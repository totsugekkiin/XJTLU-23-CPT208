const target = document.querySelector("#portal-target");
const statusUi = document.querySelector(".marker-test-ui");
const statusText = document.querySelector("#marker-status");
const statusDetail = document.querySelector("#marker-detail");
const flipDepthButton = document.querySelector("#flip-depth");

let depthDirection = 1;
let foundAt = 0;

function setTrackingState(tracking) {
  statusUi?.classList.toggle("is-tracking", tracking);
  if (statusText) statusText.textContent = tracking ? "纹样框已锁定" : "纹样框暂时丢失";
  if (statusDetail) {
    statusDetail.textContent = tracking
      ? `连续追踪 ${Math.max(0, Math.round((performance.now() - foundAt) / 1000))} 秒`
      : "让四边和四个角尽量完整进入画面";
  }
}

function applyDepthDirection() {
  document.querySelectorAll(".depth-node").forEach((node) => {
    const baseZ = Number(node.dataset.baseZ);
    node.setAttribute("position", `0 0 ${baseZ * depthDirection}`);
  });
  document.querySelectorAll(".depth-guide").forEach((node) => {
    const baseZ = Number(node.dataset.baseZ);
    const { x, y } = node.object3D.position;
    node.setAttribute("position", `${x} ${y} ${baseZ * depthDirection}`);
  });
}

target?.addEventListener("targetFound", () => {
  foundAt = performance.now();
  setTrackingState(true);
});

target?.addEventListener("targetLost", () => {
  setTrackingState(false);
});

flipDepthButton?.addEventListener("click", () => {
  depthDirection *= -1;
  applyDepthDirection();
});

window.setInterval(() => {
  if (statusUi?.classList.contains("is-tracking")) setTrackingState(true);
}, 1000);

window.addEventListener("load", () => {
  if (statusText) statusText.textContent = "相机已启动，等待纹样框";
  if (statusDetail) statusDetail.textContent = "请将20×26 cm窗口四周的纹样尽量完整放入画面";
});
