import {
  DEFAULT_PORTAL_SCENE_ID,
  PORTAL_CROP_BOX,
  PORTAL_PERSPECTIVE_MODES,
  PORTAL_REFERENCE_VIEW_DISTANCE,
  PORTAL_VIEW_PRESET,
  PORTAL_WORLD_SCALE,
  getPortalScene,
  normalizePortalFov,
  portalFrameFov,
  readPortalRuntimeConfig,
} from "./portalSceneConfig.js";

const TARGET_URL = "/markers/changgate-window-frame-border-only.mind";
const SCAN_BURST_FRAMES = 3;
const SCAN_BURST_PAUSE_MS = 160;

export function syncVideoFrameSize(video) {
  const width = Number(video?.videoWidth);
  const height = Number(video?.videoHeight);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return false;
  }

  // MindAR's input loader draws HTMLVideoElement frames with video.width and
  // video.height rather than the intrinsic videoWidth/videoHeight. Its own
  // camera system sets these attributes after loadedmetadata; the unified AR
  // page owns the video element, so it must mirror that step explicitly.
  video.width = width;
  video.height = height;
  return true;
}

function waitForScene(scene) {
  if (scene?.hasLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("A-Frame marker scene did not become ready"));
    }, 10000);
    scene?.addEventListener(
      "loaded",
      () => {
        window.clearTimeout(timeoutId);
        resolve();
      },
      { once: true },
    );
  });
}

function resolvePortalConfig() {
  const params = new URLSearchParams(window.location.search);
  const requestedScene =
    params.get("scene") ||
    params.get("dynasty") ||
    DEFAULT_PORTAL_SCENE_ID;
  const profile = getPortalScene(requestedScene);
  const saved =
    profile.id === DEFAULT_PORTAL_SCENE_ID
      ? readPortalRuntimeConfig()
      : null;
  const view = profile.view ?? saved?.view ?? PORTAL_VIEW_PRESET;
  const crop = profile.crop ?? saved?.crop ?? PORTAL_CROP_BOX;
  return {
    profile,
    view,
    crop,
    portalFov: normalizePortalFov(
      saved?.portalFov,
      portalFrameFov(view.fov),
    ),
  };
}

function updateMarkerProjection(scene, controller, video) {
  const container = scene?.parentElement;
  const camera =
    scene?.camera ||
    scene?.querySelector("[camera]")?.getObject3D("camera");
  if (
    !container ||
    !camera ||
    !video?.videoWidth ||
    !video?.videoHeight
  ) {
    return;
  }

  const sourceRatio = video.videoWidth / video.videoHeight;
  const containerRatio = container.clientWidth / container.clientHeight;
  let displayWidth;
  let displayHeight;
  if (sourceRatio > containerRatio) {
    displayHeight = container.clientHeight;
    displayWidth = displayHeight * sourceRatio;
  } else {
    displayWidth = container.clientWidth;
    displayHeight = displayWidth / sourceRatio;
  }

  const projection = controller.getProjectionMatrix();
  camera.fov =
    (2 *
      Math.atan(
        (1 / projection[5] / displayHeight) *
          container.clientHeight,
      ) *
      180) /
    Math.PI;
  camera.aspect = containerRatio;
  camera.near = projection[14] / (projection[10] - 1);
  camera.far = projection[14] / (projection[10] + 1);
  camera.updateProjectionMatrix();
  scene.renderer?.setClearColor(0x000000, 0);
}

/**
 * Runs MindAR against a video element owned by the host page. The controller
 * uses short acquisition bursts while searching, then switches to continuous
 * tracking after a target is found.
 */
export async function createSharedMarkerRecognition({
  rootEl,
  video,
  onFound,
  onLost,
  onStatus,
}) {
  const scene = rootEl.querySelector("#ar-marker-scene");
  const target = rootEl.querySelector("#ar-marker-target");
  if (!scene || !target) {
    throw new Error("Unified marker scene is missing");
  }
  if (!window.AFRAME?.THREE || !window.MINDAR?.IMAGE?.Controller) {
    throw new Error("MindAR image tracking is unavailable");
  }
  if (!syncVideoFrameSize(video)) {
    throw new Error("Shared camera has no readable video frame");
  }

  await waitForScene(scene);
  onStatus?.("loading");

  const THREE = window.AFRAME.THREE;
  const invisibleMatrix = new THREE.Matrix4().set(
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
  );
  const targetObject = target.object3D;
  targetObject.visible = false;
  targetObject.matrixAutoUpdate = false;
  targetObject.matrix.copy(invisibleMatrix);

  let destroyed = false;
  let paused = false;
  let tracking = false;
  let burstFrames = 0;
  let burstTimer = 0;
  let postMatrix = null;
  let portalRenderer = null;
  let portalPromise = null;

  const setTracking = (nextTracking, notify = true) => {
    const next = Boolean(nextTracking);
    if (tracking === next) return;
    tracking = next;
    portalRenderer?.setTracking(next);
    rootEl.classList.toggle("is-marker-tracking", next);
    if (next) {
      target.emit("targetFound");
      if (notify) onFound?.();
    } else {
      target.emit("targetLost");
      if (notify) onLost?.();
    }
  };

  const ensurePortal = () => {
    if (portalPromise) return portalPromise;
    const { profile, view, crop, portalFov } = resolvePortalConfig();
    portalPromise = import("./gaussianPortalRenderer.js")
      .then(({ createGaussianPortalRenderer }) => {
        if (destroyed) return null;
        portalRenderer = createGaussianPortalRenderer({
          scene,
          target,
          view,
          crop,
          portalFov,
          modelScale: PORTAL_WORLD_SCALE,
          viewDistance: PORTAL_REFERENCE_VIEW_DISTANCE,
          perspectiveMode: PORTAL_PERSPECTIVE_MODES.PHYSICAL,
          // The unified page uses a shared, cover-fitted video. Keep the
          // portal projection deterministic and leave the optional CV aperture
          // correction to the dedicated marker calibration page.
          apertureCv: false,
          portalScene: profile.runtime,
        });
        portalRenderer.setOcclusion(true);
        portalRenderer.setDirection(-1);
        portalRenderer.setTracking(tracking);
        return portalRenderer;
      })
      .catch((error) => {
        portalPromise = null;
        onStatus?.("portal-error", error);
        throw error;
      });
    return portalPromise;
  };

  const controller = new window.MINDAR.IMAGE.Controller({
    inputWidth: video.videoWidth,
    inputHeight: video.videoHeight,
    maxTrack: 1,
    filterMinCF: 0.0005,
    filterBeta: 0.01,
    warmupTolerance: 1,
    missTolerance: 20,
    onUpdate(data) {
      if (destroyed) return;
      if (data.type === "processDone") {
        if (!paused && !tracking) {
          burstFrames += 1;
          if (burstFrames >= SCAN_BURST_FRAMES) {
            controller.stopProcessVideo();
            window.clearTimeout(burstTimer);
            burstTimer = window.setTimeout(() => {
              if (destroyed || paused || tracking) return;
              burstFrames = 0;
              controller.processVideo(video);
            }, SCAN_BURST_PAUSE_MS);
          }
        }
        return;
      }
      if (data.type !== "updateMatrix") return;

      const worldMatrix = data.worldMatrix;
      if (!worldMatrix) {
        targetObject.visible = false;
        targetObject.matrix.copy(invisibleMatrix);
        targetObject.updateMatrixWorld(true);
        setTracking(false);
        return;
      }

      const matrix = new THREE.Matrix4();
      matrix.fromArray(worldMatrix);
      matrix.multiply(postMatrix);
      targetObject.matrix.copy(matrix);
      targetObject.visible = true;
      targetObject.updateMatrixWorld(true);
      target.emit("targetUpdate");
      if (!tracking) {
        setTracking(true);
        void ensurePortal();
      }
    },
  });

  const { dimensions } = await controller.addImageTargets(TARGET_URL);
  const [markerWidth, markerHeight] = dimensions[0] ?? [];
  if (!markerWidth || !markerHeight) {
    controller.dispose();
    throw new Error("MindAR marker data is empty");
  }

  const markerPosition = new THREE.Vector3(
    markerWidth / 2,
    markerWidth / 2 + (markerHeight - markerWidth) / 2,
    0,
  );
  const markerScale = new THREE.Vector3(
    markerWidth,
    markerWidth,
    markerWidth,
  );
  postMatrix = new THREE.Matrix4().compose(
    markerPosition,
    new THREE.Quaternion(),
    markerScale,
  );

  updateMarkerProjection(scene, controller, video);
  const resize = () => updateMarkerProjection(scene, controller, video);
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);

  await controller.dummyRun(video);
  if (destroyed) {
    controller.dispose();
    throw new Error("Marker recognition was disposed during startup");
  }
  onStatus?.("ready");
  controller.processVideo(video);

  return {
    get tracking() {
      return tracking;
    },
    pause() {
      if (destroyed || paused) return;
      paused = true;
      window.clearTimeout(burstTimer);
      controller.stopProcessVideo();
      scene.pause?.();
      setTracking(false, false);
      targetObject.visible = false;
      targetObject.updateMatrixWorld(true);
      rootEl.classList.remove("is-marker-tracking");
    },
    resume() {
      if (destroyed || !paused) return;
      paused = false;
      burstFrames = 0;
      scene.play?.();
      controller.processVideo(video);
    },
    hidePortal() {
      portalRenderer?.setTracking(false);
    },
    dispose() {
      if (destroyed) return;
      destroyed = true;
      window.clearTimeout(burstTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      controller.dispose();
      portalRenderer?.destroy();
      portalRenderer = null;
      portalPromise = null;
      targetObject.visible = false;
      rootEl.classList.remove("is-marker-tracking");
    },
  };
}
