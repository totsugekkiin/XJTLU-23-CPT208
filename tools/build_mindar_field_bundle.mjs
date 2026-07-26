import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "vite";


const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(ROOT, "public", "vendor", "mindar");
const OUTPUT_FILE = "mindar-image-aframe-field.prod.js";

const patchCounts = {
  detector: 0,
  matcher: 0,
  tracker: 0,
};

function replaceExactlyOnce(code, search, replacement, label) {
  const first = code.indexOf(search);
  if (first === -1 || code.indexOf(search, first + search.length) !== -1) {
    throw new Error(`Expected exactly one ${label} constant in MindAR 1.2.5 source`);
  }
  return code.replace(search, replacement);
}

function fieldTuningPlugin() {
  return {
    name: "mindar-field-detection-tuning",
    enforce: "pre",
    transform(code, id) {
      const normalizedId = id.replaceAll("\\", "/").split("?")[0];
      if (normalizedId.endsWith("/image-target/detector/detector.js")) {
        patchCounts.detector += 1;
        return replaceExactlyOnce(
          code,
          "const MAX_FEATURES_PER_BUCKET = 5;",
          "const MAX_FEATURES_PER_BUCKET = 15;",
          "detector feature budget",
        );
      }
      if (normalizedId.endsWith("/image-target/matching/matching.js")) {
        patchCounts.matcher += 1;
        return replaceExactlyOnce(
          code,
          "const MIN_NUM_INLIERS = 6;",
          "const MIN_NUM_INLIERS = 4;",
          "matching inlier threshold",
        );
      }
      if (normalizedId.endsWith("/image-target/tracker/tracker.js")) {
        patchCounts.tracker += 1;
        const widerSearch = replaceExactlyOnce(
          code,
          "const AR2_SEARCH_SIZE = 10;",
          "const AR2_SEARCH_SIZE = 14;",
          "tracking search radius",
        );
        return replaceExactlyOnce(
          widerSearch,
          "const AR2_SIM_THRESH = 0.8;",
          "const AR2_SIM_THRESH = 0.72;",
          "tracking similarity threshold",
        );
      }
      return null;
    },
  };
}

await build({
  root: ROOT,
  configFile: false,
  publicDir: false,
  logLevel: "warn",
  plugins: [fieldTuningPlugin()],
  worker: {
    plugins: () => [fieldTuningPlugin()],
  },
  build: {
    outDir: OUTPUT_DIR,
    emptyOutDir: false,
    minify: "esbuild",
    sourcemap: false,
    target: "es2019",
    lib: {
      entry: path.join(ROOT, "tools", "mindar_image_aframe_field_entry.js"),
      name: "MindARImageAFrameField",
      formats: ["iife"],
      fileName: () => OUTPUT_FILE,
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        banner: "/*! MindAR 1.2.5 (MIT) - field-tuned: 15 features/bucket, 4 inliers, 14px search, 0.72 tracking similarity */",
      },
    },
  },
});

if (patchCounts.detector !== 1 || patchCounts.matcher !== 1 || patchCounts.tracker !== 1) {
  throw new Error(`MindAR tuning was not applied exactly once: ${JSON.stringify(patchCounts)}`);
}

fs.copyFileSync(
  path.join(ROOT, "node_modules", "mind-ar", "LICENSE"),
  path.join(OUTPUT_DIR, "LICENSE"),
);

const stat = fs.statSync(path.join(OUTPUT_DIR, OUTPUT_FILE));
process.stdout.write(`wrote public/vendor/mindar/${OUTPUT_FILE} (${stat.size} bytes)\n`);
