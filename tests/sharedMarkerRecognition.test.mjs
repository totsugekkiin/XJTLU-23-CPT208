import assert from "node:assert/strict";
import test from "node:test";

import { syncVideoFrameSize } from "../js/ar/sharedMarkerRecognition.js";

test("syncVideoFrameSize mirrors intrinsic camera dimensions for MindAR", () => {
  const video = {
    videoWidth: 1280,
    videoHeight: 960,
    width: 0,
    height: 0,
  };

  assert.equal(syncVideoFrameSize(video), true);
  assert.equal(video.width, 1280);
  assert.equal(video.height, 960);
});

test("syncVideoFrameSize rejects a camera without a readable frame", () => {
  const video = {
    videoWidth: 0,
    videoHeight: 0,
    width: 0,
    height: 0,
  };

  assert.equal(syncVideoFrameSize(video), false);
  assert.equal(video.width, 0);
  assert.equal(video.height, 0);
});
