import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBINED_MAP_IDS,
  STANDALONE_MAP_ID,
  getAllMapIds,
  getMapProfile,
  resolveActiveMapIds,
} from "../js/ar/arAnchors.js";

test("default selection keeps the original three-map combination", () => {
  assert.deepEqual(resolveActiveMapIds({ search: "", selectedValue: "all" }), [
    148753,
    149877,
    149878,
  ]);
  assert.deepEqual(COMBINED_MAP_IDS, [148753, 149877, 149878]);
});

test("149922 can be selected as a standalone Immersal map", () => {
  assert.equal(STANDALONE_MAP_ID, 149922);
  assert.deepEqual(resolveActiveMapIds({ search: "", selectedValue: "149922" }), [149922]);
  assert.deepEqual(resolveActiveMapIds({ search: "?map=149922", selectedValue: "all" }), [149922]);
});

test("149922 exposes the five anchors exported by the placement editor", () => {
  assert.deepEqual(getAllMapIds(), [148753, 149877, 149878, 149922]);
  const anchors = getMapProfile(149922)?.anchors ?? [];
  assert.equal(anchors.length, 5);
  assert.deepEqual(
    anchors.map((anchor) => anchor.content),
    ["ming-qing", "modern", "southern-song", "tang", "spring-autumn"],
  );
  assert.deepEqual(anchors[0].position, [4.528, -0.4336, -9.5093]);
  assert.deepEqual(anchors[4].rotation, [0, 1.4301, 0]);
});
