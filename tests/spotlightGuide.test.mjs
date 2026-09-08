import assert from "node:assert/strict";
import test from "node:test";

import {
  SPOTLIGHT_GUIDE_STATUS,
  SPOTLIGHT_GUIDE_STEPS,
  getSpotlightCardPosition,
  getSpotlightFrameRect,
  isSpotlightReplayRequested,
  readSpotlightGuideStatus,
  shouldAutoStartSpotlightGuide,
  writeSpotlightGuideStatus,
} from "../js/appmain/spotlightGuide.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test("defines the four first-screen guide steps in display order", () => {
  assert.deepEqual(
    SPOTLIGHT_GUIDE_STEPS.map((step) => step.id),
    ["pet", "pet-recall", "guide-menu", "scroll"],
  );
});

test("persists only valid spotlight guide statuses", () => {
  const storage = createStorage();
  assert.equal(readSpotlightGuideStatus(storage), null);
  assert.equal(writeSpotlightGuideStatus(SPOTLIGHT_GUIDE_STATUS.STARTED, storage), true);
  assert.equal(readSpotlightGuideStatus(storage), SPOTLIGHT_GUIDE_STATUS.STARTED);
  assert.equal(writeSpotlightGuideStatus("unknown", storage), false);
  assert.equal(readSpotlightGuideStatus(storage), SPOTLIGHT_GUIDE_STATUS.STARTED);
});

test("auto-starts only on an unseen guide at the first screen", () => {
  const unseen = createStorage();
  assert.equal(shouldAutoStartSpotlightGuide({ storage: unseen }), true);
  assert.equal(shouldAutoStartSpotlightGuide({ storage: unseen, isAtPageStart: false }), false);
  assert.equal(shouldAutoStartSpotlightGuide({ storage: unseen, isRiverPage: true }), false);

  const completed = createStorage({
    "changmen.spotlight-guide.v1": SPOTLIGHT_GUIDE_STATUS.COMPLETED,
  });
  assert.equal(shouldAutoStartSpotlightGuide({ storage: completed }), false);
  assert.equal(shouldAutoStartSpotlightGuide({ storage: completed, force: true }), true);
});

test("recognizes explicit spotlight replay requests", () => {
  assert.equal(isSpotlightReplayRequested("?variant=text&spotlight=1"), true);
  assert.equal(isSpotlightReplayRequested("?spotlight=0"), false);
  assert.equal(isSpotlightReplayRequested(""), false);
});

test("clamps the spotlight frame to the visible viewport", () => {
  assert.deepEqual(
    getSpotlightFrameRect(
      { left: -4, top: 10, right: 96, bottom: 80 },
      { width: 90, height: 70 },
      8,
    ),
    { left: 0, top: 2, right: 90, bottom: 70, width: 90, height: 68 },
  );
});

test("places the explanation card below or above based on available space", () => {
  assert.deepEqual(
    getSpotlightCardPosition({
      frame: { left: 100, top: 100, bottom: 200, width: 80 },
      cardSize: { width: 200, height: 100 },
      viewport: { width: 400, height: 500 },
    }),
    { left: 40, top: 216, placement: "below" },
  );

  assert.deepEqual(
    getSpotlightCardPosition({
      frame: { left: 100, top: 400, bottom: 450, width: 80 },
      cardSize: { width: 200, height: 100 },
      viewport: { width: 400, height: 500 },
    }),
    { left: 40, top: 284, placement: "above" },
  );
});

test("uses side placement when a large target leaves no vertical room", () => {
  assert.deepEqual(
    getSpotlightCardPosition({
      frame: { left: 300, top: 120, right: 650, bottom: 520, width: 350, height: 400 },
      cardSize: { width: 260, height: 220 },
      viewport: { width: 1000, height: 620 },
    }),
    { left: 666, top: 210, placement: "right" },
  );
});
