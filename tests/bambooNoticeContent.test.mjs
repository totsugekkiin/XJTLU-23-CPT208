import test from "node:test";
import assert from "node:assert/strict";

import {
  applyBambooNoticeFinish,
  attachBambooNoticeText,
  BAMBOO_NOTICE_FINISH,
  BAMBOO_NOTICE_CONTENT_OPTIONS,
  DEFAULT_BAMBOO_NOTICE_CONTENT_ID,
  getBambooNoticeContent,
} from "../js/ar/bambooNotice.js";
import * as THREE from "three";
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

test("uses a lighter, softer finish for bamboo model materials", () => {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const model = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

  applyBambooNoticeFinish(model);

  assert.equal(material.color.r, BAMBOO_NOTICE_FINISH.colorMultiplier);
  assert.equal(material.color.g, BAMBOO_NOTICE_FINISH.colorMultiplier);
  assert.equal(material.color.b, BAMBOO_NOTICE_FINISH.colorMultiplier);
  assert.equal(material.emissive.getHexString(), "d8b77a");
  assert.equal(material.emissiveIntensity, BAMBOO_NOTICE_FINISH.emissiveIntensity);

  material.dispose();
  model.geometry.dispose();
});

test("places notice text in model-local coordinates after the model is transformed", () => {
  const context = {
    clearRect() {},
    save() {},
    restore() {},
    strokeText() {},
    fillText() {},
  };
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return { width: 0, height: 0, getContext: () => context };
    },
  };

  const model = new THREE.Group();
  model.position.set(10, -6, 4);
  model.rotation.set(0.2, -0.1, 0.3);
  model.scale.set(2, 1.5, 0.5);

  const bamboo = new THREE.Mesh(
    new THREE.BoxGeometry(4, 2, 0.2),
    new THREE.MeshBasicMaterial(),
  );
  bamboo.position.set(1, 2, 3);
  model.add(bamboo);

  try {
    const notice = attachBambooNoticeText(model);

    assert.ok(notice.mesh.position.distanceTo(new THREE.Vector3(1, 2, 3.106)) < 1e-8);
    assert.ok(Math.abs(notice.mesh.geometry.parameters.width - 3.16) < 1e-9);
    assert.ok(Math.abs(notice.mesh.geometry.parameters.height - 1.5) < 1e-9);

    notice.dispose();
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    bamboo.geometry.dispose();
    bamboo.material.dispose();
  }
});
