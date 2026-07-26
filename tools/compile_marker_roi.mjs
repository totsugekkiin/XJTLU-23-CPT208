import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";
import { CompilerBase } from "mind-ar/src/image-target/compiler-base.js";
import { build as buildClusters } from "mind-ar/src/image-target/matching/hierarchical-clustering.js";
import { buildTrackingImageList } from "mind-ar/src/image-target/image-list.js";
import { extractTrackingFeatures } from "mind-ar/src/image-target/tracker/extract-utils.js";
import "mind-ar/src/image-target/detector/kernels/cpu/index.js";


const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "public", "markers", "changgate-window-frame-border-only.png");
const OUTPUT = path.join(ROOT, "public", "markers", "changgate-window-frame-border-only.mind");
const REPORT = path.join(ROOT, "public", "markers", "changgate-window-frame-border-only-report.json");
const FEATURE_MAP = path.join(ROOT, "public", "markers", "changgate-window-frame-border-only-features.svg");
const FEATURE_MAP_PNG = path.join(ROOT, "public", "markers", "changgate-window-frame-border-only-features.png");

// Physical geometry: 20 x 26 cm opening, 3 cm maximum frame on every side.
// The compiler works at half of the 2600 x 3200 source resolution.
const COMPILE_WIDTH = 1300;
const COMPILE_HEIGHT = 1600;
const OPENING = { left: 150, top: 150, right: 1150, bottom: 1450 };
const MATCHING_SAMPLE_RADIUS = 7;
const TRACKING_SAMPLE_RADIUS = 6;


class PixelCompiler extends CompilerBase {
  createProcessCanvas() {
    let pixels = null;
    return {
      getContext() {
        return {
          drawImage(image) {
            pixels = image.data;
          },
          getImageData() {
            return { data: pixels };
          },
        };
      },
    };
  }

  async compileTrack({ progressCallback, targetImages, basePercent }) {
    const percentPerImage = (100 - basePercent) / targetImages.length;
    let percent = 0;
    const list = [];
    for (const targetImage of targetImages) {
      const imageList = buildTrackingImageList(targetImage);
      const percentPerAction = percentPerImage / imageList.length;
      const trackingData = extractTrackingFeatures(imageList, () => {
        percent += percentPerAction;
        progressCallback(basePercent + percent);
      });
      list.push(trackingData);
    }
    return list;
  }
}


function downsampleHalf(source) {
  if (source.width !== COMPILE_WIDTH * 2 || source.height !== COMPILE_HEIGHT * 2) {
    throw new Error(`Expected ${COMPILE_WIDTH * 2}x${COMPILE_HEIGHT * 2}, got ${source.width}x${source.height}`);
  }
  const data = new Uint8ClampedArray(COMPILE_WIDTH * COMPILE_HEIGHT * 4);
  for (let y = 0; y < COMPILE_HEIGHT; y += 1) {
    for (let x = 0; x < COMPILE_WIDTH; x += 1) {
      const targetOffset = (y * COMPILE_WIDTH + x) * 4;
      const offsets = [
        ((y * 2) * source.width + x * 2) * 4,
        ((y * 2) * source.width + x * 2 + 1) * 4,
        (((y * 2) + 1) * source.width + x * 2) * 4,
        (((y * 2) + 1) * source.width + x * 2 + 1) * 4,
      ];
      for (let channel = 0; channel < 4; channel += 1) {
        data[targetOffset + channel] = Math.round(
          offsets.reduce((sum, offset) => sum + source.data[offset + channel], 0) / 4,
        );
      }
    }
  }
  return { width: COMPILE_WIDTH, height: COMPILE_HEIGHT, data };
}


function sampleWindowIsInsideFrame(point, featureSet, radiusInFeaturePixels) {
  const sourceX = point.x / featureSet.scale;
  const sourceY = point.y / featureSet.scale;
  const radius = radiusInFeaturePixels / featureSet.scale;

  const insideTarget =
    sourceX - radius >= 0 &&
    sourceY - radius >= 0 &&
    sourceX + radius < COMPILE_WIDTH &&
    sourceY + radius < COMPILE_HEIGHT;

  const outsideOpening =
    sourceX + radius < OPENING.left ||
    sourceX - radius > OPENING.right ||
    sourceY + radius < OPENING.top ||
    sourceY - radius > OPENING.bottom;

  return insideTarget && outsideOpening;
}


function filterMatchingData(matchingData) {
  return matchingData.map((keyframe) => {
    const keep = (point) => sampleWindowIsInsideFrame(
      point,
      keyframe,
      MATCHING_SAMPLE_RADIUS * Math.max(1, point.scale ?? 1),
    );
    const maximaPoints = keyframe.maximaPoints.filter(keep);
    const minimaPoints = keyframe.minimaPoints.filter(keep);
    return {
      ...keyframe,
      maximaPoints,
      minimaPoints,
      maximaPointsCluster: buildClusters({ points: maximaPoints }),
      minimaPointsCluster: buildClusters({ points: minimaPoints }),
    };
  });
}


function filterTrackingData(trackingData) {
  return trackingData.map((featureSet) => ({
    ...featureSet,
    points: featureSet.points.filter((point) =>
      sampleWindowIsInsideFrame(point, featureSet, TRACKING_SAMPLE_RADIUS),
    ),
  }));
}


function countMatching(data) {
  return data.reduce(
    (total, keyframe) => total + keyframe.maximaPoints.length + keyframe.minimaPoints.length,
    0,
  );
}


function countTracking(data) {
  return data.reduce((total, featureSet) => total + featureSet.points.length, 0);
}


function createFeatureMap(sourceBase64, keyframe, trackingFrame) {
  const matchingPoints = [...keyframe.maximaPoints, ...keyframe.minimaPoints];
  const matchingCircles = matchingPoints.map((point) => {
    const x = point.x / keyframe.scale;
    const y = point.y / keyframe.scale;
    const color = point.maxima ? "#00e5ff" : "#ff3bbd";
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4" fill="${color}"/>`;
  }).join("\n");
  const trackingCircles = trackingFrame.points.map((point) => {
    const x = point.x / trackingFrame.scale;
    const y = point.y / trackingFrame.scale;
    return `<rect x="${(x - 5).toFixed(2)}" y="${(y - 5).toFixed(2)}" width="10" height="10" fill="none" stroke="#76ff03" stroke-width="3"/>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="1600" viewBox="0 0 1300 1600">
  <defs><pattern id="checker" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#ddd"/><rect width="16" height="16" fill="#888"/><rect x="16" y="16" width="16" height="16" fill="#888"/></pattern></defs>
  <rect width="1300" height="1600" fill="url(#checker)"/>
  <image width="1300" height="1600" href="data:image/png;base64,${sourceBase64}"/>
  <g opacity="0.92">${matchingCircles}</g>
  <g>${trackingCircles}</g>
</svg>`;
}


function createFeatureMapPng(source, keyframe, trackingFrame) {
  const output = new PNG({ width: COMPILE_WIDTH, height: COMPILE_HEIGHT });
  const setPixel = (x, y, color) => {
    if (x < 0 || x >= output.width || y < 0 || y >= output.height) return;
    const offset = (y * output.width + x) * 4;
    output.data[offset] = color[0];
    output.data[offset + 1] = color[1];
    output.data[offset + 2] = color[2];
    output.data[offset + 3] = 255;
  };
  for (let y = 0; y < output.height; y += 1) {
    for (let x = 0; x < output.width; x += 1) {
      const offset = (y * output.width + x) * 4;
      const checker = (Math.floor(x / 24) + Math.floor(y / 24)) % 2 ? 150 : 215;
      const alpha = source.data[offset + 3] / 255;
      for (let channel = 0; channel < 3; channel += 1) {
        output.data[offset + channel] = Math.round(source.data[offset + channel] * alpha + checker * (1 - alpha));
      }
      output.data[offset + 3] = 255;
    }
  }
  const circle = (cx, cy, radius, color) => {
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        if (x * x + y * y <= radius * radius) setPixel(Math.round(cx + x), Math.round(cy + y), color);
      }
    }
  };
  for (const point of [...keyframe.maximaPoints, ...keyframe.minimaPoints]) {
    circle(
      point.x / keyframe.scale,
      point.y / keyframe.scale,
      4,
      point.maxima ? [0, 229, 255] : [255, 59, 189],
    );
  }
  for (const point of trackingFrame.points) {
    const cx = Math.round(point.x / trackingFrame.scale);
    const cy = Math.round(point.y / trackingFrame.scale);
    for (let delta = -6; delta <= 6; delta += 1) {
      setPixel(cx + delta, cy - 6, [118, 255, 3]);
      setPixel(cx + delta, cy + 6, [118, 255, 3]);
      setPixel(cx - 6, cy + delta, [118, 255, 3]);
      setPixel(cx + 6, cy + delta, [118, 255, 3]);
    }
  }
  return PNG.sync.write(output);
}


async function main() {
  const sourceBuffer = fs.readFileSync(SOURCE);
  const source = PNG.sync.read(sourceBuffer);
  const image = downsampleHalf(source);
  const compiler = new PixelCompiler();

  let lastProgress = -1;
  const compiled = await compiler.compileImageTargets([image], (value) => {
    const rounded = Math.floor(value / 5) * 5;
    if (rounded !== lastProgress) {
      process.stdout.write(`compile ${rounded}%\n`);
      lastProgress = rounded;
    }
  });

  const target = compiled[0];
  const before = {
    matching: countMatching(target.matchingData),
    tracking: countTracking(target.trackingData),
  };
  target.matchingData = filterMatchingData(target.matchingData);
  target.trackingData = filterTrackingData(target.trackingData);
  const after = {
    matching: countMatching(target.matchingData),
    tracking: countTracking(target.trackingData),
  };

  // MindAR 1.2.5 hardcodes tracking keyframe index 1. The default is the 128px
  // layer, but a 3cm frame is only ~15px wide there. Promote the filtered 256px
  // layer to index 1 for more border-only tracking points; coordinates remain
  // correct because every point carries the layer scale.
  const filtered256Tracking = target.trackingData[0];
  const filtered128Tracking = target.trackingData[1];
  target.trackingData = [filtered128Tracking, filtered256Tracking];
  const runtimeTrackingPoints = target.trackingData[1]?.points.length ?? 0;
  if (after.matching < 80 || runtimeTrackingPoints < 4) {
    throw new Error(
      `ROI feature count is too low: matching=${after.matching}, runtimeTracking=${runtimeTrackingPoints}`,
    );
  }

  const violations = [];
  target.matchingData.forEach((keyframe, keyframeIndex) => {
    [...keyframe.maximaPoints, ...keyframe.minimaPoints].forEach((point, pointIndex) => {
      const radius = MATCHING_SAMPLE_RADIUS * Math.max(1, point.scale ?? 1);
      if (!sampleWindowIsInsideFrame(point, keyframe, radius)) {
        violations.push({ type: "matching", keyframeIndex, pointIndex });
      }
    });
  });
  target.trackingData.forEach((featureSet, keyframeIndex) => {
    featureSet.points.forEach((point, pointIndex) => {
      if (!sampleWindowIsInsideFrame(point, featureSet, TRACKING_SAMPLE_RADIUS)) {
        violations.push({ type: "tracking", keyframeIndex, pointIndex });
      }
    });
  });
  if (violations.length) throw new Error(`ROI validation found ${violations.length} violations`);

  fs.writeFileSync(OUTPUT, compiler.exportData());
  const report = {
    version: 1,
    physicalDimensionsCm: { opening: [20, 26], frameMax: 3, target: [26, 32] },
    compileSize: [COMPILE_WIDTH, COMPILE_HEIGHT],
    opening: OPENING,
    policy: "Only features whose complete sampling windows are inside the patterned frame are exported.",
    before,
    after,
    runtimeTrackingPoints,
    runtimeTrackingScale: target.trackingData[1].scale,
    trackingLayerOrder: "128px fallback, 256px runtime layer",
    violations: violations.length,
    matchingByScale: target.matchingData.map((item) => ({
      scale: item.scale,
      maxima: item.maximaPoints.length,
      minima: item.minimaPoints.length,
    })),
    trackingByScale: target.trackingData.map((item) => ({
      scale: item.scale,
      points: item.points.length,
    })),
  };
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

  const fullScaleKeyframe = target.matchingData.reduce((best, item) =>
    Math.abs(item.scale - 1) < Math.abs(best.scale - 1) ? item : best,
  );
  fs.writeFileSync(
    FEATURE_MAP,
    createFeatureMap(sourceBuffer.toString("base64"), fullScaleKeyframe, target.trackingData[1]),
  );
  fs.writeFileSync(FEATURE_MAP_PNG, createFeatureMapPng(image, fullScaleKeyframe, target.trackingData[1]));

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`wrote ${path.relative(ROOT, OUTPUT)}\n`);
  process.stdout.write(`wrote ${path.relative(ROOT, FEATURE_MAP)}\n`);
  process.stdout.write(`wrote ${path.relative(ROOT, FEATURE_MAP_PNG)}\n`);
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
