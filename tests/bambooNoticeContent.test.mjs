import test from "node:test";
import assert from "node:assert/strict";

import {
  BAMBOO_NOTICE_CONTENT_OPTIONS,
  DEFAULT_BAMBOO_NOTICE_CONTENT_ID,
  getBambooNoticeContent,
} from "../js/ar/bambooNotice.js";
import { AR_MAP_PROFILES } from "../js/ar/arAnchors.js";
import { CHANGMEN_HISTORY_CONTENTS } from "../js/content/changmenExperienceContent.js";

test("provides five selectable nine-column bamboo notice contents", () => {
  assert.equal(BAMBOO_NOTICE_CONTENT_OPTIONS.length, 5);

  for (const content of BAMBOO_NOTICE_CONTENT_OPTIONS) {
    assert.equal(content.columns.length, 9, `${content.id} should contain nine columns`);
    assert.ok(content.article.length >= 60, `${content.id} should contain a substantive article`);
    assert.ok(
      content.columns.every((column) => Array.from(column).length <= 12),
      `${content.id} contains a column longer than twelve characters`,
    );
  }
});

test("AR bamboo notices and the text version share one history source", () => {
  assert.equal(BAMBOO_NOTICE_CONTENT_OPTIONS, CHANGMEN_HISTORY_CONTENTS);
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

test("all bamboo anchors shown on the field map have a valid position", () => {
  const anchors = AR_MAP_PROFILES.flatMap((profile) => profile.anchors)
    .filter((anchor) => anchor.type === "bamboo-notice" && anchor.fieldMapPosition);

  assert.equal(anchors.length, 5);
  for (const anchor of anchors) {
    assert.equal(anchor.fieldMapPosition.length, 2);
    const [x, y] = anchor.fieldMapPosition;
    assert.ok(x >= 0 && x <= 606, `${anchor.id} map x is outside the field plan`);
    assert.ok(y >= 0 && y <= 234, `${anchor.id} map y is outside the field plan`);
  }
});
