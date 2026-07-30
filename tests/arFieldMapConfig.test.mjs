import test from "node:test";
import assert from "node:assert/strict";

import {
  AR_FIELD_MAP_HEIGHT,
  AR_FIELD_MAP_STORAGE_KEY,
  AR_FIELD_MAP_WIDTH,
  applyFieldMapOverrides,
  createFieldMapPayload,
  getDefaultFieldMapLocations,
  readFieldMapOverrides,
  saveFieldMapLocations,
} from "../js/ar/arFieldMapConfig.js";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test("field map exposes five bamboo locations and one window", () => {
  const locations = getDefaultFieldMapLocations();
  assert.equal(locations.length, 6);
  assert.equal(locations.filter((location) => location.type === "bamboo").length, 5);
  assert.equal(locations.filter((location) => location.type === "window").length, 1);
  assert.deepEqual(locations.map((location) => location.markerLabel), ["1", "2", "3", "4", "5", "窗"]);
});

test("field map clamps stored overrides to the SVG bounds", () => {
  const defaults = getDefaultFieldMapLocations();
  const firstId = defaults[0].id;
  const windowId = defaults[5].id;
  const resolved = applyFieldMapOverrides(defaults, {
    [firstId]: [-25, 99.44],
    [windowId]: [999, 999],
    unknown: [10, 10],
  });

  assert.deepEqual(resolved[0].fieldMapPosition, [0, 99.4]);
  assert.deepEqual(resolved[5].fieldMapPosition, [AR_FIELD_MAP_WIDTH, AR_FIELD_MAP_HEIGHT]);
});

test("field map positions round-trip through browser storage", () => {
  const storage = createStorage();
  const locations = getDefaultFieldMapLocations();
  locations[0].fieldMapPosition = [123.4, 56.7];

  const payload = saveFieldMapLocations(locations, storage);
  assert.deepEqual(payload, createFieldMapPayload(locations));
  assert.deepEqual(readFieldMapOverrides(storage), payload.positions);
  assert.ok(storage.getItem(AR_FIELD_MAP_STORAGE_KEY));
});
