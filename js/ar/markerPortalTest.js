import { registerPortalOcclusionTest } from "./portalOcclusionTest.js";

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

let depthDirection = -1;
let occlusionEnabled = true;
let foundAt = 0;
let arSystem = null;
let starting = false;

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
});

target?.addEventListener("targetFound", () => {
  foundAt = performance.now();
  setTrackingState(true);
});

target?.addEventListener("targetLost", () => {
  setTrackingState(false);
});

flipDepthButton?.addEventListener("click", () => {
  depthDirection *= -1;
  target?.setAttribute("portal-occlusion-test", "direction", depthDirection);
  if (statusDetail) {
    statusDetail.textContent =
      depthDirection < 0 ? "场景位于纹样框后方40 cm处" : "深度已翻转，请确认场景是否回到墙后";
  }
});

toggleOcclusionButton?.addEventListener("click", () => {
  occlusionEnabled = !occlusionEnabled;
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

scene?.addEventListener("loaded", () => {
  resolveArSystem();
  scene.renderer?.setClearColor(0x000000, 0);
  if (statusText) statusText.textContent = "等待你打开摄像头";
  if (statusDetail) statusDetail.textContent = "点击“允许并打开摄像头”开始测试";
});

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
