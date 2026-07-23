from pathlib import Path
from shutil import copyfile

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A3
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[1]
SOURCE_MARKER = ROOT / "tmp" / "pdfs" / "hiro.png"
OUTPUT = ROOT / "output" / "pdf" / "changgate-portal-marker-a3.pdf"
PUBLIC_OUTPUT = ROOT / "public" / "print" / "changgate-portal-marker-a3.pdf"


def top_y(page_height, top_mm, height_mm=0):
    return page_height - (top_mm + height_mm) * mm


def main():
    if not SOURCE_MARKER.exists():
        raise FileNotFoundError(f"Missing marker image: {SOURCE_MARKER}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    width, height = A3
    pdf = canvas.Canvas(str(OUTPUT), pagesize=A3)
    pdf.setTitle("Chang Gate portal marker - A3 actual size")
    pdf.setAuthor("Chang Gate AR prototype")

    page_width_mm = width / mm
    marker_size_mm = 80
    marker_left_mm = (page_width_mm - marker_size_mm) / 2
    marker_top_mm = 10

    cut_width_mm = 200
    cut_height_mm = 260
    cut_left_mm = (page_width_mm - cut_width_mm) / 2
    cut_top_mm = 105

    pdf.setFillColor(HexColor("#FFFFFF"))
    pdf.rect(0, 0, width, height, stroke=0, fill=1)

    pdf.setFillColor(HexColor("#111111"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(12 * mm, top_y(height, 11), "A3 - PRINT AT 100% / ACTUAL SIZE")
    pdf.setFont("Helvetica", 8)
    pdf.drawRightString(width - 12 * mm, top_y(height, 11), "DO NOT FIT TO PAGE")

    marker = ImageReader(str(SOURCE_MARKER))
    pdf.drawImage(
        marker,
        marker_left_mm * mm,
        top_y(height, marker_top_mm, marker_size_mm),
        marker_size_mm * mm,
        marker_size_mm * mm,
        preserveAspectRatio=True,
        mask="auto",
    )

    pdf.setStrokeColor(HexColor("#E13A52"))
    pdf.setLineWidth(0.45 * mm)
    pdf.setDash(3 * mm, 2 * mm)
    cut_bottom = top_y(height, cut_top_mm, cut_height_mm)
    pdf.rect(
        cut_left_mm * mm,
        cut_bottom,
        cut_width_mm * mm,
        cut_height_mm * mm,
        stroke=1,
        fill=0,
    )
    pdf.setDash()

    label_bg = Color(1, 1, 1, alpha=0.92)
    pdf.setFillColor(label_bg)
    pdf.roundRect(
        (cut_left_mm + 35) * mm,
        cut_bottom + (cut_height_mm / 2 - 8) * mm,
        130 * mm,
        16 * mm,
        3 * mm,
        stroke=0,
        fill=1,
    )
    pdf.setFillColor(HexColor("#C5203C"))
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawCentredString(
        width / 2,
        cut_bottom + (cut_height_mm / 2 - 1.5) * mm,
        "CUT OUT 20 x 26 cm",
    )

    pdf.setFillColor(HexColor("#222222"))
    pdf.setFont("Helvetica", 8)
    pdf.drawCentredString(width / 2, cut_bottom - 7 * mm, "Window opening - keep the red dashed edge accurate")

    # 100 mm verification ruler.
    ruler_x = 18 * mm
    ruler_y = 16 * mm
    pdf.setStrokeColor(HexColor("#111111"))
    pdf.setLineWidth(0.4 * mm)
    pdf.line(ruler_x, ruler_y, ruler_x + 100 * mm, ruler_y)
    pdf.line(ruler_x, ruler_y - 2 * mm, ruler_x, ruler_y + 2 * mm)
    pdf.line(ruler_x + 100 * mm, ruler_y - 2 * mm, ruler_x + 100 * mm, ruler_y + 2 * mm)
    for index in range(1, 10):
        x = ruler_x + index * 10 * mm
        tick = 2 * mm if index == 5 else 1.2 * mm
        pdf.line(x, ruler_y - tick, x, ruler_y + tick)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(ruler_x, ruler_y + 4 * mm, "CONTROL LINE: EXACTLY 100 mm")

    pdf.setFillColor(HexColor("#5A5A5A"))
    pdf.setFont("Helvetica", 7)
    pdf.drawRightString(
        width - 12 * mm,
        12 * mm,
        "Marker: 80 mm. Marker-center to opening-center: 185 mm.",
    )

    pdf.showPage()
    pdf.save()
    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    copyfile(OUTPUT, PUBLIC_OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
