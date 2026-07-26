"""Generate deterministic camera stimuli for the Chang Gate MindAR target.

These files are deliberately *not* compiled as new MindAR targets. They are
displayed to the camera to determine which parts of the existing target matter.
"""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "markers" / "changgate-window-frame.png"
OUTPUT = ROOT / "public" / "markers" / "tests"

# Coordinates come from generate_portal_marker_pdf.py (10 px per millimetre).
OPENING = (300, 300, 2300, 2900)
INNER_SAFE = (340, 340, 2260, 2860)


def checkerboard(size, cell=80, colors=("#151515", "#f4f4f4")):
    image = Image.new("RGB", size, colors[0])
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=colors[1])
    return image


def save_variant(source, filename, fill):
    result = source.copy()
    if isinstance(fill, Image.Image):
        result.paste(fill.resize((INNER_SAFE[2] - INNER_SAFE[0], INNER_SAFE[3] - INNER_SAFE[1])), INNER_SAFE[:2])
    else:
        ImageDraw.Draw(result).rectangle(INNER_SAFE, fill=fill)
    result.save(OUTPUT / filename, optimize=True)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")

    # Keep a thin white inset so these variants alter the blank field without
    # changing the frame/white boundary.
    save_variant(source, "inside-gray.png", "#777777")
    save_variant(source, "inside-checker.png", checkerboard((1920, 2520)))

    # Unlike the two variants above, this reaches the opening edge and removes
    # the white field/inner-outline contrast as well as the white field itself.
    inside_black = source.copy()
    ImageDraw.Draw(inside_black).rectangle(OPENING, fill="#111111")
    inside_black.save(OUTPUT / "inside-black-to-edge.png", optimize=True)

    # Human-facing source for the ROI compiler and physical cut-out workflows.
    # Alpha is presentation-only; the custom compiler's ROI filtering is what
    # guarantees that the opening contributes no matching/tracking features.
    transparent = source.convert("RGBA")
    transparent.paste((0, 0, 0, 0), OPENING)
    transparent.save(OUTPUT.parent / "changgate-window-frame-border-only.png", optimize=True)

    # Negative control: retain a plain white rectangle but remove every piece
    # of the patterned frame. This should never acquire the target.
    negative = Image.new("RGB", source.size, "#ffffff")
    ImageDraw.Draw(negative).rectangle(OPENING, fill="#ffffff")
    negative.save(OUTPUT / "frame-hidden-control.png", optimize=True)

    # Contact sheet is for quick inspection only, not a tracking stimulus.
    preview_width = 390
    preview_height = 480
    samples = [
        ("BASELINE", source),
        ("INSIDE GRAY", Image.open(OUTPUT / "inside-gray.png")),
        ("INSIDE CHECKER", Image.open(OUTPUT / "inside-checker.png")),
        ("BLACK TO EDGE", inside_black),
        ("FRAME HIDDEN", negative),
    ]
    sheet = Image.new("RGB", (preview_width * len(samples), preview_height + 54), "#202020")
    draw = ImageDraw.Draw(sheet)
    for index, (label, sample) in enumerate(samples):
        thumb = sample.resize((preview_width, preview_height), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (index * preview_width, 54))
        draw.text((index * preview_width + 12, 18), label, fill="#ffffff")
    sheet.save(OUTPUT / "variant-contact-sheet.jpg", quality=90, optimize=True)


if __name__ == "__main__":
    main()
