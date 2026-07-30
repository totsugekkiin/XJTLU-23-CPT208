import {
  formatMapIdList,
  getAnchorsForMap,
  getMapProfilesForIds,
  resolveActiveMapIds,
} from "./arAnchors.js";
import { agentDebugLog, getAgentDebugLogs } from "./agentDebugLog.js";
import { createVpsPoseStabilizer } from "./vpsPoseStabilizer.js";

const LOCALIZE_INTERVAL_MS = 800;
const SDK_DEVICE_LOCALIZE_INTERVAL_MS = 16;
const SDK_SERVER_ASSIST_INTERVAL_MS = 800;
const SDK_DEVICE_WATCHDOG_MS = 8000;
const SDK_DEBUG_INTERVAL_MS = 250;
const STABLE_LOCALIZATION_COUNT = 2;
const MAP_SWITCH_CONFIRMATIONS = 3;
const LOCALIZATION_GRACE_MS = 2200;
const MARKER_LOST_GRACE_MS = 900;
const CAPTURE_WIDTH = 480;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const CLIENT_IMMERSAL_TOKEN = import.meta.env.VITE_IMMERSAL_TOKEN ?? "";
const IMMERSAL_API_BASE_URL = "https://api.immersal.com";
const LAST_LOCALIZED_MAP_KEY = "changgate.immersal.last-map.v1";
const MAP_PREFETCH_CONCURRENCY = 2;

function createSharedImmersalCamera(video, stream) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
    willReadFrequently: true,
  });
  const track = stream?.getVideoTracks?.()[0] ?? null;
  const settings = track?.getSettings?.() ?? {};

  return {
    el: video,
    cameraId: settings.deviceId ?? null,
    cameraLabel: track?.label || "shared rear camera",
    width: video.videoWidth,
    height: video.videoHeight,
    getImageData(scale = 1) {
      const width = Math.max(1, Math.round(this.width * scale));
      const height = Math.max(1, Math.round(this.height * scale));
      canvas.width = width;
      canvas.height = height;
      context.drawImage(video, 0, 0, width, height);
      return context.getImageData(0, 0, width, height).data;
    },
  };
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function multiplyQuat(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function quatInvert(q) {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

function quatFromAxisAngle(axis, angle) {
  const half = angle * 0.5;
  const s = Math.sin(half);
  return {
    x: axis.x * s,
    y: axis.y * s,
    z: axis.z * s,
    w: Math.cos(half),
  };
}

function quatFromEuler(pitch, yaw, roll) {
  const qX = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, pitch);
  const qY = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, yaw);
  const qZ = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, roll);
  return multiplyQuat(multiplyQuat(qY, qX), qZ);
}

function deviceOrientationToQuaternion(alpha, beta, gamma, screenAngle) {
  const qScreen = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -degToRad(screenAngle));
  const qPortrait = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -Math.PI / 2);
  const qDevice = quatFromEuler(beta, alpha, -gamma);
  const qTilt = multiplyQuat(qDevice, qPortrait);
  return multiplyQuat(qScreen, qTilt);
}

function quatFromRotationMatrix(matrix) {
  const m = matrix;
  let w;
  let x;
  let y;
  let z;
  const trace = m[0][0] + m[1][1] + m[2][2];

  if (trace > 0) {
    const s = Math.sqrt(1 + trace) * 2;
    w = 0.25 * s;
    x = (m[2][1] - m[1][2]) / s;
    y = (m[0][2] - m[2][0]) / s;
    z = (m[1][0] - m[0][1]) / s;
  } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
    w = (m[2][1] - m[1][2]) / s;
    x = 0.25 * s;
    y = (m[0][1] + m[1][0]) / s;
    z = (m[0][2] + m[2][0]) / s;
  } else if (m[1][1] > m[2][2]) {
    const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
    w = (m[0][2] - m[2][0]) / s;
    x = (m[0][1] + m[1][0]) / s;
    y = 0.25 * s;
    z = (m[1][2] + m[2][1]) / s;
  } else {
    const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
    w = (m[1][0] - m[0][1]) / s;
    x = (m[0][2] + m[2][0]) / s;
    y = (m[1][2] + m[2][1]) / s;
    z = 0.25 * s;
  }

  return { x, y, z, w };
}

function restResultToPose(result) {
  const rotationMatrix = [
    [result.r00, result.r01, result.r02],
    [result.r10, result.r11, result.r12],
    [result.r20, result.r21, result.r22],
  ];
  const rotation = quatFromRotationMatrix(rotationMatrix);
  const pose = {
    map: result.map,
    position: { x: result.px, y: result.py, z: result.pz },
    rotationMatrix,
    rotation,
  };

  // #region agent log
  agentDebugLog("initial", "H2,H5", "js/ar/arScene.js:restResultToPose", "Immersal REST result converted to renderer pose", {
    map: pose.map,
    position: pose.position,
    rotationMatrix,
    rotation,
    anchors: getAnchorsForMap(pose.map),
  });
  // #endregion

  return pose;
}

const AXIS_ROT = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI);

export function bootstrapArScene(rootEl) {
  const params = new URLSearchParams(window.location.search);
  const debugMode = params.has("debug") || params.has("dev");
  const immersalOnlyMode = params.get("recognition") === "immersal";
  rootEl.classList.toggle("is-debug-mode", debugMode);
  rootEl.classList.toggle("is-immersal-only", immersalOnlyMode);
  const video = rootEl.querySelector("#ar-camera");
  const overlay = rootEl.querySelector("#ar-start-overlay");
  const startBtn = rootEl.querySelector("#ar-start-btn");
  const errorMsg = rootEl.querySelector("#ar-error-msg");
  const controls = rootEl.querySelector("#ar-controls");
  const controlsToggle = rootEl.querySelector("#ar-controls-toggle");
  const zoomSlider = rootEl.querySelector("#ar-zoom-slider");
  const zoomValue = rootEl.querySelector("#ar-zoom-value");
  const zoomOutBtn = rootEl.querySelector("#ar-zoom-out");
  const zoomInBtn = rootEl.querySelector("#ar-zoom-in");
  const hint = rootEl.querySelector("#ar-hint");
  const hintToggle = rootEl.querySelector("#ar-hint-toggle");
  const debugPanel = rootEl.querySelector("#ar-debug");
  const debugToggle = rootEl.querySelector("#ar-debug-toggle");
  const localizeNowBtn = rootEl.querySelector("#ar-localize-now");
  const copyDebugBtn = rootEl.querySelector("#ar-copy-debug");
  const debugLog = rootEl.querySelector("#ar-debug-log");
  const guide = rootEl.querySelector("#ar-guide");
  const guideTitle = rootEl.querySelector("#ar-guide-title");
  const guideDetail = rootEl.querySelector("#ar-guide-detail");
  const guideProgress = rootEl.querySelector("#ar-guide-progress");
  const guideProgressBar = rootEl.querySelector("#ar-guide-progress-bar");
  const preload = rootEl.querySelector("#ar-preload");
  const preloadStatus = rootEl.querySelector("#ar-preload-status");
  const preloadPercent = rootEl.querySelector("#ar-preload-percent");
  const preloadProgress = rootEl.querySelector("#ar-preload-progress");
  const preloadProgressBar = rootEl.querySelector("#ar-preload-progress-bar");
  const story = rootEl.querySelector("#ar-story");
  const storyClose = rootEl.querySelector("#ar-story-close");
  const dynastySwitcher = rootEl.querySelector("#ar-dynasty-switcher");
  const dynastyButtons = Array.from(
    rootEl.querySelectorAll("#ar-dynasty-switcher [data-scene]"),
  );
  const dynastyTransition = rootEl.querySelector("#ar-dynasty-transition");
  const dynastyTransitionTitle = rootEl.querySelector(
    "#ar-dynasty-transition-title",
  );
  const debugEls = {
    status: rootEl.querySelector("#ar-debug-status"),
    map: rootEl.querySelector("#ar-debug-map"),
    camera: rootEl.querySelector("#ar-debug-camera"),
    webxr: rootEl.querySelector("#ar-debug-webxr"),
    immersal: rootEl.querySelector("#ar-debug-immersal"),
    mode: rootEl.querySelector("#ar-debug-mode"),
    marker: rootEl.querySelector("#ar-debug-marker"),
    counts: rootEl.querySelector("#ar-debug-counts"),
    latency: rootEl.querySelector("#ar-debug-latency"),
    error: rootEl.querySelector("#ar-debug-error"),
    pose: rootEl.querySelector("#ar-debug-pose"),
  };

  const mapSelect = rootEl.querySelector("#ar-map-select");
  let mapSelectChangeHandler = null;
  if (mapSelect) {
    if (params.has("map")) {
      mapSelect.value = params.get("map");
    } else {
      mapSelect.value = "all";
    }

    mapSelectChangeHandler = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("maps");
      if (mapSelect.value === "all") {
        url.searchParams.delete("map");
      } else {
        url.searchParams.set("map", mapSelect.value);
      }
      window.location.assign(url.toString());
    };
    mapSelect.addEventListener("change", mapSelectChangeHandler);
  }
  const requestedMapIds = resolveActiveMapIds({ selectedValue: mapSelect?.value ?? "all" });
  const requestedProfiles = getMapProfilesForIds(requestedMapIds);
  const mapProfiles = debugMode
    ? requestedProfiles
    : requestedProfiles.filter((profile) =>
        profile.anchors.some((anchor) => anchor.type === "bamboo-notice"),
      );
  const activeMapIds = mapProfiles.map((profile) => profile.mapId);
  const activeMapLabel = formatMapIdList(activeMapIds);
  const totalAnchorCount = mapProfiles.reduce((sum, profile) => sum + profile.anchors.length, 0);
  let localizedMapId = activeMapIds.length === 1 ? activeMapIds[0] : null;

  let mediaStream = null;
  let orientationHandler = null;
  let localizeTimer = null;
  let sdkSession = null;
  let sdkFrameId = null;
  let sdkResizeHandler = null;
  let sdkMapHandles = {};
  let sdkRemainingMapsPromise = null;
  let localizationMode = "rest";
  let localizing = false;
  let captureCanvas = null;
  let captureCtx = null;
  let cameraZoom = 1;
  let deviceQuaternion = { x: 0, y: 0, z: 0, w: 1 };
  let hasGyro = false;
  let lastIntrinsics = { fx: 0, fy: 0, ox: 0, oy: 0 };
  let sdkFailureCount = 0;
  let sdkServerAssistPending = false;
  let sdkLastServerAssistAt = 0;
  let sdkServerAssistEnabled = false;
  let sdkDeviceWatchdogTimer = null;
  let sdkLastLocalizeCounter = 0;
  let sdkWasLocalizing = false;
  let sdkLastDebugAt = 0;
  let arRenderer = null;
  let arRendererInitPromise = null;
  let lastMapPose = null;
  let lockedRendererVFov = null;
  let restActiveMapId = activeMapIds.length === 1 ? activeMapIds[0] : null;
  let restCandidateMapId = null;
  let restCandidateMapConfirmations = 0;
  let lastSuccessfulLocalizeAt = 0;
  let stableLocalizationCount = 0;
  let stableLocalizationMapId = null;
  let contentRevealed = false;
  let restRenderFrameId = null;
  let agentLastRendererPoseLogAt = 0;
  let lastLocalizationGyro = { x: 0, y: 0, z: 0, w: 1 };
  let sdkModulePromise = null;
  let assetWarmupTimer = null;
  let markerRecognition = null;
  let markerStartPromise = null;
  let markerLostTimer = null;
  let dynastySwitching = false;
  let sharedImmersalCamera = null;
  let recognitionMode = "scanning";
  let disposed = false;
  let rendererAssetReady = false;
  let sdkAssetReady = false;
  const prefetchedMapIds = new Set();
  const mapDownloadPromises = new Map();
  const mapDownloadControllers = new Map();
  const poseStabilizer = createVpsPoseStabilizer();
  const dynastyClickHandlers = new Map();

  const debugState = {
    status: "idle",
    mapId: activeMapLabel,
    localizedMapId,
    activeMapIds,
    camera: "waiting",
    cameraZoom: "1.00x",
    webxr: "checking",
    immersal: "not started",
    success: 0,
    failure: 0,
    latency: "-",
    lastError: "none",
    lastPose: null,
    lastImageBytes: 0,
    recognitionMode,
    marker: "not started",
    video: null,
    logs: [],
  };

  function getPrioritizedMapIds() {
    let lastMapId = null;
    try {
      lastMapId = Number(window.localStorage.getItem(LAST_LOCALIZED_MAP_KEY));
    } catch {
      lastMapId = null;
    }
    if (!Number.isFinite(lastMapId) || !activeMapIds.includes(lastMapId)) {
      return [...activeMapIds];
    }
    return [lastMapId, ...activeMapIds.filter((mapId) => mapId !== lastMapId)];
  }

  function updatePreloadUi(message = "") {
    if (!preload) return;
    const mapRatio = activeMapIds.length > 0
      ? prefetchedMapIds.size / activeMapIds.length
      : 1;
    const ready =
      rendererAssetReady &&
      sdkAssetReady &&
      mapRatio >= 1;
    const progress = ready
      ? 100
      : Math.min(
          96,
          5 +
            (rendererAssetReady ? 30 : 0) +
            (sdkAssetReady ? 20 : 0) +
            Math.round(mapRatio * 45),
        );
    const defaultMessage = ready
      ? "导览内容准备完成"
      : prefetchedMapIds.size > 0
        ? `正在准备定位区域 ${prefetchedMapIds.size}/${activeMapIds.length}`
        : sdkAssetReady
          ? "正在提前下载定位地图…"
          : rendererAssetReady
            ? "竹简已就绪，正在准备定位引擎…"
            : "正在准备导览内容…";

    preload.dataset.state = ready ? "ready" : "loading";
    preloadStatus.textContent = message || defaultMessage;
    preloadPercent.textContent = `${progress}%`;
    preloadProgress.setAttribute("aria-valuenow", String(progress));
    preloadProgressBar.style.width = `${progress}%`;

    if (!startBtn.disabled && !rootEl.classList.contains("is-ar-active")) {
      startBtn.textContent = "开始实景导览";
    }
  }

  function getImmersalSdkModule() {
    if (!sdkModulePromise) {
      const sdkUrl = new URL("/vendor/immersal/immersal.js", window.location.origin).href;
      sdkModulePromise = import(/* @vite-ignore */ sdkUrl)
        .then((module) => {
          sdkAssetReady = true;
          updatePreloadUi();
          return module;
        })
        .catch((err) => {
          sdkModulePromise = null;
          updatePreloadUi("定位引擎将在开启后重试");
          throw err;
        });
    }
    return sdkModulePromise;
  }

  function prefetchMapData(mapId) {
    if (mapDownloadPromises.has(mapId)) {
      return mapDownloadPromises.get(mapId);
    }

    const controller = new AbortController();
    mapDownloadControllers.set(mapId, controller);
    const url =
      `${IMMERSAL_API_BASE_URL}/map?token=${encodeURIComponent(CLIENT_IMMERSAL_TOKEN)}` +
      `&id=${encodeURIComponent(mapId)}`;
    const promise = fetch(url, {
      signal: controller.signal,
      cache: "default",
    })
      .then((response) => {
        if (!response.ok) throw new Error(`地图 ${mapId} 下载失败（${response.status}）`);
        return response.arrayBuffer();
      })
      .then((data) => {
        prefetchedMapIds.add(mapId);
        mapDownloadControllers.delete(mapId);
        updatePreloadUi();
        return data;
      })
      .catch((err) => {
        mapDownloadControllers.delete(mapId);
        mapDownloadPromises.delete(mapId);
        if (err?.name !== "AbortError" && !disposed) {
          updatePreloadUi("网络较慢，其余内容将在开始后继续载入");
        }
        throw err;
      });
    mapDownloadPromises.set(mapId, promise);
    return promise;
  }

  async function getPrefetchedMapData(mapId) {
    const pending = mapDownloadPromises.get(mapId);
    if (!pending) return null;
    try {
      return await pending;
    } catch {
      return null;
    }
  }

  function warmImmersalAssets() {
    if (!CLIENT_IMMERSAL_TOKEN || activeMapIds.length === 0 || disposed) return;
    void getImmersalSdkModule().catch(() => {});

    const queue = getPrioritizedMapIds();
    let nextIndex = 0;
    const worker = async () => {
      while (!disposed && nextIndex < queue.length) {
        const mapId = queue[nextIndex];
        nextIndex += 1;
        try {
          await prefetchMapData(mapId);
        } catch {
          // Startup can retry the same map through the SDK's normal fetch path.
        }
      }
    };
    const workerCount = Math.min(MAP_PREFETCH_CONCURRENCY, queue.length);
    for (let index = 0; index < workerCount; index += 1) void worker();
  }

  function applyLocalizedMapId(mapId) {
    const id = Number(mapId);
    if (!Number.isFinite(id) || !activeMapIds.includes(id)) return;
    localizedMapId = id;
    rootEl.dataset.activeMapId = String(id);
    rootEl.dispatchEvent(new CustomEvent("ar:localized-map-change", {
      detail: { mapId: id },
    }));
    try {
      window.localStorage.setItem(LAST_LOCALIZED_MAP_KEY, String(id));
    } catch {
      // Remembering the last successful area is an optional optimization.
    }
    arRenderer?.setActiveMapId(id);
    debugState.localizedMapId = id;
    debugState.mapId = activeMapIds.length > 1 ? `${activeMapLabel} → ${id}` : String(id);
    updateDebugPanel();
  }

  function acceptRestMapId(mapId) {
    const id = Number(mapId);
    if (!Number.isFinite(id) || !activeMapIds.includes(id)) return false;
    if (activeMapIds.length <= 1 || restActiveMapId === id) {
      restActiveMapId = id;
      restCandidateMapId = null;
      restCandidateMapConfirmations = 0;
      return true;
    }

    if (restCandidateMapId !== id) {
      restCandidateMapId = id;
      restCandidateMapConfirmations = 1;
      return false;
    }

    restCandidateMapConfirmations += 1;
    const required = restActiveMapId == null
      ? STABLE_LOCALIZATION_COUNT
      : MAP_SWITCH_CONFIRMATIONS;
    if (restCandidateMapConfirmations < required) return false;

    restActiveMapId = id;
    restCandidateMapId = null;
    restCandidateMapConfirmations = 0;
    return true;
  }

  function captureLocalizationGyro() {
    let gyro = null;
    if (sdkSession?.gyroData) {
      gyro = {
        x: sdkSession.gyroData.x,
        y: sdkSession.gyroData.y,
        z: sdkSession.gyroData.z,
        w: sdkSession.gyroData.w,
      };
      sdkSession.localization?.lastGyro?.set(gyro.x, gyro.y, gyro.z, gyro.w);
    } else if (hasGyro) {
      gyro = { ...deviceQuaternion };
    }
    if (gyro) {
      lastLocalizationGyro = gyro;
    }
    return gyro;
  }

  function getLastLocalizationGyro() {
    if (sdkSession?.localization?.lastGyro) {
      const g = sdkSession.localization.lastGyro;
      return { x: g.x, y: g.y, z: g.z, w: g.w };
    }
    return lastLocalizationGyro;
  }

  function applyImmersalPoseCorrection(rotation) {
    let corrected = multiplyQuat(rotation, AXIS_ROT);
    if (hasGyro) {
      corrected = multiplyQuat(corrected, quatInvert(getLastLocalizationGyro()));
    }
    return corrected;
  }

  function syncSdkSolverType() {
    if (!sdkSession) return;
    sdkSession.solverType = hasGyro ? 1 : 0;
  }

  function getGyroQuaternion() {
    if (sdkSession?.gyroData) {
      const g = sdkSession.gyroData;
      return { x: g.x, y: g.y, z: g.z, w: g.w };
    }
    if (!hasGyro) return null;
    return { ...deviceQuaternion };
  }

  function getRendererVFov() {
    if (sdkSession && typeof sdkSession.getVFov === "function") {
      try {
        if (lockedRendererVFov != null) return lockedRendererVFov;
        if (
          typeof sdkSession.isFocalLengthStable === "function" &&
          !sdkSession.isFocalLengthStable()
        ) {
          return null;
        }
        const vFov = sdkSession.getVFov();
        if (Number.isFinite(vFov) && vFov > 10 && vFov < 120) {
          lockedRendererVFov = vFov;
        }
        return lockedRendererVFov;
      } catch {
        return null;
      }
    }
    return null;
  }

  function getSdkCameraDebug() {
    if (!sdkSession) return null;
    return {
      width: sdkSession.cameraData?.width ?? null,
      height: sdkSession.cameraData?.height ?? null,
      intrinsics: sdkSession.cameraData?.intrinsics ? { ...sdkSession.cameraData.intrinsics } : null,
      vFov: getRendererVFov(),
      focalLengthStable: sdkSession.isFocalLengthStable?.() ?? null,
      mapTracking: sdkSession.getMapTrackingState?.() ?? null,
    };
  }

  function poseForRenderer(poseLike) {
    if (!poseLike) return null;
    if (poseLike.position && poseLike.rotation) {
      return {
        position: poseLike.position,
        rotation: poseLike.rotation,
      };
    }
    return null;
  }

  function setGuide(
    state,
    title,
    detail,
    progress = null,
    { channel = "localization" } = {},
  ) {
    if (!guide) return;
    if (recognitionMode === "marker" && channel !== "marker") return;
    guide.dataset.state = state;
    if (title) guideTitle.textContent = title;
    if (detail) guideDetail.textContent = detail;
    const hasProgress = Number.isFinite(progress);
    guideProgress?.classList.toggle("is-visible", hasProgress);
    if (guideProgressBar) {
      guideProgressBar.style.width = hasProgress
        ? `${Math.min(100, Math.max(0, progress))}%`
        : "0%";
    }
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function currentDynastyId() {
    return (
      markerRecognition?.currentScene?.id ||
      params.get("scene") ||
      params.get("dynasty") ||
      "song"
    );
  }

  function updateDynastyControls(sceneId = currentDynastyId()) {
    const controlsDisabled = !markerRecognition || dynastySwitching || disposed;
    dynastySwitcher?.setAttribute(
      "aria-busy",
      controlsDisabled ? "true" : "false",
    );
    dynastyButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        button.dataset.scene === sceneId ? "true" : "false",
      );
      button.disabled = controlsDisabled;
    });
  }

  function showDynastyTransition(label) {
    if (!dynastyTransition) return;
    if (dynastyTransitionTitle) {
      dynastyTransitionTitle.textContent = `正在前往${label}`;
    }
    dynastyTransition.classList.remove("is-revealing");
    dynastyTransition.classList.add("is-active");
    dynastyTransition.setAttribute("aria-hidden", "false");
  }

  async function hideDynastyTransition(reducedMotion = false) {
    if (!dynastyTransition) return;
    dynastyTransition.classList.add("is-revealing");
    await wait(reducedMotion ? 20 : 430);
    dynastyTransition.classList.remove("is-active", "is-revealing");
    dynastyTransition.setAttribute("aria-hidden", "true");
  }

  async function switchDynasty(sceneId) {
    if (
      disposed ||
      dynastySwitching ||
      !markerRecognition ||
      markerRecognition.currentScene?.id === sceneId
    ) {
      return;
    }

    const button = dynastyButtons.find(
      (candidate) => candidate.dataset.scene === sceneId,
    );
    const label = button?.textContent?.trim() || "历史场景";
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    dynastySwitching = true;
    updateDynastyControls();
    showDynastyTransition(label);
    setGuide(
      "loading",
      `正在前往${label}`,
      "正在更换门后的历史场景，请保持纹理边框在画面中",
      null,
      { channel: "marker" },
    );

    try {
      await wait(reducedMotion ? 20 : 440);
      if (disposed) return;
      const minimumDisplay = wait(reducedMotion ? 20 : 560);
      const result = await markerRecognition.switchScene(sceneId);
      await minimumDisplay;
      updateDynastyControls(result.profile.id);
      if (markerRecognition.tracking) {
        setGuide(
          "recognized",
          `已切换至${result.profile.label}`,
          "保持纹理边框在画面中，移动手机查看门后的历史场景",
          null,
          { channel: "marker" },
        );
      }
    } catch (error) {
      logDebug("历史场景切换失败", error?.message || String(error));
      setGuide(
        "lost",
        "历史场景切换失败",
        "请检查网络后重新选择朝代",
        null,
        { channel: "marker" },
      );
    } finally {
      await hideDynastyTransition(reducedMotion);
      dynastySwitching = false;
      updateDynastyControls();
    }
  }

  function setSdkRecognitionPaused(paused) {
    if (!sdkSession) return;
    const shouldRun = !paused;
    if (sdkSession.continuousLocalization !== shouldRun) {
      sdkSession.continuousLocalization = shouldRun;
    }
  }

  function setRecognitionMode(nextMode, reason = "") {
    if (!["scanning", "map", "marker"].includes(nextMode)) return false;
    if (recognitionMode === nextMode) return true;
    if (nextMode === "map" && recognitionMode === "marker") return false;

    window.clearTimeout(markerLostTimer);
    markerLostTimer = null;
    recognitionMode = nextMode;
    debugState.recognitionMode = nextMode;
    rootEl.classList.toggle("is-marker-active", nextMode === "marker");
    rootEl.classList.toggle("is-map-active", nextMode === "map");

    if (nextMode === "marker") {
      contentRevealed = false;
      stableLocalizationCount = 0;
      closeStory();
      arRenderer?.setContentVisible(false);
      arRenderer?.setEnabled?.(false);
      setSdkRecognitionPaused(true);
      setGuide(
        "recognized",
        "已识别纹理入口",
        "保持纹理边框在画面中，移动手机查看门后的历史场景",
        null,
        { channel: "marker" },
      );
    } else {
      arRenderer?.setEnabled?.(true);
      if (nextMode === "map") {
        markerRecognition?.pause();
      } else {
        markerRecognition?.resume();
        setGuide(
          "scanning",
          "正在识别现场",
          "可对准建筑地图区域，也可将完整纹理边框放入画面",
        );
      }
      setSdkRecognitionPaused(false);
    }

    setDebug(
      {
        recognitionMode: nextMode,
        status:
          nextMode === "marker"
            ? "tracking (marker)"
            : nextMode === "map"
              ? "tracking (map)"
              : "scanning (map + marker)",
      },
      `AR 模式切换为 ${nextMode}`,
      reason || null,
    );
    return true;
  }

  function handleMarkerFound() {
    if (disposed || recognitionMode === "map") return;
    window.clearTimeout(markerLostTimer);
    markerLostTimer = null;
    setRecognitionMode("marker", "MindAR target found");
    try {
      navigator.vibrate?.(35);
    } catch {
      // Vibration is optional.
    }
  }

  function handleMarkerLost() {
    if (disposed || recognitionMode !== "marker") return;
    window.clearTimeout(markerLostTimer);
    markerLostTimer = window.setTimeout(() => {
      markerLostTimer = null;
      if (disposed || markerRecognition?.tracking) return;
      setRecognitionMode("scanning", "MindAR target lost");
    }, MARKER_LOST_GRACE_MS);
    setGuide(
      "lost",
      "纹理暂时离开画面",
      "重新对准纹理边框；若已离开该处，将继续搜索地图区域",
      null,
      { channel: "marker" },
    );
  }

  function startMarkerRecognition() {
    if (markerStartPromise) return markerStartPromise;
    markerStartPromise = import("./sharedMarkerRecognition.js")
      .then(({ createSharedMarkerRecognition }) =>
        createSharedMarkerRecognition({
          rootEl,
          video,
          onFound: handleMarkerFound,
          onLost: handleMarkerLost,
          onStatus(status, error, detail) {
            debugState.marker = status;
            if (
              recognitionMode === "marker" &&
              markerRecognition?.tracking !== false
            ) {
              if (status === "portal-loading") {
                setGuide(
                  "loading",
                  "正在打开历史场景",
                  "首次进入需要加载场景，请保持纹理边框在画面中",
                  null,
                  { channel: "marker" },
                );
              } else if (status === "portal-fallback") {
                setGuide(
                  "loading",
                  "正在载入备用场景",
                  "当前场景暂时不可用，请稍候",
                  null,
                  { channel: "marker" },
                );
              } else if (
                status === "portal-ready" ||
                status === "fallback-ready"
              ) {
                setGuide(
                  "recognized",
                  "已识别纹理入口",
                  "保持纹理边框在画面中，移动手机查看门后的历史场景",
                  null,
                  { channel: "marker" },
                );
              }
            }
            if (error) {
              logDebug("MindAR 纹理模式异常", error?.message || String(error));
            } else {
              if (detail?.profile?.id) {
                updateDynastyControls(detail.profile.id);
              }
              updateDebugPanel();
            }
          },
        }),
      )
      .then((session) => {
        markerRecognition = session;
        debugState.marker = "scanning";
        updateDynastyControls(session.currentScene?.id);
        if (recognitionMode === "map") session.pause();
        updateDebugPanel();
        return session;
      })
      .catch((error) => {
        markerStartPromise = null;
        debugState.marker = "unavailable";
        logDebug("MindAR 纹理识别未启动，地图模式仍可使用", error?.message || String(error));
        return null;
      });
    return markerStartPromise;
  }

  function openStory() {
    if (!story || !contentRevealed) return;
    story.classList.remove("is-hidden");
    story.setAttribute("aria-hidden", "false");
    setGuide("explore", "竹简内容已展开", "移动手机查看细节，或关闭介绍返回现场");
  }

  function closeStory() {
    story?.classList.add("is-hidden");
    story?.setAttribute("aria-hidden", "true");
  }

  function revealContent(mapId) {
    if (recognitionMode === "marker") return;
    if (!setRecognitionMode("map", `Immersal map ${mapId ?? "unknown"} confirmed`)) {
      return;
    }
    if (mapId != null) applyLocalizedMapId(mapId);
    if (!contentRevealed) {
      contentRevealed = true;
      arRenderer?.setContentVisible(true, { restart: true });
      setGuide("recognized", "发现阊门竹简", "轻触竹简查看历史内容");
      try {
        navigator.vibrate?.(35);
      } catch {
        // Vibration is optional and unsupported on some browsers.
      }
    }
  }

  function markLocalizationSuccess(mapId = localizedMapId) {
    lastSuccessfulLocalizeAt = performance.now();
    const normalizedMapId = Number(mapId);
    const hasMapId = Number.isFinite(normalizedMapId);
    const nextMapId = hasMapId ? normalizedMapId : localizedMapId;

    if (nextMapId != null && stableLocalizationMapId === nextMapId) {
      stableLocalizationCount += 1;
    } else {
      stableLocalizationMapId = nextMapId;
      stableLocalizationCount = 1;
      if (contentRevealed) {
        contentRevealed = false;
        closeStory();
        arRenderer?.setContentVisible(false);
      }
    }

    if (stableLocalizationCount >= STABLE_LOCALIZATION_COUNT) {
      revealContent(nextMapId);
    } else {
      setGuide("confirming", "已找到场景，正在确认", "请保持手机稳定片刻");
    }
  }

  function markLocalizationMiss() {
    if (recognitionMode === "marker") return;
    stableLocalizationCount = 0;
    restCandidateMapId = null;
    restCandidateMapConfirmations = 0;
    if (!lastSuccessfulLocalizeAt || performance.now() - lastSuccessfulLocalizeAt <= LOCALIZATION_GRACE_MS) {
      return;
    }
    if (contentRevealed) {
      contentRevealed = false;
      closeStory();
      arRenderer?.setContentVisible(false);
    }
    setGuide("lost", "暂时失去场景", "重新对准建筑，并缓慢左右移动");
    if (recognitionMode === "map") {
      setRecognitionMode("scanning", "Immersal map tracking lost");
    }
  }

  function getRestModeRenderPose() {
    if (!lastMapPose) return null;
    return {
      position: { ...lastMapPose.position },
      rotation: { ...lastMapPose.rotation },
    };
  }

  function updateArRendererPose(poseLike, options = {}) {
    if (!arRenderer) return;
    const pose = poseForRenderer(poseLike);
    if (!pose) return;
    if (!options.keepLastMapPose) {
      lastMapPose = pose;
    }
    const gyro = options.skipGyro ? null : getGyroQuaternion();
    const vFov = getRendererVFov();
    const now = performance.now();
    if (now - agentLastRendererPoseLogAt > 1000) {
      agentLastRendererPoseLogAt = now;
      // #region agent log
      agentDebugLog("post-fix", "H1", "js/ar/arScene.js:updateArRendererPose", "Pose handed to AR renderer", {
        localizationMode,
        options,
        pose,
        gyro,
        skipGyroReason: options.skipGyro ? "explicit" : localizationMode === "sdk" ? "sdk-gyro-at-render" : "none",
        vFov,
        hasGyro,
        cameraZoom,
        lastIntrinsics,
        video: debugState.video,
      });
      // #endregion
    }
    arRenderer.updateCameraFromPose(pose, gyro, vFov);
  }

  function initArRenderer() {
    if (arRendererInitPromise) return arRendererInitPromise;
    arRendererInitPromise = (async () => {
      const cameraWrap = rootEl.querySelector("#ar-camera-wrap");
      if (!cameraWrap) return;

      const { createArRenderer } = await import("./arRenderer.js");
      arRenderer = createArRenderer(cameraWrap, {
        getCameraViewport: () => sdkSession?.camera?.el ?? null,
        mapProfiles,
        onAnchorTap: openStory,
      });
      if (localizedMapId != null) arRenderer.setActiveMapId(localizedMapId);
      arRenderer.start();
      try {
        await arRenderer.ready;
        rendererAssetReady = true;
        updatePreloadUi();
        logDebug(`AR 模型已加载（${mapProfiles.length} 张地图，${totalAnchorCount} 个锚点）`);
      } catch (err) {
        updatePreloadUi("竹简将在识别后继续加载");
        logDebug("AR 模型加载失败", err?.message || String(err));
      }
    })();
    return arRendererInitPromise;
  }

  function logArRendererStatus() {
    if (!arRenderer) return;
    const status = arRenderer.getStatus();
    if (status.loadError) {
      setDebug({ lastError: `AR 模型: ${status.loadError}` });
      return;
    }
    if (status.modelsReady && status.hasPose && status.renderCount > 0) return;
    const parts = [
      status.modelsReady ? "模型就绪" : "模型加载中",
      status.hasPose ? "有 pose" : "等待 pose",
      `已渲染 ${status.renderCount} 帧`,
    ];
    logDebug(`AR 渲染：${parts.join(" · ")}`, status);
  }

  function clampZoom(value) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
  }

  function updateDebugPanel() {
    if (!debugPanel) return;
    debugEls.status.textContent = debugState.status;
    debugEls.map.textContent = String(debugState.mapId);
    debugEls.camera.textContent = debugState.camera;
    debugEls.webxr.textContent = debugState.webxr;
    debugEls.immersal.textContent = debugState.immersal;
    if (debugEls.mode) debugEls.mode.textContent = debugState.recognitionMode;
    if (debugEls.marker) debugEls.marker.textContent = debugState.marker;
    debugEls.counts.textContent = `${debugState.success} / ${debugState.failure}`;
    debugEls.latency.textContent = debugState.latency;
    debugEls.error.textContent = debugState.lastError;
    debugEls.pose.textContent = debugState.lastPose
      ? JSON.stringify(debugState.lastPose, null, 2)
      : "pose: waiting";
  }

  function logDebug(message, details = null) {
    const entry = {
      time: new Date().toLocaleTimeString(),
      message,
      details,
    };
    debugState.logs.unshift(entry);
    debugState.logs = debugState.logs.slice(0, 18);

    if (debugLog) {
      debugLog.replaceChildren(
        ...debugState.logs.map((item) => {
          const li = document.createElement("li");
          li.textContent = `[${item.time}] ${item.message}`;
          if (item.details) {
            li.title = typeof item.details === "string" ? item.details : JSON.stringify(item.details);
          }
          return li;
        }),
      );
    }

    console.info("[Immersal]", message, details ?? "");
    updateDebugPanel();
  }

  function setDebug(patch, message = null, details = null) {
    Object.assign(debugState, patch);
    if (message) logDebug(message, details);
    else updateDebugPanel();
  }

  function getDebugSnapshot() {
    return JSON.stringify(
      {
        ...debugState,
        localizationMode,
        cameraZoom,
        hasGyro,
        lastIntrinsics,
        sdkCamera: getSdkCameraDebug(),
        deviceQuaternion,
        lastSuccessfulLocalizeAt,
        msSinceLastLocalize: lastSuccessfulLocalizeAt
          ? Math.round(performance.now() - lastSuccessfulLocalizeAt)
          : null,
        userAgent: navigator.userAgent,
        secureContext: window.isSecureContext,
        location: window.location.href,
        agentLogs: getAgentDebugLogs(),
      },
      null,
      2,
    );
  }

  function showDebugExportModal(text) {
    let modal = rootEl.querySelector("#ar-debug-export");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "ar-debug-export";
      modal.innerHTML = `
        <div class="ar-debug-export__backdrop"></div>
        <div class="ar-debug-export__panel" role="dialog" aria-modal="true" aria-label="Debug 导出">
          <div class="ar-debug-export__header">
            <strong>Debug 内容</strong>
            <button type="button" id="ar-debug-export-close">关闭</button>
          </div>
          <p class="ar-debug-export__hint">自动复制失败。请长按下方文本框，选择“全选”后复制，再发给我。</p>
          <textarea id="ar-debug-export-text" readonly></textarea>
        </div>
      `;
      rootEl.appendChild(modal);
      modal.querySelector(".ar-debug-export__backdrop")?.addEventListener("click", () => {
        modal.classList.add("is-hidden");
      });
      modal.querySelector("#ar-debug-export-close")?.addEventListener("click", () => {
        modal.classList.add("is-hidden");
      });
    }

    const textarea = modal.querySelector("#ar-debug-export-text");
    if (textarea) {
      textarea.value = text;
      textarea.focus();
      textarea.select();
    }
    modal.classList.remove("is-hidden");
  }

  async function copyTextWithFallback(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return "clipboard";
      } catch {
        // fall through
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    document.body.removeChild(textarea);
    if (copied) return "execCommand";

    if (navigator.share) {
      try {
        await navigator.share({ title: "AR Debug", text });
        return "share";
      } catch (err) {
        if (err?.name === "AbortError") return "share-cancelled";
      }
    }

    showDebugExportModal(text);
    return "modal";
  }

  function setCopyDebugButtonLabel(label, resetMs = 1800) {
    if (!copyDebugBtn) return;
    copyDebugBtn.textContent = label;
    window.setTimeout(() => {
      copyDebugBtn.textContent = "复制 debug";
    }, resetMs);
  }

  function showError(message) {
    errorMsg.textContent = message;
    startBtn.disabled = false;
    startBtn.textContent = "重试";
    overlay.classList.remove("is-hidden");
    guide?.classList.add("is-hidden");
    setDebug({ status: "error", lastError: message }, "启动失败", message);
  }

  function updateZoomUi() {
    const label = `${cameraZoom.toFixed(2)}x`;
    if (zoomSlider) zoomSlider.value = String(cameraZoom);
    if (zoomValue) zoomValue.textContent = label;
    rootEl.style.setProperty("--ar-camera-zoom", String(cameraZoom));
    setDebug({ cameraZoom: label });
  }

  function setCameraZoom(nextZoom) {
    cameraZoom = clampZoom(nextZoom);
    updateZoomUi();
  }

  async function checkWebXrSupport() {
    if (!navigator.xr?.isSessionSupported) {
      setDebug({ webxr: "not available" }, "WebXR 不可用");
      return false;
    }

    try {
      const supported = await navigator.xr.isSessionSupported("immersive-ar");
      setDebug(
        { webxr: supported ? "immersive-ar supported" : "immersive-ar unsupported" },
        supported ? "WebXR immersive-ar 支持" : "WebXR immersive-ar 不支持",
      );
      return supported;
    } catch (err) {
      setDebug({ webxr: "check failed" }, "WebXR 检测失败", err?.message || String(err));
      return false;
    }
  }

  async function requestCameraPermission() {
    if (
      mediaStream?.active &&
      video.srcObject === mediaStream &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return mediaStream;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("当前浏览器不支持摄像头访问，请使用 Chrome 或 Safari。");
    }

    setDebug({ status: "requesting camera", camera: "requesting" }, "申请摄像头权限");
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });

    video.srcObject = mediaStream;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    await video.play();
    rootEl.classList.add("is-unified-camera");
    sharedImmersalCamera = createSharedImmersalCamera(video, mediaStream);

    const track = mediaStream.getVideoTracks()[0];
    const settings = track?.getSettings?.() ?? {};
    debugState.video = {
      width: video.videoWidth,
      height: video.videoHeight,
      track: settings,
    };
    setDebug(
      {
        camera: `${video.videoWidth}x${video.videoHeight} (contain 1x = 完整画面)`,
      },
      "摄像头已打开",
      debugState.video,
    );
    return mediaStream;
  }

  async function requestOrientationPermission() {
    const orientationEvent = window.DeviceOrientationEvent;
    const motionEvent = window.DeviceMotionEvent;
    const permissionOwner =
      typeof orientationEvent?.requestPermission === "function"
        ? orientationEvent
        : typeof motionEvent?.requestPermission === "function"
          ? motionEvent
          : null;

    if (permissionOwner) {
      // iOS requires this call to happen synchronously inside the click handler.
      // startExperience deliberately starts this promise before its first await.
      const result = await permissionOwner.requestPermission();
      if (result !== "granted") {
        throw new Error("需要允许动作与方向感应权限才能提交姿态数据。");
      }
    }

    if (!orientationHandler) {
      orientationHandler = onDeviceOrientation;
      window.addEventListener("deviceorientation", orientationHandler, true);
    }
    setDebug({ status: "orientation ready" }, "设备方向监听已启用");
  }

  function onDeviceOrientation(event) {
    if (event.alpha == null || event.beta == null || event.gamma == null) return;
    hasGyro = true;
    const screenAngle = window.screen?.orientation?.angle ?? window.orientation ?? 0;
    deviceQuaternion = deviceOrientationToQuaternion(
      degToRad(event.alpha ?? 0),
      degToRad(event.beta ?? 0),
      degToRad(event.gamma ?? 0),
      screenAngle,
    );
  }

  function getCameraRotation() {
    if (!hasGyro) {
      return { qx: 0, qy: 0, qz: 0, qw: 1 };
    }
    const camRot = multiplyQuat(deviceQuaternion, AXIS_ROT);
    return { qx: camRot.x, qy: camRot.y, qz: camRot.z, qw: camRot.w };
  }

  function getIntrinsics(capture) {
    const ox = capture.width / 2;
    const oy = capture.height / 2;
    // 未接入 Immersal devget 设备标定时，发送 0 让服务端估计焦距。
    lastIntrinsics = { fx: 0, fy: 0, ox, oy };
    return lastIntrinsics;
  }

  function getCaptureCanvas() {
    if (!captureCanvas) {
      captureCanvas = document.createElement("canvas");
      captureCtx = captureCanvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
        willReadFrequently: true,
      });
    }
    return captureCanvas;
  }

  function getActiveCameraVideo() {
    return sdkSession?.camera?.el ?? video;
  }

  function captureFrameDataUrl(sourceVideo = getActiveCameraVideo()) {
    if (!sourceVideo?.videoWidth || !sourceVideo?.videoHeight) {
      throw new Error("摄像头视频尚未产生有效帧");
    }

    const ratio = sourceVideo.videoHeight / sourceVideo.videoWidth;
    const width = CAPTURE_WIDTH;
    const height = Math.max(1, Math.round(width * ratio));
    const target = getCaptureCanvas();
    target.width = width;
    target.height = height;

    let srcX = 0;
    let srcY = 0;
    let srcWidth = sourceVideo.videoWidth;
    let srcHeight = sourceVideo.videoHeight;

    if (cameraZoom > 1) {
      srcWidth = sourceVideo.videoWidth / cameraZoom;
      srcHeight = sourceVideo.videoHeight / cameraZoom;
      srcX = (sourceVideo.videoWidth - srcWidth) / 2;
      srcY = (sourceVideo.videoHeight - srcHeight) / 2;
    }

    captureCtx.drawImage(sourceVideo, srcX, srcY, srcWidth, srcHeight, 0, 0, width, height);
    return {
      imageBase64: target.toDataURL("image/png"),
      width,
      height,
    };
  }

  function getLocalizationPayload(capture) {
    const intrinsics = getIntrinsics(capture);
    const rotation = getCameraRotation();
    const solverType = hasGyro ? 1 : 0;

    return {
      action: "localize",
      mapIds: activeMapIds,
      mapId: activeMapIds[0],
      imageBase64: capture.imageBase64,
      camera: {
        fx: intrinsics.fx,
        fy: intrinsics.fy,
        ox: intrinsics.ox,
        oy: intrinsics.oy,
        width: capture.width,
        height: capture.height,
      },
      rotation,
      solverType,
    };
  }

  async function requestImmersalLocalization(reason = "auto") {
    captureLocalizationGyro();
    const capture = captureFrameDataUrl();
    const payload = getLocalizationPayload(capture);
    const startedAt = performance.now();
    const response = await fetch("/api/immersal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    const elapsed = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      const message = data?.message || data?.upstream || `HTTP ${response.status}`;
      throw new Error(typeof message === "string" ? message : JSON.stringify(message));
    }

    return {
      elapsed,
      payload,
      data,
      result: data?.result,
      reason,
    };
  }

  function getTrackedPoseSnapshot(now = performance.now()) {
    if (!sdkSession || sdkSession.localization.counter <= 0) return null;

    const info = sdkSession.localizeInfo;
    const mapData = sdkSession.getMapDataByHandle?.(info.handle);
    const mapId = mapData?.id ?? null;
    const source = sdkServerAssistPending ? "server" : "device";
    const observation = poseStabilizer.observe({
      mapId,
      counter: sdkSession.localization.counter,
      position: info.position,
      rotation: info.rotation,
      timestamp: now,
      source,
      latencyMs: info.elapsedTime,
    });

    let estimatedPosition = null;
    if (source === "device" && typeof window.icvPoseGet === "function") {
      try {
        const estimatedPose = sdkSession.getEstimatedPose(now);
        if (estimatedPose?.position) {
          estimatedPosition = {
            x: estimatedPose.position[0],
            y: estimatedPose.position[1],
            z: estimatedPose.position[2],
          };
        }
      } catch (err) {
        console.warn("[Immersal] Tracker pose read failed", err);
      }
    }

    const stabilized = poseStabilizer.getPose({ timestamp: now, estimatedPosition });
    if (!stabilized) return null;
    return {
      mode: sdkServerAssistEnabled ? "sdk-device+server" : "sdk-device",
      map: mapId,
      mapId,
      mapHandle: info.handle,
      position: stabilized.position,
      rotation: stabilized.rotation,
      estimated: stabilized.tracking.mode === "bounded-prediction",
      translationTracking: stabilized.tracking.mode,
      localizationCounter: sdkSession.localization.counter,
      poseFilter: {
        observation,
        ...stabilized.tracking,
      },
    };
  }

  async function localizeOnce(reason = "auto") {
    if (localizing || recognitionMode === "marker") return;

    localizing = true;
    const startedAt = performance.now();
    setDebug({ status: `localizing (${reason})`, immersal: "requesting" });

    try {
      const localization = await requestImmersalLocalization(reason);
      if (recognitionMode === "marker") return;
      const { result, data, elapsed, payload } = localization;

      if (result?.success) {
        debugState.success += 1;
        const rawPose = restResultToPose(result);
        if (!acceptRestMapId(rawPose.map)) {
          setGuide("confirming", "已找到相邻地图，正在确认", "请保持手机稳定片刻");
          setDebug(
            {
              status: "confirming map switch",
              immersal: "map candidate",
              latency: `${data.elapsedMs ?? elapsed}ms`,
              lastError: "none",
              lastPose: rawPose,
            },
            "等待地图切换确认",
            {
              candidateMapId: restCandidateMapId,
              confirmations: restCandidateMapConfirmations,
              required: restActiveMapId == null ? STABLE_LOCALIZATION_COUNT : MAP_SWITCH_CONFIRMATIONS,
            },
          );
          return;
        }
        markLocalizationSuccess(rawPose.map);
        const pose = {
          ...rawPose,
          rotation: applyImmersalPoseCorrection(rawPose.rotation),
        };
        const poseObservation = poseStabilizer.observe({
          mapId: rawPose.map,
          counter: `rest-${debugState.success}`,
          position: pose.position,
          rotation: pose.rotation,
          timestamp: performance.now(),
          source: "server",
          latencyMs: data.elapsedMs ?? elapsed,
        });
        const stabilized = poseStabilizer.getPose();
        const renderPose = stabilized
          ? {
              ...pose,
              position: stabilized.position,
              rotation: stabilized.rotation,
              poseFilter: { observation: poseObservation, ...stabilized.tracking },
            }
          : pose;
        applyLocalizedMapId(rawPose.map);
        lastMapPose = poseForRenderer(renderPose);
        updateArRendererPose(renderPose);
        logArRendererStatus();
        setDebug(
          {
            status: "localized",
            immersal: "recognized",
            latency: `${data.elapsedMs ?? elapsed}ms`,
            lastError: "none",
            lastImageBytes: data.imageBytes ?? payload.imageBase64.length,
            lastPose: renderPose,
          },
          "场景识别成功",
          result,
        );
      } else {
        debugState.failure += 1;
        markLocalizationMiss();
        const failReason = result?.error && result.error !== "none"
          ? result.error
          : "场景未匹配（success=false）";
        setDebug(
          {
            status: "not recognized",
            immersal: "no match",
            latency: `${data.elapsedMs ?? elapsed}ms`,
            lastError: failReason,
            lastPose: result ?? null,
          },
          "场景暂未识别",
          { result, solverType: hasGyro ? 1 : 0, intrinsics: lastIntrinsics, hasGyro },
        );
      }
    } catch (err) {
      debugState.failure += 1;
      markLocalizationMiss();
      setDebug(
        {
          status: "localize exception",
          immersal: "error",
          latency: `${Math.round(performance.now() - startedAt)}ms`,
          lastError: err?.message || String(err),
        },
        "Immersal 定位异常",
        err?.message || String(err),
      );
    } finally {
      localizing = false;
    }
  }

  function trackSdkLocalizeAttempts() {
    if (!sdkSession) return;

    const counter = sdkSession.localization.counter;
    const isLocalizing = sdkSession.localization.localizing;

    if (sdkWasLocalizing && !isLocalizing) {
      if (counter > sdkLastLocalizeCounter) {
        sdkLastLocalizeCounter = counter;
        markLocalizationSuccess(localizedMapId);
      } else {
        sdkFailureCount += 1;
        markLocalizationMiss();
      }
    } else if (counter > sdkLastLocalizeCounter) {
      sdkLastLocalizeCounter = counter;
      markLocalizationSuccess(localizedMapId);
    }

    sdkWasLocalizing = isLocalizing;
  }

  function updateSdkDebug(now) {
    if (!sdkSession || now - sdkLastDebugAt < SDK_DEBUG_INTERVAL_MS) return;
    sdkLastDebugAt = now;

    const counter = sdkSession.localization.counter;
    const trackedPose = getTrackedPoseSnapshot(now);
    const hasPose = Boolean(trackedPose);
    const immersalLabel = sdkServerAssistEnabled
      ? sdkServerAssistPending
        ? "device + SDK server requesting"
        : "device + SDK server assist"
      : sdkSession.localization.localizing
        ? "device requesting"
        : "device tracking";

    setDebug({
      status: hasPose
        ? sdkServerAssistEnabled
          ? "tracking (sdk-device+server)"
          : "tracking (sdk-device)"
        : "sdk localizing",
      immersal: immersalLabel,
      success: counter,
      failure: sdkFailureCount,
      latency: sdkSession.localizeInfo.elapsedTime
        ? `${Math.round(sdkSession.localizeInfo.elapsedTime)}ms`
        : debugState.latency,
      lastError: hasPose ? "none" : debugState.lastError,
      lastPose: trackedPose ?? debugState.lastPose,
    });
    if (hasPose) logArRendererStatus();
  }

  async function runSdkServerAssist(reason = "assist") {
    if (
      !sdkSession ||
      recognitionMode === "marker" ||
      sdkServerAssistPending ||
      typeof sdkSession.localizeServerAsync !== "function"
    ) return;
    if (sdkSession.localization.localizing) return;

    sdkServerAssistPending = true;
    sdkLastServerAssistAt = performance.now();
    const startedAt = performance.now();

    try {
      await sdkSession.localizeServerAsync();
      if (recognitionMode === "marker") return;
      const tracked = getTrackedPoseSnapshot(performance.now());
      markLocalizationSuccess(tracked?.mapId ?? localizedMapId);
      if (tracked) {
        if (tracked.mapId != null) applyLocalizedMapId(tracked.mapId);
        lastMapPose = tracked;
        updateArRendererPose(tracked);
      }
      logDebug("SDK server 辅助识别成功，VPS 位姿已更新", {
        reason,
        elapsed: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      sdkFailureCount += 1;
      markLocalizationMiss();
      logDebug("SDK server 辅助识别失败", err?.message || String(err));
    } finally {
      sdkServerAssistPending = false;
      sdkLastDebugAt = 0;
      updateSdkDebug(performance.now());
    }
  }

  function startSdkDeviceWatchdog() {
    if (sdkDeviceWatchdogTimer) window.clearTimeout(sdkDeviceWatchdogTimer);
    sdkDeviceWatchdogTimer = window.setTimeout(() => {
      sdkDeviceWatchdogTimer = null;
      if (
        !sdkSession ||
        recognitionMode === "marker" ||
        sdkSession.localization.counter > 0
      ) return;
      sdkServerAssistEnabled = true;
      logDebug(
        `设备端 ${SDK_DEVICE_WATCHDOG_MS / 1000}s 内未成功，启用 SDK server 辅助识别`,
        { hasGyro, solverType: sdkSession.solverType },
      );
      runSdkServerAssist("watchdog");
    }, SDK_DEVICE_WATCHDOG_MS);
  }

  function startSdkFrameLoop() {
    const tick = (now) => {
      if (!sdkSession) return;
      if (recognitionMode === "marker") {
        sdkFrameId = requestAnimationFrame(tick);
        return;
      }

      syncSdkSolverType();

      if (
        sdkServerAssistEnabled &&
        !sdkServerAssistPending &&
        now - sdkLastServerAssistAt >= SDK_SERVER_ASSIST_INTERVAL_MS
      ) {
        runSdkServerAssist("interval");
      } else if (Object.values(sdkMapHandles).some((handle) => handle >= 0) && sdkSession.continuousLocalization) {
        sdkSession.localizeDevice(now);
      }

      if (sdkSession.localization.counter > 0) {
        const trackedPose = getTrackedPoseSnapshot(now);
        if (trackedPose) {
          if (trackedPose.mapId != null) applyLocalizedMapId(trackedPose.mapId);
          trackSdkLocalizeAttempts();
          updateArRendererPose(trackedPose);
        }
      } else if (lastMapPose) {
        updateArRendererPose(lastMapPose);
      }

      updateSdkDebug(now);
      sdkFrameId = requestAnimationFrame(tick);
    };

    sdkFrameId = requestAnimationFrame(tick);
  }

  function startRestRenderLoop() {
    const tick = () => {
      const pose = getRestModeRenderPose();
      if (pose) {
        updateArRendererPose(pose, { keepLastMapPose: true });
      }
      restRenderFrameId = requestAnimationFrame(tick);
    };
    restRenderFrameId = requestAnimationFrame(tick);
  }

  async function loadSdkMap(session, mapId) {
    const prefetchedData = await getPrefetchedMapData(mapId);
    try {
      return await session.loadMap(mapId, prefetchedData);
    } finally {
      // The SDK has copied the bytes into WASM memory, so release our warmup
      // buffer instead of holding every map twice on memory-constrained phones.
      mapDownloadPromises.delete(mapId);
    }
  }

  async function loadRemainingSdkMaps(session, mapIds) {
    const total = activeMapIds.length;
    for (const mapId of mapIds) {
      if (disposed || sdkSession !== session) return;
      const readyCount = Object.keys(sdkMapHandles).length;
      if (!contentRevealed && stableLocalizationCount === 0) {
        setGuide(
          "scanning",
          "正在寻找阊门场景",
          `定位已可用，正在补充附近区域 ${readyCount}/${total}`,
          (readyCount / total) * 100,
        );
      }
      try {
        const handle = await loadSdkMap(session, mapId);
        if (disposed || sdkSession !== session) {
          void session.freeMap(handle).catch(() => {});
          return;
        }
        sdkMapHandles[mapId] = handle;
        logDebug(`定位区域 ${mapId} 已在后台就绪`, {
          ready: Object.keys(sdkMapHandles).length,
          total,
        });
      } catch (err) {
        logDebug(`定位区域 ${mapId} 后台加载失败`, err?.message || String(err));
      }
    }

    if (!disposed && sdkSession === session && !contentRevealed && stableLocalizationCount === 0) {
      setGuide("scanning", "正在寻找阊门场景", "请对准建筑，缓慢左右移动手机");
    }
  }

  async function startImmersalSdkLocalization() {
    poseStabilizer.reset(activeMapIds.length === 1 ? activeMapIds[0] : null);
    if (!CLIENT_IMMERSAL_TOKEN) {
      throw new Error("前端未配置 VITE_IMMERSAL_TOKEN，跳过 SDK 连续定位。");
    }

    setDebug({ status: "sdk initializing", immersal: "loading sdk" }, "开始初始化 Immersal SDK");
    setGuide("loading", "正在启动空间定位", "载入定位引擎…", 12);

    let session = null;
    try {
      // The module begins warming while the intro is visible. Reusing that
      // promise avoids downloading and compiling the SDK after the user taps.
      const { Immersal } = await getImmersalSdkModule();
      setGuide("loading", "正在启动空间定位", "等待摄像头权限…", 24);
      const cameraWrap = rootEl.querySelector("#ar-camera-wrap") ?? rootEl;
      if (!sharedImmersalCamera) {
        throw new Error("Shared camera is not ready");
      }
      session = await Immersal.Initialize(cameraWrap, {
        developerToken: CLIENT_IMMERSAL_TOKEN,
        mapIds: activeMapIds,
        camera: sharedImmersalCamera,
        ownsCamera: false,
        continuousLocalization: true,
        continuousInterval: SDK_DEVICE_LOCALIZE_INTERVAL_MS,
        solverType: hasGyro ? 1 : 0,
        imageDownScale: 0.25,
        mapSwitchConfirmations: MAP_SWITCH_CONFIRMATIONS,
      });

      sdkSession = session;
      if (recognitionMode === "marker") {
        session.continuousLocalization = false;
      }
      syncSdkSolverType();
      localizationMode = "sdk";
      arRenderer?.bringCanvasToFront();
      sdkResizeHandler = () => {
        lockedRendererVFov = null;
        arRenderer?.resize();
      };
      session.addEventListener?.("resize", sdkResizeHandler);
      arRenderer?.resize();

      setDebug({ status: "sdk loading map", immersal: "loading map" }, "正在装载首个定位区域…");
      sdkMapHandles = {};
      const prioritizedMapIds = getPrioritizedMapIds();
      const loadErrors = [];
      let firstLoadedMapId = null;
      for (let index = 0; index < prioritizedMapIds.length; index += 1) {
        const mapId = prioritizedMapIds[index];
        setGuide(
          "loading",
          "正在准备现场地图",
          `装载定位区域 ${index + 1}/${prioritizedMapIds.length}`,
          32 + ((index + 1) / prioritizedMapIds.length) * 48,
        );
        try {
          sdkMapHandles[mapId] = await loadSdkMap(session, mapId);
          firstLoadedMapId = mapId;
          break;
        } catch (err) {
          loadErrors.push(`${mapId}: ${err?.message || String(err)}`);
        }
      }
      if (firstLoadedMapId == null) {
        throw new Error(`定位地图加载失败：${loadErrors.join("；")}`);
      }

      setDebug(
        {
          status: "sdk ready",
          camera: `${session.camera.width}x${session.camera.height} (shared camera)`,
          immersal: "device tracking",
          lastError: "none",
        },
        "Immersal SDK 设备端连续识别已启动",
        {
          width: session.camera.width,
          height: session.camera.height,
          mapIds: activeMapIds,
          mapHandles: sdkMapHandles,
          firstLoadedMapId,
        },
      );

      startSdkFrameLoop();
      startSdkDeviceWatchdog();
      setGuide(
        "scanning",
        "正在寻找阊门场景",
        activeMapIds.length > 1
          ? `定位已可用，正在补充附近区域 1/${activeMapIds.length}`
          : "请对准建筑，缓慢左右移动手机",
        activeMapIds.length > 1 ? 100 / activeMapIds.length : null,
      );
      const remainingMapIds = prioritizedMapIds.filter(
        (mapId) => sdkMapHandles[mapId] == null,
      );
      sdkRemainingMapsPromise = loadRemainingSdkMaps(session, remainingMapIds);
      void sdkRemainingMapsPromise;
    } catch (err) {
      session?.dispose?.();
      sdkSession = null;
      sdkMapHandles = {};
      sdkRemainingMapsPromise = null;
      localizationMode = "rest";
      rootEl.classList.remove("is-sdk-camera");
      throw err;
    }
  }

  function startLocalizationLoop() {
    poseStabilizer.reset(restActiveMapId);
    localizationMode = "rest";
    localizeOnce("start");
    localizeTimer = window.setInterval(() => localizeOnce("interval"), LOCALIZE_INTERVAL_MS);
    startRestRenderLoop();
    setDebug({ immersal: "REST loop running" }, "Immersal REST 定时识别循环已启动");
  }

  function checkImmersalConfig() {
    if (!CLIENT_IMMERSAL_TOKEN) {
      throw new Error("未配置 VITE_IMMERSAL_TOKEN，请在环境变量中设置 Immersal developer token。");
    }

    setDebug(
      {
        immersal: `ready (maps ${activeMapLabel}, SDK device + SDK server)`,
      },
      "Immersal 已配置：SDK 设备端优先，失败时用 SDK server 辅助",
      { mapIds: activeMapIds, hasToken: true },
    );

    // The proxy is only a fallback. A serverless cold start here used to block
    // the camera and maps even when the on-device SDK was healthy.
    void fetch("/api/immersal")
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        const proxyFallbackReady = Boolean(response.ok && data?.hasToken);
        logDebug(
          proxyFallbackReady
            ? "REST 代理兜底可用"
            : "REST 代理兜底未就绪（不影响设备端定位）",
          { proxyFallbackReady },
        );
      })
      .catch(() => {
        logDebug("REST 代理检查失败（不影响设备端定位）");
      });
  }

  async function startExperience() {
    errorMsg.textContent = "";
    startBtn.disabled = true;
    startBtn.textContent = "正在开启相机…";
    closeStory();
    contentRevealed = false;
    stableLocalizationCount = 0;
    arRenderer?.setContentVisible(false);
    setDebug({ status: "initializing", lastError: "none" }, "开始 Immersal 测试");

    try {
      if (activeMapIds.length === 0) {
        throw new Error("未找到可用的地图配置，请检查 js/ar/arAnchors.js 或 URL 参数。");
      }

      // This must be invoked before any await so Safari still sees the
      // start-button click as the active gesture when it shows the prompt.
      const orientationPermissionPromise = requestOrientationPermission();
      await orientationPermissionPromise;
      await requestCameraPermission();
      checkImmersalConfig();
      void checkWebXrSupport();
      updateZoomUi();

      overlay.classList.add("is-hidden");
      guide?.classList.remove("is-hidden");
      setGuide("loading", "正在开启现场相机", "识别内容会在后台继续载入", 8);
      if (debugMode) {
        controls?.classList.remove("is-hidden");
        hint?.classList.remove("is-hidden");
        debugPanel?.classList.remove("is-hidden");
      }
      rootEl.classList.add("is-ar-active");
      if (immersalOnlyMode) {
        setDebug({ marker: "disabled (Immersal-only)" }, "MindAR 已在 Immersal 单项测试中停用");
      } else {
        void startMarkerRecognition();
      }

      // The model is not required to open the camera or begin localization.
      // Keeping it in parallel removes a hard wait for first-time visitors.
      void initArRenderer();

      try {
        await startImmersalSdkLocalization();
        if (recognitionMode === "scanning") {
          setGuide(
            "scanning",
            "正在识别现场",
            immersalOnlyMode
              ? "请对准建筑地图区域，缓慢左右移动手机"
              : "可对准建筑地图区域，也可将完整纹理边框放入画面",
          );
        }
        setDebug({ status: "running (sdk)" }, "Immersal SDK 连续定位已启动");
      } catch (sdkErr) {
        console.warn("[Immersal] SDK fallback to REST", sdkErr);
        setDebug(
          { status: "sdk fallback", immersal: "using REST fallback", lastError: sdkErr?.message || String(sdkErr) },
          "SDK 初始化失败，回退 REST 定时定位",
          sdkErr?.message || String(sdkErr),
        );
        setGuide("loading", "正在重新连接", "请保持页面开启…", 58);
        await requestCameraPermission();
        startLocalizationLoop();
        queueMicrotask(() => {
          if (recognitionMode === "scanning") {
            setGuide(
              "scanning",
              "正在识别现场",
              immersalOnlyMode
                ? "请对准建筑地图区域，缓慢左右移动手机"
                : "可对准建筑地图区域，也可将完整纹理边框放入画面",
            );
          }
        });
        setDebug({ status: "running (rest)" }, "Immersal REST 测试已启动");
      }
    } catch (err) {
      console.error("[Immersal]", err);
      showError(err.message || "启动失败，请检查权限设置后重试。");
    }
  }

  controlsToggle?.addEventListener("click", () => {
    const collapsed = controls.classList.toggle("is-collapsed");
    controlsToggle.setAttribute("aria-expanded", String(!collapsed));
    controlsToggle.setAttribute("aria-label", collapsed ? "展开缩放控制" : "收起缩放控制");
    controlsToggle.textContent = collapsed ? "缩放 +" : "缩放";
  });

  debugToggle?.addEventListener("click", () => {
    const collapsed = debugPanel.classList.toggle("is-collapsed");
    debugToggle.setAttribute("aria-expanded", String(!collapsed));
    debugToggle.setAttribute("aria-label", collapsed ? "展开 debug 面板" : "收起 debug 面板");
    debugToggle.textContent = collapsed ? "▶" : "◀";
  });

  hintToggle?.addEventListener("click", () => {
    const collapsed = hint.classList.toggle("is-collapsed");
    hintToggle.setAttribute("aria-expanded", String(!collapsed));
    hintToggle.setAttribute("aria-label", collapsed ? "展开提示信息" : "最小化提示信息");
    hintToggle.textContent = collapsed ? "+" : "-";
  });

  zoomSlider?.addEventListener("input", () => {
    setCameraZoom(parseFloat(zoomSlider.value));
  });

  zoomOutBtn?.addEventListener("click", () => {
    setCameraZoom(cameraZoom - ZOOM_STEP);
  });

  zoomInBtn?.addEventListener("click", () => {
    setCameraZoom(cameraZoom + ZOOM_STEP);
  });

  localizeNowBtn?.addEventListener("click", async () => {
    if (recognitionMode === "marker") return;
    if (sdkSession) {
      setDebug({ status: "sdk localizing (manual)", immersal: "device requesting" });
      syncSdkSolverType();
      try {
        await sdkSession.localizeDeviceAsync();
        const trackedPose = getTrackedPoseSnapshot(performance.now());
        markLocalizationSuccess(trackedPose?.mapId ?? localizedMapId);
        if (trackedPose) {
          if (trackedPose.mapId != null) applyLocalizedMapId(trackedPose.mapId);
          updateArRendererPose(trackedPose);
        }
        setDebug(
          {
            status: sdkServerAssistEnabled ? "tracking (sdk-device+server)" : "tracking (sdk-device)",
            immersal: "device recognized",
            success: sdkSession.localization.counter,
            lastError: "none",
            lastPose: trackedPose ?? debugState.lastPose,
          },
          "手动设备端识别成功",
          sdkSession.localizeInfo,
        );
      } catch (err) {
        sdkFailureCount += 1;
        markLocalizationMiss();
        if (!sdkServerAssistEnabled) {
          sdkServerAssistEnabled = true;
          logDebug("手动设备端识别失败，尝试 SDK server 辅助");
          await runSdkServerAssist("manual-fallback");
          return;
        }
        setDebug(
          {
            status: "sdk not recognized",
            immersal: "device no match",
            failure: sdkFailureCount,
            lastError: err?.message || String(err),
          },
          "手动设备端识别失败",
          err?.message || String(err),
        );
      }
      return;
    }
    localizeOnce("manual");
  });

  copyDebugBtn?.addEventListener("click", async () => {
    const text = getDebugSnapshot();
    const result = await copyTextWithFallback(text);
    if (result === "clipboard" || result === "execCommand") {
      setCopyDebugButtonLabel("已复制");
    } else if (result === "share") {
      setCopyDebugButtonLabel("已分享");
    } else if (result === "share-cancelled") {
      setCopyDebugButtonLabel("已取消");
    } else {
      setCopyDebugButtonLabel("请手动复制", 2500);
    }
  });

  storyClose?.addEventListener("click", closeStory);
  dynastyButtons.forEach((button) => {
    const handler = () => {
      void switchDynasty(button.dataset.scene);
    };
    dynastyClickHandlers.set(button, handler);
    button.addEventListener("click", handler);
  });
  updateDynastyControls();
  startBtn.addEventListener("click", startExperience);
  setDebug({ mapId: activeMapLabel, activeMapIds });
  updatePreloadUi();
  void initArRenderer();
  assetWarmupTimer = window.setTimeout(warmImmersalAssets, 80);

  return () => {
    disposed = true;
    if (assetWarmupTimer) window.clearTimeout(assetWarmupTimer);
    for (const controller of mapDownloadControllers.values()) controller.abort();
    mapDownloadControllers.clear();
    mapDownloadPromises.clear();
    if (localizeTimer) window.clearInterval(localizeTimer);
    if (markerLostTimer) window.clearTimeout(markerLostTimer);
    if (sdkDeviceWatchdogTimer) window.clearTimeout(sdkDeviceWatchdogTimer);
    if (sdkFrameId) cancelAnimationFrame(sdkFrameId);
    if (restRenderFrameId) cancelAnimationFrame(restRenderFrameId);
    if (sdkResizeHandler) {
      sdkSession?.removeEventListener?.("resize", sdkResizeHandler);
    }
    if (mapSelect && mapSelectChangeHandler) {
      mapSelect.removeEventListener("change", mapSelectChangeHandler);
    }
    dynastyClickHandlers.forEach((handler, button) => {
      button.removeEventListener("click", handler);
    });
    dynastyClickHandlers.clear();
    markerRecognition?.dispose();
    markerRecognition = null;
    markerStartPromise = null;
    arRenderer?.dispose();
    for (const handle of Object.values(sdkMapHandles)) {
      if (handle != null) {
        sdkSession?.freeMap(handle).catch((err) => {
          console.warn("[Immersal] freeMap failed", err);
        });
      }
    }
    sdkSession?.dispose?.();
    sdkSession = null;
    sharedImmersalCamera = null;
    sdkRemainingMapsPromise = null;
    rootEl.classList.remove(
      "is-sdk-camera",
      "is-unified-camera",
      "is-marker-active",
      "is-map-active",
      "is-marker-tracking",
    );
    if (orientationHandler) {
      window.removeEventListener("deviceorientation", orientationHandler, true);
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
    }
  };
}
