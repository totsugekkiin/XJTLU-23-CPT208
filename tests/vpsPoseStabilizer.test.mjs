import test from "node:test";
import assert from "node:assert/strict";

import { createVpsPoseStabilizer } from "../js/ar/vpsPoseStabilizer.js";

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

function measurement(counter, position, timestamp, source = "device") {
  return {
    mapId: 148688,
    counter,
    position,
    rotation: IDENTITY,
    timestamp,
    source,
    latencyMs: source === "server" ? 600 : 20,
  };
}

test("accepts the first VPS pose immediately", () => {
  const stabilizer = createVpsPoseStabilizer();
  const result = stabilizer.observe(measurement(1, { x: 1, y: 2, z: 3 }, 0));
  const pose = stabilizer.getPose({ timestamp: 0 });

  assert.equal(result.accepted, true);
  assert.deepEqual(pose.position, { x: 1, y: 2, z: 3 });
  assert.equal(pose.tracking.mode, "filtered-hold");
});

test("rejects an isolated large jump and requires repeated confirmation", () => {
  const stabilizer = createVpsPoseStabilizer();
  stabilizer.observe(measurement(1, { x: 0, y: 0, z: 0 }, 0));

  const firstJump = stabilizer.observe(measurement(2, { x: 5, y: 0, z: 0 }, 100));
  const secondJump = stabilizer.observe(measurement(3, { x: 5.1, y: 0, z: 0 }, 200));
  const thirdJump = stabilizer.observe(measurement(4, { x: 5.05, y: 0, z: 0 }, 300));

  assert.equal(firstJump.accepted, false);
  assert.equal(secondJump.accepted, false);
  assert.equal(thirdJump.accepted, true);
  assert.equal(thirdJump.reason, "confirmed-jump");
  assert.equal(stabilizer.getPose({ timestamp: 300 }).position.x > 3, true);
});

test("clamps prediction distance and fades it back to the filtered pose", () => {
  const stabilizer = createVpsPoseStabilizer();
  stabilizer.observe(measurement(1, { x: 0, y: 0, z: 0 }, 0));

  const predicted = stabilizer.getPose({
    timestamp: 50,
    estimatedPosition: { x: 10, y: 0, z: 0 },
  });
  const expired = stabilizer.getPose({
    timestamp: 500,
    estimatedPosition: { x: 10, y: 0, z: 0 },
  });

  assert.equal(predicted.position.x <= 0.12, true);
  assert.equal(predicted.position.x > 0, true);
  assert.equal(predicted.tracking.mode, "bounded-prediction");
  assert.equal(expired.position.x, 0);
  assert.equal(expired.tracking.mode, "filtered-hold");
});

test("does not predict from delayed server localization", () => {
  const stabilizer = createVpsPoseStabilizer();
  stabilizer.observe(measurement(1, { x: 0, y: 0, z: 0 }, 0, "server"));

  const pose = stabilizer.getPose({
    timestamp: 50,
    estimatedPosition: { x: 1, y: 0, z: 0 },
  });

  assert.equal(pose.position.x, 0);
  assert.equal(pose.tracking.mode, "filtered-hold");
  assert.equal(pose.tracking.source, "server");
});

test("requires confirmation for a large rotation-only correction", () => {
  const stabilizer = createVpsPoseStabilizer();
  stabilizer.observe(measurement(1, { x: 0, y: 0, z: 0 }, 0));
  const quarterTurn = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };

  const first = stabilizer.observe({
    ...measurement(2, { x: 0, y: 0, z: 0 }, 100),
    rotation: quarterTurn,
  });
  const second = stabilizer.observe({
    ...measurement(3, { x: 0, y: 0, z: 0 }, 200),
    rotation: quarterTurn,
  });
  const third = stabilizer.observe({
    ...measurement(4, { x: 0, y: 0, z: 0 }, 300),
    rotation: quarterTurn,
  });

  assert.equal(first.accepted, false);
  assert.equal(second.accepted, false);
  assert.equal(third.accepted, true);
  assert.equal(third.reason, "confirmed-jump");
});
