from pathlib import Path
from shutil import copyfile

from PIL import Image, ImageDraw
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A3
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
TARGET_IMAGE = ROOT / "public" / "markers" / "changgate-window-frame.png"
OUTPUT = ROOT / "output" / "pdf" / "changgate-portal-marker-a3.pdf"
PUBLIC_OUTPUT = ROOT / "public" / "print" / "changgate-portal-marker-a3.pdf"

TARGET_WIDTH_MM = 240
TARGET_HEIGHT_MM = 300
OPENING_WIDTH_MM = 200
OPENING_HEIGHT_MM = 260
OPENING_LEFT_MM = 20
OPENING_TOP_MM = 20
PIXELS_PER_MM = 6


def _px(mm_value):
    return round(mm_value * PIXELS_PER_MM)


def _rect(draw, box_mm, fill, outline=None, width_mm=0):
    box = tuple(_px(value) for value in box_mm)
    draw.rectangle(box, fill=fill, outline=outline, width=max(1, _px(width_mm)) if outline else 1)


def _polygon(draw, points_mm, fill):
    draw.polygon([(_px(x), _px(y)) for x, y in points_mm], fill=fill)


def _line(draw, points_mm, fill, width_mm):
    draw.line([(_px(x), _px(y)) for x, y in points_mm], fill=fill, width=max(1, _px(width_mm)), joint="curve")


def create_target_image():
    width = _px(TARGET_WIDTH_MM)
    height = _px(TARGET_HEIGHT_MM)
    cream = "#F3E4C4"
    dark = "#241B18"
    brown = "#5C3026"
    gold = "#D7A83E"
    teal = "#1E6263"
    red = "#A93336"

    image = Image.new("RGB", (width, height), cream)
    draw = ImageDraw.Draw(image)

    # One-centimetre frame immediately around the 20 x 26 cm opening.
    _rect(draw, (10, 10, 230, 20), dark)
    _rect(draw, (10, 280, 230, 290), brown)
    _rect(draw, (10, 20, 20, 280), teal)
    _rect(draw, (220, 20, 230, 280), red)

    # Non-repeating edge texture. Each side has a different rhythm so the
    # target cannot be mistaken for its 90/180-degree rotations.
    top_segments = [8, 14, 11, 19, 9, 16, 12, 21, 10, 17, 13, 15, 18]
    cursor = 11
    for index, length in enumerate(top_segments):
        end = min(229, cursor + length)
        color = gold if index % 3 == 0 else (cream if index % 3 == 1 else teal)
        _polygon(draw, [(cursor, 11), (end, 11), (end - 3, 19), (cursor + 2, 19)], color)
        cursor = end + 2

    bottom_segments = [17, 9, 22, 12, 15, 8, 19, 11, 23, 10, 14, 18]
    cursor = 11
    for index, length in enumerate(bottom_segments):
        end = min(229, cursor + length)
        color = teal if index % 3 == 0 else (gold if index % 3 == 1 else cream)
        _rect(draw, (cursor, 281, end, 289), color)
        if index % 2 == 0:
            _line(draw, [(cursor + 2, 288), (end - 2, 282)], dark, 0.8)
        cursor = end + 2

    left_segments = [13, 21, 9, 17, 12, 24, 10, 15, 19, 8, 22, 11, 16]
    cursor = 21
    for index, length in enumerate(left_segments):
        end = min(279, cursor + length)
        color = cream if index % 3 == 0 else (gold if index % 3 == 1 else brown)
        _polygon(draw, [(11, cursor), (19, cursor + 2), (19, end), (11, end - 3)], color)
        cursor = end + 2

    right_segments = [20, 8, 15, 23, 11, 18, 9, 25, 12, 16, 21, 10]
    cursor = 21
    for index, length in enumerate(right_segments):
        end = min(279, cursor + length)
        color = gold if index % 3 == 0 else (teal if index % 3 == 1 else cream)
        _rect(draw, (221, cursor, 229, end), color)
        if index % 2:
            _line(draw, [(222, cursor + 2), (228, end - 2)], dark, 0.8)
        cursor = end + 2

    # Four 3 x 3 cm asymmetric corner flowers. The opening mask below removes
    # their inner quarter, leaving an L-shaped ornament around each corner.
    corners = {
        "tl": (0, 0, 30, 30),
        "tr": (210, 0, 240, 30),
        "bl": (0, 270, 30, 300),
        "br": (210, 270, 240, 300),
    }
    for box in corners.values():
        _rect(draw, box, dark)

    # Top-left: concentric square and offset dot.
    _rect(draw, (3, 3, 26, 26), gold)
    _rect(draw, (7, 7, 23, 23), teal)
    _rect(draw, (11, 11, 20, 20), cream)
    draw.ellipse((_px(4), _px(19), _px(10), _px(25)), fill=brown)

    # Top-right: diagonal fan.
    _polygon(draw, [(212, 2), (238, 2), (238, 8)], gold)
    _polygon(draw, [(212, 5), (238, 12), (238, 18)], teal)
    _polygon(draw, [(212, 12), (238, 21), (238, 28), (228, 28)], cream)
    _line(draw, [(214, 27), (236, 4)], brown, 2)

    # Bottom-left: stepped key pattern.
    _rect(draw, (2, 272, 28, 298), teal)
    _line(draw, [(5, 294), (5, 276), (13, 276), (13, 288), (21, 288), (21, 280), (27, 280)], gold, 3)
    _rect(draw, (8, 291, 14, 297), cream)

    # Bottom-right: asymmetric rays.
    _rect(draw, (212, 272, 238, 298), brown)
    for end_x, end_y, color in [
        (237, 274, gold),
        (237, 283, teal),
        (232, 297, cream),
        (220, 297, gold),
    ]:
        _polygon(draw, [(213, 273), (end_x, end_y), (214, 281)], color)
    draw.ellipse((_px(214), _px(273), _px(222), _px(281)), fill=dark)

    # The physical centre is cut out. Keeping it featureless in the reference
    # image ensures the compiler extracts features only from the printed frame.
    _rect(
        draw,
        (
            OPENING_LEFT_MM,
            OPENING_TOP_MM,
            OPENING_LEFT_MM + OPENING_WIDTH_MM,
            OPENING_TOP_MM + OPENING_HEIGHT_MM,
        ),
        "#FFFFFF",
    )

    TARGET_IMAGE.parent.mkdir(parents=True, exist_ok=True)
    image.save(TARGET_IMAGE, format="PNG", dpi=(300, 300), optimize=True)
    return image


def top_y(page_height, top_mm, height_mm=0):
    return page_height - (top_mm + height_mm) * mm


def create_pdf():
    image = create_target_image()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    width, height = A3
    pdf = canvas.Canvas(str(OUTPUT), pagesize=A3)
    pdf.setTitle("Chang Gate patterned portal target - A3 actual size")
    pdf.setAuthor("Chang Gate AR prototype")

    target_left_mm = (width / mm - TARGET_WIDTH_MM) / 2
    target_top_mm = 48
    pdf.setFillColor(HexColor("#FFFFFF"))
    pdf.rect(0, 0, width, height, stroke=0, fill=1)

    pdf.setFillColor(HexColor("#111111"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(12 * mm, top_y(height, 11), "A3 - PRINT AT 100% / ACTUAL SIZE")
    pdf.setFont("Helvetica", 8)
    pdf.drawRightString(width - 12 * mm, top_y(height, 11), "DO NOT FIT TO PAGE")
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawCentredString(width / 2, top_y(height, 28), "1 cm PATTERN FRAME + FOUR 3 cm CORNER TARGETS")

    pdf.drawImage(
        ImageReader(image),
        target_left_mm * mm,
        top_y(height, target_top_mm, TARGET_HEIGHT_MM),
        TARGET_WIDTH_MM * mm,
        TARGET_HEIGHT_MM * mm,
        preserveAspectRatio=True,
        mask="auto",
    )

    cut_left_mm = target_left_mm + OPENING_LEFT_MM
    cut_top_mm = target_top_mm + OPENING_TOP_MM
    cut_bottom = top_y(height, cut_top_mm, OPENING_HEIGHT_MM)
    pdf.setStrokeColor(HexColor("#EA3555"))
    pdf.setLineWidth(0.35 * mm)
    pdf.setDash(2.5 * mm, 1.5 * mm)
    # Draw the cutting line 0.7 mm inside the removed area so none of the
    # tracking texture is accidentally trimmed away.
    inset = 0.7
    pdf.rect(
        (cut_left_mm + inset) * mm,
        cut_bottom + inset * mm,
        (OPENING_WIDTH_MM - inset * 2) * mm,
        (OPENING_HEIGHT_MM - inset * 2) * mm,
        stroke=1,
        fill=0,
    )
    pdf.setDash()
    pdf.setFillColor(HexColor("#C5203C"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawCentredString(width / 2, cut_bottom + OPENING_HEIGHT_MM / 2 * mm, "CUT OUT 20 x 26 cm")

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
    pdf.drawRightString(width - 12 * mm, 12 * mm, "Target outer size: 24 x 30 cm. Opening: 20 x 26 cm.")

    pdf.showPage()
    pdf.save()
    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    copyfile(OUTPUT, PUBLIC_OUTPUT)
    print(TARGET_IMAGE)
    print(OUTPUT)


if __name__ == "__main__":
    create_pdf()
