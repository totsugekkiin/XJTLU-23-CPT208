import * as pc from "playcanvas";

const GAUSSIAN_URL = "/models/changgate-courtyard.sog";
const GAUSSIAN_COUNT = 916617;
const stage = document.querySelector("#preview-stage");
const viewport = document.querySelector("#splat-viewport");
const loadState = document.querySelector("#load-state");
const parameterOutput = document.querySelector("#parameter-output");
const resetButton = document.querySelector("#reset-view");
const levelButton = document.querySelector("#level-camera");
const copyButton = document.querySelector("#copy-parameters");
const sceneCompass = document.querySelector("#scene-compass");
const yawValue = document.querySelector("#yaw-value");
const angleValue = document.querySelector("#angle-value");
const positionValue = document.querySelector("#position-value");
const fovValue = document.querySelector("#fov-value");
const pitchInput = document.querySelector("#camera-pitch");
const rollInput = document.querySelector("#camera-roll");
const fovInput = document.querySelector("#camera-fov");
const pitchOutput = document.querySelector("#camera-pitch-output");
const rollOutput = document.querySelector("#camera-roll-output");
const fovOutput = document.querySelector("#camera-fov-output");

const defaults = {
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  pitch: 35,
  roll: 0,
  fov: 75,
};
const state = { ...defaults };
const pressedKeys = new Set();
const movement = new pc.Vec3();
const cameraBaseRotation = new pc.Quat()
  .setFromEulerAngles(defaults.pitch, 0, 0)
  .mul(new pc.Quat().setFromEulerAngles(0, 0, 180));
const sceneUp = cameraBaseRotation
  .transformVector(new pc.Vec3(0, 1, 0), new pc.Vec3())
  .normalize();
const yawRotation = new pc.Quat();
const cameraRotation = new pc.Quat();
let dragging = null;
let lastFrameTime = performance.now();
let frameRequest = 0;

const canvas = document.createElement("canvas");
canvas.className = "splat-canvas";
viewport.appendChild(canvas);

const app = new pc.Application(canvas, {
  graphicsDeviceOptions: {
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  },
});
app.setCanvasFillMode(pc.FILLMODE_NONE);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const cameraEntity = new pc.Entity("free-camera");
cameraEntity.addComponent("camera", {
  clearColor: new pc.Color(0.75, 0.79, 0.8),
  fov: state.fov,
  nearClip: 0.02,
  farClip: 1000,
});
app.root.addChild(cameraEntity);

const splatEntity = new pc.Entity("changgate-gaussian-scene");
splatEntity.setEulerAngles(180, 0, 0);
app.root.addChild(splatEntity);
app.start();

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function resize() {
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  app.resizeCanvas(width, height);
}

function buildViewUrl() {
  const url = new URL("/portal-model-editor.html", window.location.href);
  Object.entries(state).forEach(([key, value]) => {
    url.searchParams.set(key, Number(value).toFixed(key === "fov" ? 0 : 3));
  });
  return url;
}

function readViewUrl() {
  const query = new URLSearchParams(window.location.search);
  Object.keys(defaults).forEach((key) => {
    if (!query.has(key)) return;
    const parsed = Number(query.get(key));
    if (Number.isFinite(parsed)) state[key] = parsed;
  });
  state.pitch = clamp(state.pitch, -89, 89);
  state.roll = clamp(state.roll, -45, 45);
  state.fov = clamp(state.fov, 30, 100);
}

function renderHud() {
  yawValue.textContent = `${state.yaw.toFixed(1)}°`;
  angleValue.textContent = `${state.pitch.toFixed(1)}° / ${state.roll.toFixed(1)}°`;
  positionValue.textContent =
    `${state.x.toFixed(2)} / ${state.y.toFixed(2)} / ${state.z.toFixed(2)}`;
  fovValue.textContent = `${Math.round(state.fov)}°`;
  pitchInput.value = String(state.pitch);
  rollInput.value = String(state.roll);
  fovInput.value = String(state.fov);
  pitchOutput.textContent = `${state.pitch.toFixed(1)}°`;
  rollOutput.textContent = `${state.roll.toFixed(1)}°`;
  fovOutput.textContent = `${Math.round(state.fov)}°`;
  const viewUrl = buildViewUrl();
  parameterOutput.textContent = `${viewUrl.pathname}${viewUrl.search}`;

  const yawDelta = Math.abs(
    ((state.yaw - defaults.yaw + 540) % 360) - 180,
  );
  const pitchDelta = Math.abs(state.pitch - defaults.pitch);
  const distanceFromHome = Math.hypot(
    state.x - defaults.x,
    state.y - defaults.y,
    state.z - defaults.z,
  );
  sceneCompass.hidden =
    yawDelta < 40 && pitchDelta < 35 && distanceFromHome < 24;
}

function applyCamera() {
  cameraEntity.setPosition(state.x, state.y, state.z);
  yawRotation.setFromAxisAngle(sceneUp, state.yaw);
  cameraRotation.mul2(yawRotation, cameraBaseRotation);
  cameraEntity.setRotation(cameraRotation);
  cameraEntity.rotateLocal(state.pitch - defaults.pitch, 0, 0);
  cameraEntity.rotateLocal(0, 0, state.roll);
  cameraEntity.camera.fov = state.fov;
  renderHud();
}

function setKeyVisual(code, active) {
  document
    .querySelector(`[data-key="${code}"]`)
    ?.classList.toggle("is-active", active);
}

function moveCamera(distanceForward, distanceRight, distanceUp) {
  movement
    .set(0, 0, 0)
    .add(cameraEntity.forward.clone().mulScalar(distanceForward))
    .add(cameraEntity.right.clone().mulScalar(distanceRight));
  movement.y += distanceUp;
  state.x += movement.x;
  state.y += movement.y;
  state.z += movement.z;
}

function applyTapStep(code, boosted) {
  const distance = boosted ? 1.1 : 0.28;
  const turn = boosted ? 9 : 2.5;
  if (code === "KeyW") moveCamera(distance, 0, 0);
  else if (code === "KeyS") moveCamera(-distance, 0, 0);
  else if (code === "KeyA") moveCamera(0, -distance, 0);
  else if (code === "KeyD") moveCamera(0, distance, 0);
  else if (code === "Space") moveCamera(0, 0, distance);
  else if (code === "KeyC") moveCamera(0, 0, -distance);
  else if (code === "KeyQ") state.yaw -= turn;
  else if (code === "KeyE") state.yaw += turn;
  else return;
  applyCamera();
}

function updateMovement(now) {
  const elapsed = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;
  const boosted =
    pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight");
  const speed = (boosted ? 12 : 3.2) * elapsed;
  const turnSpeed = (boosted ? 115 : 58) * elapsed;
  let changed = false;

  if (pressedKeys.has("KeyW")) {
    moveCamera(speed, 0, 0);
    changed = true;
  }
  if (pressedKeys.has("KeyS")) {
    moveCamera(-speed, 0, 0);
    changed = true;
  }
  if (pressedKeys.has("KeyA")) {
    moveCamera(0, -speed, 0);
    changed = true;
  }
  if (pressedKeys.has("KeyD")) {
    moveCamera(0, speed, 0);
    changed = true;
  }
  if (pressedKeys.has("Space")) {
    moveCamera(0, 0, speed);
    changed = true;
  }
  if (pressedKeys.has("KeyC")) {
    moveCamera(0, 0, -speed);
    changed = true;
  }
  if (pressedKeys.has("KeyQ")) {
    state.yaw -= turnSpeed;
    changed = true;
  }
  if (pressedKeys.has("KeyE")) {
    state.yaw += turnSpeed;
    changed = true;
  }
  if (changed) applyCamera();
  frameRequest = window.requestAnimationFrame(updateMovement);
}

const controlledCodes = new Set([
  "KeyQ",
  "KeyW",
  "KeyE",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyC",
  "KeyH",
  "Space",
  "ShiftLeft",
  "ShiftRight",
]);

window.addEventListener("keydown", (event) => {
  if (!controlledCodes.has(event.code)) return;
  event.preventDefault();
  if (event.code === "KeyH") {
    Object.assign(state, defaults);
    applyCamera();
    return;
  }
  if (!event.repeat && !pressedKeys.has(event.code)) {
    applyTapStep(
      event.code,
      pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight"),
    );
  }
  pressedKeys.add(event.code);
  setKeyVisual(event.code, true);
  if (event.code === "ShiftRight") setKeyVisual("ShiftLeft", true);
});

window.addEventListener("keyup", (event) => {
  pressedKeys.delete(event.code);
  setKeyVisual(event.code, false);
  if (event.code === "ShiftRight") setKeyVisual("ShiftLeft", false);
});

window.addEventListener("blur", () => {
  pressedKeys.forEach((code) => setKeyVisual(code, false));
  pressedKeys.clear();
});

stage.addEventListener("pointerdown", (event) => {
  if (
    event.target.closest?.(
      ".top-hud, .control-hud, .camera-hud, .pose-hud, .scene-compass",
    )
  ) {
    return;
  }
  dragging = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  };
  stage.setPointerCapture?.(event.pointerId);
  stage.classList.add("is-dragging");
});

stage.addEventListener("pointermove", (event) => {
  if (!dragging || dragging.pointerId !== event.pointerId) return;
  state.yaw -= (event.clientX - dragging.x) * 0.18;
  state.pitch = clamp(
    state.pitch - (event.clientY - dragging.y) * 0.16,
    -89,
    89,
  );
  dragging.x = event.clientX;
  dragging.y = event.clientY;
  applyCamera();
});

function endDrag(event) {
  if (!dragging || dragging.pointerId !== event.pointerId) return;
  dragging = null;
  stage.classList.remove("is-dragging");
}

stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);
stage.addEventListener(
  "wheel",
  (event) => {
    if (event.target.closest?.(".camera-hud")) return;
    event.preventDefault();
    state.fov = clamp(state.fov + event.deltaY * 0.025, 30, 100);
    applyCamera();
  },
  { passive: false },
);

pitchInput.addEventListener("input", () => {
  state.pitch = Number(pitchInput.value);
  applyCamera();
});
rollInput.addEventListener("input", () => {
  state.roll = Number(rollInput.value);
  applyCamera();
});
fovInput.addEventListener("input", () => {
  state.fov = Number(fovInput.value);
  applyCamera();
});
levelButton.addEventListener("click", () => {
  state.roll = 0;
  applyCamera();
});

function returnToMainView() {
  Object.assign(state, defaults);
  applyCamera();
}

resetButton.addEventListener("click", returnToMainView);
sceneCompass.addEventListener("click", returnToMainView);

copyButton.addEventListener("click", async () => {
  const originalText = copyButton.textContent;
  try {
    await navigator.clipboard.writeText(buildViewUrl().href);
    copyButton.textContent = "已复制";
  } catch {
    copyButton.textContent = "复制失败";
  }
  window.setTimeout(() => {
    copyButton.textContent = originalText;
  }, 1400);
});

window.addEventListener("resize", resize);
window.addEventListener("beforeunload", () => {
  window.cancelAnimationFrame(frameRequest);
  app.destroy();
});

function loadScene() {
  const asset = new pc.Asset(
    "changgate-courtyard",
    "gsplat",
    { url: GAUSSIAN_URL },
  );
  app.assets.add(asset);
  asset.ready((loadedAsset) => {
    splatEntity.addComponent("gsplat", {
      asset: loadedAsset,
      unified: true,
    });
    loadState.textContent =
      `SOG 场景已就绪 · ${GAUSSIAN_COUNT.toLocaleString("zh-CN")} 高斯点`;
    loadState.className = "load-state is-ready";
  });
  asset.on("error", (error) => {
    console.error("SOG scene load failed", error);
    loadState.textContent = "高斯场景加载失败";
    loadState.className = "load-state is-error";
  });
  app.assets.load(asset);
}

readViewUrl();
resize();
applyCamera();
frameRequest = window.requestAnimationFrame(updateMovement);
loadScene();
