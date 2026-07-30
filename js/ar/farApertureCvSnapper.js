const PROCESS_INTERVAL_MS = 200;
const MAX_PROCESSING_EDGE = 600;
const MIN_PROJECTED_EDGE = 42;
const INITIAL_SEARCH_FRACTION = 0.18;
const LOCKED_SEARCH_FRACTION = 0.085;
const MIN_SEARCH_PIXELS = 5;
const INITIAL_MAX_SEARCH_PIXELS = 25;
const LOCKED_MAX_SEARCH_PIXELS = 14;
const HOLD_LAST_GOOD_MS = 1200;
const CORRECTION_SMOOTHING_MS = 720;
const RELEASE_TIME_MS = 900;
const MIN_SIDE_CONFIDENCE = 0.38;
const MIN_SIDE_COVERAGE = 0.34;
const MIN_SIDE_POLARITY = 0.26;
const MIN_SIDE_STEP_CONTRAST = 6;
const MIN_SIDE_STEP_POLARITY = 0.34;
const MIN_ACCEPTED_SIDES = 4;
const INITIAL_CONSENSUS_FRAMES = 4;
const MEASUREMENT_HISTORY_SIZE = 5;
const MAX_INITIAL_SPREAD = 0.05;
const MAX_LOCKED_MEASUREMENT_JUMP = 0.065;
const MAX_NORMALIZED_CORRECTION = 0.23;
const LOCAL_SHAPE_CORRECTION_WEIGHT = 0.42;
const OVERLAY_POINT_EPSILON = 0.8;
const APERTURE_CV_SNAPSHOT_VERSION = 1;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function copyPoint(target, source) {
  target.x = source.x;
  target.y = source.y;
}

function cloneQuad(points) {
  return points.map(({ x, y }) => ({ x, y }));
}

function normalizeCorrectionList(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const corrections = value.map((correction) => ({
    x: Number(correction?.x),
    y: Number(correction?.y),
  }));
  if (
    corrections.some(
      ({ x, y }) =>
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        Math.abs(x) > MAX_NORMALIZED_CORRECTION ||
        Math.abs(y) > MAX_NORMALIZED_CORRECTION,
    )
  ) {
    return null;
  }
  return corrections;
}

export function normalizeApertureCvSnapshot(snapshot) {
  if (!snapshot || snapshot.version !== APERTURE_CV_SNAPSHOT_VERSION) {
    return null;
  }
  const targetCorrections = normalizeCorrectionList(snapshot.targetCorrections);
  const smoothedCorrections = normalizeCorrectionList(snapshot.smoothedCorrections);
  if (!targetCorrections || !smoothedCorrections) return null;

  const lockEstablished = Boolean(snapshot.lockEstablished);
  const mode =
    lockEstablished && snapshot.mode === "locked"
      ? "locked"
      : lockEstablished && snapshot.mode === "holding"
        ? "holding"
        : "fallback";
  return {
    version: APERTURE_CV_SNAPSHOT_VERSION,
    mode,
    confidence: clamp(Number(snapshot.confidence) || 0, 0, 1),
    lockEstablished: mode !== "fallback",
    targetCorrections,
    smoothedCorrections,
  };
}

function quadArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    area += point.x * next.y - next.x * point.y;
  }
  return area / 2;
}

function quadCenter(points) {
  return points.reduce(
    (center, point) => {
      center.x += point.x / points.length;
      center.y += point.y / points.length;
      return center;
    },
    { x: 0, y: 0 },
  );
}

function quadDimensions(points) {
  return {
    width:
      (distance(points[0], points[1]) + distance(points[3], points[2])) / 2,
    height:
      (distance(points[0], points[3]) + distance(points[1], points[2])) / 2,
  };
}

function isUsableQuad(
  points,
  predicted,
  {
    minimumAreaRatio = 0.65,
    maximumAreaRatio = 1.5,
    minimumEdgeRatio = 0.68,
    maximumEdgeRatio = 1.42,
    maximumCenterShift = 0.3,
  } = {},
) {
  if (points.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) {
    return false;
  }
  const predictedArea = Math.abs(quadArea(predicted));
  const candidateArea = Math.abs(quadArea(points));
  if (predictedArea < 1 || candidateArea < predictedArea * minimumAreaRatio) {
    return false;
  }
  if (candidateArea > predictedArea * maximumAreaRatio) return false;
  if (Math.sign(quadArea(points)) !== Math.sign(quadArea(predicted))) return false;

  const predictedDimensions = quadDimensions(predicted);
  const candidateDimensions = quadDimensions(points);
  const widthRatio = candidateDimensions.width / predictedDimensions.width;
  const heightRatio = candidateDimensions.height / predictedDimensions.height;
  if (
    widthRatio < minimumEdgeRatio ||
    widthRatio > maximumEdgeRatio ||
    heightRatio < minimumEdgeRatio ||
    heightRatio > maximumEdgeRatio
  ) {
    return false;
  }
  const predictedCenter = quadCenter(predicted);
  const candidateCenter = quadCenter(points);
  if (
    distance(predictedCenter, candidateCenter) >
    Math.min(predictedDimensions.width, predictedDimensions.height) *
      maximumCenterShift
  ) {
    return false;
  }

  let crossSign = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const c = points[(index + 2) % points.length];
    const cross =
      (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 0.01) return false;
    const sign = Math.sign(cross);
    if (crossSign && sign !== crossSign) return false;
    crossSign = sign;
  }
  return true;
}

function isQuadInsideOuter(candidate, outer) {
  const outerSign = Math.sign(quadArea(outer));
  if (!outerSign) return false;
  const outerDimensions = quadDimensions(outer);
  const minimumInset =
    Math.min(outerDimensions.width, outerDimensions.height) * 0.012;
  for (const point of candidate) {
    for (let index = 0; index < outer.length; index += 1) {
      const start = outer[index];
      const end = outer[(index + 1) % outer.length];
      const edgeX = end.x - start.x;
      const edgeY = end.y - start.y;
      const edgeLength = Math.hypot(edgeX, edgeY);
      const cross =
        edgeX * (point.y - start.y) - edgeY * (point.x - start.x);
      if (cross * outerSign < minimumInset * edgeLength) return false;
    }
  }
  return true;
}

function quadBasis(points) {
  const x = {
    x:
      ((points[1].x - points[0].x) + (points[2].x - points[3].x)) / 2,
    y:
      ((points[1].y - points[0].y) + (points[2].y - points[3].y)) / 2,
  };
  const y = {
    x:
      ((points[3].x - points[0].x) + (points[2].x - points[1].x)) / 2,
    y:
      ((points[3].y - points[0].y) + (points[2].y - points[1].y)) / 2,
  };
  const determinant = x.x * y.y - x.y * y.x;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-5) {
    return null;
  }
  return { x, y, determinant };
}

function normalizedCorrections(measured, predicted) {
  const basis = quadBasis(predicted);
  if (!basis) return null;
  const corrections = measured.map((point, index) => {
    const deltaX = point.x - predicted[index].x;
    const deltaY = point.y - predicted[index].y;
    return {
      x: (deltaX * basis.y.y - deltaY * basis.y.x) / basis.determinant,
      y: (basis.x.x * deltaY - basis.x.y * deltaX) / basis.determinant,
    };
  });
  const average = corrections.reduce(
    (result, correction) => {
      result.x += correction.x / corrections.length;
      result.y += correction.y / corrections.length;
      return result;
    },
    { x: 0, y: 0 },
  );
  for (const correction of corrections) {
    correction.x =
      average.x +
      (correction.x - average.x) * LOCAL_SHAPE_CORRECTION_WEIGHT;
    correction.y =
      average.y +
      (correction.y - average.y) * LOCAL_SHAPE_CORRECTION_WEIGHT;
    if (
      Math.abs(correction.x) > MAX_NORMALIZED_CORRECTION ||
      Math.abs(correction.y) > MAX_NORMALIZED_CORRECTION
    ) {
      return null;
    }
  }
  return corrections;
}

function applyNormalizedCorrections(predicted, corrections, output) {
  const basis = quadBasis(predicted);
  if (!basis) {
    predicted.forEach((point, index) => copyPoint(output[index], point));
    return;
  }
  for (let index = 0; index < predicted.length; index += 1) {
    const correction = corrections[index];
    output[index].x =
      predicted[index].x +
      basis.x.x * correction.x +
      basis.y.x * correction.y;
    output[index].y =
      predicted[index].y +
      basis.x.y * correction.x +
      basis.y.y * correction.y;
  }
}

function correctionDistance(first, second) {
  let squared = 0;
  for (let index = 0; index < first.length; index += 1) {
    squared +=
      (first[index].x - second[index].x) ** 2 +
      (first[index].y - second[index].y) ** 2;
  }
  return Math.sqrt(squared / (first.length * 2));
}

function medianCorrections(history) {
  return Array.from({ length: 4 }, (_, cornerIndex) => {
    const xs = history
      .map((measurement) => measurement.corrections[cornerIndex].x)
      .sort((a, b) => a - b);
    const ys = history
      .map((measurement) => measurement.corrections[cornerIndex].y)
      .sort((a, b) => a - b);
    const middle = Math.floor(xs.length / 2);
    return {
      x:
        xs.length % 2 === 0 ? (xs[middle - 1] + xs[middle]) / 2 : xs[middle],
      y:
        ys.length % 2 === 0 ? (ys[middle - 1] + ys[middle]) / 2 : ys[middle],
    };
  });
}

function intersectLines(first, second) {
  const x1 = first.start.x;
  const y1 = first.start.y;
  const x2 = first.end.x;
  const y2 = first.end.y;
  const x3 = second.start.x;
  const y3 = second.start.y;
  const x4 = second.end.x;
  const y4 = second.end.y;
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 1e-5) return null;
  const firstCross = x1 * y2 - y1 * x2;
  const secondCross = x3 * y4 - y3 * x4;
  return {
    x:
      (firstCross * (x3 - x4) - (x1 - x2) * secondCross) /
      denominator,
    y:
      (firstCross * (y3 - y4) - (y1 - y2) * secondCross) /
      denominator,
  };
}

function blurLuma(source, width, height) {
  const horizontal = new Uint16Array(source.length);
  const output = new Uint8Array(source.length);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const left = source[row + Math.max(0, x - 1)];
      const center = source[row + x];
      const right = source[row + Math.min(width - 1, x + 1)];
      horizontal[row + x] = left + center * 2 + right;
    }
  }
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - 1) * width;
    const row = y * width;
    const bottom = Math.min(height - 1, y + 1) * width;
    for (let x = 0; x < width; x += 1) {
      output[row + x] =
        (horizontal[top + x] + horizontal[row + x] * 2 + horizontal[bottom + x]) >>
        4;
    }
  }
  return output;
}

function buildGradients(luma, width, height) {
  const blurred = blurLuma(luma, width, height);
  const gradientX = new Int16Array(luma.length);
  const gradientY = new Int16Array(luma.length);
  let totalMagnitude = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    const previous = (y - 1) * width;
    const row = y * width;
    const next = (y + 1) * width;
    for (let x = 1; x < width - 1; x += 1) {
      const gx =
        -blurred[previous + x - 1] +
        blurred[previous + x + 1] -
        2 * blurred[row + x - 1] +
        2 * blurred[row + x + 1] -
        blurred[next + x - 1] +
        blurred[next + x + 1];
      const gy =
        -blurred[previous + x - 1] -
        2 * blurred[previous + x] -
        blurred[previous + x + 1] +
        blurred[next + x - 1] +
        2 * blurred[next + x] +
        blurred[next + x + 1];
      gradientX[row + x] = gx;
      gradientY[row + x] = gy;
      totalMagnitude += Math.abs(gx) + Math.abs(gy);
      count += 1;
    }
  }

  return {
    luma: blurred,
    gradientX,
    gradientY,
    noiseFloor: Math.max(18, totalMagnitude / Math.max(1, count) / 2),
  };
}

function sampleGradient(array, width, height, x, y) {
  if (x < 1 || y < 1 || x >= width - 2 || y >= height - 2) return 0;
  const left = Math.floor(x);
  const top = Math.floor(y);
  const fractionX = x - left;
  const fractionY = y - top;
  const topLeft = array[top * width + left];
  const topRight = array[top * width + left + 1];
  const bottomLeft = array[(top + 1) * width + left];
  const bottomRight = array[(top + 1) * width + left + 1];
  const upper = topLeft + (topRight - topLeft) * fractionX;
  const lower = bottomLeft + (bottomRight - bottomLeft) * fractionX;
  return upper + (lower - upper) * fractionY;
}

function medianOfThree(first, second, third) {
  return Math.max(
    Math.min(first, second),
    Math.min(Math.max(first, second), third),
  );
}

function evaluateLine(line, gradients, width, height) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const length = Math.hypot(dx, dy);
  if (length < 8) return null;
  const normalX = -dy / length;
  const normalY = dx / length;
  const sampleCount = clamp(Math.round(length * 0.62), 20, 72);
  const edgeThreshold = gradients.noiseFloor * 1.35;
  let absoluteSum = 0;
  let signedSum = 0;
  let covered = 0;
  let longestRun = 0;
  let run = 0;
  let stepAbsoluteSum = 0;
  let stepSignedSum = 0;
  const stepDistance = clamp(length * 0.018, 2.5, 4.5);

  for (let index = 0; index < sampleCount; index += 1) {
    const ratio = 0.12 + (0.76 * index) / Math.max(1, sampleCount - 1);
    const x = line.start.x + dx * ratio;
    const y = line.start.y + dy * ratio;
    const gx = sampleGradient(gradients.gradientX, width, height, x, y);
    const gy = sampleGradient(gradients.gradientY, width, height, x, y);
    const oriented = gx * normalX + gy * normalY;
    const strength = Math.abs(oriented);
    const innerLuma = medianOfThree(
      sampleGradient(
        gradients.luma,
        width,
        height,
        x + normalX * stepDistance,
        y + normalY * stepDistance,
      ),
      sampleGradient(
        gradients.luma,
        width,
        height,
        x + normalX * stepDistance * 2,
        y + normalY * stepDistance * 2,
      ),
      sampleGradient(
        gradients.luma,
        width,
        height,
        x + normalX * stepDistance * 3,
        y + normalY * stepDistance * 3,
      ),
    );
    const outerLuma = medianOfThree(
      sampleGradient(
        gradients.luma,
        width,
        height,
        x - normalX * stepDistance,
        y - normalY * stepDistance,
      ),
      sampleGradient(
        gradients.luma,
        width,
        height,
        x - normalX * stepDistance * 2,
        y - normalY * stepDistance * 2,
      ),
      sampleGradient(
        gradients.luma,
        width,
        height,
        x - normalX * stepDistance * 3,
        y - normalY * stepDistance * 3,
      ),
    );
    const step = innerLuma - outerLuma;
    absoluteSum += strength;
    signedSum += oriented;
    stepAbsoluteSum += Math.abs(step);
    stepSignedSum += step;
    if (strength >= edgeThreshold) {
      covered += 1;
      run += 1;
      longestRun = Math.max(longestRun, run);
    } else {
      run = 0;
    }
  }

  const meanStrength = absoluteSum / sampleCount;
  const coverage = covered / sampleCount;
  const continuity = longestRun / sampleCount;
  const polarity = Math.abs(signedSum) / Math.max(1, absoluteSum);
  const stepContrast = Math.abs(stepSignedSum) / sampleCount;
  const stepPolarity =
    Math.abs(stepSignedSum) / Math.max(1, stepAbsoluteSum);
  const normalizedStrength = meanStrength / gradients.noiseFloor;
  const confidence = clamp(
    ((normalizedStrength - 0.9) / 2.8) *
      (0.52 + coverage * 0.3 + continuity * 0.18) *
      (0.68 + polarity * 0.32),
    0,
    1,
  );
  return {
    confidence,
    coverage,
    continuity,
    polarity,
    stepContrast,
    stepPolarity,
    normalizedStrength,
    objective:
      (meanStrength + stepContrast * 4) *
      (0.54 +
        coverage * 0.18 +
        continuity * 0.08 +
        polarity * 0.08 +
        stepPolarity * 0.12),
  };
}

function findSideLine(start, end, searchDistance, gradients, width, height) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 8) return null;
  const normalX = -dy / length;
  const normalY = dx / length;
  const shiftStep = Math.max(1, searchDistance / 15);
  const tiltLimit = Math.min(length * 0.055, searchDistance * 0.48);
  const tiltStep = Math.max(1, tiltLimit / 3);
  let best = null;

  for (let shift = -searchDistance; shift <= searchDistance + 0.01; shift += shiftStep) {
    for (let tilt = -tiltLimit; tilt <= tiltLimit + 0.01; tilt += tiltStep) {
      const line = {
        start: {
          x: start.x + normalX * (shift + tilt),
          y: start.y + normalY * (shift + tilt),
        },
        end: {
          x: end.x + normalX * (shift - tilt),
          y: end.y + normalY * (shift - tilt),
        },
      };
      const score = evaluateLine(line, gradients, width, height);
      if (!score) continue;
      if (
        score.confidence < MIN_SIDE_CONFIDENCE ||
        score.coverage < MIN_SIDE_COVERAGE ||
        score.polarity < MIN_SIDE_POLARITY ||
        score.stepContrast < MIN_SIDE_STEP_CONTRAST ||
        score.stepPolarity < MIN_SIDE_STEP_POLARITY
      ) {
        continue;
      }
      const prior = 1 - 0.3 * Math.abs(shift) / Math.max(1, searchDistance);
      const objective = score.objective * prior;
      if (!best || objective > best.objective) {
        best = {
          ...line,
          ...score,
          confidence: score.confidence,
          objective,
          shift,
        };
      }
    }
  }
  return best;
}

/**
 * Detects a quadrilateral by snapping each predicted side to a nearby image edge.
 * Coordinates and image dimensions must use the same pixel space.
 */
export function detectApertureQuad({
  luma,
  width,
  height,
  predictedCorners,
  searchFraction = INITIAL_SEARCH_FRACTION,
  maximumSearchPixels = INITIAL_MAX_SEARCH_PIXELS,
}) {
  if (
    !(luma instanceof Uint8Array) ||
    luma.length !== width * height ||
    predictedCorners?.length !== 4
  ) {
    return null;
  }
  const predicted = cloneQuad(predictedCorners);
  const horizontalSize =
    (distance(predicted[0], predicted[1]) + distance(predicted[3], predicted[2])) /
    2;
  const verticalSize =
    (distance(predicted[0], predicted[3]) + distance(predicted[1], predicted[2])) /
    2;
  if (Math.min(horizontalSize, verticalSize) < 18) return null;

  const gradients = buildGradients(luma, width, height);
  const lines = [];
  for (let side = 0; side < 4; side += 1) {
    const sideSpan = side % 2 === 0 ? verticalSize : horizontalSize;
    const searchDistance = clamp(
      sideSpan * searchFraction,
      MIN_SEARCH_PIXELS,
      maximumSearchPixels,
    );
    const baseline = {
      start: predicted[side],
      end: predicted[(side + 1) % 4],
      confidence: 0,
      shift: 0,
    };
    const detected = findSideLine(
      baseline.start,
      baseline.end,
      searchDistance,
      gradients,
      width,
      height,
    );
    const reliable =
      detected?.confidence >= MIN_SIDE_CONFIDENCE &&
      detected.coverage >= MIN_SIDE_COVERAGE &&
      detected.polarity >= MIN_SIDE_POLARITY &&
      detected.stepContrast >= MIN_SIDE_STEP_CONTRAST &&
      detected.stepPolarity >= MIN_SIDE_STEP_POLARITY;
    lines.push(reliable ? detected : baseline);
  }

  const acceptedSides = lines.filter(
    ({ confidence }) => confidence >= MIN_SIDE_CONFIDENCE,
  ).length;
  if (acceptedSides < MIN_ACCEPTED_SIDES) return null;
  const corners = [
    intersectLines(lines[3], lines[0]),
    intersectLines(lines[0], lines[1]),
    intersectLines(lines[1], lines[2]),
    intersectLines(lines[2], lines[3]),
  ];
  if (
    corners.some((point) => !point) ||
    !isUsableQuad(corners, predicted, {
      minimumAreaRatio: 0.72,
      maximumAreaRatio: 1.36,
      minimumEdgeRatio: 0.76,
      maximumEdgeRatio: 1.28,
      maximumCenterShift: 0.22,
    })
  ) {
    return null;
  }

  const accepted = lines.filter(({ confidence }) => confidence > 0);
  const confidence =
    accepted.reduce((sum, line) => sum + line.confidence, 0) /
    Math.max(1, accepted.length);
  return {
    corners,
    confidence: clamp(confidence * (acceptedSides / 4), 0, 1),
    acceptedSides,
    sideConfidences: lines.map(({ confidence }) => confidence),
  };
}

function lumaFromImageData(imageData) {
  const rgba = imageData.data;
  const luma = new Uint8Array(imageData.width * imageData.height);
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 1) {
    luma[target] = (rgba[source] * 77 + rgba[source + 1] * 150 + rgba[source + 2] * 29) >> 8;
  }
  return luma;
}

export function resolveCoverSource(video, viewportBounds) {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  const videoBounds = video.getBoundingClientRect();
  if (!videoWidth || !videoHeight || !videoBounds.width || !videoBounds.height) {
    return null;
  }
  const scale = Math.max(
    videoBounds.width / videoWidth,
    videoBounds.height / videoHeight,
  );
  const mediaLeft = videoBounds.left + (videoBounds.width - videoWidth * scale) / 2;
  const mediaTop = videoBounds.top + (videoBounds.height - videoHeight * scale) / 2;
  const source = {
    x: (viewportBounds.left - mediaLeft) / scale,
    y: (viewportBounds.top - mediaTop) / scale,
    width: viewportBounds.width / scale,
    height: viewportBounds.height / scale,
  };
  if (
    source.x < -1 ||
    source.y < -1 ||
    source.x + source.width > videoWidth + 1 ||
    source.y + source.height > videoHeight + 1
  ) {
    return null;
  }
  source.x = clamp(source.x, 0, videoWidth);
  source.y = clamp(source.y, 0, videoHeight);
  source.width = clamp(source.width, 1, videoWidth - source.x);
  source.height = clamp(source.height, 1, videoHeight - source.y);
  return source;
}

export class FarApertureCvSnapper {
  constructor({ scene, target, video = null, enabled = true }) {
    this.scene = scene;
    this.target = target;
    this.video = video;
    this.enabled = enabled;
    this.occlusion = true;
    this.tracking = false;
    this.destroyed = false;
    this.lastProcessedAt = 0;
    this.lastGoodAt = 0;
    this.lastUpdateAt = 0;
    this.mode = "fallback";
    this.confidence = 0;
    this.lockEstablished = false;
    this.measurements = [];
    this.targetCorrections = Array.from({ length: 4 }, () => ({ x: 0, y: 0 }));
    this.smoothedCorrections = Array.from({ length: 4 }, () => ({
      x: 0,
      y: 0,
    }));
    this.outputCorners = Array.from({ length: 4 }, () => ({ x: 0, y: 0 }));
    this.lastOverlayCorners = Array.from({ length: 4 }, () => ({
      x: Number.NaN,
      y: Number.NaN,
    }));

    this.processingCanvas = document.createElement("canvas");
    this.processingContext = this.processingCanvas.getContext("2d", {
      alpha: false,
      willReadFrequently: true,
    });
    this.overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.overlay.classList.add("far-aperture-cv-overlay");
    this.overlay.setAttribute("aria-hidden", "true");
    this.polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    this.overlay.append(this.polygon);
    this.scene.before(this.overlay);
    this.emitState(true);
  }

  setTracking(tracking) {
    this.tracking = Boolean(tracking);
    this.updateVisibility();
    if (!this.tracking) this.reset();
  }

  setOcclusion(enabled) {
    this.occlusion = Boolean(enabled);
    this.updateVisibility();
  }

  updateVisibility() {
    this.overlay.classList.toggle(
      "is-visible",
      this.enabled && this.occlusion && this.tracking,
    );
  }

  reset() {
    this.lastProcessedAt = 0;
    this.lastGoodAt = 0;
    this.lastUpdateAt = 0;
    this.confidence = 0;
    this.lockEstablished = false;
    this.measurements.length = 0;
    this.targetCorrections.forEach((correction) => {
      correction.x = 0;
      correction.y = 0;
    });
    this.smoothedCorrections.forEach((correction) => {
      correction.x = 0;
      correction.y = 0;
    });
    this.lastOverlayCorners.forEach((point) => {
      point.x = Number.NaN;
      point.y = Number.NaN;
    });
    this.setMode("fallback");
  }

  captureState() {
    if (!this.enabled || !this.lockEstablished || this.mode === "fallback") {
      return null;
    }
    return normalizeApertureCvSnapshot({
      version: APERTURE_CV_SNAPSHOT_VERSION,
      mode: this.mode,
      confidence: this.confidence,
      lockEstablished: this.lockEstablished,
      targetCorrections: this.targetCorrections,
      smoothedCorrections: this.smoothedCorrections,
    });
  }

  restoreState(snapshot) {
    if (!this.enabled || this.destroyed) return false;
    const restored = normalizeApertureCvSnapshot(snapshot);
    if (!restored || !restored.lockEstablished) return false;

    restored.targetCorrections.forEach((correction, index) => {
      copyPoint(this.targetCorrections[index], correction);
    });
    restored.smoothedCorrections.forEach((correction, index) => {
      copyPoint(this.smoothedCorrections[index], correction);
    });
    this.lockEstablished = true;
    this.measurements.length = 0;
    if (restored.mode === "locked") {
      this.measurements.push({
        corrections: cloneQuad(restored.targetCorrections),
        confidence: restored.confidence,
      });
    }
    const now = performance.now();
    this.lastProcessedAt = 0;
    this.lastGoodAt = restored.mode === "locked" ? now : 0;
    this.lastUpdateAt = now;
    this.lastOverlayCorners.forEach((point) => {
      point.x = Number.NaN;
      point.y = Number.NaN;
    });
    this.setMode(restored.mode, restored.confidence);
    return true;
  }

  setMode(mode, confidence = this.confidence) {
    const nextConfidence = Number.isFinite(confidence) ? confidence : 0;
    const changed = mode !== this.mode || Math.abs(nextConfidence - this.confidence) >= 0.08;
    this.mode = mode;
    this.confidence = nextConfidence;
    this.overlay.classList.toggle("is-locked", mode === "locked");
    if (changed) this.emitState();
  }

  emitState(force = false) {
    if (!force && this.destroyed) return;
    this.target.emit("far-aperture-cv-state", {
      enabled: this.enabled,
      mode: this.mode,
      confidence: this.confidence,
    });
  }

  readFrame(searchCorners, viewportBounds, locked) {
    const video =
      this.video ||
      this.scene?.systems?.["mindar-image-system"]?.video ||
      document.querySelector("video");
    if (
      !this.processingContext ||
      !video ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return null;
    }
    const source = resolveCoverSource(video, viewportBounds);
    if (!source) return null;
    const scale = Math.min(
      1,
      MAX_PROCESSING_EDGE / Math.max(viewportBounds.width, viewportBounds.height),
    );
    const width = Math.max(2, Math.round(viewportBounds.width * scale));
    const height = Math.max(2, Math.round(viewportBounds.height * scale));
    if (this.processingCanvas.width !== width || this.processingCanvas.height !== height) {
      this.processingCanvas.width = width;
      this.processingCanvas.height = height;
    }
    this.processingContext.drawImage(
      video,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      width,
      height,
    );
    const imageData = this.processingContext.getImageData(0, 0, width, height);
    const processingCorners = searchCorners.map(({ x, y }) => ({
      x: (x - viewportBounds.left) * scale,
      y: (y - viewportBounds.top) * scale,
    }));
    const result = detectApertureQuad({
      luma: lumaFromImageData(imageData),
      width,
      height,
      predictedCorners: processingCorners,
      searchFraction: locked
        ? LOCKED_SEARCH_FRACTION
        : INITIAL_SEARCH_FRACTION,
      maximumSearchPixels: locked
        ? LOCKED_MAX_SEARCH_PIXELS
        : INITIAL_MAX_SEARCH_PIXELS,
    });
    if (!result) return null;
    return {
      ...result,
      corners: result.corners.map(({ x, y }) => ({
        x: viewportBounds.left + x / scale,
        y: viewportBounds.top + y / scale,
      })),
    };
  }

  absorbMeasurement(result, predictedCorners, nearCorners, now) {
    if (
      !nearCorners ||
      !isQuadInsideOuter(result.corners, nearCorners) ||
      !isUsableQuad(result.corners, predictedCorners, {
        minimumAreaRatio: 0.74,
        maximumAreaRatio: 1.34,
        minimumEdgeRatio: 0.78,
        maximumEdgeRatio: 1.26,
        maximumCenterShift: 0.21,
      })
    ) {
      return false;
    }
    const corrections = normalizedCorrections(
      result.corners,
      predictedCorners,
    );
    if (!corrections) return false;

    if (
      this.lockEstablished &&
      correctionDistance(
        corrections,
        this.mode === "holding"
          ? this.smoothedCorrections
          : this.targetCorrections,
      ) >
        MAX_LOCKED_MEASUREMENT_JUMP
    ) {
      return false;
    }

    this.measurements.push({
      corrections,
      confidence: result.confidence,
    });
    if (this.measurements.length > MEASUREMENT_HISTORY_SIZE) {
      this.measurements.shift();
    }
    const median = medianCorrections(this.measurements);

    if (!this.lockEstablished) {
      if (this.measurements.length < INITIAL_CONSENSUS_FRAMES) return false;
      const spread = Math.max(
        ...this.measurements.map((measurement) =>
          correctionDistance(measurement.corrections, median),
        ),
      );
      if (spread > MAX_INITIAL_SPREAD) return false;
      this.lockEstablished = true;
    }

    median.forEach((correction, index) => {
      copyPoint(this.targetCorrections[index], correction);
    });
    this.lastGoodAt = now;
    this.setMode("locked", result.confidence);
    return true;
  }

  releaseCorrection(now) {
    if (!this.lastGoodAt || now - this.lastGoodAt <= HOLD_LAST_GOOD_MS) return;
    this.targetCorrections.forEach((correction) => {
      correction.x = 0;
      correction.y = 0;
    });
    this.setMode("holding", 0);
  }

  smoothCorrections(now) {
    const elapsed = this.lastUpdateAt
      ? clamp(now - this.lastUpdateAt, 0, 100)
      : 0;
    const timeConstant =
      this.mode === "holding" ? RELEASE_TIME_MS : CORRECTION_SMOOTHING_MS;
    const alpha = elapsed > 0 ? 1 - Math.exp(-elapsed / timeConstant) : 0;
    let remaining = 0;
    for (let index = 0; index < this.smoothedCorrections.length; index += 1) {
      const smoothed = this.smoothedCorrections[index];
      const target = this.targetCorrections[index];
      smoothed.x += (target.x - smoothed.x) * alpha;
      smoothed.y += (target.y - smoothed.y) * alpha;
      remaining += Math.abs(smoothed.x) + Math.abs(smoothed.y);
    }
    if (this.mode === "holding" && remaining < 0.002) {
      this.lockEstablished = false;
      this.lastGoodAt = 0;
      this.measurements.length = 0;
      this.setMode("fallback", 0);
    }
  }

  update(predictedCorners, viewportBounds, nearCorners) {
    if (!predictedCorners?.length || !viewportBounds) return predictedCorners;
    const now = performance.now();
    applyNormalizedCorrections(
      predictedCorners,
      this.smoothedCorrections,
      this.outputCorners,
    );
    const minimumEdge = Math.min(
      ...predictedCorners.map((point, index) =>
        distance(point, predictedCorners[(index + 1) % 4]),
      ),
    );
    if (
      this.enabled &&
      this.occlusion &&
      this.tracking &&
      minimumEdge >= MIN_PROJECTED_EDGE &&
      now - this.lastProcessedAt >= PROCESS_INTERVAL_MS
    ) {
      this.lastProcessedAt = now;
      try {
        const result = this.readFrame(
          this.lockEstablished ? this.outputCorners : predictedCorners,
          viewportBounds,
          this.lockEstablished,
        );
        if (result) {
          this.absorbMeasurement(
            result,
            predictedCorners,
            nearCorners,
            now,
          );
        }
      } catch (error) {
        console.warn("Far-aperture CV frame skipped", error);
      }
    }
    this.releaseCorrection(now);
    this.smoothCorrections(now);
    this.lastUpdateAt = now;

    applyNormalizedCorrections(
      predictedCorners,
      this.smoothedCorrections,
      this.outputCorners,
    );
    if (
      !isUsableQuad(this.outputCorners, predictedCorners) ||
      (this.lockEstablished &&
        nearCorners &&
        !isQuadInsideOuter(this.outputCorners, nearCorners))
    ) {
      this.reset();
      predictedCorners.forEach((point, index) => copyPoint(this.outputCorners[index], point));
    }
    this.drawOverlay(this.outputCorners);
    return this.outputCorners;
  }

  drawOverlay(points) {
    const changed = points.some(
      (point, index) => {
        const previous = this.lastOverlayCorners[index];
        return (
          !Number.isFinite(previous.x) ||
          !Number.isFinite(previous.y) ||
          Math.abs(point.x - previous.x) >=
          OVERLAY_POINT_EPSILON ||
          Math.abs(point.y - previous.y) >= OVERLAY_POINT_EPSILON
        );
      },
    );
    if (!changed) return;
    this.overlay.setAttribute(
      "viewBox",
      `0 0 ${window.innerWidth} ${window.innerHeight}`,
    );
    this.polygon.setAttribute(
      "points",
      points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" "),
    );
    points.forEach((point, index) => {
      copyPoint(this.lastOverlayCorners[index], point);
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.video = null;
    this.overlay.remove();
    this.processingCanvas.width = 0;
    this.processingCanvas.height = 0;
  }
}

export function createFarApertureCvSnapper(options) {
  return new FarApertureCvSnapper(options);
}
