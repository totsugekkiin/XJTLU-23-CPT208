import test from "node:test";
import assert from "node:assert/strict";
import * as pc from "playcanvas";

import { PortalFlightController } from "../js/ar/portalFlightController.js";
import { PORTAL_NAVIGATION_UP } from "../js/ar/portalSceneConfig.js";

const SERIALIZED_VIEW_YAW_AXIS = new pc.Vec3(0, -1, 0);
const NAVIGATION_UP = new pc.Vec3(...PORTAL_NAVIGATION_UP);
const EDITOR_HOME_PITCH = 35;

function createLegacyCamera(view) {
  const camera = new pc.Entity("test-camera");
  const baseRotation = new pc.Quat()
    .setFromEulerAngles(EDITOR_HOME_PITCH, 0, 0)
    .mul(new pc.Quat().setFromEulerAngles(0, 0, 180));
  const rotation = new pc.Quat().mul2(
    new pc.Quat().setFromAxisAngle(SERIALIZED_VIEW_YAW_AXIS, view.yaw),
    baseRotation,
  );

  camera.setPosition(view.x, view.y, view.z);
  camera.setRotation(rotation);
  camera.rotateLocal(view.pitch - EDITOR_HOME_PITCH, 0, 0);
  camera.rotateLocal(0, 0, view.roll);
  return camera;
}

test("turns 180 degrees in place without mutating locked scene data", () => {
  const lockedView = Object.freeze({
    x: -0.847,
    y: -4.059,
    z: 0.069,
    yaw: 15,
    pitch: -24.9,
    roll: -5.5,
    fov: 75,
  });
  const originalData = JSON.stringify(lockedView);
  const camera = createLegacyCamera(lockedView);
  const originalPosition = camera.getPosition().clone();
  const originalForward = camera.forward.clone();
  const controller = new PortalFlightController(camera, {
    worldUp: NAVIGATION_UP,
  });

  controller.begin({ fov: lockedView.fov });
  const before = camera.forward.clone();
  controller.lookByPixels(1800, 0);
  const after = camera.forward.clone();

  assert.equal(JSON.stringify(lockedView), originalData);
  assert.ok(camera.getPosition().equals(originalPosition));
  assert.ok(before.equals(originalForward, 1e-6));
  assert.ok(Math.abs(before.dot(NAVIGATION_UP) - after.dot(NAVIGATION_UP)) < 1e-6);
  assert.ok(
    before
      .clone()
      .sub(NAVIGATION_UP.clone().mulScalar(before.dot(NAVIGATION_UP)))
      .normalize()
      .dot(
        after
          .clone()
          .sub(NAVIGATION_UP.clone().mulScalar(after.dot(NAVIGATION_UP)))
          .normalize(),
      ) < -0.999,
  );
});

test("uses camera-forward movement and the scan's physical -Z elevation", () => {
  const camera = createLegacyCamera({
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 70,
    roll: 0,
  });
  const controller = new PortalFlightController(camera, {
    worldUp: NAVIGATION_UP,
  });

  controller.begin();
  controller.move(2, 0, 0);
  const afterForward = camera.getPosition().clone();
  controller.move(0, 0, 1);
  const afterRise = camera.getPosition().clone();

  assert.ok(afterForward.length() > 1.99);
  assert.ok(
    Math.abs(
      afterRise.clone().sub(afterForward).dot(NAVIGATION_UP) - 1,
    ) < 1e-6,
  );
  assert.ok(Math.abs(afterRise.z - afterForward.z + 1) < 1e-6);
});

test("levels the Ming scan against physical up without changing locked data", () => {
  const lockedView = Object.freeze({
    x: 1.269,
    y: 12.965,
    z: -1.625,
    yaw: 244.3,
    pitch: 89,
    roll: 0,
    fov: 75,
  });
  const originalData = JSON.stringify(lockedView);
  const camera = createLegacyCamera(lockedView);
  const originalPosition = camera.getPosition().clone();
  const controller = new PortalFlightController(camera, {
    worldUp: NAVIGATION_UP,
  });

  controller.begin({ fov: lockedView.fov });

  const projectedPhysicalUp = NAVIGATION_UP
    .clone()
    .sub(camera.forward.clone().mulScalar(NAVIGATION_UP.dot(camera.forward)))
    .normalize();
  assert.equal(JSON.stringify(lockedView), originalData);
  assert.ok(camera.getPosition().equals(originalPosition));
  assert.ok(camera.up.dot(projectedPhysicalUp) > 0.999);
});

test("re-entering flight continues from the retained endpoint", () => {
  const camera = createLegacyCamera({
    x: -1.868,
    y: 0.455,
    z: -5.56,
    yaw: -36.1,
    pitch: -17.4,
    roll: -7.6,
  });
  const controller = new PortalFlightController(camera, {
    worldUp: NAVIGATION_UP,
  });

  controller.begin({ fov: 75 });
  controller.lookByDegrees(82.9, -0.8);
  controller.move(3.4, -0.6, 0.25);
  const endpointPosition = camera.getPosition().clone();
  const endpointForward = camera.forward.clone();

  controller.end();
  assert.ok(camera.getPosition().equals(endpointPosition));
  assert.ok(camera.forward.dot(endpointForward) > 0.999999);

  controller.begin({ fov: 75 });
  assert.ok(camera.getPosition().equals(endpointPosition));
  assert.ok(camera.forward.dot(endpointForward) > 0.999999);
});
