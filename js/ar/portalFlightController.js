import * as pc from "playcanvas";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const HEADING_EPSILON = 1e-5;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeDegrees(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

/**
 * A self-contained first-person camera controller.
 *
 * It deliberately owns a temporary pose instead of mutating the editor's
 * serialized AR view. This keeps dynasty presets and crop data read-only while
 * the operator flies through the complete scan.
 */
export class PortalFlightController {
  constructor(
    cameraEntity,
    {
      worldUp = new pc.Vec3(0, 1, 0),
      entryElevationLimit = 60,
      maximumElevation = 85,
      mouseSensitivity = 0.1,
    } = {},
  ) {
    this.cameraEntity = cameraEntity;
    this.worldUp = worldUp.clone().normalize();
    this.entryElevationLimit = Math.abs(entryElevationLimit);
    this.maximumElevation = Math.abs(maximumElevation);
    this.mouseSensitivity = mouseSensitivity;
    this.active = false;
    this.elevation = 0;
    this.fov = 75;

    this.position = new pc.Vec3();
    this.heading = new pc.Vec3(0, 0, -1);
    this.forward = new pc.Vec3(0, 0, -1);
    this.right = new pc.Vec3(-1, 0, 0);
    this.target = new pc.Vec3();
    this.verticalComponent = new pc.Vec3();
    this.moveDelta = new pc.Vec3();
    this.yawRotation = new pc.Quat();
    this.headingOrigin = new pc.Vec3(0, 0, -1);
    this.headingRight = new pc.Vec3(1, 0, 0);
  }

  begin({ fov } = {}) {
    this.position.copy(this.cameraEntity.getPosition());
    this.forward.copy(this.cameraEntity.forward).normalize();
    this.fov = Number.isFinite(fov)
      ? fov
      : Number(this.cameraEntity.camera?.fov) || 75;

    const verticalShare = clamp(
      this.forward.dot(this.worldUp),
      -1,
      1,
    );
    this.elevation = Math.asin(verticalShare) * RAD_TO_DEG;
    this.heading
      .copy(this.forward)
      .sub(
        this.verticalComponent
          .copy(this.worldUp)
          .mulScalar(verticalShare),
      );

    if (this.heading.lengthSq() < HEADING_EPSILON) {
      this.heading
        .cross(this.worldUp, this.cameraEntity.right);
    }
    if (this.heading.lengthSq() < HEADING_EPSILON) {
      this.heading.set(0, 0, -1);
    }
    this.heading.normalize();
    this.headingOrigin.copy(this.heading);
    this.headingRight
      .cross(this.headingOrigin, this.worldUp)
      .normalize();

    // Near a pole, yaw is visually indistinguishable from spinning. Preserve
    // heading but start inside a range where left/right motion is obvious.
    this.elevation = clamp(
      this.elevation,
      -this.entryElevationLimit,
      this.entryElevationLimit,
    );
    this.active = true;
    this.apply();
    return this.getPose();
  }

  end() {
    this.active = false;
  }

  setFov(fov) {
    if (!Number.isFinite(fov)) return;
    this.fov = fov;
    if (this.active) this.apply();
  }

  lookByPixels(deltaX, deltaY) {
    return this.lookByDegrees(
      -deltaX * this.mouseSensitivity,
      -deltaY * this.mouseSensitivity,
    );
  }

  lookByDegrees(deltaHeading, deltaElevation) {
    if (!this.active) return this.getPose();
    this.turn(
      Number.isFinite(deltaHeading) ? deltaHeading : 0,
      false,
    );
    this.elevation = clamp(
      this.elevation +
        (Number.isFinite(deltaElevation) ? deltaElevation : 0),
      -this.maximumElevation,
      this.maximumElevation,
    );
    this.apply();
    return this.getPose();
  }

  turn(deltaDegrees, apply = true) {
    if (!this.active || !Number.isFinite(deltaDegrees)) {
      return this.getPose();
    }
    this.yawRotation.setFromAxisAngle(this.worldUp, deltaDegrees);
    this.yawRotation.transformVector(this.heading, this.heading);
    this.heading.normalize();
    if (apply) this.apply();
    return this.getPose();
  }

  move(distanceForward, distanceRight, distanceVertical) {
    if (!this.active) return this.getPose();
    this.updateAxes();
    this.moveDelta
      .set(0, 0, 0)
      .add(
        this.verticalComponent
          .copy(this.forward)
          .mulScalar(distanceForward),
      )
      .add(
        this.verticalComponent
          .copy(this.right)
          .mulScalar(distanceRight),
      )
      .add(
        this.verticalComponent
          .copy(this.worldUp)
          .mulScalar(distanceVertical),
      );
    this.position
      .add(this.moveDelta);
    this.apply();
    return this.getPose();
  }

  updateAxes() {
    const elevationRadians = this.elevation * DEG_TO_RAD;
    this.forward
      .copy(this.heading)
      .mulScalar(Math.cos(elevationRadians))
      .add(
        this.verticalComponent
          .copy(this.worldUp)
          .mulScalar(Math.sin(elevationRadians)),
      )
      .normalize();
    this.right
      .cross(this.forward, this.worldUp)
      .normalize();
  }

  apply() {
    if (!this.active) return;
    this.updateAxes();
    this.target.copy(this.position).add(this.forward);
    this.cameraEntity.setPosition(this.position);
    this.cameraEntity.lookAt(this.target, this.worldUp);
    if (this.cameraEntity.camera) {
      this.cameraEntity.camera.fov = this.fov;
    }
  }

  getPose() {
    const heading = normalizeDegrees(
      Math.atan2(
        this.heading.dot(this.headingRight),
        this.heading.dot(this.headingOrigin),
      ) * RAD_TO_DEG,
    );
    return {
      active: this.active,
      heading,
      elevation: this.elevation,
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      fov: this.fov,
    };
  }
}
