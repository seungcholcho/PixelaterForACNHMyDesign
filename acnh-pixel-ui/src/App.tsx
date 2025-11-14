import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import "./App.css";

// 백엔드 주소
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 사용된 색상(hex 리스트)
  const [usedColors, setUsedColors] = useState<
    { hex: string; h: number; s: number; v: number }[]
  >([]);

  // URL 메모리 해제
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

  // --- 🎨 색상 계산 로직 ----------------------------------------

  // RGB → HEX
  const rgbToHex = (r: number, g: number, b: number) =>
    "#" +
    [r, g, b]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");

  // RGB → HSV
  const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;

      h *= 60;
      if (h < 0) h += 360;
    }

    const s = max === 0 ? 0 : (d / max) * 100;
    const v = max * 100;

    return { h, s, v };
  };

  // ACNH 규격 HSV 변환 (가장 가까운 구간으로 반올림)
  const hsvToACNH = (h: number, s: number, v: number) => {
    // Hue 30단계 (12도)
    let hueIndex = Math.round(h / 12);
    if (hueIndex < 0) hueIndex = 0;
    if (hueIndex > 29) hueIndex = 29;

    // S/V 15단계 (6.666%)
    const step = 100 / 15;

    let satIndex = Math.round(s / step);
    let valIndex = Math.round(v / step);

    if (satIndex < 0) satIndex = 0;
    if (satIndex > 14) satIndex = 14;
    if (valIndex < 0) valIndex = 0;
    if (valIndex > 14) valIndex = 14;

    return { h: hueIndex, s: satIndex, v: valIndex };
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

      const colorSet = new Map<string, { h: number; s: number; v: number }>();

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a === 0) continue;

        const hex = rgbToHex(r, g, b);

        if (!colorSet.has(hex)) {
          const { h, s, v } = rgbToHsv(r, g, b);
          const ac = hsvToACNH(h, s, v);
          colorSet.set(hex, ac);
        }
      }

      setUsedColors(
        Array.from(colorSet.entries()).map(([hex, ac]) => ({
          hex,
          h: ac.h,
          s: ac.s,
          v: ac.v,
        }))
      );
    };
  };

  // resultUrl 바뀌면 색 추출
  useEffect(() => {
    if (resultUrl) extractColors(resultUrl);
  }, [resultUrl]);

  // 변환하기
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

      const data = await res.json();

      if (!data.image) {
        throw new Error(data.error || data.detail || "알 수 없는 오류");
      }

      const dataUrl = `data:image/png;base64,${data.image}`;
      setResultUrl(dataUrl);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "이미지 변환 중 오류 발생");
    } finally {
      setIsLoading(false);
    }
  };

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
        <header className="page-title">
          <h1>동물의 숲 마이 디자인 툴</h1>
          <p>이미지를 ACNH 마이 디자인 색상으로 변환합니다.</p>
        </header>

        <section className="upload-section">
          <label className="upload-box">
            파일 업로드 (PNG / JPG 등)
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

        <section className="bottom-grid">
          <div className="card">
            <h2>미리보기</h2>
            <div className="preview">
              {previewUrl ? <img src={previewUrl} /> : <span>없음</span>}
            </div>
          </div>

          <div className="card">
            <h2>결과</h2>
            <div className="preview">
              {resultUrl ? <img src={resultUrl} /> : <span>없음</span>}
            </div>

            <button
              className="secondary-button"
              onClick={handleDownloadClick}
              disabled={!resultUrl}
            >
              결과 다운로드
            </button>

            {usedColors.length > 0 && (
              <div className="color-list">
                <h3>사용된 색상 ({usedColors.length}개)</h3>
                <div className="color-grid">
                  {usedColors.map((c) => (
                    <div key={c.hex} className="color-item">
                      <div
                        className="color-swatch"
                        style={{ backgroundColor: c.hex }}
                      />
                      <div className="color-code">
                        {c.hex}
                        <br />
                        H:{c.h} S:{c.s} V:{c.v}
                      </div>
                    </div>
                  ))}
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
