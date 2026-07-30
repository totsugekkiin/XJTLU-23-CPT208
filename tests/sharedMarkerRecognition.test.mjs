import assert from "node:assert/strict";
import test from "node:test";

import {
  MARKER_TRACKING_HOLD_MS,
  createTrackingLossGuard,
  resolveSharedPortalConfig,
  syncVideoFrameSize,
} from "../js/ar/sharedMarkerRecognition.js";
import {
  FarApertureCvSnapper,
  normalizeApertureCvSnapshot,
  resolveCoverSource,
} from "../js/ar/farApertureCvSnapper.js";

function createSnapperState(overrides = {}) {
  const snapper = Object.create(FarApertureCvSnapper.prototype);
  return Object.assign(
    snapper,
    {
      enabled: true,
      destroyed: false,
      mode: "locked",
      confidence: 0.82,
      lockEstablished: true,
      targetCorrections: [
        { x: -0.04, y: 0.03 },
        { x: 0.02, y: 0.025 },
        { x: 0.018, y: -0.035 },
        { x: -0.03, y: -0.028 },
      ],
      smoothedCorrections: [
        { x: -0.035, y: 0.026 },
        { x: 0.018, y: 0.021 },
        { x: 0.015, y: -0.031 },
        { x: -0.027, y: -0.024 },
      ],
      measurements: [],
      lastOverlayCorners: Array.from({ length: 4 }, () => ({ x: 0, y: 0 })),
      setMode(mode, confidence) {
        this.mode = mode;
        this.confidence = confidence;
      },
    },
    overrides,
  );
}

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

test("shared marker portal resolves each dynasty's own runtime scene", () => {
  const song = resolveSharedPortalConfig("song");
  const ming = resolveSharedPortalConfig("ming");
  const qing = resolveSharedPortalConfig("qing");

  assert.equal(song.profile.id, "song");
  assert.equal(ming.profile.id, "ming");
  assert.equal(qing.profile.id, "qing");
  assert.notEqual(song.profile.runtime.url, ming.profile.runtime.url);
  assert.notEqual(ming.profile.runtime.url, qing.profile.runtime.url);
  assert.deepEqual(ming.view, ming.profile.view);
  assert.deepEqual(qing.crop, qing.profile.crop);
});

test("only the default dynasty uses the saved portal composition", () => {
  const saved = {
    view: {
      x: 1,
      y: 2,
      z: 3,
      yaw: 4,
      pitch: 5,
      roll: 6,
      fov: 70,
    },
    crop: {
      cx: 1,
      cy: 2,
      cz: 3,
      sx: 4,
      sy: 5,
      sz: 6,
      rx: 7,
      ry: 8,
      rz: 9,
    },
    portalFov: 48,
  };

  const song = resolveSharedPortalConfig("song", saved);
  const ming = resolveSharedPortalConfig("ming", saved);

  assert.equal(song.view, saved.view);
  assert.equal(song.crop, saved.crop);
  assert.equal(song.portalFov, 48);
  assert.notEqual(ming.view, saved.view);
  assert.notEqual(ming.crop, saved.crop);
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

test("locked aperture CV state survives a portal renderer replacement", () => {
  const previous = createSnapperState();
  const snapshot = previous.captureState();

  assert.ok(snapshot);
  previous.targetCorrections[0].x = 0.2;
  assert.equal(snapshot.targetCorrections[0].x, -0.04);

  const replacement = createSnapperState({
    mode: "fallback",
    confidence: 0,
    lockEstablished: false,
    targetCorrections: Array.from({ length: 4 }, () => ({ x: 0, y: 0 })),
    smoothedCorrections: Array.from({ length: 4 }, () => ({ x: 0, y: 0 })),
  });
  assert.equal(replacement.restoreState(snapshot), true);
  assert.equal(replacement.mode, "locked");
  assert.equal(replacement.lockEstablished, true);
  assert.equal(replacement.confidence, 0.82);
  assert.deepEqual(replacement.targetCorrections, snapshot.targetCorrections);
  assert.deepEqual(replacement.smoothedCorrections, snapshot.smoothedCorrections);
  assert.equal(replacement.measurements.length, 1);
});

test("aperture CV snapshots reject stale or unsafe corrections", () => {
  const valid = createSnapperState().captureState();
  assert.ok(valid);
  assert.equal(
    normalizeApertureCvSnapshot({ ...valid, version: valid.version + 1 }),
    null,
  );
  assert.equal(
    normalizeApertureCvSnapshot({
      ...valid,
      targetCorrections: [
        ...valid.targetCorrections.slice(0, 3),
        { x: 0.5, y: 0 },
      ],
    }),
    null,
  );
});
