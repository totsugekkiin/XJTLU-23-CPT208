import json
import re
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
def read_image(path, flags):
    return cv2.imdecode(np.fromfile(path, dtype=np.uint8), flags)


source = read_image(ROOT / "public/markers/changgate-window-frame-border-only.png", cv2.IMREAD_UNCHANGED)
shot = read_image(ROOT / ".tmp-marker-tracking/latest-loss.jpg", cv2.IMREAD_COLOR)
svg = (ROOT / "public/markers/changgate-window-frame-border-only-features.svg").read_text(encoding="utf-8")
report = json.loads((ROOT / "public/markers/changgate-window-frame-border-only-report.json").read_text(encoding="utf-8"))

# Estimate the printed frame quadrilateral from border-only local features.
source_gray_full = cv2.cvtColor(source[:, :, :3], cv2.COLOR_BGR2GRAY)
shot_gray = cv2.cvtColor(shot, cv2.COLOR_BGR2GRAY)
source_gray = cv2.resize(source_gray_full, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
source_mask = cv2.resize(source[:, :, 3], None, fx=0.5, fy=0.5, interpolation=cv2.INTER_NEAREST)
shot_half = cv2.resize(shot_gray, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
sift = cv2.SIFT_create(nfeatures=9000, contrastThreshold=0.02)
source_keys, source_desc = sift.detectAndCompute(source_gray, source_mask)
shot_keys, shot_desc = sift.detectAndCompute(shot_half, None)
matches = cv2.BFMatcher().knnMatch(source_desc, shot_desc, k=2)
good = [first for first, second in matches if first.distance < 0.72 * second.distance]
source_points = np.float32([source_keys[item.queryIdx].pt for item in good])
shot_points = np.float32([shot_keys[item.trainIdx].pt for item in good])
homography, inliers = cv2.findHomography(source_points, shot_points, cv2.RANSAC, 4)
corners = np.float32([[[0, 0], [1299, 0], [1299, 1599], [0, 1599]]])
shot_corners = cv2.perspectiveTransform(corners, homography) * 2

scale = report["runtimeTrackingScale"]
runtime_width = round(1300 * scale)
runtime_height = round(1600 * scale)
destination = np.float32([[0, 0], [runtime_width - 1, 0], [runtime_width - 1, runtime_height - 1], [0, runtime_height - 1]])
warp = cv2.getPerspectiveTransform(shot_corners.reshape(4, 2), destination)
rectified = cv2.warpPerspective(shot_gray, warp, (runtime_width, runtime_height))
compile_gray = cv2.resize(source_gray_full, (1300, 1600), interpolation=cv2.INTER_AREA)
reference = cv2.resize(compile_gray, (runtime_width, runtime_height), interpolation=cv2.INTER_AREA)

tracking_points = [
    (float(x) + 5, float(y) + 5)
    for x, y in re.findall(r'<rect x="([\d.]+)" y="([\d.]+)" width="10" height="10"', svg)
]


def best_ncc(cx, cy, frame, template_radius=6, search_radius=10):
    x = round(cx * scale)
    y = round(cy * scale)
    template = reference[y-template_radius:y+template_radius+1, x-template_radius:x+template_radius+1]
    padded = cv2.copyMakeBorder(frame, search_radius, search_radius, search_radius, search_radius, cv2.BORDER_CONSTANT)
    search = padded[
        y-template_radius:y+template_radius+2*search_radius+1,
        x-template_radius:x+template_radius+2*search_radius+1,
    ]
    search_side = 2 * (template_radius + search_radius) + 1
    if template.shape != (13, 13) or search.shape != (search_side, search_side):
        return None
    scores = cv2.matchTemplate(search, template, cv2.TM_CCOEFF_NORMED)
    return float(scores.max())


def score_frame(frame, search_radius):
    return [
        score
        for point in tracking_points
        if (score := best_ncc(*point, frame, search_radius=search_radius)) is not None
    ]


scores = score_frame(rectified, 10)
drifted = cv2.warpAffine(rectified, np.float32([[1, 0, 12], [0, 1, 0]]), (runtime_width, runtime_height))
drift_search_10 = score_frame(drifted, 10)
drift_search_14 = score_frame(drifted, 14)
base_search_14 = score_frame(rectified, 14)
print(json.dumps({
    "siftRatioMatches": len(good),
    "siftHomographyInliers": int(inliers.sum()),
    "outerCornersPx": shot_corners.reshape(4, 2).round(1).tolist(),
    "runtimeSize": [runtime_width, runtime_height],
    "trackingPoints": len(scores),
    "trackingPointsInSvg": len(tracking_points),
    "scoreMin": round(min(scores), 3),
    "scoreMedian": round(float(np.median(scores)), 3),
    "over080": sum(score > 0.80 for score in scores),
    "over072": sum(score > 0.72 for score in scores),
    "over068": sum(score > 0.68 for score in scores),
    "scores": [round(score, 3) for score in scores],
    "synthetic12pxDrift": {
        "oldSearch10Over080": sum(score > 0.80 for score in drift_search_10),
        "oldSearch10Over072": sum(score > 0.72 for score in drift_search_10),
        "newSearch14Over072": sum(score > 0.72 for score in drift_search_14),
        "baseSearch14Over072": sum(score > 0.72 for score in base_search_14),
        "search10Scores": [round(score, 3) for score in drift_search_10],
        "search14Scores": [round(score, 3) for score in drift_search_14],
    },
}, ensure_ascii=False, indent=2))
