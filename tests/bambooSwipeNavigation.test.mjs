import test from "node:test";
import assert from "node:assert/strict";

import {
  getAdjacentBambooContentId,
  getHorizontalSwipeStep,
} from "../js/ar/bambooSwipeNavigation.js";

test("maps horizontal swipes to previous and next bamboo slips", () => {
  assert.equal(getHorizontalSwipeStep({ x: 300, y: 200 }, { x: 180, y: 210 }), 1);
  assert.equal(getHorizontalSwipeStep({ x: 100, y: 200 }, { x: 220, y: 190 }), -1);
});

test("ignores short or mostly vertical gestures", () => {
  assert.equal(getHorizontalSwipeStep({ x: 100, y: 100 }, { x: 130, y: 102 }), 0);
  assert.equal(getHorizontalSwipeStep({ x: 100, y: 100 }, { x: 160, y: 210 }), 0);
});

test("cycles through collected bamboo slips in both directions", () => {
  const contentIds = ["spring-autumn", "tang", "southern-song"];

  assert.equal(getAdjacentBambooContentId(contentIds, "spring-autumn", 1), "tang");
  assert.equal(getAdjacentBambooContentId(contentIds, "southern-song", 1), "spring-autumn");
  assert.equal(getAdjacentBambooContentId(contentIds, "spring-autumn", -1), "southern-song");
});
