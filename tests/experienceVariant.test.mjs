import test from "node:test";
import assert from "node:assert/strict";

import {
  createVariantHref,
  EXPERIENCE_VARIANT_AR,
  EXPERIENCE_VARIANT_TEXT,
  resolveExperienceVariant,
} from "../js/appmain/experienceVariant.js";

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
