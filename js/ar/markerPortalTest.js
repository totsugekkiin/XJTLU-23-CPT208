const marker = document.querySelector("#portal-marker");
const rig = document.querySelector("#portal-rig");
const statusUi = document.querySelector(".marker-test-ui");
const statusText = document.querySelector("#marker-status");
const statusDetail = document.querySelector("#marker-detail");
const flipOffsetButton = document.querySelector("#flip-window-offset");
const flipDepthButton = document.querySelector("#flip-depth");

const WINDOW_OFFSET_METERS = 0.185;
let offsetDirection = 1;
let depthDirection = 1;
let foundAt = 0;

function setTrackingState(tracking) {
  statusUi?.classList.toggle("is-tracking", tracking);
  if (statusText) statusText.textContent = tracking ? "标记已锁定" : "标记暂时丢失";
  if (statusDetail) {
    statusDetail.textContent = tracking
      ? `连续追踪 ${Math.max(0, Math.round((performance.now() - foundAt) / 1000))} 秒`
      : "让完整黑框进入画面，并避免反光";
  }
}

function applyWindowOffset() {
  if (!rig) return;
  rig.setAttribute("position", `0 0 ${WINDOW_OFFSET_METERS * offsetDirection}`);
}

function applyDepthDirection() {
  document.querySelectorAll(".depth-node").forEach((node) => {
    const baseY = Number(node.dataset.baseY);
    node.setAttribute("position", `0 ${baseY * depthDirection} 0`);
  });
  document.querySelectorAll(".depth-guide").forEach((node) => {
    const baseY = Number(node.dataset.baseY);
    node.setAttribute("position", `${node.object3D.position.x} ${baseY * depthDirection} ${node.object3D.position.z}`);
  });
}

marker?.addEventListener("markerFound", () => {
  foundAt = performance.now();
  setTrackingState(true);
});

marker?.addEventListener("markerLost", () => {
  setTrackingState(false);
});

flipOffsetButton?.addEventListener("click", () => {
  offsetDirection *= -1;
  applyWindowOffset();
});

flipDepthButton?.addEventListener("click", () => {
  depthDirection *= -1;
  applyDepthDirection();
});

window.setInterval(() => {
  if (statusUi?.classList.contains("is-tracking")) setTrackingState(true);
}, 1000);

window.addEventListener("load", () => {
  if (statusText) statusText.textContent = "相机已启动，等待标记";
  if (statusDetail) statusDetail.textContent = "请将打印页上方的完整 Hiro 标记放入画面";
});
