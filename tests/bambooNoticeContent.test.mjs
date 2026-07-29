import test from "node:test";
import assert from "node:assert/strict";

import {
  BAMBOO_NOTICE_CONTENT_OPTIONS,
  DEFAULT_BAMBOO_NOTICE_CONTENT_ID,
  getBambooNoticeContent,
} from "../js/ar/bambooNotice.js";
import { AR_MAP_PROFILES } from "../js/ar/arAnchors.js";

test("provides five selectable nine-column bamboo notice contents", () => {
  assert.equal(BAMBOO_NOTICE_CONTENT_OPTIONS.length, 5);

  for (const content of BAMBOO_NOTICE_CONTENT_OPTIONS) {
    assert.equal(content.columns.length, 9, `${content.id} should contain nine columns`);
    assert.ok(
      content.columns.every((column) => Array.from(column).length <= 12),
      `${content.id} contains a column longer than twelve characters`,
    );
  }
});

test("falls back to the documented default content", () => {
  assert.equal(
    getBambooNoticeContent("not-a-real-content").id,
    DEFAULT_BAMBOO_NOTICE_CONTENT_ID,
  );
});

test("all configured bamboo anchors reference known content", () => {
  const anchors = AR_MAP_PROFILES.flatMap((profile) => profile.anchors)
    .filter((anchor) => anchor.type === "bamboo-notice");

  assert.ok(anchors.length > 0);
  for (const anchor of anchors) {
    assert.equal(getBambooNoticeContent(anchor.content).id, anchor.content);
  }
});
