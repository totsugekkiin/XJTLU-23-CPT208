import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { AR_ANCHORS, IMMERSAL_MAP_ID } from "./arAnchors.js";

const IMMERSAL_BASE = "https://api.immersal.com";
const CLIENT_TOKEN = import.meta.env.VITE_IMMERSAL_TOKEN ?? "";
const CAMERA_KEY_MOVE_SPEED = 4;
const CAMERA_KEY_BOOST = 3;

function radToDeg(r) {
  return (r * 180) / Math.PI;
}

function degToRad(d) {
  return (d * Math.PI) / 180;
}

function vec3FromArray(arr, fallback = 0) {
  return new THREE.Vector3(arr?.[0] ?? fallback, arr?.[1] ?? fallback, arr?.[2] ?? fallback);
}

function eulerFromArray(arr) {
  return new THREE.Euler(arr?.[0] ?? 0, arr?.[1] ?? 0, arr?.[2] ?? 0, "XYZ");
}

function formatNum(n) {
  return Number.parseFloat(n.toFixed(4));
}

function anchorToState(anchor) {
  return {
    id: anchor.id,
    label: anchor.label ?? anchor.id,
    url: anchor.url,
    position: [...(anchor.position ?? [0, 0, 0])],
    rotation: [...(anchor.rotation ?? [0, 0, 0])],
    scale: [...(anchor.scale ?? [1, 1, 1])],
  };
}

function generateAnchorsModule(anchors, mapId) {
  const body = anchors
    .map((a) => {
      const pos = a.position.map(formatNum);
      const rot = a.rotation.map(formatNum);
      const scl = a.scale.map(formatNum);
      return `  {
    id: ${JSON.stringify(a.id)},
    label: ${JSON.stringify(a.label)},
    url: ${JSON.stringify(a.url)},
    position: [${pos.join(", ")}],
    rotation: [${rot.join(", ")}],
    scale: [${scl.join(", ")}],
  }`;
    })
    .join(",\n");

  return `/** Immersal 地图 ID，与 arScene.js 保持一致 */
export const IMMERSAL_MAP_ID = ${mapId};

/**
 * AR 锚点配置（地图坐标系，单位：米）
 * - position: [x, y, z]
 * - rotation: 欧拉角 [x, y, z]，弧度，Three.js XYZ 顺序
 * - scale: [x, y, z]
 */
export const AR_ANCHORS = [
${body},
];
`;
}

export function bootstrapArPlacementEditor(rootEl) {
  const canvas = rootEl.querySelector("#ar-editor-canvas");
  const statusEl = rootEl.querySelector("#ar-editor-status");
  const anchorSelect = rootEl.querySelector("#ar-editor-anchor-select");
  const loadSparseBtn = rootEl.querySelector("#ar-editor-load-sparse");
  const loadDenseBtn = rootEl.querySelector("#ar-editor-load-dense");
  const refFileInput = rootEl.querySelector("#ar-editor-ref-file");
  const modelFileInput = rootEl.querySelector("#ar-editor-model-file");
  const modeTranslateBtn = rootEl.querySelector("#ar-editor-mode-translate");
  const modeRotateBtn = rootEl.querySelector("#ar-editor-mode-rotate");
  const modeScaleBtn = rootEl.querySelector("#ar-editor-mode-scale");
  const resetCameraBtn = rootEl.querySelector("#ar-editor-reset-camera");
  const exportBtn = rootEl.querySelector("#ar-editor-export");
  const copyBtn = rootEl.querySelector("#ar-editor-copy");
  const importBtn = rootEl.querySelector("#ar-editor-import");
  const importFileInput = rootEl.querySelector("#ar-editor-import-file");
  const toggleRefBtn = rootEl.querySelector("#ar-editor-toggle-ref");
  const toggleGridBtn = rootEl.querySelector("#ar-editor-toggle-grid");
  const numInputs = {
    px: rootEl.querySelector("#ar-editor-px"),
    py: rootEl.querySelector("#ar-editor-py"),
    pz: rootEl.querySelector("#ar-editor-pz"),
    rx: rootEl.querySelector("#ar-editor-rx"),
    ry: rootEl.querySelector("#ar-editor-ry"),
    rz: rootEl.querySelector("#ar-editor-rz"),
    sx: rootEl.querySelector("#ar-editor-sx"),
    sy: rootEl.querySelector("#ar-editor-sy"),
    sz: rootEl.querySelector("#ar-editor-sz"),
  };

  let anchorStates = AR_ANCHORS.map(anchorToState);
  let activeAnchorId = anchorStates[0]?.id ?? null;
  let referenceRoot = null;
  let referenceVisible = true;
  let gridVisible = true;
  let modelObject = null;
  let isSyncingUi = false;
  const pressedKeys = new Set();
  let cameraBoost = false;
  const cameraMoveForward = new THREE.Vector3();
  const cameraMoveRight = new THREE.Vector3();
  const cameraMoveDelta = new THREE.Vector3();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171a1f);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
  camera.position.set(4, 3, 6);

  const orbitControls = new OrbitControls(camera, canvas);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;

  const transformControls = new TransformControls(camera, canvas);
  transformControls.setSpace("local");
  scene.add(transformControls.getHelper());

  const grid = new THREE.GridHelper(40, 40, 0x3a4556, 0x252b35);
  grid.position.y = 0;
  scene.add(grid);

  const axes = new THREE.AxesHelper(1.5);
  scene.add(axes);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.position.set(4, 8, 2);
  scene.add(dirLight);

  const modelRoot = new THREE.Group();
  modelRoot.name = "ar-model-root";
  scene.add(modelRoot);

  const plyLoader = new PLYLoader();
  const gltfLoader = new GLTFLoader();

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.level = isError ? "error" : "info";
  }

  function resize() {
    const { clientWidth, clientHeight } = rootEl;
    if (!clientWidth || !clientHeight) return;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  }

  function getActiveState() {
    return anchorStates.find((a) => a.id === activeAnchorId) ?? null;
  }

  function applyStateToObject(state) {
    if (!modelObject || !state) return;
    modelObject.position.copy(vec3FromArray(state.position));
    modelObject.rotation.copy(eulerFromArray(state.rotation));
    modelObject.scale.copy(vec3FromArray(state.scale, 1));
  }

  function readStateFromObject() {
    const state = getActiveState();
    if (!modelObject || !state) return;
    state.position = [
      formatNum(modelObject.position.x),
      formatNum(modelObject.position.y),
      formatNum(modelObject.position.z),
    ];
    state.rotation = [
      formatNum(modelObject.rotation.x),
      formatNum(modelObject.rotation.y),
      formatNum(modelObject.rotation.z),
    ];
    state.scale = [
      formatNum(modelObject.scale.x),
      formatNum(modelObject.scale.y),
      formatNum(modelObject.scale.z),
    ];
    syncUiFromState();
  }

  function syncUiFromState() {
    const state = getActiveState();
    if (!state || isSyncingUi) return;
    isSyncingUi = true;
    numInputs.px.value = String(state.position[0]);
    numInputs.py.value = String(state.position[1]);
    numInputs.pz.value = String(state.position[2]);
    numInputs.rx.value = String(radToDeg(state.rotation[0]));
    numInputs.ry.value = String(radToDeg(state.rotation[1]));
    numInputs.rz.value = String(radToDeg(state.rotation[2]));
    numInputs.sx.value = String(state.scale[0]);
    numInputs.sy.value = String(state.scale[1]);
    numInputs.sz.value = String(state.scale[2]);
    isSyncingUi = false;
  }

  function applyUiToState() {
    const state = getActiveState();
    if (!state || isSyncingUi) return;
    state.position = [
      Number.parseFloat(numInputs.px.value) || 0,
      Number.parseFloat(numInputs.py.value) || 0,
      Number.parseFloat(numInputs.pz.value) || 0,
    ];
    state.rotation = [
      degToRad(Number.parseFloat(numInputs.rx.value) || 0),
      degToRad(Number.parseFloat(numInputs.ry.value) || 0),
      degToRad(Number.parseFloat(numInputs.rz.value) || 0),
    ];
    state.scale = [
      Number.parseFloat(numInputs.sx.value) || 1,
      Number.parseFloat(numInputs.sy.value) || 1,
      Number.parseFloat(numInputs.sz.value) || 1,
    ];
    applyStateToObject(state);
  }

  function focusOnObject(object) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.5, 1);
    orbitControls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(radius * 1.4, radius * 0.9, radius * 1.4));
    orbitControls.update();
  }

  function isTypingTarget(target) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    );
  }

  const CAMERA_MOVE_KEYS = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyQ",
    "KeyE",
    "PageUp",
    "PageDown",
  ]);

  function moveCameraFromKeys(delta) {
    if (!orbitControls.enabled || pressedKeys.size === 0) return;

    cameraMoveDelta.set(0, 0, 0);
    camera.getWorldDirection(cameraMoveForward);
    cameraMoveForward.y = 0;
    if (cameraMoveForward.lengthSq() > 1e-8) {
      cameraMoveForward.normalize();
      cameraMoveRight.crossVectors(cameraMoveForward, camera.up).normalize();
    } else {
      cameraMoveForward.set(0, 0, -1);
      cameraMoveRight.set(1, 0, 0);
    }

    if (pressedKeys.has("ArrowUp") || pressedKeys.has("KeyW")) cameraMoveDelta.add(cameraMoveForward);
    if (pressedKeys.has("ArrowDown") || pressedKeys.has("KeyS")) cameraMoveDelta.sub(cameraMoveForward);
    if (pressedKeys.has("ArrowLeft") || pressedKeys.has("KeyA")) cameraMoveDelta.sub(cameraMoveRight);
    if (pressedKeys.has("ArrowRight") || pressedKeys.has("KeyD")) cameraMoveDelta.add(cameraMoveRight);
    if (pressedKeys.has("KeyQ") || pressedKeys.has("PageUp")) cameraMoveDelta.y += 1;
    if (pressedKeys.has("KeyE") || pressedKeys.has("PageDown")) cameraMoveDelta.y -= 1;

    if (cameraMoveDelta.lengthSq() === 0) return;

    const speed = CAMERA_KEY_MOVE_SPEED * (cameraBoost ? CAMERA_KEY_BOOST : 1) * delta;
    cameraMoveDelta.normalize().multiplyScalar(speed);
    camera.position.add(cameraMoveDelta);
    orbitControls.target.add(cameraMoveDelta);
  }

  function onCameraKeyDown(event) {
    if (isTypingTarget(event.target)) return;

    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      cameraBoost = true;
      return;
    }

    if (!CAMERA_MOVE_KEYS.has(event.code)) return;
    event.preventDefault();
    pressedKeys.add(event.code);
  }

  function onCameraKeyUp(event) {
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      cameraBoost = false;
      return;
    }
    pressedKeys.delete(event.code);
  }

  function onCameraWindowBlur() {
    pressedKeys.clear();
    cameraBoost = false;
  }

  function clearReference() {
    if (referenceRoot) {
      scene.remove(referenceRoot);
      referenceRoot.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
      referenceRoot = null;
    }
  }

  function addPlyGeometry(geometry, label) {
    clearReference();
    geometry.computeVertexNormals();

    const hasColors = Boolean(geometry.getAttribute("color"));
    const material = new THREE.PointsMaterial({
      size: 0.03,
      sizeAttenuation: true,
      vertexColors: hasColors,
      color: hasColors ? 0xffffff : 0xddff19,
    });

    const points = new THREE.Points(geometry, material);
    referenceRoot = new THREE.Group();
    referenceRoot.name = "map-reference";
    referenceRoot.add(points);
    referenceRoot.visible = referenceVisible;
    scene.add(referenceRoot);
    focusOnObject(referenceRoot);
    setStatus(`${label} 已加载（${geometry.getAttribute("position").count} 点）`);
  }

  function addGltfScene(gltfScene, label) {
    clearReference();
    referenceRoot = new THREE.Group();
    referenceRoot.name = "map-reference";
    referenceRoot.add(gltfScene);
    referenceRoot.visible = referenceVisible;
    scene.add(referenceRoot);
    focusOnObject(referenceRoot);
    setStatus(`${label} 已加载`);
  }

  async function loadImmersalPly(kind) {
    if (!CLIENT_TOKEN) {
      setStatus("未配置 VITE_IMMERSAL_TOKEN，请用本地文件导入点云/网格", true);
      return;
    }
    const endpoint = kind === "dense" ? "dense" : "sparse";
    setStatus(`正在下载 Map ${IMMERSAL_MAP_ID} ${endpoint} 点云…`);
    try {
      const url = `${IMMERSAL_BASE}/${endpoint}?token=${encodeURIComponent(CLIENT_TOKEN)}&id=${IMMERSAL_MAP_ID}`;
      const geometry = await plyLoader.loadAsync(url);
      addPlyGeometry(geometry, kind === "dense" ? "稠密点云" : "稀疏点云");
    } catch (err) {
      setStatus(`点云加载失败：${err?.message || err}`, true);
    }
  }

  async function loadReferenceFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    setStatus(`正在加载 ${file.name}…`);
    try {
      const url = URL.createObjectURL(file);
      if (name.endsWith(".ply")) {
        const geometry = await plyLoader.loadAsync(url);
        URL.revokeObjectURL(url);
        addPlyGeometry(geometry, file.name);
      } else if (name.endsWith(".glb") || name.endsWith(".gltf")) {
        const gltf = await gltfLoader.loadAsync(url);
        URL.revokeObjectURL(url);
        addGltfScene(gltf.scene, file.name);
      } else {
        setStatus("仅支持 .ply / .glb / .gltf 参考文件", true);
      }
    } catch (err) {
      setStatus(`参考文件加载失败：${err?.message || err}`, true);
    }
  }

  async function loadModelFromState(state) {
    modelRoot.clear();
    modelObject = null;
    transformControls.detach();
    setStatus(`正在加载模型 ${state.label}…`);
    try {
      const gltf = await gltfLoader.loadAsync(state.url);
      modelObject = gltf.scene;
      modelObject.name = `anchor-${state.id}`;
      applyStateToObject(state);
      modelRoot.add(modelObject);
      transformControls.attach(modelObject);
      syncUiFromState();
      setStatus(`模型已加载：${state.label}`);
    } catch (err) {
      setStatus(`模型加载失败：${err?.message || err}`, true);
    }
  }

  async function loadModelFile(file) {
    if (!file || !activeAnchorId) return;
    const state = getActiveState();
    if (!state) return;
    const url = URL.createObjectURL(file);
    try {
      const gltf = await gltfLoader.loadAsync(url);
      state.url = url;
      modelRoot.clear();
      modelObject = gltf.scene;
      applyStateToObject(state);
      modelRoot.add(modelObject);
      transformControls.attach(modelObject);
      syncUiFromState();
      setStatus(`已替换当前锚点模型：${file.name}`);
    } catch (err) {
      setStatus(`模型文件加载失败：${err?.message || err}`, true);
    }
  }

  function populateAnchorSelect() {
    if (!anchorSelect) return;
    anchorSelect.replaceChildren(
      ...anchorStates.map((a) => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = a.label;
        return opt;
      }),
    );
    anchorSelect.value = activeAnchorId ?? "";
  }

  function setTransformMode(mode) {
    transformControls.setMode(mode);
    modeTranslateBtn?.classList.toggle("is-active", mode === "translate");
    modeRotateBtn?.classList.toggle("is-active", mode === "rotate");
    modeScaleBtn?.classList.toggle("is-active", mode === "scale");
  }

  function exportConfig() {
    const moduleText = generateAnchorsModule(anchorStates, IMMERSAL_MAP_ID);
    const blob = new Blob([moduleText], { type: "text/javascript;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "arAnchors.js";
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("已下载 arAnchors.js，请覆盖 js/ar/arAnchors.js");
    return moduleText;
  }

  async function copyConfig() {
    const text = generateAnchorsModule(anchorStates, IMMERSAL_MAP_ID);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("配置已复制到剪贴板");
    } catch {
      setStatus("复制失败，请使用导出按钮", true);
    }
  }

  function importConfigFromJson(data) {
    if (!Array.isArray(data?.anchors) && !Array.isArray(data)) {
      throw new Error("JSON 需包含 anchors 数组");
    }
    const list = Array.isArray(data?.anchors) ? data.anchors : data;
    anchorStates = list.map((item, index) =>
      anchorToState({
        id: item.id ?? `anchor-${index}`,
        label: item.label ?? item.id ?? `锚点 ${index + 1}`,
        url: item.url ?? AR_ANCHORS[0]?.url ?? "",
        position: item.position,
        rotation: item.rotation,
        scale: item.scale,
      }),
    );
    activeAnchorId = anchorStates[0]?.id ?? null;
    populateAnchorSelect();
    if (activeAnchorId) loadModelFromState(getActiveState());
  }

  transformControls.addEventListener("dragging-changed", (event) => {
    orbitControls.enabled = !event.value;
  });

  transformControls.addEventListener("objectChange", () => {
    readStateFromObject();
  });

  Object.values(numInputs).forEach((input) => {
    input?.addEventListener("input", applyUiToState);
  });

  anchorSelect?.addEventListener("change", () => {
    activeAnchorId = anchorSelect.value;
    const state = getActiveState();
    if (state) loadModelFromState(state);
  });

  loadSparseBtn?.addEventListener("click", () => loadImmersalPly("sparse"));
  loadDenseBtn?.addEventListener("click", () => loadImmersalPly("dense"));
  refFileInput?.addEventListener("change", () => {
    const file = refFileInput.files?.[0];
    refFileInput.value = "";
    loadReferenceFile(file);
  });
  modelFileInput?.addEventListener("change", () => {
    const file = modelFileInput.files?.[0];
    modelFileInput.value = "";
    loadModelFile(file);
  });

  modeTranslateBtn?.addEventListener("click", () => setTransformMode("translate"));
  modeRotateBtn?.addEventListener("click", () => setTransformMode("rotate"));
  modeScaleBtn?.addEventListener("click", () => setTransformMode("scale"));

  resetCameraBtn?.addEventListener("click", () => {
    if (referenceRoot) focusOnObject(referenceRoot);
    else if (modelObject) focusOnObject(modelObject);
    else {
      orbitControls.target.set(0, 0, 0);
      camera.position.set(4, 3, 6);
      orbitControls.update();
    }
  });

  exportBtn?.addEventListener("click", exportConfig);
  copyBtn?.addEventListener("click", copyConfig);

  importBtn?.addEventListener("click", () => importFileInput?.click());
  importFileInput?.addEventListener("change", async () => {
    const file = importFileInput.files?.[0];
    importFileInput.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      importConfigFromJson(JSON.parse(text));
      setStatus(`已导入 ${file.name}`);
    } catch (err) {
      setStatus(`导入失败：${err?.message || err}`, true);
    }
  });

  toggleRefBtn?.addEventListener("click", () => {
    referenceVisible = !referenceVisible;
    if (referenceRoot) referenceRoot.visible = referenceVisible;
    toggleRefBtn.textContent = referenceVisible ? "隐藏点云" : "显示点云";
  });

  toggleGridBtn?.addEventListener("click", () => {
    gridVisible = !gridVisible;
    grid.visible = gridVisible;
    axes.visible = gridVisible;
    toggleGridBtn.textContent = gridVisible ? "隐藏网格" : "显示网格";
  });

  const ro = new ResizeObserver(resize);
  ro.observe(rootEl);

  window.addEventListener("keydown", onCameraKeyDown);
  window.addEventListener("keyup", onCameraKeyUp);
  window.addEventListener("blur", onCameraWindowBlur);

  let frameId = 0;
  let lastFrameTime = performance.now();
  const tick = (now) => {
    const delta = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;
    moveCameraFromKeys(delta);
    orbitControls.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(tick);
  };

  populateAnchorSelect();
  setTransformMode("translate");
  resize();
  tick();

  if (CLIENT_TOKEN) {
    loadImmersalPly("sparse");
  } else {
    setStatus("未配置 VITE_IMMERSAL_TOKEN：可上传本地 sparse.ply，或配置 .env 后刷新");
  }

  if (activeAnchorId) {
    loadModelFromState(getActiveState());
  }

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener("keydown", onCameraKeyDown);
    window.removeEventListener("keyup", onCameraKeyUp);
    window.removeEventListener("blur", onCameraWindowBlur);
    pressedKeys.clear();
    ro.disconnect();
    transformControls.detach();
    transformControls.dispose();
    orbitControls.dispose();
    clearReference();
    renderer.dispose();
  };
}
