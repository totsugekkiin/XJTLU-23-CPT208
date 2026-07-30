import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateLocalizationCounter,
  isAcceptedLocalizationPose,
} from "../js/ar/localizationAcceptance.js";

function trackedPose({ accepted = true, reason = "in-range", mapId = 149877 } = {}) {
  return {
    mapId,
    poseFilter: {
      observation: { accepted, reason },
    },
  };
}

test("accepts one fresh SDK localization counter exactly once", () => {
  const first = evaluateLocalizationCounter({
    lastCounter: 0,
    counter: 1,
    trackedPose: trackedPose(),
  });
  const duplicate = evaluateLocalizationCounter({
    lastCounter: first.lastCounter,
    counter: 1,
    trackedPose: trackedPose(),
  });

  assert.equal(first.isNew, true);
  assert.equal(first.accepted, true);
  assert.equal(first.mapId, 149877);
  assert.equal(duplicate.isNew, false);
  assert.equal(duplicate.accepted, false);
});

test("does not confirm a pose rejected by the VPS stabilizer", () => {
  const pose = trackedPose({ accepted: false, reason: "unconfirmed-jump" });
  const result = evaluateLocalizationCounter({
    lastCounter: 4,
    counter: 5,
    trackedPose: pose,
  });

  assert.equal(isAcceptedLocalizationPose(pose), false);
  assert.equal(result.isNew, true);
  assert.equal(result.accepted, false);
  assert.equal(result.lastCounter, 5);
  assert.equal(result.reason, "unconfirmed-jump");
});

test("consumes a fresh counter even when its tracked pose is missing", () => {
  const result = evaluateLocalizationCounter({
    lastCounter: 7,
    counter: 8,
    trackedPose: null,
  });

  assert.equal(result.isNew, true);
  assert.equal(result.accepted, false);
  assert.equal(result.lastCounter, 8);
  assert.equal(result.reason, "missing-pose");
});
