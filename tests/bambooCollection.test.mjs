import assert from "node:assert/strict";
import test from "node:test";

import {
  BAMBOO_COLLECTION_STORAGE_KEY,
  collectBambooNotice,
  normalizeBambooCollection,
  readBambooCollection,
  saveBambooCollection,
} from "../js/ar/bambooCollection.js";

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

test("collects a visible bamboo immediately and deduplicates its content", () => {
  const first = collectBambooNotice([], {
    contentId: "tang",
    mapId: 149922,
    anchorId: "bamboo-notice-4",
  }, 1234);
  const duplicate = collectBambooNotice(first.entries, {
    contentId: "tang",
    mapId: 149878,
    anchorId: "bamboo-notice",
  }, 5678);

  assert.equal(first.added, true);
  assert.deepEqual(first.entries, [{
    contentId: "tang",
    mapId: 149922,
    anchorId: "bamboo-notice-4",
    collectedAt: 1234,
  }]);
  assert.equal(duplicate.added, false);
  assert.deepEqual(duplicate.entries, first.entries);
});

test("ignores unknown content and malformed saved entries", () => {
  assert.deepEqual(normalizeBambooCollection([
    { contentId: "unknown" },
    null,
    { contentId: "modern", mapId: "149922", collectedAt: "20" },
  ]), [{
    contentId: "modern",
    mapId: 149922,
    anchorId: null,
    collectedAt: 20,
  }]);
});

test("persists backpack contents across AR visits", () => {
  const storage = createStorage();
  const entries = saveBambooCollection([
    { contentId: "spring-autumn", mapId: 149922, anchorId: "bamboo-notice-5" },
  ], storage);

  assert.ok(storage.getItem(BAMBOO_COLLECTION_STORAGE_KEY));
  assert.deepEqual(readBambooCollection(storage), entries);
});
