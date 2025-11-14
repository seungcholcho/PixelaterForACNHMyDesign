from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from PALETTE import PALETTE

import io
import base64

# ----- 기존 함수들 그대로 -----

def pixelate_image(img: Image.Image, output_w: int, output_h: int, filter: str):
    if filter == "nearest":
        output = img.resize((output_w, output_h), Image.Resampling.NEAREST)
    elif filter == "box":
        output = img.resize((output_w, output_h), Image.Resampling.BOX)
    elif filter == "bilinear":
        output = img.resize((output_w, output_h), Image.Resampling.BILINEAR)
    elif filter == "hamming":
        output = img.resize((output_w, output_h), Image.Resampling.HAMMING)
    elif filter == "bicubic":
        output = img.resize((output_w, output_h), Image.Resampling.BICUBIC)
    elif filter == "lanczos":
        output = img.resize((output_w, output_h), Image.Resampling.LANCZOS)
    else:
        # 잘못된 필터 값이면 기본 NEAREST 사용
        output = img.resize((output_w, output_h), Image.Resampling.NEAREST)
    return output

def quantize_colors(img: Image.Image, n: int):
    q = img.quantize(colors=n, method=1)
    return q.convert("RGB")

def nearest_color(rgb, palette):
    r, g, b = rgb
    best = None
    best_dist = None
    
    for pr, pg, pb in palette:
        dr = r - pr
        dg = g - pg
        db = b - pb
        dist = dr*dr + dg*dg + db*db
        
        if best_dist is None or dist < best_dist:
            best_dist = dist
            best = (pr, pg, pb)
    return best

def apply_palette(img: Image.Image, palette):
    img = img.convert("RGB")
    w, h = img.size
    out = Image.new("RGB", (w, h))
    pix_in = img.load()
    pix_out = out.load()
    for y in range(h):
        for x in range(w):
            pix_out[x, y] = nearest_color(pix_in[x, y], palette)
    return out

def pad_to_square(img: Image.Image, pad_color=(0, 0, 0, 0)):
    img = img.convert("RGBA")
    w, h = img.size
    max_side = max(w, h)

    # 패딩을 추가한 정방형 캔버스 생성
    new_img = Image.new("RGBA", (max_side, max_side), pad_color)

    # 중앙에 배치
    left = (max_side - w) // 2
    top = (max_side - h) // 2
    new_img.paste(img, (left, top))

    return new_img
# ----- 여기가 FastAPI 부분 -----

app = FastAPI()

# CORS - 로컬 개발용 (추후 필요에 따라 origin 제한 가능)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 나중에 "https://내프론트도메인" 으로 좁히면 더 안전
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def run_pipeline(
    img: Image.Image,
    pixel_size: int = 32,
    resample: str = "nearest",
) -> Image.Image:
    """
    기존 __main__에서 하던 파이프라인:
      - 128색 퀀타이즈
      - 32x32 픽셀화 (output_w, output_h)
      - 16색 퀀타이즈
      - 동숲 PALETTE에 스냅
      - 512x512로 NEAREST 업스케일
    """
    # 1 - 128색 퀀타이즈
    img_q = quantize_colors(img, 128)

    # 2 - 픽셀화 (pixel_size x pixel_size)
    small = pixelate_image(img_q, pixel_size, pixel_size, resample)

    # 3 - 16색 퀀타이즈
    small_q = quantize_colors(small, 15)

    # 4 - 동숲 팔레트에 스냅
    snapped = apply_palette(small_q, PALETTE)

    # 5 - 보기 좋게 512x512로 업스케일 (nearest)
    out = snapped.resize((512, 512), Image.Resampling.NEAREST)

    return out

@app.post("/api/process")
async def api_process(
    file: UploadFile = File(...),
    pixel_size: int = Form(32),
    resample: str = Form("nearest"),
):
    """
    - file: 업로드된 이미지 파일
    - pixel_size: 최종 도트 크기 (예: 32 → 32x32)
    - resample: "nearest", "box", "bilinear" 등
    응답: {"image": "<png base64 string>"}
    """
    # 업로드된 파일을 Pillow Image로 로드
    try:
        img = Image.open(file.file).convert("RGB")
    except UnidentifiedImageError:
        return {"error": "Invalid image file. Upload PNG/JPG/WEBP/GIF."}

    # 파이프라인 실행
    result_img = run_pipeline(img, pixel_size=pixel_size, resample=resample)

    # 결과를 PNG 바이너리로 변환
    buf = io.BytesIO()
    result_img.save(buf, format="PNG")
    buf.seek(0)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return {"image": b64}
