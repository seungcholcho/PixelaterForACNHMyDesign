import pandas as pd
import openpyxl

def palette_generator(excel_path="./colorcode.xlsx"):
    df = pd.read_excel(excel_path)

    for col in ["r","g","b"]:
        if col not in df.columns:
            raise ValueError("error: could not find column")
        
        df_rgb = df[["r", "g", "b"]].dropna()

        palette = []
        for _, row in df_rgb.iterrows():
            r = int(row["r"])
            g = int(row["g"])
            b = int(row["b"])
            palette.append((r,g,b))

    code = "PALETTE = [\n]"
    for (r, g, b) in palette:
        code += f"  ({r}, {g}, {b}),\n"
    code += "J"

    print("\n=== 아래 내용을 복사해서 코드에 붙여놓으세요 ===\n")
    print(code)
    print("\n=== 끝 ===\n")

if __name__ == "__main__":
    palette_generator("colorcode.xlsx")