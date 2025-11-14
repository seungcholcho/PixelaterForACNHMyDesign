import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import "./App.css";

// 백엔드 주소 - .env에 VITE_API_BASE_URL이 있으면 그걸 쓰고, 없으면 localhost:8000 사용
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [previewUrl, resultUrl]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setError(null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);

    if (selected) {
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
      setResultUrl(null);
    }
  };

  const handleTransformClick = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setResultUrl(null);

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
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;