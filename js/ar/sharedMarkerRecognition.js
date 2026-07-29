import { registerPortalOcclusionTest } from "./portalOcclusionTest.js";
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
export const MARKER_TRACKING_HOLD_MS = 900;

export function createTrackingLossGuard({
  holdMs = MARKER_TRACKING_HOLD_MS,
  onExpired,
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = (timerId) => globalThis.clearTimeout(timerId),
}) {
  let timerId = null;

  return {
    get pending() {
      return timerId !== null;
    },
    markMissing() {
      if (timerId !== null) return false;
      timerId = setTimer(() => {
        timerId = null;
        onExpired?.();
      }, holdMs);
      return true;
    },
    markPresent() {
      if (timerId === null) return false;
      clearTimer(timerId);
      timerId = null;
      return true;
    },
    cancel() {
      if (timerId === null) return;
      clearTimer(timerId);
      timerId = null;
    },
  };
}

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

export function resolveSharedPortalConfig(
  requestedScene = DEFAULT_PORTAL_SCENE_ID,
  savedConfig = null,
) {
  const profile = getPortalScene(requestedScene);
  const saved = profile.id === DEFAULT_PORTAL_SCENE_ID ? savedConfig : null;
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

function resolvePortalConfig() {
  const params = new URLSearchParams(window.location.search);
  const requestedScene =
    params.get("scene") ||
    params.get("dynasty") ||
    DEFAULT_PORTAL_SCENE_ID;
  return resolveSharedPortalConfig(
    requestedScene,
    readPortalRuntimeConfig(),
  );
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
 * Runs the same continuous MindAR tracking and portal renderer as the
 * dedicated marker page against a video element owned by the host page.
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
  registerPortalOcclusionTest();

  const THREE = window.AFRAME.THREE;
  let portalConfig = resolvePortalConfig();
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
  let postMatrix = null;
  let portalRenderer = null;
  let portalPromise = null;
  let portalRendererGeneration = 0;
  let portalSwitching = false;

  const applyFallbackConfig = (loadModel = false) => {
    const { view } = portalConfig;
    target.setAttribute("portal-occlusion-test", {
      direction: -1,
      occlusion: true,
      nearFrame: false,
      farFrame: false,
      loadModel,
      useViewPose: true,
      viewX: view.x,
      viewY: view.y,
      viewZ: view.z,
      viewYaw: view.yaw,
      viewPitch: view.pitch,
      viewRoll: view.roll,
      viewFov: view.fov,
      modelScale: PORTAL_WORLD_SCALE,
    });
  };

  applyFallbackConfig(false);

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

  const hideTrackedTarget = (notify = true) => {
    targetObject.visible = false;
    targetObject.matrix.copy(invisibleMatrix);
    targetObject.updateMatrixWorld(true);
    setTracking(false, notify);
  };

  const trackingLossGuard = createTrackingLossGuard({
    onExpired() {
      if (destroyed || paused || !tracking) return;
      hideTrackedTarget();
      onStatus?.("lost");
    },
  });

  const isCurrentPortalEvent = (event) =>
    !event.detail?.url ||
    event.detail.url === portalConfig.profile.runtime.url;
  const handlePortalLoading = (event) => {
    if (isCurrentPortalEvent(event)) onStatus?.("portal-loading");
  };
  const handlePortalLoaded = (event) => {
    if (isCurrentPortalEvent(event)) onStatus?.("portal-ready");
  };
  const handlePortalError = (event) => {
    if (!isCurrentPortalEvent(event)) return;
    applyFallbackConfig(true);
    onStatus?.(
      "portal-fallback",
      new Error(event.detail?.message || "Gaussian portal failed to load"),
    );
  };
  const handleFallbackLoaded = () => onStatus?.("fallback-ready");
  const handleFallbackError = (event) => {
    onStatus?.(
      "fallback-error",
      new Error(event.detail?.message || "Portal fallback failed to load"),
    );
  };
  target.addEventListener("gaussian-portal-loading", handlePortalLoading);
  target.addEventListener("gaussian-portal-loaded", handlePortalLoaded);
  target.addEventListener("gaussian-portal-error", handlePortalError);
  target.addEventListener("portal-model-loaded", handleFallbackLoaded);
  target.addEventListener("portal-model-error", handleFallbackError);

  const ensurePortal = () => {
    if (portalPromise) return portalPromise;
    const config = portalConfig;
    const generation = portalRendererGeneration;
    const { profile, view, crop, portalFov } = config;
    portalPromise = import("./gaussianPortalRenderer.js")
      .then(({ createGaussianPortalRenderer }) => {
        if (destroyed || generation !== portalRendererGeneration) return null;
        const renderer = createGaussianPortalRenderer({
          scene,
          target,
          video,
          view,
          crop,
          portalFov,
          modelScale: PORTAL_WORLD_SCALE,
          viewDistance: PORTAL_REFERENCE_VIEW_DISTANCE,
          perspectiveMode: PORTAL_PERSPECTIVE_MODES.PHYSICAL,
          apertureCv: true,
          portalScene: {
            ...profile.runtime,
            id: profile.id,
          },
        });
        if (destroyed || generation !== portalRendererGeneration) {
          renderer.destroy();
          return null;
        }
        portalRenderer = renderer;
        renderer.setOcclusion(true);
        renderer.setDirection(-1);
        renderer.setTracking(tracking);
        return renderer;
      })
      .catch((error) => {
        if (destroyed || generation !== portalRendererGeneration) return null;
        applyFallbackConfig(true);
        onStatus?.("portal-fallback", error);
        return null;
      });
    return portalPromise;
  };

  const waitForPortalResult = (url, timeout = 2800) =>
    new Promise((resolve) => {
      let settled = false;
      const finish = (outcome) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        target.removeEventListener("gaussian-portal-loaded", handleLoaded);
        target.removeEventListener("gaussian-portal-error", handleError);
        resolve(outcome);
      };
      const handleLoaded = (event) => {
        if (event.detail?.url === url) finish("loaded");
      };
      const handleError = (event) => {
        if (!event.detail?.url || event.detail.url === url) finish("error");
      };
      const timeoutId = window.setTimeout(() => finish("timeout"), timeout);
      target.addEventListener("gaussian-portal-loaded", handleLoaded);
      target.addEventListener("gaussian-portal-error", handleError);
    });

  const switchScene = async (sceneId) => {
    const nextConfig = resolveSharedPortalConfig(
      sceneId,
      readPortalRuntimeConfig(),
    );
    if (
      destroyed ||
      portalSwitching ||
      nextConfig.profile.id === portalConfig.profile.id
    ) {
      return {
        profile: portalConfig.profile,
        outcome: "unchanged",
      };
    }

    portalSwitching = true;
    onStatus?.("portal-switching", null, {
      profile: nextConfig.profile,
    });
    try {
      portalRendererGeneration += 1;
      portalRenderer?.destroy();
      portalRenderer = null;
      portalPromise = null;
      portalConfig = nextConfig;
      applyFallbackConfig(false);

      const url = new URL(window.location.href);
      url.searchParams.set("scene", portalConfig.profile.id);
      url.searchParams.delete("dynasty");
      window.history.replaceState(null, "", url);

      const portalResult = waitForPortalResult(
        portalConfig.profile.runtime.url,
      );
      await ensurePortal();
      const outcome = await portalResult;
      onStatus?.("portal-scene-changed", null, {
        profile: portalConfig.profile,
        outcome,
      });
      return {
        profile: portalConfig.profile,
        outcome,
      };
    } finally {
      portalSwitching = false;
    }
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
      if (data.type === "processDone") return;
      if (data.type !== "updateMatrix") return;

      const worldMatrix = data.worldMatrix;
      if (!worldMatrix) {
        if (tracking && trackingLossGuard.markMissing()) {
          onStatus?.("tracking-hold");
        }
        return;
      }

      trackingLossGuard.markPresent();
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
  void ensurePortal();
  onStatus?.("ready");
  controller.processVideo(video);

  return {
    get tracking() {
      return tracking;
    },
    get currentScene() {
      return portalConfig.profile;
    },
    get switchingScene() {
      return portalSwitching;
    },
    switchScene,
    pause() {
      if (destroyed || paused) return;
      paused = true;
      trackingLossGuard.cancel();
      controller.stopProcessVideo();
      scene.pause?.();
      setTracking(false, false);
      targetObject.visible = false;
      targetObject.matrix.copy(invisibleMatrix);
      targetObject.updateMatrixWorld(true);
      rootEl.classList.remove("is-marker-tracking");
    },
    resume() {
      if (destroyed || !paused) return;
      paused = false;
      scene.play?.();
      controller.processVideo(video);
    },
    hidePortal() {
      portalRenderer?.setTracking(false);
    },
    dispose() {
      if (destroyed) return;
      destroyed = true;
      portalRendererGeneration += 1;
      trackingLossGuard.cancel();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      target.removeEventListener("gaussian-portal-loading", handlePortalLoading);
      target.removeEventListener("gaussian-portal-loaded", handlePortalLoaded);
      target.removeEventListener("gaussian-portal-error", handlePortalError);
      target.removeEventListener("portal-model-loaded", handleFallbackLoaded);
      target.removeEventListener("portal-model-error", handleFallbackError);
      controller.dispose();
      portalRenderer?.destroy();
      portalRenderer = null;
      portalPromise = null;
      targetObject.visible = false;
      target.removeAttribute("portal-occlusion-test");
      rootEl.classList.remove("is-marker-tracking");
    },
  };
}
