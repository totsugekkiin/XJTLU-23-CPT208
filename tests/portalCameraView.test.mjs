import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { readPortalCameraView } from "../js/ar/portalCameraView.js";

const HOME_PITCH = 35;
const SERIALIZED_YAW_AXIS = new pc.Vec3(0, -1, 0);

function applyPortalView(entity, view) {
  const baseRotation = new pc.Quat()
    .setFromEulerAngles(HOME_PITCH, 0, 0)
    .mul(new pc.Quat().setFromEulerAngles(0, 0, 180));
  const yawRotation = new pc.Quat().setFromAxisAngle(
    SERIALIZED_YAW_AXIS,
    view.yaw,
  );
  const rotation = new pc.Quat().mul2(yawRotation, baseRotation);

  entity.setPosition(view.x, view.y, view.z);
  entity.setRotation(rotation);
  entity.rotateLocal(view.pitch - HOME_PITCH, 0, 0);
  entity.rotateLocal(0, 0, view.roll);
  entity.camera = { fov: view.fov };
}

function assertClose(actual, expected, epsilon = 1e-5) {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `${actual} should be within ${epsilon} of ${expected}`,
  );
}

test("reads the exact serialized portal view from an editor camera", () => {
  const expected = {
    x: 4.145,
    y: 8.311,
    z: 3.108,
    yaw: 256.7,
    pitch: 78.4,
    roll: -31.4,
    fov: 75,
  };
  const camera = new pc.Entity();
  applyPortalView(camera, expected);

  const actual = readPortalCameraView(camera, {
    homePitch: HOME_PITCH,
  });

  Object.keys(expected).forEach((key) => {
    assertClose(actual[key], expected[key]);
  });
});

test("round-trips a free-flight camera orientation into AR parameters", () => {
  const freeFlightCamera = new pc.Entity();
  freeFlightCamera.setPosition(3.25, -4.5, 6.75);
  freeFlightCamera.lookAt(
    new pc.Vec3(-20, 3, 12),
    new pc.Vec3(0, 0, -1),
  );
  freeFlightCamera.camera = { fov: 68 };

  const capturedView = readPortalCameraView(freeFlightCamera, {
    homePitch: HOME_PITCH,
  });
  const reconstructedCamera = new pc.Entity();
  applyPortalView(reconstructedCamera, capturedView);

  const original = freeFlightCamera.getRotation();
  const reconstructed = reconstructedCamera.getRotation();
  const quaternionDot = Math.abs(
    original.x * reconstructed.x +
      original.y * reconstructed.y +
      original.z * reconstructed.z +
      original.w * reconstructed.w,
  );
  assertClose(quaternionDot, 1);
  assert.deepEqual(
    reconstructedCamera.getPosition().toArray(),
    freeFlightCamera.getPosition().toArray(),
  );
  assert.equal(reconstructedCamera.camera.fov, 68);
});
