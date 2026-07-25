import * as pc from "playcanvas";
import {
  installGaussianCropShader,
  updateGaussianCropMaterial,
} from "./gaussianCropShader.js";
import {
  PORTAL_CROP_BOX,
  PORTAL_OPENING_HEIGHT,
  PORTAL_OPENING_WIDTH,
  PORTAL_PERSPECTIVE_MODES,
  PORTAL_REFERENCE_VIEW_DISTANCE,
  PORTAL_RUNTIME_SCENE,
  PORTAL_WALL_DEPTH,
  PORTAL_WORLD_SCALE,
  portalCropBounds,
  portalFrameFov,
  resolvePortalPerspectivePose,
} from "./portalSceneConfig.js";

const GAUSSIAN_URL = PORTAL_RUNTIME_SCENE.url;
const GAUSSIAN_COUNT = PORTAL_RUNTIME_SCENE.gaussians;
const EDITOR_HOME_PITCH = 35;
const TEXTURE_HEIGHT = 960;
const TEXTURE_WIDTH = Math.round(
  TEXTURE_HEIGHT * (PORTAL_OPENING_WIDTH / PORTAL_OPENING_HEIGHT),
);
const CAMERA_NEAR = 0.02;
const CAMERA_FAR = 1000;
const MOBILE_RENDER_INTERVAL = 1000 / 30;
const DESKTOP_RENDER_INTERVAL = 1000 / 45;
const EYE_MOVEMENT_EPSILON = 0.003;
const EYE_DEPTH_SMOOTHING_MS = 55;
const EYE_DEPTH_SNAP_DISTANCE = 0.08;
const PROJECTED_POINT_EPSILON = 0.15;

function applyEditorCameraPose(entity, view) {
  const cameraBaseRotation = new pc.Quat()
    .setFromEulerAngles(EDITOR_HOME_PITCH, 0, 0)
    .mul(new pc.Quat().setFromEulerAngles(0, 0, 180));
  const sceneUp = cameraBaseRotation
    .transformVector(new pc.Vec3(0, 1, 0), new pc.Vec3())
    .normalize();
  const yawRotation = new pc.Quat().setFromAxisAngle(
    sceneUp,
    view.yaw,
  );
  const cameraRotation = new pc.Quat().mul2(
    yawRotation,
    cameraBaseRotation,
  );

  entity.setPosition(view.x, view.y, view.z);
  entity.setRotation(cameraRotation);
  entity.rotateLocal(view.pitch - EDITOR_HOME_PITCH, 0, 0);
  entity.rotateLocal(0, 0, view.roll);
}

function quadTransform(points, sourceWidth, sourceHeight) {
  const [topLeft, topRight, bottomRight, bottomLeft] = points;
  const dx1 = topRight.x - bottomRight.x;
  const dx2 = bottomLeft.x - bottomRight.x;
  const dx3 =
    topLeft.x - topRight.x + bottomRight.x - bottomLeft.x;
  const dy1 = topRight.y - bottomRight.y;
  const dy2 = bottomLeft.y - bottomRight.y;
  const dy3 =
    topLeft.y - topRight.y + bottomRight.y - bottomLeft.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-6) {
    return null;
  }

  const perspectiveX =
    (dx3 * dy2 - dx2 * dy3) / denominator;
  const perspectiveY =
    (dx1 * dy3 - dx3 * dy1) / denominator;
  const scaleX = 1 / sourceWidth;
  const scaleY = 1 / sourceHeight;
  const a =
    topRight.x - topLeft.x + perspectiveX * topRight.x;
  const b =
    bottomLeft.x - topLeft.x + perspectiveY * bottomLeft.x;
  const d =
    topRight.y - topLeft.y + perspectiveX * topRight.y;
  const e =
    bottomLeft.y - topLeft.y + perspectiveY * bottomLeft.y;

  const values = [
    a * scaleX,
    d * scaleX,
    0,
    perspectiveX * scaleX,
    b * scaleY,
    e * scaleY,
    0,
    perspectiveY * scaleY,
    0,
    0,
    1,
    0,
    topLeft.x,
    topLeft.y,
    0,
    1,
  ];
  if (values.some((value) => !Number.isFinite(value))) return null;
  return `matrix3d(${values
    .map((value) => value.toFixed(7))
    .join(",")})`;
}

class GaussianPortalRenderer {
  constructor({
    scene,
    target,
    view,
    anchorObject = null,
    crop = PORTAL_CROP_BOX,
    portalFov = portalFrameFov(view.fov),
    modelScale = PORTAL_WORLD_SCALE,
    viewDistance = PORTAL_REFERENCE_VIEW_DISTANCE,
    perspectiveMode = PORTAL_PERSPECTIVE_MODES.PHYSICAL,
  }) {
    this.scene = scene;
    this.target = target;
    this.anchorObject = anchorObject || target.object3D;
    this.THREE = window.AFRAME.THREE;
    this.cropBounds = portalCropBounds(crop);
    this.modelScale =
      Number.isFinite(modelScale) && modelScale > 0
        ? modelScale
        : PORTAL_WORLD_SCALE;
    this.viewDistance =
      Number.isFinite(viewDistance) && viewDistance > 0
        ? viewDistance
        : PORTAL_REFERENCE_VIEW_DISTANCE;
    this.tracking = false;
    this.loaded = false;
    this.occlusion = true;
    this.direction = -1;
    this.destroyed = false;
    this.lastTransform = "";
    this.renderRequested = true;
    this.forceNextRender = true;
    this.poseRenderRequested = true;
    this.lastRenderAt = 0;
    this.renderInterval =
      navigator.maxTouchPoints > 0
        ? MOBILE_RENDER_INTERVAL
        : DESKTOP_RENDER_INTERVAL;
    this.viewportBounds = null;
    this.frustumValid = true;
    this.hasRenderedEye = false;
    this.perspectiveMode =
      perspectiveMode === PORTAL_PERSPECTIVE_MODES.COMPOSITION
        ? PORTAL_PERSPECTIVE_MODES.COMPOSITION
        : PORTAL_PERSPECTIVE_MODES.PHYSICAL;
    this.hasReferenceEye =
      this.perspectiveMode === PORTAL_PERSPECTIVE_MODES.PHYSICAL;
    this.distanceCalibrated = false;
    this.hasSmoothedEye = false;
    this.lastEyeSampleAt = 0;
    this.lastPerspectiveEmitAt = 0;

    this.worldPoint = new this.THREE.Vector3();
    this.cameraPoint = new this.THREE.Vector3();
    this.relativeCameraMatrix = new this.THREE.Matrix4();
    this.rawRuntimeEye = new this.THREE.Vector3();
    this.runtimeEye = new this.THREE.Vector3();
    this.lastRenderedEye = new this.THREE.Vector3();
    this.referenceEye = new this.THREE.Vector3(
      0,
      0,
      this.viewDistance,
    );
    this.projectedCorners = Array.from({ length: 4 }, () => ({
      x: 0,
      y: 0,
    }));
    this.lastProjectedCorners = Array.from({ length: 4 }, () => ({
      x: Number.NaN,
      y: Number.NaN,
    }));
    this.nearProjectedCorners = Array.from({ length: 4 }, () => ({
      x: 0,
      y: 0,
    }));
    this.lastNearProjectedCorners = Array.from(
      { length: 4 },
      () => ({
        x: Number.NaN,
        y: Number.NaN,
      }),
    );
    this.lastNearClipPath = "";
    this.clipCorners = [
      new this.THREE.Vector3(
        -PORTAL_OPENING_WIDTH / 2,
        PORTAL_OPENING_HEIGHT / 2,
        0,
      ),
      new this.THREE.Vector3(
        PORTAL_OPENING_WIDTH / 2,
        PORTAL_OPENING_HEIGHT / 2,
        0,
      ),
      new this.THREE.Vector3(
        PORTAL_OPENING_WIDTH / 2,
        -PORTAL_OPENING_HEIGHT / 2,
        0,
      ),
      new this.THREE.Vector3(
        -PORTAL_OPENING_WIDTH / 2,
        -PORTAL_OPENING_HEIGHT / 2,
        0,
      ),
    ];

    this.clipLayer = document.createElement("div");
    this.clipLayer.className = "gaussian-portal-clip";
    this.clipLayer.setAttribute("aria-hidden", "true");
    this.scene.before(this.clipLayer);

    this.canvas = document.createElement("canvas");
    this.canvas.className = "gaussian-portal-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.width = `${TEXTURE_WIDTH}px`;
    this.canvas.style.height = `${TEXTURE_HEIGHT}px`;
    this.clipLayer.append(this.canvas);

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
    this.app.autoRender = false;
    this.app.resizeCanvas(TEXTURE_WIDTH, TEXTURE_HEIGHT);
    this.canvas.style.width = `${TEXTURE_WIDTH}px`;
    this.canvas.style.height = `${TEXTURE_HEIGHT}px`;

    this.cameraEntity = new pc.Entity("editor-selected-camera");
    this.cameraEntity.addComponent("camera", {
      clearColor: new pc.Color(0, 0, 0, 0),
      fov: portalFov,
      nearClip: CAMERA_NEAR,
      farClip: CAMERA_FAR,
    });
    applyEditorCameraPose(this.cameraEntity, view);
    this.baseCameraPosition = this.cameraEntity.getPosition().clone();
    this.baseCameraRotation = this.cameraEntity.getRotation().clone();
    this.virtualEyeLocal = new pc.Vec3();
    this.virtualEyeWorld = new pc.Vec3();
    this.virtualOpeningHeight =
      PORTAL_OPENING_HEIGHT / this.modelScale;
    this.virtualOpeningWidth =
      PORTAL_OPENING_WIDTH / this.modelScale;
    this.virtualPortalDistance =
      this.virtualOpeningHeight /
      (2 * Math.tan((portalFov * Math.PI) / 360));
    this.frustum = {
      left: -CAMERA_NEAR,
      right: CAMERA_NEAR,
      bottom: -CAMERA_NEAR,
      top: CAMERA_NEAR,
    };
    this.cameraEntity.camera.calculateProjection = (matrix) => {
      matrix.setFrustum(
        this.frustum.left,
        this.frustum.right,
        this.frustum.bottom,
        this.frustum.top,
        CAMERA_NEAR,
        CAMERA_FAR,
      );
    };
    this.applyRuntimeEye(this.referenceEye);
    this.app.root.addChild(this.cameraEntity);

    this.scanRoot = new pc.Entity("scan-axis-correction");
    this.scanRoot.setEulerAngles(180, 0, 0);
    this.app.root.addChild(this.scanRoot);

    this.splatEntity = new pc.Entity("changgate-gaussian-scene");
    this.splatEntity.enabled = false;
    this.scanRoot.addChild(this.splatEntity);

    this.cropMaterials = new Set();
    this.handleCropMaterialCreated = (material) => {
      installGaussianCropShader(material);
      updateGaussianCropMaterial(material, this.cropBounds);
      this.cropMaterials.add(material);
      material.update();
      this.requestRender(true);
    };
    this.handleGsplatFrameRequest = () => this.requestRender();
    this.app.systems.gsplat.on(
      "material:created",
      this.handleCropMaterialCreated,
    );
    this.app.systems.gsplat.on(
      "frame:request",
      this.handleGsplatFrameRequest,
    );

    this.sync = this.sync.bind(this);
    this.handleViewportResize = this.handleViewportResize.bind(this);
    this.handleVisibilityChange =
      this.handleVisibilityChange.bind(this);
    window.addEventListener("resize", this.handleViewportResize);
    window.addEventListener(
      "orientationchange",
      this.handleViewportResize,
    );
    window.visualViewport?.addEventListener(
      "resize",
      this.handleViewportResize,
    );
    document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.app.on("frameupdate", this.sync);
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

  requestRender(force = false) {
    this.renderRequested = true;
    this.forceNextRender ||= force;
  }

  handleViewportResize() {
    this.lastTransform = "";
    this.viewportBounds = null;
    for (const point of this.lastProjectedCorners) {
      point.x = Number.NaN;
      point.y = Number.NaN;
    }
    for (const point of this.lastNearProjectedCorners) {
      point.x = Number.NaN;
      point.y = Number.NaN;
    }
    this.lastNearClipPath = "";
    this.requestRender(true);
  }

  resolveViewportBounds() {
    if (this.viewportBounds) return this.viewportBounds;
    const bounds = this.scene.canvas?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return null;
    this.viewportBounds = {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
    return this.viewportBounds;
  }

  sampleRuntimeEye(camera) {
    this.relativeCameraMatrix
      .copy(this.anchorObject.matrixWorld)
      .invert()
      .multiply(camera.matrixWorld);
    this.rawRuntimeEye.setFromMatrixPosition(this.relativeCameraMatrix);
    if (
      !Number.isFinite(this.rawRuntimeEye.x) ||
      !Number.isFinite(this.rawRuntimeEye.y) ||
      !Number.isFinite(this.rawRuntimeEye.z)
    ) {
      return false;
    }

    const now = performance.now();
    if (!this.hasSmoothedEye) {
      this.runtimeEye.copy(this.rawRuntimeEye);
      this.hasSmoothedEye = true;
    } else {
      const elapsed = Math.max(0, now - this.lastEyeSampleAt);
      const depthDifference = this.rawRuntimeEye.z - this.runtimeEye.z;
      const depthAlpha =
        Math.abs(depthDifference) >= EYE_DEPTH_SNAP_DISTANCE
          ? 1
          : 1 - Math.exp(-elapsed / EYE_DEPTH_SMOOTHING_MS);
      this.runtimeEye.set(
        this.rawRuntimeEye.x,
        this.rawRuntimeEye.y,
        this.runtimeEye.z + depthDifference * depthAlpha,
      );
    }
    this.lastEyeSampleAt = now;

    if (!this.hasReferenceEye) {
      this.referenceEye.copy(this.runtimeEye);
      this.hasReferenceEye = true;
      this.hasRenderedEye = false;
      this.poseRenderRequested = true;
    }

    if (
      !this.hasRenderedEye ||
      this.runtimeEye.distanceToSquared(this.lastRenderedEye) >=
        EYE_MOVEMENT_EPSILON * EYE_MOVEMENT_EPSILON
    ) {
      this.poseRenderRequested = true;
    }
    return true;
  }

  applyRuntimeEye(eye) {
    const pose = resolvePortalPerspectivePose({
      eye,
      referenceEye: this.referenceEye,
      direction: this.direction,
      virtualPortalDistance: this.virtualPortalDistance,
    });
    if (!pose || pose.distance <= CAMERA_NEAR * 1.05) {
      this.frustumValid = false;
      return false;
    }

    const { deltaX, deltaY, deltaZ, distance } = pose;

    this.virtualEyeLocal.set(deltaX, deltaY, deltaZ);
    this.baseCameraRotation.transformVector(
      this.virtualEyeLocal,
      this.virtualEyeWorld,
    );
    this.virtualEyeWorld.add(this.baseCameraPosition);
    this.cameraEntity.setPosition(this.virtualEyeWorld);
    this.cameraEntity.setRotation(this.baseCameraRotation);

    const nearOverDistance = CAMERA_NEAR / distance;
    this.frustum.left =
      (-this.virtualOpeningWidth / 2 - deltaX) * nearOverDistance;
    this.frustum.right =
      (this.virtualOpeningWidth / 2 - deltaX) * nearOverDistance;
    this.frustum.bottom =
      (-this.virtualOpeningHeight / 2 - deltaY) * nearOverDistance;
    this.frustum.top =
      (this.virtualOpeningHeight / 2 - deltaY) * nearOverDistance;
    this.frustumValid = true;
    return true;
  }

  emitPerspectiveState(force = false) {
    const now = performance.now();
    if (!force && now - this.lastPerspectiveEmitAt < 500) return;
    this.lastPerspectiveEmitAt = now;
    const pose = resolvePortalPerspectivePose({
      eye: this.runtimeEye,
      referenceEye: this.referenceEye,
      direction: this.direction,
      virtualPortalDistance: this.virtualPortalDistance,
    });
    this.target.emit("gaussian-portal-perspective", {
      mode: this.perspectiveMode,
      calibrated: this.distanceCalibrated,
      eyeDistanceMm: pose?.eyeDistanceMm ?? null,
      farPlaneDistanceMm: pose?.farPlaneDistanceMm ?? null,
    });
  }

  setPerspectiveMode(mode) {
    const nextMode =
      mode === PORTAL_PERSPECTIVE_MODES.COMPOSITION
        ? PORTAL_PERSPECTIVE_MODES.COMPOSITION
        : PORTAL_PERSPECTIVE_MODES.PHYSICAL;
    if (nextMode === this.perspectiveMode && this.hasReferenceEye) return;
    this.perspectiveMode = nextMode;
    this.distanceCalibrated = false;
    if (nextMode === PORTAL_PERSPECTIVE_MODES.PHYSICAL) {
      this.referenceEye.set(0, 0, this.viewDistance);
      this.hasReferenceEye = true;
    } else {
      this.hasReferenceEye = false;
    }
    this.hasRenderedEye = false;
    this.poseRenderRequested = true;
    this.requestRender(true);
    this.emitPerspectiveState(true);
  }

  calibrateCurrentDistance() {
    if (!this.hasSmoothedEye) return null;
    this.perspectiveMode = PORTAL_PERSPECTIVE_MODES.PHYSICAL;
    this.referenceEye.set(0, 0, this.runtimeEye.z);
    this.hasReferenceEye = true;
    this.distanceCalibrated = true;
    this.hasRenderedEye = false;
    this.poseRenderRequested = true;
    this.requestRender(true);
    this.emitPerspectiveState(true);
    return this.runtimeEye.z;
  }

  setTracking(tracking) {
    this.tracking = tracking;
    this.splatEntity.enabled =
      this.loaded && this.tracking && !document.hidden;
    this.canvas.classList.toggle(
      "is-visible",
      this.loaded && this.tracking,
    );
    if (this.tracking) {
      this.poseRenderRequested = true;
      this.requestRender(true);
    } else {
      this.app.renderNextFrame = true;
    }
  }

  setOcclusion(enabled) {
    this.occlusion = enabled;
    this.lastTransform = "";
    if (!enabled) {
      this.setNearClipPath("none");
    } else {
      this.lastNearClipPath = "";
    }
    this.requestRender(true);
  }

  setDirection(direction) {
    this.direction = direction < 0 ? -1 : 1;
    this.lastTransform = "";
    this.poseRenderRequested = true;
    this.requestRender(true);
    this.emitPerspectiveState(true);
  }

  setProjected(projected) {
    this.canvas.classList.toggle("is-projected", projected);
  }

  setTransform(transform) {
    if (transform === this.lastTransform) return;
    this.lastTransform = transform;
    this.canvas.style.transform = transform;
  }

  setNearClipPath(clipPath) {
    if (clipPath === this.lastNearClipPath) return;
    this.lastNearClipPath = clipPath;
    this.clipLayer.style.clipPath = clipPath;
    this.clipLayer.style.webkitClipPath = clipPath;
  }

  projectPortalCorners(camera, z, sourceBounds, output) {
    for (let index = 0; index < this.clipCorners.length; index += 1) {
      const corner = this.clipCorners[index];
      this.worldPoint
        .set(corner.x, corner.y, z)
        .applyMatrix4(this.anchorObject.matrixWorld);
      this.cameraPoint
        .copy(this.worldPoint)
        .applyMatrix4(camera.matrixWorldInverse);
      if (
        !Number.isFinite(this.cameraPoint.z) ||
        this.cameraPoint.z >= -camera.near
      ) {
        return false;
      }

      this.worldPoint.project(camera);
      if (
        !Number.isFinite(this.worldPoint.x) ||
        !Number.isFinite(this.worldPoint.y)
      ) {
        return false;
      }
      output[index].x =
        sourceBounds.left +
        ((this.worldPoint.x + 1) * sourceBounds.width) / 2;
      output[index].y =
        sourceBounds.top +
        ((1 - this.worldPoint.y) * sourceBounds.height) / 2;
    }
    return true;
  }

  updateNearClipPath() {
    let changed = !this.lastNearClipPath;
    for (let index = 0; index < this.nearProjectedCorners.length; index += 1) {
      const projected = this.nearProjectedCorners[index];
      const previous = this.lastNearProjectedCorners[index];
      if (
        Math.abs(projected.x - previous.x) >=
          PROJECTED_POINT_EPSILON ||
        Math.abs(projected.y - previous.y) >= PROJECTED_POINT_EPSILON
      ) {
        changed = true;
      }
    }
    if (!changed) return;

    const clipPath = `polygon(${this.nearProjectedCorners
      .map((point) => `${point.x.toFixed(2)}px ${point.y.toFixed(2)}px`)
      .join(",")})`;
    for (let index = 0; index < this.nearProjectedCorners.length; index += 1) {
      this.lastNearProjectedCorners[index].x =
        this.nearProjectedCorners[index].x;
      this.lastNearProjectedCorners[index].y =
        this.nearProjectedCorners[index].y;
    }
    this.setNearClipPath(clipPath);
  }

  updatePortalTransform(camera) {
    if (!this.occlusion) {
      const scale = Math.min(
        (window.innerWidth * 0.7) / TEXTURE_WIDTH,
        (window.innerHeight * 0.7) / TEXTURE_HEIGHT,
      );
      const x = (window.innerWidth - TEXTURE_WIDTH * scale) / 2;
      const y = (window.innerHeight - TEXTURE_HEIGHT * scale) / 2;
      this.setTransform(
        `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${scale.toFixed(5)})`,
      );
      this.setNearClipPath("none");
      this.setProjected(true);
      return;
    }

    const sourceBounds = this.resolveViewportBounds();
    if (!sourceBounds?.width || !sourceBounds.height) {
      this.setProjected(false);
      return;
    }

    const farPlaneZ = this.direction * PORTAL_WALL_DEPTH;
    if (
      !this.projectPortalCorners(
        camera,
        0,
        sourceBounds,
        this.nearProjectedCorners,
      ) ||
      !this.projectPortalCorners(
        camera,
        farPlaneZ,
        sourceBounds,
        this.projectedCorners,
      )
    ) {
      this.setProjected(false);
      return;
    }
    this.updateNearClipPath();

    let projectionChanged = !this.lastTransform;
    for (let index = 0; index < this.clipCorners.length; index += 1) {
      const projected = this.projectedCorners[index];
      const previous = this.lastProjectedCorners[index];
      if (
        Math.abs(projected.x - previous.x) >=
          PROJECTED_POINT_EPSILON ||
        Math.abs(projected.y - previous.y) >= PROJECTED_POINT_EPSILON
      ) {
        projectionChanged = true;
      }
    }

    if (!this.frustumValid) {
      this.setProjected(false);
      return;
    }
    if (!projectionChanged) {
      this.setProjected(true);
      return;
    }
    const transform = quadTransform(
      this.projectedCorners,
      TEXTURE_WIDTH,
      TEXTURE_HEIGHT,
    );
    if (!transform) {
      this.setProjected(false);
      return;
    }
    for (let index = 0; index < this.projectedCorners.length; index += 1) {
      this.lastProjectedCorners[index].x = this.projectedCorners[index].x;
      this.lastProjectedCorners[index].y = this.projectedCorners[index].y;
    }
    this.setTransform(transform);
    this.setProjected(true);
  }

  sync() {
    if (this.destroyed) return;

    let hasRuntimeEye = false;
    if (this.tracking && this.anchorObject) {
      const camera = this.resolveThreeCamera();
      if (camera) {
        camera.updateMatrixWorld(true);
        this.anchorObject.updateWorldMatrix(true, false);
        hasRuntimeEye = this.sampleRuntimeEye(camera);
        this.updatePortalTransform(camera);
      }
    }

    const renderPending =
      this.forceNextRender ||
      this.renderRequested ||
      this.poseRenderRequested;
    const now = performance.now();
    const withinFrameBudget =
      !this.forceNextRender &&
      now - this.lastRenderAt < this.renderInterval;
    if (
      this.loaded &&
      this.splatEntity.enabled &&
      hasRuntimeEye &&
      renderPending &&
      !withinFrameBudget &&
      this.applyRuntimeEye(this.runtimeEye)
    ) {
      this.app.renderNextFrame = true;
      this.lastRenderAt = now;
      this.lastRenderedEye.copy(this.runtimeEye);
      this.hasRenderedEye = true;
      this.renderRequested = false;
      this.forceNextRender = false;
      this.poseRenderRequested = false;
      this.emitPerspectiveState();
    }
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
      this.setTracking(this.tracking);
      this.requestRender(true);
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
    this.splatEntity.enabled =
      this.loaded && this.tracking && !document.hidden;
    if (!document.hidden) {
      this.requestRender(true);
    } else {
      this.app.renderNextFrame = true;
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener("resize", this.handleViewportResize);
    window.removeEventListener(
      "orientationchange",
      this.handleViewportResize,
    );
    window.visualViewport?.removeEventListener(
      "resize",
      this.handleViewportResize,
    );
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.app.off("frameupdate", this.sync);
    this.app.systems.gsplat.off(
      "material:created",
      this.handleCropMaterialCreated,
    );
    this.app.systems.gsplat.off(
      "frame:request",
      this.handleGsplatFrameRequest,
    );
    this.cropMaterials.clear();
    this.app.destroy();
    this.clipLayer.remove();
  }
}

export function createGaussianPortalRenderer(options) {
  return new GaussianPortalRenderer(options);
}
