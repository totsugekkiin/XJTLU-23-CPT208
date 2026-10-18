#!/usr/bin/env python3
"""Render the Chang Gate AR location figure from a clean aerial photograph.

The overlay coordinates are calibrated from the annotated field image supplied
for the CPT208 project. The PNG is presentation-ready; the SVG keeps the route,
markers, leaders, and cards editable when imported into Figma.
"""

from __future__ import annotations

import argparse
import base64
import html
import math
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


CANVAS_SIZE = (1520, 940)
PHOTO_BOX = (40, 80, 1480, 900)
CREAM = (247, 247, 243, 255)
INK = (25, 25, 24, 255)
MUTED = (90, 90, 86, 255)
WHITE = (255, 255, 255, 255)
ROUTE_RED = (227, 73, 55, 255)
BAMBOO_YELLOW = (249, 218, 42, 255)

# Figma-board coordinates, calibrated from the user's 1824 x 1039 markup.
ROUTE_POINTS = [
    (88.2, 376.7),
    (127.6, 437.5),
    (167.1, 477.8),
    (206.6, 518.8),
    (246.1, 552.0),
    (285.5, 569.3),
    (364.5, 587.5),
    (443.4, 600.9),
    (522.4, 609.6),
    (601.3, 618.2),
    (680.3, 619.0),
    (759.2, 629.3),
    (838.2, 637.2),
    (917.1, 647.4),
    (996.1, 653.8),
    (1075.0, 664.8),
    (1153.9, 671.9),
    (1208.4, 681.4),
]

ENTRANCE = (189.2, 430.4)
STAIR_ARROW_END = (145.8, 384.6)
WINDOW = (1232.3, 700.8)

# Numbering follows the project's AR_MAP_PROFILES traversal order.
BAMBOO_POINTS = [
    ("1", "Modern\nTransformation", (309.4, 512.4)),
    ("2", "Ming–Qing\nCommerce", (165.8, 499.6)),
    ("3", "Southern Song\nMap Evidence", (225.6, 568.6)),
    ("4", "Tang Dynasty\nShantang", (324.4, 613.0)),
    ("5", "Spring and Autumn\nCity Foundation", (408.7, 621.8)),
]

SITE_POLYGON = [
    (60, 320),
    (130, 370),
    (205, 425),
    (300, 485),
    (475, 530),
    (760, 570),
    (970, 600),
    (970, 330),
    (1440, 330),
    (1440, 880),
    (94, 880),
]

CALLOUTS = [
    {
        "point": "2",
        "box": (60, 170, 235, 236),
        "label": "2) Ming–Qing\nCommerce",
        "leader": [(148, 236), (148, 458), (165.8, 458), (165.8, 499.6)],
    },
    {
        "point": "3",
        "box": (315, 115, 505, 181),
        "label": "3) Southern Song\nMap Evidence",
        "leader": [(410, 181), (410, 525), (225.6, 525), (225.6, 568.6)],
    },
    {
        "point": "1",
        "box": (575, 185, 755, 251),
        "label": "1) Modern\nTransformation",
        "leader": [(665, 251), (665, 466), (309.4, 466), (309.4, 512.4)],
    },
    {
        "point": "4",
        "box": (825, 115, 995, 181),
        "label": "4) Tang Dynasty\nShantang",
        "leader": [(910, 181), (910, 556), (324.4, 556), (324.4, 613.0)],
    },
    {
        "point": "5",
        "box": (1060, 185, 1270, 251),
        "label": "5) Spring and Autumn\nCity Foundation",
        "leader": [(1165, 251), (1165, 578), (408.7, 578), (408.7, 621.8)],
    },
]


def load_variable_font(path: Path, size: int, weight: int) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(path), size=size)
    try:
        font.set_variation_by_axes([weight])
    except (AttributeError, OSError, ValueError):
        pass
    return font


def rounded_shadow(canvas: Image.Image, box: tuple[float, float, float, float], radius: int = 10) -> None:
    x0, y0, x1, y1 = map(int, box)
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((x0, y0 + 4, x1, y1 + 4), radius=radius, fill=(0, 0, 0, 68))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(9)))


def draw_centered_lines(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    spacing: int = 3,
) -> None:
    x0, y0, x1, y1 = box
    bbox = draw.multiline_textbbox((0, 0), text, font=font, spacing=spacing, align="center")
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    x = (x0 + x1 - width) / 2
    y = (y0 + y1 - height) / 2 - bbox[1]
    draw.multiline_text((x, y), text, font=font, fill=fill, spacing=spacing, align="center")


def draw_card(
    canvas: Image.Image,
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    label: str,
    font: ImageFont.FreeTypeFont,
    radius: int = 10,
) -> None:
    rounded_shadow(canvas, box, radius)
    draw.rounded_rectangle(box, radius=radius, fill=WHITE)
    draw_centered_lines(draw, box, label, font, INK)


def draw_dashed_segment(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    fill: tuple[int, int, int, int],
    width: int,
    dash: float,
    gap: float,
) -> None:
    x0, y0 = start
    x1, y1 = end
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    if length == 0:
        return
    ux, uy = dx / length, dy / length
    pos = 0.0
    while pos < length:
        stop = min(pos + dash, length)
        draw.line((x0 + ux * pos, y0 + uy * pos, x0 + ux * stop, y0 + uy * stop), fill=fill, width=width)
        pos += dash + gap


def draw_dashed_polyline(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[float, float]],
    fill: tuple[int, int, int, int],
    width: int = 3,
    dash: int = 13,
    gap: int = 10,
    closed: bool = False,
) -> None:
    pairs = list(zip(points, points[1:]))
    if closed:
        pairs.append((points[-1], points[0]))
    for start, end in pairs:
        draw_dashed_segment(draw, start, end, fill, width, dash, gap)


def draw_arrowhead(
    draw: ImageDraw.ImageDraw,
    previous: tuple[float, float],
    tip: tuple[float, float],
    fill: tuple[int, int, int, int],
    size: float = 14,
) -> None:
    dx, dy = tip[0] - previous[0], tip[1] - previous[1]
    length = math.hypot(dx, dy) or 1
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    base_x, base_y = tip[0] - ux * size, tip[1] - uy * size
    wing = size * 0.55
    draw.polygon(
        [tip, (base_x + px * wing, base_y + py * wing), (base_x - px * wing, base_y - py * wing)],
        fill=fill,
    )


def render_png(source: Path, output: Path, font_path: Path) -> None:
    source_image = Image.open(source).convert("RGB")
    photo = source_image.resize((PHOTO_BOX[2] - PHOTO_BOX[0], PHOTO_BOX[3] - PHOTO_BOX[1]), Image.Resampling.LANCZOS)

    gray = ImageEnhance.Contrast(photo.convert("L")).enhance(1.16).convert("RGB")
    gray = ImageEnhance.Brightness(gray).enhance(0.84).convert("RGBA")
    color = ImageEnhance.Contrast(photo).enhance(1.04).convert("RGBA")

    canvas = Image.new("RGBA", CANVAS_SIZE, CREAM)
    canvas.paste(gray, (PHOTO_BOX[0], PHOTO_BOX[1]))

    color_layer = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    color_layer.paste(color, (PHOTO_BOX[0], PHOTO_BOX[1]))
    site_mask = Image.new("L", CANVAS_SIZE, 0)
    ImageDraw.Draw(site_mask).polygon(SITE_POLYGON, fill=255)
    canvas.paste(color_layer, (0, 0), site_mask)

    draw = ImageDraw.Draw(canvas)
    bold = load_variable_font(font_path, 27, 700)
    medium = load_variable_font(font_path, 15, 500)
    small_bold = load_variable_font(font_path, 15, 700)
    small = load_variable_font(font_path, 11, 500)
    marker_font = load_variable_font(font_path, 11, 700)

    draw_dashed_polyline(draw, SITE_POLYGON, WHITE, width=3, dash=13, gap=10, closed=True)
    draw.rounded_rectangle((1035, 370, 1400, 720), radius=5, outline=WHITE, width=3)

    draw.line(ROUTE_POINTS, fill=ROUTE_RED, width=5, joint="curve")
    draw_arrowhead(draw, ROUTE_POINTS[-2], ROUTE_POINTS[-1], ROUTE_RED, 16)
    draw.line((ENTRANCE, STAIR_ARROW_END), fill=ROUTE_RED, width=5)
    draw_arrowhead(draw, ENTRANCE, STAIR_ARROW_END, ROUTE_RED, 15)

    for callout in CALLOUTS:
        draw.line(callout["leader"], fill=WHITE, width=3, joint="curve")

    entrance_box = (232, 338, 352, 384)
    entrance_leader = [(232, 361), (210, 361), (210, 410), ENTRANCE]
    draw.line(entrance_leader, fill=WHITE, width=3, joint="curve")

    window_box = (1250, 565, 1460, 631)
    window_leader = [(1250, 598), (1232.3, 598), WINDOW]
    draw.line(window_leader, fill=WHITE, width=3, joint="curve")

    for callout in CALLOUTS:
        draw_card(canvas, draw, callout["box"], callout["label"], medium)
    draw_card(canvas, draw, entrance_box, "Entrance", medium, radius=9)
    draw_card(canvas, draw, window_box, "Xuanyan AR\nHistory Window", medium, radius=9)

    for number, _label, (x, y) in BAMBOO_POINTS:
        draw.ellipse((x - 11, y - 11, x + 11, y + 11), fill=WHITE)
        draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=BAMBOO_YELLOW)
        tb = draw.textbbox((0, 0), number, font=marker_font)
        tw, th = tb[2] - tb[0], tb[3] - tb[1]
        draw.text((x - tw / 2, y - th / 2 - tb[1]), number, font=marker_font, fill=INK)

    draw.ellipse((WINDOW[0] - 15, WINDOW[1] - 15, WINDOW[0] + 15, WINDOW[1] + 15), fill=WHITE)
    draw.ellipse((WINDOW[0] - 11, WINDOW[1] - 11, WINDOW[0] + 11, WINDOW[1] + 11), outline=ROUTE_RED, width=5)
    draw.ellipse((ENTRANCE[0] - 8, ENTRANCE[1] - 8, ENTRANCE[0] + 8, ENTRANCE[1] + 8), fill=WHITE)
    draw.ellipse((ENTRANCE[0] - 5, ENTRANCE[1] - 5, ENTRANCE[0] + 5, ENTRANCE[1] + 5), fill=ROUTE_RED)

    draw.text((40, 30), "CHANG GATE AR EXPERIENCE  ·  SITE LOCATIONS", font=small_bold, fill=INK)

    title_box = (62, 815, 575, 900)
    rounded_shadow(canvas, title_box, 9)
    draw.rounded_rectangle(title_box, radius=9, fill=WHITE)
    draw.text((82, 832), "The Chang Gate AR Experience Site", font=bold, fill=INK)
    draw.text((82, 873), "5 BAMBOO HISTORY POINTS  ·  1 XUANYAN AR WINDOW", font=small, fill=MUTED)

    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(output, quality=96)


def svg_multiline_text(x: float, y: float, lines: list[str], font_size: int, line_gap: int = 20) -> str:
    tspans = []
    for index, line in enumerate(lines):
        dy = 0 if index == 0 else line_gap
        tspans.append(f'<tspan x="{x}" dy="{dy}">{html.escape(line)}</tspan>')
    return f'<text x="{x}" y="{y}" text-anchor="middle" font-size="{font_size}" font-weight="500">{"".join(tspans)}</text>'


def render_svg(source: Path, output: Path) -> None:
    encoded = base64.b64encode(source.read_bytes()).decode("ascii")
    site_points = " ".join(f"{x},{y}" for x, y in SITE_POLYGON)
    route_path = "M " + " L ".join(f"{x},{y}" for x, y in ROUTE_POINTS)

    elements = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="1520" height="940" viewBox="0 0 1520 940">',
        '<defs>',
        '<filter id="gray"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.05" intercept="-0.08"/><feFuncG type="linear" slope="1.05" intercept="-0.08"/><feFuncB type="linear" slope="1.05" intercept="-0.08"/></feComponentTransfer></filter>',
        '<filter id="shadow" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="7" flood-opacity=".22"/></filter>',
        f'<clipPath id="site"><polygon points="{site_points}"/></clipPath>',
        '<marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#e34937"/></marker>',
        '</defs>',
        '<rect width="1520" height="940" fill="#f7f7f3"/>',
        f'<image x="40" y="80" width="1440" height="820" href="data:image/png;base64,{encoded}" preserveAspectRatio="none" filter="url(#gray)"/>',
        f'<image x="40" y="80" width="1440" height="820" href="data:image/png;base64,{encoded}" preserveAspectRatio="none" clip-path="url(#site)"/>',
        f'<polygon points="{site_points}" fill="none" stroke="white" stroke-width="3" stroke-dasharray="13 10" stroke-linejoin="round"/>',
        '<rect x="1035" y="370" width="365" height="350" rx="5" fill="none" stroke="white" stroke-width="3"/>',
        f'<path d="{route_path}" fill="none" stroke="#e34937" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrow)"/>',
        f'<path d="M {ENTRANCE[0]},{ENTRANCE[1]} L {STAIR_ARROW_END[0]},{STAIR_ARROW_END[1]}" fill="none" stroke="#e34937" stroke-width="5" stroke-linecap="round" marker-end="url(#arrow)"/>',
    ]

    for callout in CALLOUTS:
        points = " ".join(f"{x},{y}" for x, y in callout["leader"])
        elements.append(f'<polyline points="{points}" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>')

    elements.extend(
        [
            f'<polyline points="232,361 210,361 210,410 {ENTRANCE[0]},{ENTRANCE[1]}" fill="none" stroke="white" stroke-width="3"/>',
            f'<polyline points="1250,598 1232.3,598 {WINDOW[0]},{WINDOW[1]}" fill="none" stroke="white" stroke-width="3"/>',
        ]
    )

    for callout in CALLOUTS:
        x0, y0, x1, y1 = callout["box"]
        cx = (x0 + x1) / 2
        lines = callout["label"].split("\n")
        elements.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" rx="10" fill="white" filter="url(#shadow)"/>')
        elements.append(svg_multiline_text(cx, y0 + 26, lines, 15))

    elements.extend(
        [
            '<rect x="232" y="338" width="120" height="46" rx="9" fill="white" filter="url(#shadow)"/>',
            '<text x="292" y="367" text-anchor="middle" font-size="15" font-weight="500">Entrance</text>',
            '<rect x="1250" y="565" width="210" height="66" rx="9" fill="white" filter="url(#shadow)"/>',
            svg_multiline_text(1355, 591, ["Xuanyan AR", "History Window"], 15),
        ]
    )

    for number, _label, (x, y) in BAMBOO_POINTS:
        elements.extend(
            [
                f'<circle cx="{x}" cy="{y}" r="11" fill="white"/>',
                f'<circle cx="{x}" cy="{y}" r="8" fill="#f9da2a"/>',
                f'<text x="{x}" y="{y+4}" text-anchor="middle" font-size="11" font-weight="700">{number}</text>',
            ]
        )

    elements.extend(
        [
            f'<circle cx="{WINDOW[0]}" cy="{WINDOW[1]}" r="15" fill="white"/>',
            f'<circle cx="{WINDOW[0]}" cy="{WINDOW[1]}" r="11" fill="none" stroke="#e34937" stroke-width="5"/>',
            f'<circle cx="{ENTRANCE[0]}" cy="{ENTRANCE[1]}" r="8" fill="white"/><circle cx="{ENTRANCE[0]}" cy="{ENTRANCE[1]}" r="5" fill="#e34937"/>',
            '<text x="40" y="45" font-size="15" font-weight="700" letter-spacing="1.5">CHANG GATE AR EXPERIENCE · SITE LOCATIONS</text>',
            '<rect x="62" y="815" width="513" height="85" rx="9" fill="white" filter="url(#shadow)"/>',
            '<text x="82" y="857" font-size="27" font-weight="700">The Chang Gate AR Experience Site</text>',
            '<text x="82" y="882" font-size="11" font-weight="500" fill="#5a5a56" letter-spacing=".8">5 BAMBOO HISTORY POINTS · 1 XUANYAN AR WINDOW</text>',
            '</svg>',
        ]
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(elements), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--svg", type=Path, required=True)
    parser.add_argument("--font", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    render_png(args.source, args.output, args.font)
    render_svg(args.source, args.svg)


if __name__ == "__main__":
    main()
