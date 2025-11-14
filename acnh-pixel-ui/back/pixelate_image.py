from PIL import Image
from PALETTE import PALETTE

input_w, input_h = 0, 0
output_w, output_h = 0, 0

def pixelate_image(img: Image.Image, output_w, output_h, filter):
    input_w, input_h = img.size
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
        return "error"
    return output

def quantize_colors(img: Image.Image, n):
    q = img.quantize(colors=n, method=1)
    return q.convert("RGB")

def nearest_color(rgb, palette):
    r,g,b = rgb
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

def apply_palette(img, palette):
    img = img.convert("RGB")
    w, h = img.size
    out = Image.new("RGB", (w, h))
    pix_in = img.load()
    pix_out = out.load()
    for y in range(h):
        for x in range(w):
            pix_out[x, y] = nearest_color(pix_in[x, y], palette)
    return out
    
if __name__ == "__main__":
    input_path = "./back/image/test.jpg"

    output = Image.open(input_path).convert("RGB")
    output = quantize_colors(output,128)
    output = pixelate_image(output, 32, 32, "nearest")
    output = quantize_colors(output,16)
    output = apply_palette(output, PALETTE)
    output = output.resize((512, 512), Image.Resampling.NEAREST)
    output.save("./back/pixelated/output.png", format="PNG")
    
    print(f"저장 완료")
