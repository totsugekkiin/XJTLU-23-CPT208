import * as pc from "playcanvas";

const RADIANS_TO_DEGREES = 180 / Math.PI;
const SERIALIZED_YAW_INVERSE_AXIS = new pc.Vec3(0, 1, 0);

export function readPortalCameraView(
  cameraEntity,
  { homePitch = 35 } = {},
) {
  const position = cameraEntity.getPosition();
  const rotation = cameraEntity.getRotation();
  const rotationMatrix = new pc.Mat4().setTRS(
    pc.Vec3.ZERO,
    rotation,
    pc.Vec3.ONE,
  ).data;
  const yawRadians = Math.atan2(-rotationMatrix[8], rotationMatrix[10]);
  const yaw = yawRadians * RADIANS_TO_DEGREES;

  const baseRotationInverse = new pc.Quat()
    .setFromEulerAngles(homePitch, 0, 0)
    .mul(new pc.Quat().setFromEulerAngles(0, 0, 180))
    .invert();
  const yawInverse = new pc.Quat().setFromAxisAngle(
    SERIALIZED_YAW_INVERSE_AXIS,
    yaw,
  );
  const residualRotation = new pc.Quat()
    .mul2(baseRotationInverse, yawInverse)
    .mul(rotation);
  const residualMatrix = new pc.Mat4().setTRS(
    pc.Vec3.ZERO,
    residualRotation,
    pc.Vec3.ONE,
  ).data;

  return {
    x: position.x,
    y: position.y,
    z: position.z,
    yaw: ((yaw % 360) + 360) % 360,
    pitch:
      Math.atan2(-residualMatrix[9], residualMatrix[10]) *
        RADIANS_TO_DEGREES +
      homePitch,
    roll:
      Math.atan2(-residualMatrix[4], residualMatrix[0]) *
      RADIANS_TO_DEGREES,
    fov: cameraEntity.camera?.fov ?? 75,
  };
}
