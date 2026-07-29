import assert from "node:assert/strict";
import test from "node:test";

import { applyVideoLayout } from "../public/vendor/immersal/videoLayout.js";

function createVideoElement(width = 1920, height = 1080) {
  return {
    width,
    height,
    style: {},
  };
}

test("shared camera layout preserves intrinsic frame attributes", () => {
  const video = createVideoElement();

  applyVideoLayout(
    video,
    { width: 1422, height: 800, x: -531, y: 0 },
    { ownsCamera: false },
  );

  assert.equal(video.style.width, "1422px");
  assert.equal(video.style.height, "800px");
  assert.equal(video.width, 1920);
  assert.equal(video.height, 1080);
});

test("owned camera layout may resize its frame attributes", () => {
  const video = createVideoElement();

  applyVideoLayout(
    video,
    { width: 1422, height: 800, x: -531, y: 0 },
    { ownsCamera: true, positionElement: true },
  );

  assert.equal(video.width, 1422);
  assert.equal(video.height, 800);
  assert.equal(video.style.left, "-531px");
  assert.equal(video.style.top, "0px");
});
