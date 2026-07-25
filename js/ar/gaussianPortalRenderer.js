import * as pc from "playcanvas";
import {
  installGaussianCropShader,
  updateGaussianCropMaterial,
} from "./gaussianCropShader.js";
import {
  PORTAL_CROP_BOX,
  PORTAL_OPENING_HEIGHT,
  PORTAL_OPENING_WIDTH,
  PORTAL_RUNTIME_SCENE,
  PORTAL_WALL_DEPTH,
  portalCropBounds,
  portalFrameFov,
} from "./portalSceneConfig.js";

const GAUSSIAN_URL = PORTAL_RUNTIME_SCENE.url;
const GAUSSIAN_COUNT = PORTAL_RUNTIME_SCENE.gaussians;
const EDITOR_HOME_PITCH = 35;
const TEXTURE_HEIGHT = 960;
const TEXTURE_WIDTH = Math.round(
  TEXTURE_HEIGHT * (PORTAL_OPENING_WIDTH / PORTAL_OPENING_HEIGHT),
);

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
  }) {
    this.scene = scene;
    this.target = target;
    this.anchorObject = anchorObject || target.object3D;
    this.THREE = window.AFRAME.THREE;
    this.cropBounds = portalCropBounds(crop);
    this.tracking = false;
    this.loaded = false;
    this.occlusion = true;
    this.direction = -1;
    this.destroyed = false;
    this.lastTransform = "";
    this.renderRequested = true;
    this.forceNextRender = true;

    this.worldPoint = new this.THREE.Vector3();
    this.cameraPoint = new this.THREE.Vector3();
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

    this.canvas = document.createElement("canvas");
    this.canvas.className = "gaussian-portal-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.width = `${TEXTURE_WIDTH}px`;
    this.canvas.style.height = `${TEXTURE_HEIGHT}px`;
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
    this.app.autoRender = false;
    this.app.resizeCanvas(TEXTURE_WIDTH, TEXTURE_HEIGHT);
    this.canvas.style.width = `${TEXTURE_WIDTH}px`;
    this.canvas.style.height = `${TEXTURE_HEIGHT}px`;

    this.cameraEntity = new pc.Entity("editor-selected-camera");
    this.cameraEntity.addComponent("camera", {
      clearColor: new pc.Color(0, 0, 0, 0),
      fov: portalFov,
      nearClip: 0.02,
      farClip: 1000,
    });
    applyEditorCameraPose(this.cameraEntity, view);
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
    document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
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

  requestRender(force = false) {
    this.renderRequested = true;
    this.forceNextRender ||= force;
  }

  handleViewportResize() {
    this.lastTransform = "";
  }

  setTracking(tracking) {
    this.tracking = tracking;
    this.splatEntity.enabled =
      this.loaded && this.tracking && !document.hidden;
    this.canvas.classList.toggle(
      "is-visible",
      this.loaded && this.tracking,
    );
    if (this.tracking) this.requestRender(true);
  }

  setOcclusion(enabled) {
    this.occlusion = enabled;
    this.lastTransform = "";
  }

  setDirection(direction) {
    this.direction = direction < 0 ? -1 : 1;
    this.lastTransform = "";
  }

  setProjected(projected) {
    this.canvas.classList.toggle("is-projected", projected);
  }

  setTransform(transform) {
    if (transform === this.lastTransform) return;
    this.lastTransform = transform;
    this.canvas.style.transform = transform;
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
      this.setProjected(true);
      return;
    }

    const sourceBounds = this.scene.canvas?.getBoundingClientRect();
    if (!sourceBounds?.width || !sourceBounds.height) {
      this.setProjected(false);
      return;
    }

    const farPlaneZ = this.direction * PORTAL_WALL_DEPTH;
    const projected = [];
    for (const corner of this.clipCorners) {
      this.worldPoint
        .set(corner.x, corner.y, farPlaneZ)
        .applyMatrix4(this.anchorObject.matrixWorld);
      this.cameraPoint
        .copy(this.worldPoint)
        .applyMatrix4(camera.matrixWorldInverse);
      if (
        !Number.isFinite(this.cameraPoint.z) ||
        this.cameraPoint.z >= -camera.near
      ) {
        this.setProjected(false);
        return;
      }

      this.worldPoint.project(camera);
      if (
        !Number.isFinite(this.worldPoint.x) ||
        !Number.isFinite(this.worldPoint.y)
      ) {
        this.setProjected(false);
        return;
      }
      projected.push({
        x:
          sourceBounds.left +
          ((this.worldPoint.x + 1) * sourceBounds.width) / 2,
        y:
          sourceBounds.top +
          ((1 - this.worldPoint.y) * sourceBounds.height) / 2,
      });
    }

    const transform = quadTransform(
      projected,
      TEXTURE_WIDTH,
      TEXTURE_HEIGHT,
    );
    if (!transform) {
      this.setProjected(false);
      return;
    }
    this.setTransform(transform);
    this.setProjected(true);
  }

  sync() {
    if (this.destroyed) return;

    if (this.tracking && this.anchorObject) {
      const camera = this.resolveThreeCamera();
      if (camera) {
        camera.updateMatrixWorld(true);
        this.anchorObject.updateWorldMatrix(true, false);
        this.updatePortalTransform(camera);
      }
    }

    if (
      this.loaded &&
      this.splatEntity.enabled &&
      (this.forceNextRender || this.renderRequested)
    ) {
      this.app.renderNextFrame = true;
      this.renderRequested = false;
      this.forceNextRender = false;
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
    if (!document.hidden) this.requestRender(true);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener("resize", this.handleViewportResize);
    window.removeEventListener(
      "orientationchange",
      this.handleViewportResize,
    );
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.app.off("update", this.sync);
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
    this.canvas.remove();
  }
}

export function createGaussianPortalRenderer(options) {
  return new GaussianPortalRenderer(options);
}
