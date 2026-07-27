import { registerPortalOcclusionTest } from "./portalOcclusionTest.js";
import {
  PORTAL_CROP_BOX,
  PORTAL_PERSPECTIVE_MODES,
  PORTAL_REFERENCE_VIEW_DISTANCE,
  PORTAL_RUNTIME_SCENE,
  PORTAL_VIEW_PRESET,
  PORTAL_WORLD_SCALE,
  normalizePortalFov,
  portalFrameFov,
  readPortalRuntimeConfig,
  savePortalRuntimeConfig,
} from "./portalSceneConfig.js";

registerPortalOcclusionTest();

const target = document.querySelector("#portal-target");
const statusUi = document.querySelector(".marker-test-ui");
const statusText = document.querySelector("#marker-status");
const statusDetail = document.querySelector("#marker-detail");
const flipDepthButton = document.querySelector("#flip-depth");
const toggleOcclusionButton = document.querySelector("#toggle-occlusion");
const togglePerspectiveButton = document.querySelector("#toggle-perspective");
const calibrateDistanceButton = document.querySelector("#calibrate-distance");
const scene = document.querySelector("a-scene");
const cameraGate = document.querySelector("#camera-gate");
const markerScanGuide = document.querySelector("#marker-scan-guide");
const cameraGateDetail = document.querySelector("#camera-gate-detail");
const startCameraButton = document.querySelector("#start-camera");
const farCvStatus = document.querySelector("#far-cv-status");

const REFERENCE_VIEW_DISTANCE = PORTAL_REFERENCE_VIEW_DISTANCE;

let depthDirection = -1;
let occlusionEnabled = true;
let foundAt = 0;
let arSystem = null;
let starting = false;
let gaussianPortal = null;
let gaussianPortalPromise = null;
let debugAnchorObject = null;
let targetTracking = false;
let pageDestroyed = false;
let perspectiveState = null;
let apertureCvState = null;

const query = new URLSearchParams(window.location.search);
const debugPortal = query.get("debugPortal") === "1";
const apertureCvEnabled = query.get("apertureCv") !== "0" && !debugPortal;
let perspectiveMode =
  query.get("perspective") === PORTAL_PERSPECTIVE_MODES.COMPOSITION
    ? PORTAL_PERSPECTIVE_MODES.COMPOSITION
    : PORTAL_PERSPECTIVE_MODES.PHYSICAL;
const savedPortalConfig = readPortalRuntimeConfig();
const configuredView = savedPortalConfig?.view ?? PORTAL_VIEW_PRESET;
const configuredCrop = savedPortalConfig?.crop ?? PORTAL_CROP_BOX;

function finiteQueryNumber(name, fallback = 0) {
  const rawValue = query.get(name);
  if (rawValue === null || rawValue.trim() === "") return fallback;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const portalView = {
  x: finiteQueryNumber("x", configuredView.x),
  y: finiteQueryNumber("y", configuredView.y),
  z: finiteQueryNumber("z", configuredView.z),
  yaw: finiteQueryNumber("yaw", configuredView.yaw),
  pitch: finiteQueryNumber("pitch", configuredView.pitch),
  roll: finiteQueryNumber("roll", configuredView.roll),
  fov: finiteQueryNumber("fov", configuredView.fov),
};
const portalCrop = {
  cx: finiteQueryNumber("cropCX", configuredCrop.cx),
  cy: finiteQueryNumber("cropCY", configuredCrop.cy),
  cz: finiteQueryNumber("cropCZ", configuredCrop.cz),
  sx: finiteQueryNumber("cropSX", configuredCrop.sx),
  sy: finiteQueryNumber("cropSY", configuredCrop.sy),
  sz: finiteQueryNumber("cropSZ", configuredCrop.sz),
};
const portalFov = normalizePortalFov(
  finiteQueryNumber(
    "portalFov",
    savedPortalConfig?.portalFov ?? portalFrameFov(portalView.fov),
  ),
);
const hasPortalQuery = [
  "x",
  "y",
  "z",
  "yaw",
  "pitch",
  "roll",
  "fov",
  "cropCX",
  "cropCY",
  "cropCZ",
  "cropSX",
  "cropSY",
  "cropSZ",
  "portalFov",
].some((name) => query.has(name));

if (hasPortalQuery) {
  try {
    savePortalRuntimeConfig({
      view: portalView,
      crop: portalCrop,
      portalFov,
    });
  } catch (error) {
    console.warn("Unable to persist portal URL settings", error);
  }
}

if (target) {
  target.dataset.portalConfigSource = hasPortalQuery
    ? "url"
    : savedPortalConfig
      ? "saved-editor"
      : "built-in";
}

function setTrackingState(tracking) {
  statusUi?.classList.toggle("is-tracking", tracking);
  if (statusText) statusText.textContent = tracking ? "纹样框已锁定" : "纹样框暂时丢失";
  if (statusDetail) {
    const distance = Number(perspectiveState?.eyeDistanceMm);
    const distanceText = Number.isFinite(distance)
      ? ` · 镜头约 ${(distance / 10).toFixed(0)} cm`
      : "";
    const perspectiveText =
      perspectiveMode === PORTAL_PERSPECTIVE_MODES.PHYSICAL
        ? perspectiveState?.calibrated
          ? "物理透视（已校准）"
          : "物理透视"
        : "构图优先";
    const cvText = apertureCvEnabled
      ? apertureCvState?.mode === "locked"
        ? " · 洞口CV已吸附"
        : apertureCvState?.mode === "holding"
          ? " · 洞口CV保持中"
          : " · 洞口CV校准中"
      : "";
    statusDetail.textContent = tracking
      ? `连续追踪 ${Math.max(0, Math.round((performance.now() - foundAt) / 1000))} 秒 · ${perspectiveText}${distanceText}${cvText}`
      : "让四边和四个角尽量完整进入画面";
  }
}

function updatePerspectiveControls() {
  const physical = perspectiveMode === PORTAL_PERSPECTIVE_MODES.PHYSICAL;
  if (togglePerspectiveButton) {
    const label = `透视：${physical ? "物理" : "构图"}`;
    if (togglePerspectiveButton.textContent !== label) {
      togglePerspectiveButton.textContent = label;
    }
    if (
      togglePerspectiveButton.getAttribute("aria-pressed") !== String(physical)
    ) {
      togglePerspectiveButton.setAttribute("aria-pressed", String(physical));
    }
  }
  if (calibrateDistanceButton) {
    const disabled =
      !gaussianPortal || !Number.isFinite(perspectiveState?.eyeDistanceMm);
    if (calibrateDistanceButton.disabled !== disabled) {
      calibrateDistanceButton.disabled = disabled;
    }
    const label = perspectiveState?.calibrated
      ? "当前距离已校准"
      : "以当前距离校准";
    if (calibrateDistanceButton.textContent !== label) {
      calibrateDistanceButton.textContent = label;
    }
  }
}

updatePerspectiveControls();

target?.setAttribute("portal-occlusion-test", {
  direction: depthDirection,
  occlusion: occlusionEnabled,
  farFrame: !apertureCvEnabled,
  loadModel: false,
  useViewPose: true,
  viewX: portalView.x,
  viewY: portalView.y,
  viewZ: portalView.z,
  viewYaw: portalView.yaw,
  viewPitch: portalView.pitch,
  viewRoll: portalView.roll,
  viewFov: portalView.fov,
  modelScale: finiteQueryNumber("modelScale", PORTAL_WORLD_SCALE),
  modelYaw: finiteQueryNumber("modelYaw"),
  modelPitch: finiteQueryNumber("modelPitch"),
  modelRoll: finiteQueryNumber("modelRoll"),
  modelOffsetX: finiteQueryNumber("modelX"),
  modelOffsetY: finiteQueryNumber("modelY"),
  modelOffsetZ: finiteQueryNumber("modelZ"),
});

target?.addEventListener("portal-model-transform", (event) => {
  const detail = event.detail ?? {};
  target.dataset.portalView = JSON.stringify(detail.viewPose ?? null);
  target.dataset.portalPosition = JSON.stringify(
    detail.resolvedPosition ?? null,
  );
  target.dataset.portalRotation = JSON.stringify(
    detail.resolvedQuaternion ?? null,
  );
});

target?.addEventListener("gaussian-portal-loading", () => {
  if (statusText) statusText.textContent = "正在加载完整高斯场景…";
  if (statusDetail) {
    statusDetail.textContent =
      `首次打开需要下载约 ${PORTAL_RUNTIME_SCENE.megabytes} MB 场景`;
  }
});

target?.addEventListener("gaussian-portal-loaded", (event) => {
  if (statusText) statusText.textContent = "完整高斯场景已就绪";
  if (statusDetail) {
    const gaussians = Number(
      event.detail?.gaussians ?? 0,
    ).toLocaleString("zh-CN");
    statusDetail.textContent =
      `已加载 ${gaussians} 个高斯点；移动手机可看到蓝框内实时透视`;
  }
  if (debugPortal && target?.object3D) {
    cameraGate?.classList.add("is-hidden");
    const debugCamera =
      scene?.camera ||
      scene?.querySelector("[camera]")?.getObject3D("camera");
    if (debugCamera?.isPerspectiveCamera) {
      debugCamera.aspect = window.innerWidth / window.innerHeight;
      debugCamera.fov = finiteQueryNumber(
        "debugCameraFov",
        portalView.fov,
      );
      debugCamera.near = 0.01;
      debugCamera.far = 1000;
      debugCamera.updateProjectionMatrix();
    }
    gaussianPortal?.setTracking(true);
    if (
      debugAnchorObject &&
      ["debugMoveX", "debugMoveY", "debugMoveZ"].some((name) =>
        query.has(name),
      )
    ) {
      window.setTimeout(() => {
        debugAnchorObject?.position.add(
          new window.AFRAME.THREE.Vector3(
            finiteQueryNumber("debugMoveX"),
            finiteQueryNumber("debugMoveY"),
            finiteQueryNumber("debugMoveZ"),
          ),
        );
        debugAnchorObject?.updateMatrixWorld(true);
      }, 250);
    }
  }
});

target?.addEventListener("gaussian-portal-perspective", (event) => {
  perspectiveState = event.detail ?? null;
  perspectiveMode =
    perspectiveState?.mode === PORTAL_PERSPECTIVE_MODES.COMPOSITION
      ? PORTAL_PERSPECTIVE_MODES.COMPOSITION
      : PORTAL_PERSPECTIVE_MODES.PHYSICAL;
  updatePerspectiveControls();
});

target?.addEventListener("far-aperture-cv-state", (event) => {
  apertureCvState = event.detail ?? null;
  if (target) {
    target.dataset.apertureCvMode = String(apertureCvState?.mode ?? "fallback");
    target.dataset.apertureCvConfidence = Number(
      apertureCvState?.confidence ?? 0,
    ).toFixed(2);
  }
  if (farCvStatus) {
    farCvStatus.textContent = !apertureCvEnabled
      ? "已关闭"
      : apertureCvState?.mode === "locked"
        ? "CV已吸附"
        : apertureCvState?.mode === "holding"
          ? "CV保持"
          : "CV校准中";
  }
});

target?.addEventListener("gaussian-portal-error", () => {
  target?.setAttribute("portal-occlusion-test", "loadModel", true);
  if (statusText) statusText.textContent = "高斯场景不可用，启用网格回退";
  if (statusDetail) {
    statusDetail.textContent = "正在加载兼容性模型，请稍候…";
  }
});

target?.addEventListener("portal-model-loading", () => {
  if (statusText) statusText.textContent = "正在加载实景模型…";
  if (statusDetail) statusDetail.textContent = "首次打开需要下载约 8 MB 模型";
});

target?.addEventListener("portal-model-loaded", (event) => {
  if (statusText) statusText.textContent = "实景模型已就绪";
  if (statusDetail) {
    const vertices = Number(event.detail?.vertices ?? 0).toLocaleString("zh-CN");
    statusDetail.textContent = `已加载 ${vertices} 个顶点，请将图案边框完整放入画面`;
  }
});

target?.addEventListener("portal-model-error", () => {
  if (statusText) statusText.textContent = "实景模型加载失败";
  if (statusDetail) statusDetail.textContent = "请检查网络后刷新页面重试";
});

target?.addEventListener("targetFound", () => {
  foundAt = performance.now();
  targetTracking = true;
  markerScanGuide?.classList.remove("is-active");
  gaussianPortal?.setTracking(true);
  setTrackingState(true);
});

target?.addEventListener("targetLost", () => {
  targetTracking = false;
  markerScanGuide?.classList.add("is-active");
  gaussianPortal?.setTracking(false);
  setTrackingState(false);
  if (calibrateDistanceButton) calibrateDistanceButton.disabled = true;
});

flipDepthButton?.addEventListener("click", () => {
  depthDirection *= -1;
  gaussianPortal?.setDirection(depthDirection);
  target?.setAttribute("portal-occlusion-test", "direction", depthDirection);
  if (statusDetail) {
    statusDetail.textContent =
      depthDirection < 0 ? "场景位于纹样框后方40 cm处" : "深度已翻转，请确认场景是否回到墙后";
  }
});

toggleOcclusionButton?.addEventListener("click", () => {
  occlusionEnabled = !occlusionEnabled;
  gaussianPortal?.setOcclusion(occlusionEnabled);
  target?.setAttribute("portal-occlusion-test", "occlusion", occlusionEnabled);
  toggleOcclusionButton.textContent = `遮挡：${occlusionEnabled ? "开" : "关"}`;
  toggleOcclusionButton.setAttribute("aria-pressed", String(occlusionEnabled));
  if (statusDetail) {
    statusDetail.textContent = occlusionEnabled
      ? "遮挡已开启：场景只在蓝色远端窗眼内显示"
      : "遮挡已关闭：用于观察场景原本超出洞口的范围";
  }
});

togglePerspectiveButton?.addEventListener("click", () => {
  perspectiveMode =
    perspectiveMode === PORTAL_PERSPECTIVE_MODES.PHYSICAL
      ? PORTAL_PERSPECTIVE_MODES.COMPOSITION
      : PORTAL_PERSPECTIVE_MODES.PHYSICAL;
  perspectiveState = null;
  gaussianPortal?.setPerspectiveMode(perspectiveMode);
  updatePerspectiveControls();
  if (statusDetail) {
    statusDetail.textContent =
      perspectiveMode === PORTAL_PERSPECTIVE_MODES.PHYSICAL
        ? "已启用物理透视：初始距离、横移和倾斜都会参与计算"
        : "已启用构图优先：当前锁定位置作为调试构图基准";
  }
});

calibrateDistanceButton?.addEventListener("click", () => {
  const distance = gaussianPortal?.calibrateCurrentDistance();
  if (!Number.isFinite(distance)) {
    if (statusDetail) statusDetail.textContent = "请先稳定锁定纹样框再校准";
    return;
  }
  perspectiveMode = PORTAL_PERSPECTIVE_MODES.PHYSICAL;
  if (statusDetail) {
    statusDetail.textContent =
      `已将当前约 ${(distance * 26).toFixed(0)} cm 设为调试构图基准；继续移动仍会实时改变透视`;
  }
});

function setStartError(message) {
  starting = false;
  if (cameraGateDetail) cameraGateDetail.textContent = message;
  if (startCameraButton) {
    startCameraButton.disabled = false;
    startCameraButton.textContent = "重新申请摄像头";
  }
  if (statusText) statusText.textContent = "摄像头没有启动";
  if (statusDetail) statusDetail.textContent = message;
}

function resolveArSystem() {
  arSystem = scene?.systems?.["mindar-image-system"] ?? null;
  return arSystem;
}

async function startCamera() {
  if (starting) return;

  if (!window.isSecureContext) {
    setStartError("摄像头只能在 HTTPS 安全页面中启动。");
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setStartError("当前浏览器不支持网页摄像头，请改用最新版 Chrome。");
    return;
  }

  const system = resolveArSystem();
  if (!system) {
    setStartError("AR 引擎还未加载完成，请等待两秒后重试。");
    return;
  }

  starting = true;
  if (startCameraButton) {
    startCameraButton.disabled = true;
    startCameraButton.textContent = "正在申请权限…";
  }
  if (cameraGateDetail) cameraGateDetail.textContent = "请在系统弹窗中选择“允许”。";
  if (statusText) statusText.textContent = "正在申请摄像头权限…";

  try {
    await system.start();
  } catch (error) {
    console.error("Unable to start MindAR camera", error);
    setStartError("权限被拒绝或摄像头不可用。请在浏览器的网站权限中允许摄像头。");
  }
}

startCameraButton?.addEventListener("click", startCamera);

async function initializeGaussianPortal() {
  if (gaussianPortal || gaussianPortalPromise || !scene || !target) {
    return gaussianPortalPromise;
  }
  gaussianPortalPromise = import("./gaussianPortalRenderer.js")
    .then(({ createGaussianPortalRenderer }) => {
      if (pageDestroyed) return null;
      const viewDistance = finiteQueryNumber(
        "viewDistance",
        REFERENCE_VIEW_DISTANCE,
      );
      const debugDistance = finiteQueryNumber(
        "debugDistance",
        viewDistance,
      );
      const debugAnchor = debugPortal
        ? new window.AFRAME.THREE.Object3D()
        : null;
      debugAnchor?.position.set(
        finiteQueryNumber("debugX"),
        finiteQueryNumber("debugY"),
        -debugDistance,
      );
      debugAnchor?.rotation.set(
        window.AFRAME.THREE.MathUtils.degToRad(
          finiteQueryNumber("debugPitch"),
        ),
        window.AFRAME.THREE.MathUtils.degToRad(
          finiteQueryNumber("debugYaw"),
        ),
        window.AFRAME.THREE.MathUtils.degToRad(
          finiteQueryNumber("debugRoll"),
        ),
      );
      debugAnchor?.updateMatrixWorld(true);
      debugAnchorObject = debugAnchor;
      gaussianPortal = createGaussianPortalRenderer({
        scene,
        target,
        view: portalView,
        crop: portalCrop,
        portalFov,
        modelScale: finiteQueryNumber("modelScale", PORTAL_WORLD_SCALE),
        viewDistance,
        perspectiveMode,
        apertureCv: apertureCvEnabled,
        anchorObject: debugAnchor,
      });
      gaussianPortal.setOcclusion(occlusionEnabled);
      gaussianPortal.setDirection(depthDirection);
      gaussianPortal.setTracking(debugPortal || targetTracking);
      return gaussianPortal;
    })
    .catch((error) => {
      gaussianPortalPromise = null;
      console.error("Unable to initialize Gaussian portal", error);
      target.emit("gaussian-portal-error", {
        message: error?.message ?? "unknown error",
      });
      return null;
    });
  return gaussianPortalPromise;
}

scene?.addEventListener("loaded", () => {
  resolveArSystem();
  scene.renderer?.setClearColor(0x000000, 0);
  if (debugPortal) initializeGaussianPortal();
  if (statusText) statusText.textContent = "等待你打开摄像头";
  if (statusDetail) statusDetail.textContent = "点击“允许并打开摄像头”开始测试";
});

if (scene?.hasLoaded && debugPortal) initializeGaussianPortal();

scene?.addEventListener("arReady", () => {
  starting = false;
  cameraGate?.classList.add("is-hidden");
  markerScanGuide?.classList.add("is-active");
  if (statusText) statusText.textContent = "摄像头已启动，等待纹样框";
  if (statusDetail) statusDetail.textContent = "先后退，让完整外框接近黄色取景框大小";
  initializeGaussianPortal();
});

scene?.addEventListener("arError", () => {
  setStartError("摄像头启动失败。请允许网站摄像头权限，关闭其他相机应用后重试。");
});

window.setInterval(() => {
  if (statusUi?.classList.contains("is-tracking")) setTrackingState(true);
}, 1000);

window.addEventListener("load", () => {
  if (statusText) statusText.textContent = "等待你打开摄像头";
  if (statusDetail) statusDetail.textContent = "点击屏幕中央按钮开始测试";
});

window.addEventListener("beforeunload", () => {
  pageDestroyed = true;
  debugAnchorObject = null;
  gaussianPortal?.destroy();
  gaussianPortal = null;
});
