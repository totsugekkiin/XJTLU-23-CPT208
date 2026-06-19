import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = "models/the_vast_land_no_background.glb";

/** @type {Array<{ key: string, label: string, min: number, max: number, step: number, default: number, unit: string, group: string }>} */
const SLIDER_CONFIG = [
  { key: "x", label: "左右(X)", min: -40, max: 40, step: 0.5, default: 0, unit: "m", group: "model" },
  { key: "y", label: "高度(Y)", min: -30, max: -5, step: 0.5, default: -12, unit: "m", group: "model" },
  { key: "z", label: "距离(Z)", min: -50, max: -5, step: 0.5, default: -20, unit: "m", group: "model" },
  { key: "scale", label: "比例", min: 0.1, max: 5, step: 0.05, default: 1, unit: "×", group: "model" },
  { key: "rotX", label: "模型俯仰", min: -90, max: 90, step: 1, default: 0, unit: "°", group: "model" },
  { key: "rotY", label: "模型旋转", min: -180, max: 180, step: 1, default: 0, unit: "°", group: "model" },
  { key: "rotZ", label: "模型侧倾", min: -45, max: 45, step: 1, default: 0, unit: "°", group: "model" },
  { key: "fov", label: "视野(FOV)", min: 30, max: 110, step: 1, default: 65, unit: "°", group: "view" },
  { key: "pitchOff", label: "视角俯仰", min: -90, max: 90, step: 1, default: 0, unit: "°", group: "view" },
  { key: "yawOff", label: "视角偏航", min: -180, max: 180, step: 1, default: 0, unit: "°", group: "view" },
  { key: "rollOff", label: "视角侧倾", min: -90, max: 90, step: 1, default: 0, unit: "°", group: "view" },
  { key: "emissive", label: "自发光", min: 0, max: 1, step: 0.05, default: 0.2, unit: "", group: "view" },
];

const GROUP_LABELS = {
  model: "模型位置",
  view: "视角校正",
};

export function bootstrapArScene(rootEl) {
  const video = rootEl.querySelector("#ar-camera");
  const canvas = rootEl.querySelector("#ar-canvas");
  const overlay = rootEl.querySelector("#ar-start-overlay");
  const startBtn = rootEl.querySelector("#ar-start-btn");
  const errorMsg = rootEl.querySelector("#ar-error-msg");
  const panel = rootEl.querySelector("#ar-panel");
  const panelToggle = rootEl.querySelector("#ar-panel-toggle");
  const panelBody = rootEl.querySelector("#ar-panel-body");
  const copyBtn = rootEl.querySelector("#ar-copy-params");
  const hint = rootEl.querySelector("#ar-hint");

  let renderer = null;
  let scene = null;
  let camera = null;
  let modelGroup = null;
  let animationId = null;
  let mediaStream = null;
  let orientationHandler = null;
  let baseFitScale = 1;
  /** @type {import('three').MeshStandardMaterial[]} */
  let emissiveMaterials = [];

  const qDevice = new THREE.Quaternion();
  const qScreen = new THREE.Quaternion();
  const qOffset = new THREE.Quaternion();
  const qFinal = new THREE.Quaternion();
  const qPortrait = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

  const orientation = { alpha: 0, beta: 0, gamma: 0, screenAngle: 0 };

  const params = Object.fromEntries(SLIDER_CONFIG.map((c) => [c.key, c.default]));
  const valueEls = {};
  const sliderEls = {};

  function showError(message) {
    errorMsg.textContent = message;
    startBtn.disabled = false;
    startBtn.textContent = "重试";
  }

  function formatValue(cfg, val) {
    if (cfg.unit === "×") return `${val.toFixed(2)}×`;
    if (cfg.unit === "°") return `${val.toFixed(0)}°`;
    if (cfg.unit === "m") return `${val.toFixed(1)}m`;
    return val.toFixed(2);
  }

  function updateValueDisplay(key) {
    const cfg = SLIDER_CONFIG.find((c) => c.key === key);
    if (!cfg || !valueEls[key]) return;
    valueEls[key].textContent = formatValue(cfg, params[key]);
  }

  function updateAllValueDisplays() {
    SLIDER_CONFIG.forEach((c) => updateValueDisplay(c.key));
  }

  function applyEmissive() {
    emissiveMaterials.forEach((mat) => {
      mat.emissiveIntensity = params.emissive;
    });
  }

  function applyModelTransform() {
    if (!modelGroup) return;
    modelGroup.position.set(params.x, params.y, params.z);
    modelGroup.rotation.set(
      THREE.MathUtils.degToRad(params.rotX),
      THREE.MathUtils.degToRad(params.rotY),
      THREE.MathUtils.degToRad(params.rotZ),
    );
    modelGroup.scale.setScalar(baseFitScale * params.scale);
  }

  function applyCameraFov() {
    if (!camera) return;
    camera.fov = params.fov;
    camera.updateProjectionMatrix();
  }

  function onParamChange(key) {
    if (key === "emissive") applyEmissive();
    else if (key === "fov") applyCameraFov();
    else if (key === "pitchOff" || key === "yawOff" || key === "rollOff") updateCameraOrientation();
    else applyModelTransform();
    updateValueDisplay(key);
  }

  function buildPanel() {
    let currentGroup = "";
    SLIDER_CONFIG.forEach((cfg) => {
      if (cfg.group !== currentGroup) {
        currentGroup = cfg.group;
        const heading = document.createElement("div");
        heading.className = "ar-panel__group-title";
        heading.textContent = GROUP_LABELS[currentGroup] || currentGroup;
        panelBody.appendChild(heading);
      }

      const row = document.createElement("div");
      row.className = "ar-panel__row";

      const label = document.createElement("label");
      label.className = "ar-panel__label";
      label.htmlFor = `ar-slider-${cfg.key}`;
      label.textContent = cfg.label;

      const slider = document.createElement("input");
      slider.id = `ar-slider-${cfg.key}`;
      slider.className = "ar-panel__slider";
      slider.type = "range";
      slider.min = String(cfg.min);
      slider.max = String(cfg.max);
      slider.step = String(cfg.step);
      slider.value = String(cfg.default);

      const valueSpan = document.createElement("span");
      valueSpan.id = `ar-value-${cfg.key}`;
      valueSpan.className = "ar-panel__value";

      slider.addEventListener("input", () => {
        params[cfg.key] = parseFloat(slider.value);
        onParamChange(cfg.key);
      });

      row.append(label, slider, valueSpan);
      panelBody.appendChild(row);

      sliderEls[cfg.key] = slider;
      valueEls[cfg.key] = valueSpan;
    });

    updateAllValueDisplays();
  }

  function getParamsSnapshot() {
    const snap = { baseFitScale, ...params };
    return JSON.stringify(snap, null, 2);
  }

  function initThree() {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      params.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      800,
    );
    camera.position.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const dir = new THREE.DirectionalLight(0xffffff, 2);
    dir.position.set(5, 12, 8);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-4, 2, -6);
    scene.add(fill);

    modelGroup = new THREE.Group();
    scene.add(modelGroup);

    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        MODEL_URL,
        (gltf) => {
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          gltf.scene.position.sub(center);
          const maxDim = Math.max(size.x, size.y, size.z);
          baseFitScale = maxDim > 0 ? 40 / maxDim : 1;

          modelGroup.add(gltf.scene);
          emissiveMaterials = [];

          gltf.scene.traverse((child) => {
            if (child.isMesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((mat) => {
                mat.needsUpdate = true;
                if (mat.emissive) {
                  mat.emissive.setHex(0x333333);
                  mat.emissiveIntensity = params.emissive;
                  emissiveMaterials.push(mat);
                }
              });
            }
          });

          applyModelTransform();
          resolve();
        },
        undefined,
        reject,
      );
    });
  }

  function updateCameraOrientation() {
    if (!camera) return;

    const euler = new THREE.Euler(
      orientation.beta,
      orientation.alpha,
      -orientation.gamma,
      "YXZ",
    );
    qDevice.setFromEuler(euler);
    qDevice.multiply(qPortrait);

    qScreen.setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      -THREE.MathUtils.degToRad(orientation.screenAngle),
    );

    const offsetEuler = new THREE.Euler(
      THREE.MathUtils.degToRad(params.pitchOff),
      THREE.MathUtils.degToRad(params.yawOff),
      THREE.MathUtils.degToRad(params.rollOff),
      "YXZ",
    );
    qOffset.setFromEuler(offsetEuler);

    qFinal.copy(qScreen).multiply(qDevice).multiply(qOffset);
    camera.quaternion.copy(qFinal);
  }

  function onDeviceOrientation(event) {
    orientation.alpha = THREE.MathUtils.degToRad(event.alpha ?? 0);
    orientation.beta = THREE.MathUtils.degToRad(event.beta ?? 0);
    orientation.gamma = THREE.MathUtils.degToRad(event.gamma ?? 0);
    orientation.screenAngle =
      window.screen?.orientation?.angle ?? window.orientation ?? 0;
    updateCameraOrientation();
  }

  async function requestCameraPermission() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("当前浏览器不支持摄像头访问，请使用 Chrome 或 Safari。");
    }

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
  }

  async function requestOrientationPermission() {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== "granted") {
        throw new Error("需要允许动作与方向感应权限才能同步视角。");
      }
    }

    orientationHandler = onDeviceOrientation;
    window.addEventListener("deviceorientation", orientationHandler, true);
  }

  function startRenderLoop() {
    const render = () => {
      animationId = requestAnimationFrame(render);
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };
    render();
  }

  function onResize() {
    if (!renderer || !camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  async function startExperience() {
    errorMsg.textContent = "";
    startBtn.disabled = true;
    startBtn.textContent = "初始化中…";

    try {
      await requestCameraPermission();
      await requestOrientationPermission();
      await initThree();

      overlay.classList.add("is-hidden");
      panel.classList.remove("is-hidden");
      hint.classList.remove("is-hidden");
      rootEl.classList.add("is-ar-active");

      startRenderLoop();
      window.addEventListener("resize", onResize);
    } catch (err) {
      console.error("[AR]", err);
      showError(err.message || "启动失败，请检查权限设置后重试。");
    }
  }

  buildPanel();

  panelToggle.addEventListener("click", () => {
    const collapsed = panel.classList.toggle("is-collapsed");
    rootEl.classList.toggle("is-panel-collapsed", collapsed);
    panelToggle.setAttribute("aria-expanded", String(!collapsed));
    panelToggle.setAttribute("aria-label", collapsed ? "展开调参面板" : "收起调参面板");
    panelToggle.textContent = collapsed ? "▶" : "◀";
  });

  copyBtn.addEventListener("click", async () => {
    const text = getParamsSnapshot();
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "已复制";
      setTimeout(() => {
        copyBtn.textContent = "复制参数";
      }, 1500);
    } catch {
      copyBtn.textContent = text.slice(0, 40) + "…";
    }
  });

  startBtn.addEventListener("click", startExperience);

  return () => {
    if (animationId) cancelAnimationFrame(animationId);
    if (orientationHandler) {
      window.removeEventListener("deviceorientation", orientationHandler, true);
    }
    window.removeEventListener("resize", onResize);
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
    }
    renderer?.dispose();
  };
}
