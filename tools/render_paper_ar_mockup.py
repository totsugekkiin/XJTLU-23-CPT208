"""Render a reproducible offline marker-AR screenshot for the paper.

The script uses the coloured marker to establish a search region, then detects
the bright outdoor window on the far side of the stone passage.  A historical
scene is perspective-warped and clipped to that detected far-window quad.  The
supplied phone screenshot remains unchanged outside the far window.

This is deliberately an offline input mode, not evidence of an on-site run.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Perspective-composite a historical scene into an AR window screenshot.",
    )
    parser.add_argument("--camera-frame", required=True, type=Path)
    parser.add_argument("--historical-scene", required=True, type=Path)
    parser.add_argument(
        "--marker-template",
        type=Path,
        default=Path("public/markers/changgate-window-frame-border-only.png"),
        help="Border-only marker template used to derive the inner opening.",
    )
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--debug-output",
        type=Path,
        help="Optional copy with the detected far-window outline.",
    )
    parser.add_argument(
        "--edge-feather",
        type=float,
        default=1.8,
        help="Edge feather radius in pixels (default: 1.8).",
    )
    parser.add_argument(
        "--blend",
        type=float,
        default=0.97,
        help="Historical-scene opacity inside the aperture (default: 0.97).",
    )
    return parser.parse_args()


def load_bgr(path: Path) -> np.ndarray:
    data = np.fromfile(path, dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Unable to read image: {path}")
    return image


def write_bgr(path: Path, image: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    suffix = path.suffix.lower() or ".png"
    ok, encoded = cv2.imencode(suffix, image)
    if not ok:
        raise ValueError(f"Unable to encode output image: {path}")
    encoded.tofile(path)


def crop_scene(image: np.ndarray, target_aspect: float) -> np.ndarray:
    """Centre-crop to the portal aspect ratio without stretching the scene."""
    image = image.copy()
    # The supplied reconstruction preview contains a small circular editor
    # cursor near its centre.  It is not part of the historical scene.
    cursor_mask = np.zeros(image.shape[:2], dtype=np.uint8)
    cursor_center = (round(image.shape[1] * 0.5), round(image.shape[0] * 0.503))
    cv2.circle(cursor_mask, cursor_center, 8, 255, -1, cv2.LINE_AA)
    image = cv2.inpaint(image, cursor_mask, 4, cv2.INPAINT_TELEA)

    height, width = image.shape[:2]
    source_aspect = width / height
    if not np.isfinite(target_aspect) or target_aspect <= 0:
        raise ValueError("Projected window has an invalid aspect ratio")
    if source_aspect > target_aspect:
        crop_width = max(1, round(height * target_aspect))
        x0 = (width - crop_width) // 2
        crop = image[:, x0 : x0 + crop_width]
    else:
        crop_height = max(1, round(width / target_aspect))
        y0 = (height - crop_height) // 2
        crop = image[y0 : y0 + crop_height, :]
    if crop.size == 0:
        raise ValueError("Historical-scene crop is empty")
    return crop


def grade_scene(scene: np.ndarray) -> np.ndarray:
    """Give the insert the slight cool haze and optical softness of the phone frame."""
    graded = scene.astype(np.float32)
    # Lift the darkest wooden details without flattening the tiled roof.
    graded = np.clip((graded - 10.0) * 0.96 + 16.0, 0.0, 255.0)
    # A small cool atmospheric veil makes the scene sit at a believable distance.
    haze_bgr = np.array([220.0, 224.0, 218.0], dtype=np.float32)
    graded = graded * 0.955 + haze_bgr * 0.045
    graded = cv2.GaussianBlur(graded, (0, 0), sigmaX=0.45, sigmaY=0.45)
    return np.clip(graded, 0, 255).astype(np.uint8)


def order_quad(points: np.ndarray) -> np.ndarray:
    """Return four points in top-left, top-right, bottom-right, bottom-left order."""
    points = np.asarray(points, dtype=np.float32).reshape(4, 2)
    ordered = np.zeros((4, 2), dtype=np.float32)
    coordinate_sum = points.sum(axis=1)
    coordinate_difference = np.diff(points, axis=1).ravel()
    ordered[0] = points[np.argmin(coordinate_sum)]
    ordered[2] = points[np.argmax(coordinate_sum)]
    ordered[1] = points[np.argmin(coordinate_difference)]
    ordered[3] = points[np.argmax(coordinate_difference)]
    return ordered


def detect_marker_quad(camera_frame: np.ndarray) -> tuple[np.ndarray, int]:
    """Detect the patterned marker border from its red/yellow/teal palette."""
    height, width = camera_frame.shape[:2]
    hsv = cv2.cvtColor(camera_frame, cv2.COLOR_BGR2HSV)
    hue, saturation, value = cv2.split(hsv)
    yy, xx = np.indices((height, width))

    # Exclude the green landscape and neutral stone while keeping the marker's
    # red, ochre and teal tiles.  The broad central ROI excludes the app chrome.
    palette = (
        (saturation > 45)
        & (value > 40)
        & ((hue < 35) | (hue > 78))
        & (yy > height * 0.17)
        & (yy < height * 0.71)
        & (xx > width * 0.04)
        & (xx < width * 0.86)
    )
    palette_u8 = palette.astype(np.uint8) * 255
    palette_u8 = cv2.morphologyEx(
        palette_u8,
        cv2.MORPH_OPEN,
        np.ones((3, 3), dtype=np.uint8),
    )
    y_points, x_points = np.where(palette_u8 > 0)
    if len(x_points) < 1000:
        raise ValueError("Unable to detect enough coloured marker features")

    # Robustly discard thin reflections and isolated colour noise before the
    # convex hull is simplified to the marker's four outer corners.
    x_low, x_high = np.quantile(x_points, [0.005, 0.995])
    y_low, y_high = np.quantile(y_points, [0.005, 0.995])
    retained = (
        (x_points >= x_low)
        & (x_points <= x_high)
        & (y_points >= y_low)
        & (y_points <= y_high)
    )
    points = np.column_stack((x_points[retained], y_points[retained])).astype(np.int32)
    hull = cv2.convexHull(points.reshape(-1, 1, 2))
    perimeter = cv2.arcLength(hull, True)
    simplified = cv2.approxPolyDP(hull, perimeter * 0.015, True)
    if len(simplified) == 4:
        quad = simplified.reshape(4, 2)
    else:
        quad = cv2.boxPoints(cv2.minAreaRect(points.astype(np.float32)))
    return order_quad(quad), int(len(points))


def template_inner_quad(marker_template: np.ndarray) -> np.ndarray:
    """Find the large connected black opening in the border-only template."""
    gray = cv2.cvtColor(marker_template, cv2.COLOR_BGR2GRAY)
    black = (gray < 25).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(black, 8)
    centre_y, centre_x = gray.shape[0] // 2, gray.shape[1] // 2
    component = int(labels[centre_y, centre_x])
    if component <= 0 or component >= count:
        raise ValueError("Marker template has no connected central opening")
    x, y, width, height, area = stats[component]
    if area < marker_template.shape[0] * marker_template.shape[1] * 0.25:
        raise ValueError("Marker template central opening is unexpectedly small")
    return np.array(
        [
            [x, y],
            [x + width - 1, y],
            [x + width - 1, y + height - 1],
            [x, y + height - 1],
        ],
        dtype=np.float32,
    )


def project_inner_opening(
    marker_template: np.ndarray,
    detected_marker: np.ndarray,
) -> np.ndarray:
    template_height, template_width = marker_template.shape[:2]
    template_outer = np.array(
        [
            [0.0, 0.0],
            [template_width - 1.0, 0.0],
            [template_width - 1.0, template_height - 1.0],
            [0.0, template_height - 1.0],
        ],
        dtype=np.float32,
    )
    marker_transform = cv2.getPerspectiveTransform(template_outer, detected_marker)
    inner = template_inner_quad(marker_template).reshape(1, 4, 2)
    return cv2.perspectiveTransform(inner, marker_transform)[0]


def detect_far_window(
    camera_frame: np.ndarray,
    marker_inner: np.ndarray,
) -> tuple[np.ndarray, int]:
    """Detect the outdoor aperture at the far end of the stone passage."""
    height, width = camera_frame.shape[:2]
    hsv = cv2.cvtColor(camera_frame, cv2.COLOR_BGR2HSV)
    hue, saturation, value = cv2.split(hsv)
    blue, green_channel, red = cv2.split(camera_frame)
    yy, _ = np.indices((height, width))

    search_mask = np.zeros((height, width), dtype=np.uint8)
    cv2.fillConvexPoly(
        search_mask,
        np.round(marker_inner).astype(np.int32),
        255,
    )

    # Green foliage is the stable connected seed.  The bright low-saturation
    # test adds the small strip of pale sky across the top of the far opening.
    foliage = (
        (hue > 25)
        & (hue < 90)
        & (saturation > 30)
        & (value > 80)
        & (green_channel.astype(np.int16) > red.astype(np.int16) + 3)
    )
    marker_top = float(np.min(marker_inner[:, 1]))
    marker_bottom = float(np.max(marker_inner[:, 1]))
    bright_sky_limit = marker_top + (marker_bottom - marker_top) * 0.58
    bright_sky = (value > 190) & (saturation < 110) & (yy < bright_sky_limit)
    candidate = ((foliage | bright_sky) & (search_mask > 0)).astype(np.uint8) * 255
    candidate = cv2.morphologyEx(
        candidate,
        cv2.MORPH_CLOSE,
        np.ones((13, 13), dtype=np.uint8),
    )
    candidate = cv2.morphologyEx(
        candidate,
        cv2.MORPH_OPEN,
        np.ones((5, 5), dtype=np.uint8),
    )

    count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, 8)
    if count <= 1:
        raise ValueError("Unable to detect the far window")
    component = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    area = int(stats[component, cv2.CC_STAT_AREA])
    if area < height * width * 0.02:
        raise ValueError("Detected far-window region is unexpectedly small")
    component_mask = (labels == component).astype(np.uint8) * 255
    contours, _ = cv2.findContours(
        component_mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    hull = cv2.convexHull(max(contours, key=cv2.contourArea))
    perimeter = cv2.arcLength(hull, True)
    simplified = cv2.approxPolyDP(hull, perimeter * 0.03, True)
    if len(simplified) == 4:
        quad = simplified.reshape(4, 2)
    else:
        quad = cv2.boxPoints(cv2.minAreaRect(hull.astype(np.float32)))
    ordered = order_quad(quad)
    # Foliage leaks through a small gap beside the sloping sill.  Using the full
    # component bounds would therefore push the lower-left corner onto the near
    # stone ledge.  Keep that corner just inside the far sill instead.
    x, y, component_width, component_height = cv2.boundingRect(hull)
    ordered[3] = (
        x + max(16.0, component_width * 0.075),
        y + component_height * 0.94,
    )
    return ordered, area


def quad_aspect(quad: np.ndarray) -> float:
    """Estimate the undistorted width/height ratio of a projected quad."""
    top = float(np.linalg.norm(quad[1] - quad[0]))
    bottom = float(np.linalg.norm(quad[2] - quad[3]))
    left = float(np.linalg.norm(quad[3] - quad[0]))
    right = float(np.linalg.norm(quad[2] - quad[1]))
    mean_height = (left + right) * 0.5
    if mean_height <= 1e-6:
        raise ValueError("Detected far window has zero height")
    return ((top + bottom) * 0.5) / mean_height


def render(
    camera_frame: np.ndarray,
    historical_scene: np.ndarray,
    marker_template: np.ndarray,
    edge_feather: float,
    blend: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, int, int, int]:
    frame_height, frame_width = camera_frame.shape[:2]
    marker_quad, feature_count = detect_marker_quad(camera_frame)
    marker_inner = project_inner_opening(marker_template, marker_quad)
    destination, far_window_area = detect_far_window(camera_frame, marker_inner)
    scene = grade_scene(crop_scene(historical_scene, quad_aspect(destination)))
    scene_height, scene_width = scene.shape[:2]
    source = np.array(
        [
            [0.0, 0.0],
            [scene_width - 1.0, 0.0],
            [scene_width - 1.0, scene_height - 1.0],
            [0.0, scene_height - 1.0],
        ],
        dtype=np.float32,
    )
    transform = cv2.getPerspectiveTransform(source, destination)
    warped = cv2.warpPerspective(
        scene,
        transform,
        (frame_width, frame_height),
        flags=cv2.INTER_LANCZOS4,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0),
    )

    hard_mask = np.zeros((frame_height, frame_width), dtype=np.uint8)
    cv2.fillConvexPoly(hard_mask, np.round(destination).astype(np.int32), 255)
    # A deep masonry opening naturally darkens the view immediately beside
    # the reveal.  This also removes the tell-tale bright seam of a flat paste.
    edge_distance = cv2.distanceTransform(hard_mask, cv2.DIST_L2, 5)
    edge_shade = 0.84 + 0.16 * np.clip(edge_distance / 44.0, 0.0, 1.0)
    warped = np.clip(
        warped.astype(np.float32) * edge_shade[..., None],
        0,
        255,
    ).astype(np.uint8)
    if edge_feather > 0:
        soft_mask = cv2.GaussianBlur(
            hard_mask.astype(np.float32) / 255.0,
            (0, 0),
            sigmaX=edge_feather,
            sigmaY=edge_feather,
        )
        # Keep the blur from leaking onto the stone surface.  Feather inward only.
        soft_mask *= hard_mask.astype(np.float32) / 255.0
    else:
        soft_mask = hard_mask.astype(np.float32) / 255.0

    opacity = float(np.clip(blend, 0.0, 1.0))
    alpha = (soft_mask * opacity)[..., None]
    composed = (
        camera_frame.astype(np.float32) * (1.0 - alpha)
        + warped.astype(np.float32) * alpha
    )
    composed = np.clip(composed, 0, 255).astype(np.uint8)

    # This is the key paper-screenshot invariant: UI, marker, stonework and
    # reflections outside the aperture remain byte-identical after rendering.
    outside = hard_mask == 0
    changed_outside = int(np.count_nonzero(np.any(composed[outside] != camera_frame[outside], axis=1)))
    return (
        composed,
        marker_quad,
        destination,
        feature_count,
        far_window_area,
        changed_outside,
    )


def main() -> None:
    args = parse_args()
    camera_frame = load_bgr(args.camera_frame)
    historical_scene = load_bgr(args.historical_scene)
    marker_template = load_bgr(args.marker_template)
    (
        output,
        marker_quad,
        aperture,
        feature_count,
        far_window_area,
        changed_outside,
    ) = render(
        camera_frame,
        historical_scene,
        marker_template,
        args.edge_feather,
        args.blend,
    )
    write_bgr(args.output, output)

    if args.debug_output:
        debug = camera_frame.copy()
        # Yellow marks only the detected window at the far end of the passage.
        cv2.polylines(
            debug,
            [np.round(aperture).astype(np.int32)],
            True,
            (0, 210, 255),
            5,
            cv2.LINE_AA,
        )
        write_bgr(args.debug_output, debug)

    print(f"Rendered: {args.output.resolve()}")
    print(f"Output size: {output.shape[1]} x {output.shape[0]}")
    print(f"Detected marker features: {feature_count}")
    print(f"Detected marker quad: {np.round(marker_quad, 1).tolist()}")
    print(f"Detected far-window pixels: {far_window_area}")
    print(f"Detected far-window quad: {np.round(aperture, 1).tolist()}")
    print(f"Pixels changed outside aperture: {changed_outside}")


if __name__ == "__main__":
    main()
