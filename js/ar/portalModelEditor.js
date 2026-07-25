import * as pc from "playcanvas";
import {
  PORTAL_CROP_BOX,
  PORTAL_SOURCE_SCENE,
  PORTAL_VIEW_PRESET,
} from "./portalSceneConfig.js";

const GAUSSIAN_URL = PORTAL_SOURCE_SCENE.url;
const GAUSSIAN_COUNT = PORTAL_SOURCE_SCENE.gaussians;
const stage = document.querySelector("#preview-stage");
const viewport = document.querySelector("#splat-viewport");
const loadState = document.querySelector("#load-state");
const parameterOutput = document.querySelector("#parameter-output");
const resetButton = document.querySelector("#reset-view");
const levelButton = document.querySelector("#level-camera");
const copyButton = document.querySelector("#copy-parameters");
const toggleCropButton = document.querySelector("#toggle-crop-box");
const cropRecommendedButton = document.querySelector("#crop-recommended");
const cropFullButton = document.querySelector("#crop-full");
const copyCropButton = document.querySelector("#copy-crop-command");
const cropBoundsOutput = document.querySelector("#crop-bounds-output");
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
const cropInputs = {
  cx: document.querySelector("#crop-center-x"),
  cy: document.querySelector("#crop-center-y"),
  cz: document.querySelector("#crop-center-z"),
  sx: document.querySelector("#crop-size-x"),
  sy: document.querySelector("#crop-size-y"),
  sz: document.querySelector("#crop-size-z"),
};

const FULL_CROP = Object.freeze({
  cx: -1.348,
  cy: -0.7,
  cz: 12.433,
  sx: 51.175,
  sy: 42.905,
  sz: 43.02,
});
const RECOMMENDED_CROP = Object.freeze({
  ...PORTAL_CROP_BOX,
});
const cropState = {
  ...RECOMMENDED_CROP,
  visible: true,
};

const defaults = {
  ...PORTAL_VIEW_PRESET,
};
const EDITOR_HOME_PITCH = 35;
const state = { ...defaults };
const pressedKeys = new Set();
const movement = new pc.Vec3();
const cameraBaseRotation = new pc.Quat()
  .setFromEulerAngles(EDITOR_HOME_PITCH, 0, 0)
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

const scanRoot = new pc.Entity("scan-axis-correction");
scanRoot.setEulerAngles(180, 0, 0);
app.root.addChild(scanRoot);

const splatEntity = new pc.Entity("changgate-gaussian-scene");
scanRoot.addChild(splatEntity);

const cropBoxRoot = new pc.Entity("gaussian-crop-box");
const cropMaterial = new pc.StandardMaterial();
cropMaterial.diffuse = new pc.Color(0.05, 0.72, 1);
cropMaterial.emissive = new pc.Color(0.05, 0.72, 1);
cropMaterial.opacity = 0.82;
cropMaterial.blendType = pc.BLEND_NORMAL;
cropMaterial.depthWrite = false;
cropMaterial.depthTest = false;
cropMaterial.update();
scanRoot.addChild(cropBoxRoot);

const cropEdges = Array.from({ length: 12 }, (_, index) => {
  const edge = new pc.Entity(`crop-edge-${index}`);
  edge.addComponent("render", {
    type: "box",
    material: cropMaterial,
    castShadows: false,
    receiveShadows: false,
  });
  cropBoxRoot.addChild(edge);
  return edge;
});

const cropMaterials = new Set();
const cropModifyGlsl = `
uniform vec3 uCropMin;
uniform vec3 uCropMax;
uniform float uCropEnabled;

void modifySplatCenter(inout vec3 center) {
}

void modifySplatRotationScale(
  vec3 originalCenter,
  vec3 modifiedCenter,
  inout vec4 rotation,
  inout vec3 scale
) {
}

void modifySplatColor(vec3 center, inout vec4 color) {
  bool outside =
    any(lessThan(center, uCropMin)) ||
    any(greaterThan(center, uCropMax));
  if (uCropEnabled > 0.5 && outside) {
    color.a = 0.0;
  }
}
`;
const cropModifyWgsl = `
uniform uCropMin: vec3f;
uniform uCropMax: vec3f;
uniform uCropEnabled: f32;

fn modifySplatCenter(center: ptr<function, vec3f>) {
}

fn modifySplatRotationScale(
  originalCenter: vec3f,
  modifiedCenter: vec3f,
  rotation: ptr<function, vec4f>,
  scale: ptr<function, vec3f>
) {
}

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  let outside =
    any(center < uniform.uCropMin) ||
    any(center > uniform.uCropMax);
  if (uniform.uCropEnabled > 0.5 && outside) {
    (*color).a = 0.0;
  }
}
`;

function updateCropMaterials() {
  const bounds = cropBounds();
  cropMaterials.forEach((material) => {
    material.setParameter("uCropMin", bounds.min);
    material.setParameter("uCropMax", bounds.max);
    material.setParameter("uCropEnabled", cropState.visible ? 1 : 0);
  });
}

app.systems.gsplat.on("material:created", (material) => {
  material.shaderChunks.glsl.set("gsplatModifyVS", cropModifyGlsl);
  material.shaderChunks.wgsl.set("gsplatModifyVS", cropModifyWgsl);
  cropMaterials.add(material);
  updateCropMaterials();
  material.update();
});
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
  Object.entries(cropState).forEach(([key, value]) => {
    url.searchParams.set(
      `crop${key.toUpperCase()}`,
      typeof value === "boolean" ? String(Number(value)) : Number(value).toFixed(3),
    );
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
  Object.keys(RECOMMENDED_CROP).forEach((key) => {
    const parameter = `crop${key.toUpperCase()}`;
    if (!query.has(parameter)) return;
    const parsed = Number(query.get(parameter));
    if (Number.isFinite(parsed)) cropState[key] = parsed;
  });
  cropState.visible = query.get("cropVISIBLE") !== "0";
}

function cropBounds() {
  const hx = cropState.sx / 2;
  const hy = cropState.sy / 2;
  const hz = cropState.sz / 2;
  return {
    min: [
      cropState.cx - hx,
      cropState.cy - hy,
      cropState.cz - hz,
    ],
    max: [
      cropState.cx + hx,
      cropState.cy + hy,
      cropState.cz + hz,
    ],
  };
}

function buildCropCommand() {
  const bounds = cropBounds();
  const values = [...bounds.min, ...bounds.max]
    .map((value) => value.toFixed(3))
    .join(",");
  return `npx splat-transform --overwrite public/models/changgate-courtyard.sog --filter-box=${values} public/models/changgate-courtyard-cropped.sog`;
}

function applyCropBox() {
  cropState.sx = Math.max(0.5, Number(cropState.sx) || 0.5);
  cropState.sy = Math.max(0.5, Number(cropState.sy) || 0.5);
  cropState.sz = Math.max(0.5, Number(cropState.sz) || 0.5);
  cropBoxRoot.enabled = cropState.visible;
  cropBoxRoot.setLocalPosition(cropState.cx, cropState.cy, cropState.cz);

  const hx = cropState.sx / 2;
  const hy = cropState.sy / 2;
  const hz = cropState.sz / 2;
  const thickness = clamp(
    Math.max(cropState.sx, cropState.sy, cropState.sz) * 0.004,
    0.025,
    0.12,
  );
  const definitions = [];
  for (const y of [-hy, hy]) {
    for (const z of [-hz, hz]) {
      definitions.push([[0, y, z], [cropState.sx, thickness, thickness]]);
    }
  }
  for (const x of [-hx, hx]) {
    for (const z of [-hz, hz]) {
      definitions.push([[x, 0, z], [thickness, cropState.sy, thickness]]);
    }
  }
  for (const x of [-hx, hx]) {
    for (const y of [-hy, hy]) {
      definitions.push([[x, y, 0], [thickness, thickness, cropState.sz]]);
    }
  }
  definitions.forEach(([position, scale], index) => {
    cropEdges[index].setLocalPosition(...position);
    cropEdges[index].setLocalScale(...scale);
  });

  Object.entries(cropInputs).forEach(([key, input]) => {
    input.value = Number(cropState[key]).toFixed(2);
  });
  toggleCropButton.textContent =
    `裁剪盒：${cropState.visible ? "显示" : "隐藏"}`;
  toggleCropButton.setAttribute("aria-pressed", String(cropState.visible));
  const bounds = cropBounds();
  cropBoundsOutput.textContent =
    `保留范围  min ${bounds.min.map((value) => value.toFixed(2)).join(" / ")}  ·  max ${bounds.max.map((value) => value.toFixed(2)).join(" / ")}`;
  updateCropMaterials();
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
  cameraEntity.rotateLocal(state.pitch - EDITOR_HOME_PITCH, 0, 0);
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
      ".top-hud, .control-hud, .camera-hud, .crop-hud, .pose-hud, .scene-compass",
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
    if (event.target.closest?.(".camera-hud, .crop-hud")) return;
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

Object.entries(cropInputs).forEach(([key, input]) => {
  input.addEventListener("input", () => {
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    cropState[key] = key.startsWith("s") ? Math.max(0.5, value) : value;
    applyCropBox();
  });
});

toggleCropButton.addEventListener("click", () => {
  cropState.visible = !cropState.visible;
  applyCropBox();
});

cropRecommendedButton.addEventListener("click", () => {
  Object.assign(cropState, RECOMMENDED_CROP, { visible: true });
  applyCropBox();
});

cropFullButton.addEventListener("click", () => {
  Object.assign(cropState, FULL_CROP, { visible: true });
  applyCropBox();
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

copyCropButton.addEventListener("click", async () => {
  const originalText = copyCropButton.textContent;
  try {
    await navigator.clipboard.writeText(buildCropCommand());
    copyCropButton.textContent = "命令已复制";
  } catch {
    copyCropButton.textContent = "复制失败";
  }
  window.setTimeout(() => {
    copyCropButton.textContent = originalText;
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
applyCropBox();
frameRequest = window.requestAnimationFrame(updateMovement);
loadScene();
