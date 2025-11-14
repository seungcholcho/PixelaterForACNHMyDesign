import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import "./App.css";

// 백엔드 주소 - .env에 VITE_API_BASE_URL이 있으면 그걸 쓰고, 없으면 localhost:8000 사용
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// HEX → RGB
function hexToRGB(hex: string) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { r, g, b };
}

// RGB(0-255) → HSV (H:0-360, S:0-100, V:0-100)
function rgbToHSV(r: number, g: number, b: number) {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;

  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const d = max - min;

  let h = 0;
  let s = 0;
  const v = max;

  if (d === 0) {
    h = 0;
  } else {
    switch (max) {
      case rN:
        h = ((gN - bN) / d + (gN < bN ? 6 : 0));
        break;
      case gN:
        h = (bN - rN) / d + 2;
        break;
      case bN:
        h = (rN - gN) / d + 4;
        break;
    }
    h *= 60; // 0~360
  }

  if (max === 0) {
    s = 0;
  } else {
    s = d / max;
  }

  return {
    h: Math.round(h),        // 0~360
    s: Math.round(s * 100),  // 0~100
    v: Math.round(v * 100),  // 0~100
  };
}

// HSV → 동숲형 HSV 인덱스 (H:0-29, S:0-14, V:0-14)
function hsvToACNH(h: number, s: number, v: number) {
  // 색상: 30단계 → 12도씩 (0~359를 30등분)
  let hueIndex = Math.floor(h / 12); // 0~29 정도
  if (hueIndex >= 30) hueIndex = 29;

  // 채도/밝기: 15단계 → 약 6.666%씩
  const step = 100 / 15; // ≈ 6.666...
  let satIndex = Math.floor(s / step); // 0~14
  let valIndex = Math.floor(v / step); // 0~14

  if (satIndex > 14) satIndex = 14;
  if (valIndex > 14) valIndex = 14;
  if (satIndex < 0) satIndex = 0;
  if (valIndex < 0) valIndex = 0;

  return {
    h: hueIndex,
    s: satIndex,
    v: valIndex,
  };
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 사용된 색상(hex 문자열 리스트)
  const [usedColors, setUsedColors] = useState<string[]>([]);

  // 이미지 URL 해제
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [previewUrl, resultUrl]);

  // 파일 선택
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setError(null);
    setUsedColors([]);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);

    if (selected) {
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
      setResultUrl(null);
    }
  };

  // 변환 버튼 클릭
  const handleTransformClick = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setResultUrl(null);
    setUsedColors([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/api/process`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`서버 오류 (${res.status}): ${text}`);
      }

      const data: { image?: string; error?: string; detail?: string } =
        await res.json();

      if (!data.image) {
        const msg = data.error || (data.detail as string) || "알 수 없는 오류";
        throw new Error(msg);
      }

      const dataUrl = `data:image/png;base64,${data.image}`;
      setResultUrl(dataUrl);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "이미지 변환 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // RGB → HEX
  const rgbToHex = (r: number, g: number, b: number) => {
    return (
      "#" +
      [r, g, b]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")
    );
  };

  // 이미지에서 사용된 색상 추출
  const extractColors = (imgUrl: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imgUrl;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const colors = new Set<string>();

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 완전 투명은 제외
        if (a === 0) continue;

        const hex = rgbToHex(r, g, b);
        colors.add(hex);
      }

      // Set → 배열로 변환
      setUsedColors(Array.from(colors));
    };
  };

  // resultUrl이 바뀔 때마다 색 추출
  useEffect(() => {
    if (resultUrl) {
      extractColors(resultUrl);
    } else {
      setUsedColors([]);
    }
  }, [resultUrl]);

  // 다운로드 버튼
  const handleDownloadClick = () => {
    if (!resultUrl) return;

    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = "my_design_result.png";
    a.click();
  };

  return (
    <div className="app-root">
      <div className="app-container">
        {/* 제목 */}
        <header className="page-title">
          <h1>동물의 숲 마이 디자인 툴</h1>
          <p>이미지를 동물의 숲 마이 디자인 스타일로 변환해보세요.</p>
        </header>

        {/* 업로드 영역 (가로 전체) */}
        <section className="upload-section">
          <label className="upload-box">
            파일 업로드 (PNG / JPG / WEBP ...)
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </label>

          <div className="file-info">
            {file ? `선택된 파일: ${file.name}` : "업로드된 파일이 없습니다."}
          </div>

          <button
            className="primary-button"
            onClick={handleTransformClick}
            disabled={!previewUrl || isLoading}
          >
            {isLoading ? "변환 중..." : "변환하기"}
          </button>

          {error && <div className="error-msg">{error}</div>}
        </section>

        {/* 아래 2열 미리보기 & 결과 */}
        <section className="bottom-grid">
          <div className="card">
            <h2 className="card-title">미리보기</h2>
            <div className="preview">
              {previewUrl ? (
                <img src={previewUrl} alt="미리보기" />
              ) : (
                <span>이미지가 없습니다.</span>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">결과</h2>
            <div className="preview">
              {resultUrl ? (
                <img src={resultUrl} alt="결과" />
              ) : (
                <span>변환된 이미지가 없습니다.</span>
              )}
            </div>
            <button
              className="secondary-button"
              onClick={handleDownloadClick}
              disabled={!resultUrl}
            >
              결과 이미지 다운로드
            </button>

            {/* 사용된 색상 표시 영역 - 동숲 HSV 인덱스로 표기 */}
            {usedColors.length > 0 && (
              <div className="color-list">
                <h3>사용된 색상 ({usedColors.length}개)</h3>
                <div className="color-grid">
                  {usedColors.map((c) => {
                    const { r, g, b } = hexToRGB(c);
                    const { h, s, v } = rgbToHSV(r, g, b);
                    const acnh = hsvToACNH(h, s, v);

                    return (
                      <div key={c} className="color-item">
                        <div
                          className="color-swatch"
                          style={{ backgroundColor: c }}
                        ></div>
                        <div className="color-code">
                          H:{acnh.h} S:{acnh.s} V:{acnh.v}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
