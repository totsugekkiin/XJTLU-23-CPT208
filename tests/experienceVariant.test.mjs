import test from "node:test";
import assert from "node:assert/strict";

import {
  createVariantHref,
  EXPERIENCE_VARIANT_AR,
  EXPERIENCE_VARIANT_TEXT,
  resolveExperienceVariant,
} from "../js/appmain/experienceVariant.js";
import { AR_MAP_PROFILES } from "../js/ar/arAnchors.js";
import { CHANGMEN_HISTORY_CONTENTS } from "../js/content/changmenExperienceContent.js";

test("resolves the two explicit experience variants", () => {
  assert.equal(resolveExperienceVariant("?variant=ar"), EXPERIENCE_VARIANT_AR);
  assert.equal(resolveExperienceVariant("?variant=text"), EXPERIENCE_VARIANT_TEXT);
});

test("keeps the original AR experience as the safe fallback", () => {
  assert.equal(resolveExperienceVariant(""), EXPERIENCE_VARIANT_AR);
  assert.equal(resolveExperienceVariant("?variant=unknown"), EXPERIENCE_VARIANT_AR);
});

test("preserves the chosen variant when building internal links", () => {
  assert.equal(
    createVariantHref("appMain.html", EXPERIENCE_VARIANT_TEXT, { resume: "gate" }),
    "appMain.html?variant=text&resume=gate",
  );
  assert.equal(
    createVariantHref("map.html", EXPERIENCE_VARIANT_AR),
    "map.html?variant=ar",
  );
});

test("keeps AR bamboo notices aligned with the shared non-AR history content", () => {
  const arBambooContentIds = AR_MAP_PROFILES
    .flatMap((profile) => profile.anchors)
    .filter((anchor) => anchor.type === "bamboo-notice")
    .map((anchor) => anchor.content)
    .sort();
  const sharedHistoryContentIds = CHANGMEN_HISTORY_CONTENTS
    .map((content) => content.id)
    .sort();

  assert.deepEqual(arBambooContentIds, sharedHistoryContentIds);
});
