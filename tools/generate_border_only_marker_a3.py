"""Create an A3, actual-size cutting sheet for the border-only AR target."""

from pathlib import Path
from shutil import copyfile

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A3
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "markers" / "changgate-window-frame-border-only.png"
OUTPUT = ROOT / "output" / "pdf" / "changgate-portal-marker-border-only-a3.pdf"
PUBLIC_OUTPUT = ROOT / "public" / "print" / "changgate-portal-marker-border-only-a3.pdf"

TARGET_WIDTH_MM = 260
TARGET_HEIGHT_MM = 320
OPENING_WIDTH_MM = 200
OPENING_HEIGHT_MM = 260
FRAME_WIDTH_MM = 30


def top_y(page_height, top_mm, height_mm=0):
    return page_height - (top_mm + height_mm) * mm


def draw_corner_marks(pdf, left_mm, top_mm, width_mm, height_mm, page_height):
    """Draw crop marks outside the finished outer rectangle."""
    gap = 1.5
    length = 5
    right_mm = left_mm + width_mm
    bottom_y = top_y(page_height, top_mm, height_mm)
    top_line_y = top_y(page_height, top_mm)

    pdf.setStrokeColor(HexColor("#222222"))
    pdf.setLineWidth(0.2 * mm)
    for x_mm in (left_mm, right_mm):
        pdf.line(x_mm * mm, top_line_y + gap * mm, x_mm * mm, top_line_y + (gap + length) * mm)
        pdf.line(x_mm * mm, bottom_y - gap * mm, x_mm * mm, bottom_y - (gap + length) * mm)
    for y in (top_line_y, bottom_y):
        pdf.line((left_mm - gap) * mm, y, (left_mm - gap - length) * mm, y)
        pdf.line((right_mm + gap) * mm, y, (right_mm + gap + length) * mm, y)


def create_pdf():
    if not SOURCE.exists():
        raise FileNotFoundError(
            f"Missing {SOURCE}. Run: python tools/generate_marker_test_variants.py"
        )

    source = Image.open(SOURCE).convert("RGBA")
    if source.size != (2600, 3200):
        raise ValueError(f"Expected source size 2600x3200, got {source.size}")
    if source.getpixel((1300, 1600))[3] != 0:
        raise ValueError("The marker opening is not transparent")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    page_width, page_height = A3
    pdf = canvas.Canvas(str(OUTPUT), pagesize=A3, pageCompression=1)
    pdf.setTitle("Chang Gate border-only AR marker - A3 actual size")
    pdf.setAuthor("Chang Gate AR prototype")

    target_left_mm = (page_width / mm - TARGET_WIDTH_MM) / 2
    target_top_mm = 46
    target_bottom = top_y(page_height, target_top_mm, TARGET_HEIGHT_MM)

    pdf.setFillColor(HexColor("#FFFFFF"))
    pdf.rect(0, 0, page_width, page_height, stroke=0, fill=1)

    pdf.setFillColor(HexColor("#111111"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(12 * mm, top_y(page_height, 11), "A3 - PRINT AT 100% / ACTUAL SIZE")
    pdf.setFont("Helvetica", 8)
    pdf.drawRightString(page_width - 12 * mm, top_y(page_height, 11), "DO NOT SCALE OR FIT TO PAGE")
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawCentredString(page_width / 2, top_y(page_height, 28), "CUT-OUT AR FRAME - OUTER 260 x 320 mm")

    pdf.drawImage(
        ImageReader(source),
        target_left_mm * mm,
        target_bottom,
        TARGET_WIDTH_MM * mm,
        TARGET_HEIGHT_MM * mm,
        preserveAspectRatio=True,
        mask="auto",
    )

    draw_corner_marks(
        pdf,
        target_left_mm,
        target_top_mm,
        TARGET_WIDTH_MM,
        TARGET_HEIGHT_MM,
        page_height,
    )

    # The centre of this thin line is the exact 200 x 260 mm opening.
    opening_left_mm = target_left_mm + FRAME_WIDTH_MM
    opening_top_mm = target_top_mm + FRAME_WIDTH_MM
    opening_bottom = top_y(page_height, opening_top_mm, OPENING_HEIGHT_MM)
    pdf.setStrokeColor(HexColor("#D22445"))
    pdf.setLineWidth(0.18 * mm)
    pdf.rect(
        opening_left_mm * mm,
        opening_bottom,
        OPENING_WIDTH_MM * mm,
        OPENING_HEIGHT_MM * mm,
        stroke=1,
        fill=0,
    )

    pdf.setFillColor(HexColor("#B51F39"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawCentredString(page_width / 2, opening_bottom + OPENING_HEIGHT_MM / 2 * mm, "CUT OUT 200 x 260 mm")
    pdf.setFont("Helvetica", 8)
    pdf.drawCentredString(page_width / 2, opening_bottom + OPENING_HEIGHT_MM / 2 * mm - 5 * mm, "Cut through the centre of the thin red guide")

    ruler_x = 18 * mm
    ruler_y = 16 * mm
    pdf.setStrokeColor(HexColor("#111111"))
    pdf.setLineWidth(0.35 * mm)
    pdf.line(ruler_x, ruler_y, ruler_x + 100 * mm, ruler_y)
    pdf.line(ruler_x, ruler_y - 2 * mm, ruler_x, ruler_y + 2 * mm)
    pdf.line(ruler_x + 100 * mm, ruler_y - 2 * mm, ruler_x + 100 * mm, ruler_y + 2 * mm)
    for index in range(1, 10):
        x = ruler_x + index * 10 * mm
        tick = 2 * mm if index == 5 else 1.2 * mm
        pdf.line(x, ruler_y - tick, x, ruler_y + tick)
    pdf.setFillColor(HexColor("#111111"))
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(ruler_x, ruler_y + 4 * mm, "CONTROL LINE: EXACTLY 100 mm")

    pdf.setFillColor(HexColor("#555555"))
    pdf.setFont("Helvetica", 7)
    pdf.drawRightString(
        page_width - 12 * mm,
        12 * mm,
        "Outer: 260 x 320 mm | Opening: 200 x 260 mm | Frame: 30 mm",
    )

    pdf.showPage()
    pdf.save()
    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    copyfile(OUTPUT, PUBLIC_OUTPUT)
    print(OUTPUT)
    print(PUBLIC_OUTPUT)


if __name__ == "__main__":
    create_pdf()
