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

TARGET_WIDTH_MM = 260
TARGET_HEIGHT_MM = 320
OPENING_WIDTH_MM = 200
OPENING_HEIGHT_MM = 260
OPENING_LEFT_MM = 30
OPENING_TOP_MM = 30
PIXELS_PER_MM = 10


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

    # The whole three-centimetre frame is high-contrast target material. Each
    # side uses a different irregular rhythm and symbol sequence so that it
    # remains distinctive after camera downscaling and perspective distortion.
    top_segments = [14, 21, 17, 26, 12, 23, 18, 29, 15, 25]
    bottom_segments = [19, 13, 27, 16, 22, 31, 14, 24, 18, 16]
    left_segments = [17, 24, 13, 29, 19, 31, 16, 26, 22, 28, 15, 20]
    right_segments = [23, 14, 28, 17, 32, 19, 25, 12, 30, 21, 16, 23]

    horizontal_palettes = [
        [gold, cream, teal, red, cream, brown, gold, teal, cream, red],
        [teal, gold, cream, brown, gold, red, cream, teal, brown, gold],
    ]
    for side_index, (top, segments, palette) in enumerate(
        [
            (0, top_segments, horizontal_palettes[0]),
            (290, bottom_segments, horizontal_palettes[1]),
        ]
    ):
        cursor = 30
        for index, (length, color) in enumerate(zip(segments, palette)):
            end = cursor + length
            _rect(draw, (cursor, top, end, top + 30), color, dark, 0.8)
            symbol = cream if color in (teal, red, brown) else dark
            if (index + side_index) % 4 == 0:
                _line(draw, [(cursor + 3, top + 25), (end - 3, top + 5)], symbol, 1.2)
            elif (index + side_index) % 4 == 1:
                _line(draw, [(cursor + 3, top + 5), (end - 3, top + 25)], symbol, 1)
                _line(draw, [(cursor + 3, top + 25), (end - 3, top + 5)], symbol, 1)
            elif (index + side_index) % 4 == 2:
                radius = min(6, length / 4)
                centre_x = (cursor + end) / 2
                draw.ellipse(
                    (
                        _px(centre_x - radius),
                        _px(top + 15 - radius),
                        _px(centre_x + radius),
                        _px(top + 15 + radius),
                    ),
                    fill=symbol,
                )
                draw.ellipse(
                    (
                        _px(centre_x - radius / 2),
                        _px(top + 15 - radius / 2),
                        _px(centre_x + radius / 2),
                        _px(top + 15 + radius / 2),
                    ),
                    fill=color,
                )
            else:
                _rect(draw, (cursor + 3, top + 5, end - 3, top + 25), None, symbol, 1.2)
            cursor = end

    vertical_palettes = [
        [cream, teal, gold, brown, cream, red, gold, teal, cream, brown, gold, teal],
        [gold, red, cream, teal, brown, gold, cream, red, teal, gold, brown, cream],
    ]
    for side_index, (left, segments, palette) in enumerate(
        [
            (0, left_segments, vertical_palettes[0]),
            (230, right_segments, vertical_palettes[1]),
        ]
    ):
        cursor = 30
        for index, (length, color) in enumerate(zip(segments, palette)):
            end = cursor + length
            _rect(draw, (left, cursor, left + 30, end), color, dark, 0.8)
            symbol = cream if color in (teal, red, brown) else dark
            if (index + side_index * 2) % 4 == 0:
                _line(draw, [(left + 5, cursor + 3), (left + 25, end - 3)], symbol, 1.2)
            elif (index + side_index * 2) % 4 == 1:
                _line(draw, [(left + 25, cursor + 3), (left + 5, end - 3)], symbol, 1)
                _line(draw, [(left + 5, cursor + 3), (left + 25, end - 3)], symbol, 1)
            elif (index + side_index * 2) % 4 == 2:
                radius = min(6, length / 4)
                centre_y = (cursor + end) / 2
                draw.ellipse(
                    (
                        _px(left + 15 - radius),
                        _px(centre_y - radius),
                        _px(left + 15 + radius),
                        _px(centre_y + radius),
                    ),
                    fill=symbol,
                )
                draw.ellipse(
                    (
                        _px(left + 15 - radius / 2),
                        _px(centre_y - radius / 2),
                        _px(left + 15 + radius / 2),
                        _px(centre_y + radius / 2),
                    ),
                    fill=color,
                )
            else:
                _rect(draw, (left + 5, cursor + 3, left + 25, end - 3), None, symbol, 1.2)
            cursor = end

    # Four fully different 3 x 3 cm corner motifs anchor orientation.
    for box in [(0, 0, 30, 30), (230, 0, 260, 30), (0, 290, 30, 320), (230, 290, 260, 320)]:
        _rect(draw, box, dark)

    # Top-left: concentric square and offset dot.
    _rect(draw, (3, 3, 26, 26), gold)
    _rect(draw, (7, 7, 23, 23), teal)
    _rect(draw, (11, 11, 20, 20), cream)
    draw.ellipse((_px(4), _px(19), _px(10), _px(25)), fill=brown)

    # Top-right: diagonal fan.
    _polygon(draw, [(232, 2), (258, 2), (258, 8)], gold)
    _polygon(draw, [(232, 5), (258, 12), (258, 18)], teal)
    _polygon(draw, [(232, 12), (258, 21), (258, 28), (248, 28)], cream)
    _line(draw, [(234, 27), (256, 4)], brown, 2)

    # Bottom-left: stepped key pattern.
    _rect(draw, (2, 292, 28, 318), teal)
    _line(draw, [(5, 314), (5, 296), (13, 296), (13, 308), (21, 308), (21, 300), (27, 300)], gold, 3)
    _rect(draw, (8, 311, 14, 317), cream)

    # Bottom-right: asymmetric rays.
    _rect(draw, (232, 292, 258, 318), brown)
    for end_x, end_y, color in [
        (257, 294, gold),
        (257, 303, teal),
        (252, 317, cream),
        (240, 317, gold),
    ]:
        _polygon(draw, [(233, 293), (end_x, end_y), (234, 301)], color)
    draw.ellipse((_px(234), _px(293), _px(242), _px(301)), fill=dark)

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
    _rect(draw, (0, 0, TARGET_WIDTH_MM, TARGET_HEIGHT_MM), None, dark, 1.2)
    _rect(draw, (28.5, 28.5, 231.5, 291.5), None, dark, 1.5)

    TARGET_IMAGE.parent.mkdir(parents=True, exist_ok=True)
    image.save(
        TARGET_IMAGE,
        format="PNG",
        dpi=(PIXELS_PER_MM * 25.4, PIXELS_PER_MM * 25.4),
        optimize=True,
    )
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
    pdf.drawCentredString(width / 2, top_y(height, 28), "FULL 3 cm HIGH-CONTRAST PATTERN FRAME")

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
    # The centreline of this cutting guide is the exact 20 x 26 cm opening.
    # Print at 100% and cut through the middle of the dashed stroke.
    inset = 0
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
    pdf.drawRightString(width - 12 * mm, 12 * mm, "Target outer size: 26 x 32 cm. Opening: 20 x 26 cm.")

    pdf.showPage()
    pdf.save()
    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    copyfile(OUTPUT, PUBLIC_OUTPUT)
    print(TARGET_IMAGE)
    print(OUTPUT)


if __name__ == "__main__":
    create_pdf()
