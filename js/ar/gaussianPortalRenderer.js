import * as pc from "playcanvas";

const GAUSSIAN_URL = "/models/changgate-courtyard-cropped.sog";
const GAUSSIAN_COUNT = 266512;
const TARGET_WIDTH_MM = 260;
const OPENING_WIDTH = 200 / TARGET_WIDTH_MM;
const OPENING_HEIGHT = 260 / TARGET_WIDTH_MM;
const FAR_FRAME_DEPTH = 400 / TARGET_WIDTH_MM;
const REFERENCE_VIEW_DISTANCE = 600 / TARGET_WIDTH_MM;
const EDITOR_HOME_PITCH = 35;
const DEFAULT_MODEL_SCALE = 1000 / TARGET_WIDTH_MM;

function editorCameraRotation(THREE, view) {
  const radians = THREE.MathUtils.degToRad;
  const axisX = new THREE.Vector3(1, 0, 0);
  const axisZ = new THREE.Vector3(0, 0, 1);
  const cameraBaseRotation = new THREE.Quaternion()
    .setFromAxisAngle(axisX, radians(EDITOR_HOME_PITCH))
    .multiply(
      new THREE.Quaternion().setFromAxisAngle(axisZ, radians(180)),
    );
  const sceneUp = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(cameraBaseRotation)
    .normalize();

  return new THREE.Quaternion()
    .setFromAxisAngle(sceneUp, radians(view.yaw))
    .multiply(cameraBaseRotation)
    .multiply(
      new THREE.Quaternion().setFromAxisAngle(
        axisX,
        radians(view.pitch - EDITOR_HOME_PITCH),
      ),
    )
    .multiply(
      new THREE.Quaternion().setFromAxisAngle(
        axisZ,
        radians(view.roll),
      ),
    );
}

class GaussianPortalRenderer {
  constructor({
    scene,
    target,
    view,
    modelScale = DEFAULT_MODEL_SCALE,
    viewDistance = REFERENCE_VIEW_DISTANCE,
    anchorObject = null,
  }) {
    this.scene = scene;
    this.target = target;
    this.anchorObject = anchorObject || target.object3D;
    this.view = view;
    this.modelScale = modelScale > 0 ? modelScale : DEFAULT_MODEL_SCALE;
    this.viewDistance =
      viewDistance > 0 ? viewDistance : REFERENCE_VIEW_DISTANCE;
    this.THREE = window.AFRAME.THREE;
    this.tracking = false;
    this.loaded = false;
    this.occlusion = true;
    this.direction = -1;
    this.destroyed = false;

    this.threePosition = new this.THREE.Vector3();
    this.threeRotation = new this.THREE.Quaternion();
    this.threeScale = new this.THREE.Vector3();
    this.clipPoint = new this.THREE.Vector3();

    this.canvas = document.createElement("canvas");
    this.canvas.className = "gaussian-portal-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.scene.before(this.canvas);

    this.app = new pc.Application(this.canvas, {
      graphicsDeviceOptions: {
        alpha: true,
        antialias: false,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
      },
    });
    this.app.graphicsDevice.maxPixelRatio = Math.min(
      window.devicePixelRatio || 1,
      1.25,
    );
    this.app.setCanvasFillMode(pc.FILLMODE_NONE);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);

    this.cameraEntity = new pc.Entity("mindar-camera");
    this.cameraEntity.addComponent("camera", {
      clearColor: new pc.Color(0, 0, 0, 0),
      nearClip: 0.01,
      farClip: 1000,
    });
    this.app.root.addChild(this.cameraEntity);

    this.anchorEntity = new pc.Entity("mindar-target-anchor");
    this.directionEntity = new pc.Entity("portal-depth-and-scale");
    this.viewRotationEntity = new pc.Entity("selected-view-rotation");
    this.viewProjectionEntity = new pc.Entity("selected-view-fov");
    this.viewPositionEntity = new pc.Entity("selected-view-position");
    this.scanCorrectionEntity = new pc.Entity("scan-axis-correction");
    this.splatEntity = new pc.Entity("changgate-gaussian-scene");
    // Loading may happen before MindAR has found the target. Keep the expensive
    // splat draw disabled until the portal is actually visible.
    this.splatEntity.enabled = false;

    this.app.root.addChild(this.anchorEntity);
    this.anchorEntity.addChild(this.directionEntity);
    this.directionEntity.addChild(this.viewProjectionEntity);
    this.viewProjectionEntity.addChild(this.viewRotationEntity);
    this.viewRotationEntity.addChild(this.viewPositionEntity);
    this.viewPositionEntity.addChild(this.scanCorrectionEntity);
    this.scanCorrectionEntity.addChild(this.splatEntity);

    this.scanCorrectionEntity.setLocalEulerAngles(180, 0, 0);
    this.viewPositionEntity.setLocalPosition(-view.x, -view.y, -view.z);

    const inverseView = editorCameraRotation(this.THREE, view).invert();
    this.viewRotationEntity.setLocalRotation(
      inverseView.x,
      inverseView.y,
      inverseView.z,
      inverseView.w,
    );
    this.applyDirection();

    this.cameraEntity.camera.calculateProjection = (projection) => {
      const camera = this.resolveThreeCamera();
      if (camera?.projectionMatrix?.elements) {
        projection.data.set(camera.projectionMatrix.elements);
      }
    };

    this.resize = this.resize.bind(this);
    this.sync = this.sync.bind(this);
    this.handleVisibilityChange =
      this.handleVisibilityChange.bind(this);
    window.addEventListener("resize", this.resize);
    window.addEventListener("orientationchange", this.resize);
    document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.resize();

    this.app.on("update", this.sync);
    this.app.start();
    this.loadScene();
  }

  resolveThreeCamera() {
    return (
      this.scene.camera ||
      this.scene.querySelector("[camera]")?.getObject3D("camera") ||
      null
    );
  }

  resize() {
    if (this.destroyed) return;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.app.resizeCanvas(width, height);
  }

  applyDirection() {
    const mirrorZ = this.direction < 0 ? this.modelScale : -this.modelScale;
    this.directionEntity.setLocalPosition(
      0,
      0,
      -this.direction * this.viewDistance,
    );
    this.directionEntity.setLocalScale(
      this.modelScale,
      this.modelScale,
      mirrorZ,
    );
  }

  setTracking(tracking) {
    this.tracking = tracking;
    this.updateRenderState();
    this.updateVisibility();
  }

  setOcclusion(enabled) {
    this.occlusion = enabled;
    if (!enabled) this.canvas.style.clipPath = "none";
  }

  setDirection(direction) {
    this.direction = direction < 0 ? -1 : 1;
    this.applyDirection();
  }

  updateVisibility() {
    this.canvas.classList.toggle(
      "is-visible",
      this.loaded && this.tracking,
    );
  }

  updateRenderState() {
    this.splatEntity.enabled =
      this.loaded && this.tracking && !document.hidden;
  }

  copyThreeTransform(source, destination) {
    source.matrixWorld.decompose(
      this.threePosition,
      this.threeRotation,
      this.threeScale,
    );
    destination.setPosition(
      this.threePosition.x,
      this.threePosition.y,
      this.threePosition.z,
    );
    destination.setRotation(
      this.threeRotation.x,
      this.threeRotation.y,
      this.threeRotation.z,
      this.threeRotation.w,
    );
    destination.setLocalScale(
      this.threeScale.x,
      this.threeScale.y,
      this.threeScale.z,
    );
  }

  updateClip(camera) {
    if (!this.occlusion) {
      this.canvas.style.clipPath = "none";
      return;
    }

    const corners = [
      [-OPENING_WIDTH / 2, OPENING_HEIGHT / 2, this.direction * FAR_FRAME_DEPTH],
      [OPENING_WIDTH / 2, OPENING_HEIGHT / 2, this.direction * FAR_FRAME_DEPTH],
      [OPENING_WIDTH / 2, -OPENING_HEIGHT / 2, this.direction * FAR_FRAME_DEPTH],
      [-OPENING_WIDTH / 2, -OPENING_HEIGHT / 2, this.direction * FAR_FRAME_DEPTH],
    ];
    const projected = corners.map(([x, y, z]) => {
      this.clipPoint
        .set(x, y, z)
        .applyMatrix4(this.anchorObject.matrixWorld)
        .project(camera);
      return `${((this.clipPoint.x + 1) * 50).toFixed(3)}% ${(
        (1 - this.clipPoint.y) *
        50
      ).toFixed(3)}%`;
    });
    if (projected.some((point) => point.includes("NaN"))) {
      return;
    }
    this.canvas.style.clipPath = `polygon(${projected.join(", ")})`;
  }

  updateViewProjection(camera) {
    const projectionY = camera.projectionMatrix.elements[5];
    const editorTangent = Math.tan(
      this.THREE.MathUtils.degToRad(this.view.fov) / 2,
    );
    const runtimeTangent =
      Number.isFinite(projectionY) && Math.abs(projectionY) > 1e-6
        ? 1 / Math.abs(projectionY)
        : editorTangent;
    const scale = runtimeTangent / editorTangent;
    this.viewProjectionEntity.setLocalScale(scale, scale, 1);
  }

  sync() {
    if (
      this.destroyed ||
      !this.loaded ||
      !this.tracking ||
      !this.anchorObject
    ) {
      return;
    }

    const camera = this.resolveThreeCamera();
    if (!camera) return;

    camera.updateMatrixWorld(true);
    this.anchorObject.updateWorldMatrix(true, false);
    this.copyThreeTransform(camera, this.cameraEntity);
    this.copyThreeTransform(this.anchorObject, this.anchorEntity);
    this.updateViewProjection(camera);
    this.updateClip(camera);
  }

  loadScene() {
    this.target.emit("gaussian-portal-loading", {
      url: GAUSSIAN_URL,
      gaussians: GAUSSIAN_COUNT,
    });
    const asset = new pc.Asset(
      "changgate-courtyard",
      "gsplat",
      { url: GAUSSIAN_URL },
    );
    this.app.assets.add(asset);
    asset.ready((loadedAsset) => {
      if (this.destroyed) return;
      this.splatEntity.addComponent("gsplat", {
        asset: loadedAsset,
        unified: true,
      });
      this.loaded = true;
      this.updateRenderState();
      this.updateVisibility();
      this.target.emit("gaussian-portal-loaded", {
        url: GAUSSIAN_URL,
        gaussians: GAUSSIAN_COUNT,
      });
    });
    asset.on("error", (error) => {
      if (this.destroyed) return;
      console.error("Unable to load Gaussian portal scene", error);
      this.target.emit("gaussian-portal-error", {
        url: GAUSSIAN_URL,
        message: error?.message ?? "unknown error",
      });
    });
    this.app.assets.load(asset);
  }

  handleVisibilityChange() {
    this.updateRenderState();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("orientationchange", this.resize);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.app.off("update", this.sync);
    this.app.destroy();
    this.canvas.remove();
  }
}

export function createGaussianPortalRenderer(options) {
  return new GaussianPortalRenderer(options);
}
