import { registerPortalOcclusionTest } from "./portalOcclusionTest.js";
import { createGaussianPortalRenderer } from "./gaussianPortalRenderer.js";

registerPortalOcclusionTest();

const target = document.querySelector("#portal-target");
const statusUi = document.querySelector(".marker-test-ui");
const statusText = document.querySelector("#marker-status");
const statusDetail = document.querySelector("#marker-detail");
const flipDepthButton = document.querySelector("#flip-depth");
const toggleOcclusionButton = document.querySelector("#toggle-occlusion");
const scene = document.querySelector("a-scene");
const cameraGate = document.querySelector("#camera-gate");
const cameraGateDetail = document.querySelector("#camera-gate-detail");
const startCameraButton = document.querySelector("#start-camera");

const PORTAL_VIEW_PRESET = Object.freeze({
  x: -1.05,
  y: -2.787,
  z: 0.891,
  yaw: 11.293,
  pitch: 17.08,
  roll: -7.6,
  fov: 75,
});
const PORTAL_WORLD_SCALE = 1000 / 260;
const REFERENCE_VIEW_DISTANCE = 600 / 260;

let depthDirection = -1;
let occlusionEnabled = true;
let foundAt = 0;
let arSystem = null;
let starting = false;
let gaussianPortal = null;

const query = new URLSearchParams(window.location.search);
const debugPortal = query.get("debugPortal") === "1";

function finiteQueryNumber(name, fallback = 0) {
  const rawValue = query.get(name);
  if (rawValue === null || rawValue.trim() === "") return fallback;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const portalView = {
  x: finiteQueryNumber("x", PORTAL_VIEW_PRESET.x),
  y: finiteQueryNumber("y", PORTAL_VIEW_PRESET.y),
  z: finiteQueryNumber("z", PORTAL_VIEW_PRESET.z),
  yaw: finiteQueryNumber("yaw", PORTAL_VIEW_PRESET.yaw),
  pitch: finiteQueryNumber("pitch", PORTAL_VIEW_PRESET.pitch),
  roll: finiteQueryNumber("roll", PORTAL_VIEW_PRESET.roll),
  fov: finiteQueryNumber("fov", PORTAL_VIEW_PRESET.fov),
};

function setTrackingState(tracking) {
  statusUi?.classList.toggle("is-tracking", tracking);
  if (statusText) statusText.textContent = tracking ? "纹样框已锁定" : "纹样框暂时丢失";
  if (statusDetail) {
    statusDetail.textContent = tracking
      ? `连续追踪 ${Math.max(0, Math.round((performance.now() - foundAt) / 1000))} 秒`
      : "让四边和四个角尽量完整进入画面";
  }
}

target?.setAttribute("portal-occlusion-test", {
  direction: depthDirection,
  occlusion: occlusionEnabled,
  farFrame: true,
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
    statusDetail.textContent = "首次打开需要下载约 11 MB 场景";
  }
});

target?.addEventListener("gaussian-portal-loaded", (event) => {
  if (statusText) statusText.textContent = "完整高斯场景已就绪";
  if (statusDetail) {
    const gaussians = Number(
      event.detail?.gaussians ?? 0,
    ).toLocaleString("zh-CN");
    statusDetail.textContent =
      `已加载 ${gaussians} 个高斯点，移动手机即可观察空间视差`;
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
  gaussianPortal?.setTracking(true);
  setTrackingState(true);
});

target?.addEventListener("targetLost", () => {
  gaussianPortal?.setTracking(false);
  setTrackingState(false);
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
      ? "遮挡已开启：场景应只出现在洞口内"
      : "遮挡已关闭：用于观察场景原本超出洞口的范围";
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

function initializeGaussianPortal() {
  if (gaussianPortal || !scene || !target) return;
  const viewDistance = finiteQueryNumber(
    "viewDistance",
    REFERENCE_VIEW_DISTANCE,
  );
  const debugAnchor = debugPortal
    ? new window.AFRAME.THREE.Object3D()
    : null;
  debugAnchor?.position.set(
    finiteQueryNumber("debugX"),
    finiteQueryNumber("debugY"),
    -viewDistance,
  );
  debugAnchor?.updateMatrixWorld(true);
  gaussianPortal = createGaussianPortalRenderer({
    scene,
    target,
    view: portalView,
    modelScale: finiteQueryNumber("modelScale", PORTAL_WORLD_SCALE),
    viewDistance,
    anchorObject: debugAnchor,
  });
  gaussianPortal.setOcclusion(occlusionEnabled);
  gaussianPortal.setDirection(depthDirection);
}

scene?.addEventListener("loaded", () => {
  resolveArSystem();
  scene.renderer?.setClearColor(0x000000, 0);
  initializeGaussianPortal();
  if (statusText) statusText.textContent = "等待你打开摄像头";
  if (statusDetail) statusDetail.textContent = "点击“允许并打开摄像头”开始测试";
});

if (scene?.hasLoaded) initializeGaussianPortal();

scene?.addEventListener("arReady", () => {
  starting = false;
  cameraGate?.classList.add("is-hidden");
  if (statusText) statusText.textContent = "摄像头已启动，等待纹样框";
  if (statusDetail) statusDetail.textContent = "请将20×26 cm窗口周围的纹样完整放入画面";
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
  gaussianPortal?.destroy();
  gaussianPortal = null;
});
