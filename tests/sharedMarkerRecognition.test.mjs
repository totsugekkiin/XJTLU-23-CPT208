import assert from "node:assert/strict";
import test from "node:test";

import {
  MARKER_TRACKING_HOLD_MS,
  createTrackingLossGuard,
  syncVideoFrameSize,
} from "../js/ar/sharedMarkerRecognition.js";
import { resolveCoverSource } from "../js/ar/farApertureCvSnapper.js";

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

test("tracking loss guard keeps the portal alive across a brief miss", () => {
  let scheduled = null;
  let expired = 0;
  const guard = createTrackingLossGuard({
    onExpired: () => {
      expired += 1;
    },
    setTimer(callback, delay) {
      assert.equal(delay, MARKER_TRACKING_HOLD_MS);
      scheduled = callback;
      return 17;
    },
    clearTimer(timerId) {
      assert.equal(timerId, 17);
      scheduled = null;
    },
  });

  assert.equal(guard.markMissing(), true);
  assert.equal(guard.markMissing(), false);
  assert.equal(guard.pending, true);
  assert.equal(guard.markPresent(), true);
  assert.equal(guard.pending, false);
  assert.equal(scheduled, null);
  assert.equal(expired, 0);
});

test("tracking loss guard expires once when the marker stays absent", () => {
  let scheduled = null;
  let expired = 0;
  const guard = createTrackingLossGuard({
    holdMs: 450,
    onExpired: () => {
      expired += 1;
    },
    setTimer(callback, delay) {
      assert.equal(delay, 450);
      scheduled = callback;
      return 23;
    },
    clearTimer() {},
  });

  guard.markMissing();
  scheduled();

  assert.equal(expired, 1);
  assert.equal(guard.pending, false);
});

test("cover source maps the visible portrait viewport into the shared video", () => {
  const video = {
    videoWidth: 1920,
    videoHeight: 1080,
    getBoundingClientRect() {
      return {
        left: 0,
        top: 0,
        width: 360,
        height: 800,
      };
    },
  };

  const source = resolveCoverSource(video, {
    left: 0,
    top: 0,
    width: 360,
    height: 800,
  });

  assert.ok(source);
  assert.ok(Math.abs(source.x - 717) < 1);
  assert.ok(Math.abs(source.y) < 0.01);
  assert.ok(Math.abs(source.width - 486) < 1);
  assert.ok(Math.abs(source.height - 1080) < 0.01);
});
