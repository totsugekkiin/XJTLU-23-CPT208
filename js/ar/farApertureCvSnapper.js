const PROCESS_INTERVAL_MS = 125;
const MAX_PROCESSING_EDGE = 600;
const MIN_PROJECTED_EDGE = 42;
const SEARCH_FRACTION = 0.24;
const MIN_SEARCH_PIXELS = 6;
const MAX_SEARCH_PIXELS = 34;
const HOLD_LAST_GOOD_MS = 650;
const RELEASE_TIME_MS = 420;
const MIN_SIDE_CONFIDENCE = 0.28;
const MIN_ACCEPTED_SIDES = 3;

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

function quadArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    area += point.x * next.y - next.x * point.y;
  }
  return area / 2;
}

function isUsableQuad(points, predicted) {
  if (points.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) {
    return false;
  }
  const predictedArea = Math.abs(quadArea(predicted));
  const candidateArea = Math.abs(quadArea(points));
  if (predictedArea < 1 || candidateArea < predictedArea * 0.52) return false;
  if (candidateArea > predictedArea * 1.9) return false;
  if (Math.sign(quadArea(points)) !== Math.sign(quadArea(predicted))) return false;

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

  for (let index = 0; index < sampleCount; index += 1) {
    const ratio = 0.12 + (0.76 * index) / Math.max(1, sampleCount - 1);
    const x = line.start.x + dx * ratio;
    const y = line.start.y + dy * ratio;
    const gx = sampleGradient(gradients.gradientX, width, height, x, y);
    const gy = sampleGradient(gradients.gradientY, width, height, x, y);
    const oriented = gx * normalX + gy * normalY;
    const strength = Math.abs(oriented);
    absoluteSum += strength;
    signedSum += oriented;
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
    objective:
      meanStrength *
      (0.62 + coverage * 0.2 + continuity * 0.1 + polarity * 0.08),
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
      const prior = 1 - 0.13 * Math.abs(shift) / Math.max(1, searchDistance);
      const objective = score.objective * prior;
      if (!best || objective > best.objective) {
        best = {
          ...line,
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
export function detectApertureQuad({ luma, width, height, predictedCorners }) {
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
      sideSpan * SEARCH_FRACTION,
      MIN_SEARCH_PIXELS,
      MAX_SEARCH_PIXELS,
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
    lines.push(
      detected?.confidence >= MIN_SIDE_CONFIDENCE ? detected : baseline,
    );
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
  if (corners.some((point) => !point) || !isUsableQuad(corners, predicted)) {
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

function resolveCoverSource(video, viewportBounds) {
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
  constructor({ scene, target, enabled = true }) {
    this.scene = scene;
    this.target = target;
    this.enabled = enabled;
    this.occlusion = true;
    this.tracking = false;
    this.destroyed = false;
    this.lastProcessedAt = 0;
    this.lastGoodAt = 0;
    this.lastUpdateAt = 0;
    this.mode = "fallback";
    this.confidence = 0;
    this.smoothedDeltas = Array.from({ length: 4 }, () => ({ x: 0, y: 0 }));
    this.outputCorners = Array.from({ length: 4 }, () => ({ x: 0, y: 0 }));

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
    this.confidence = 0;
    this.smoothedDeltas.forEach((delta) => {
      delta.x = 0;
      delta.y = 0;
    });
    this.setMode("fallback");
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

  readFrame(predictedCorners, viewportBounds) {
    const video = document.querySelector("video");
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
    const processingCorners = predictedCorners.map(({ x, y }) => ({
      x: (x - viewportBounds.left) * scale,
      y: (y - viewportBounds.top) * scale,
    }));
    const result = detectApertureQuad({
      luma: lumaFromImageData(imageData),
      width,
      height,
      predictedCorners: processingCorners,
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

  absorbMeasurement(result, predictedCorners, now) {
    const confidenceAlpha = 0.16 + result.confidence * 0.22;
    const firstLock = !this.lastGoodAt;
    for (let index = 0; index < 4; index += 1) {
      const measuredX = result.corners[index].x - predictedCorners[index].x;
      const measuredY = result.corners[index].y - predictedCorners[index].y;
      const delta = this.smoothedDeltas[index];
      if (firstLock) {
        delta.x = measuredX;
        delta.y = measuredY;
      } else {
        delta.x += (measuredX - delta.x) * confidenceAlpha;
        delta.y += (measuredY - delta.y) * confidenceAlpha;
      }
    }
    this.lastGoodAt = now;
    this.setMode("locked", result.confidence);
  }

  releaseCorrection(now) {
    if (!this.lastGoodAt || now - this.lastGoodAt <= HOLD_LAST_GOOD_MS) return;
    const elapsed = Math.max(0, now - this.lastUpdateAt);
    const alpha = 1 - Math.exp(-elapsed / RELEASE_TIME_MS);
    let remaining = 0;
    this.smoothedDeltas.forEach((delta) => {
      delta.x += (0 - delta.x) * alpha;
      delta.y += (0 - delta.y) * alpha;
      remaining += Math.abs(delta.x) + Math.abs(delta.y);
    });
    this.setMode(remaining < 1 ? "fallback" : "holding", 0);
  }

  update(predictedCorners, viewportBounds) {
    if (!predictedCorners?.length || !viewportBounds) return predictedCorners;
    const now = performance.now();
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
        const result = this.readFrame(predictedCorners, viewportBounds);
        if (result) this.absorbMeasurement(result, predictedCorners, now);
      } catch (error) {
        console.warn("Far-aperture CV frame skipped", error);
      }
    }
    this.releaseCorrection(now);
    this.lastUpdateAt = now;

    for (let index = 0; index < 4; index += 1) {
      this.outputCorners[index].x =
        predictedCorners[index].x + this.smoothedDeltas[index].x;
      this.outputCorners[index].y =
        predictedCorners[index].y + this.smoothedDeltas[index].y;
    }
    if (!isUsableQuad(this.outputCorners, predictedCorners)) {
      this.smoothedDeltas.forEach((delta) => {
        delta.x = 0;
        delta.y = 0;
      });
      predictedCorners.forEach((point, index) => copyPoint(this.outputCorners[index], point));
      this.setMode("fallback", 0);
    }
    this.drawOverlay(this.outputCorners, viewportBounds);
    return this.outputCorners;
  }

  drawOverlay(points, viewportBounds) {
    this.overlay.setAttribute(
      "viewBox",
      `0 0 ${window.innerWidth} ${window.innerHeight}`,
    );
    this.polygon.setAttribute(
      "points",
      points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" "),
    );
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.overlay.remove();
    this.processingCanvas.width = 0;
    this.processingCanvas.height = 0;
  }
}

export function createFarApertureCvSnapper(options) {
  return new FarApertureCvSnapper(options);
}
