import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = "models/the_vast_land.glb";

const DEFAULTS = {
  y: -12,
  z: -20,
  scale: 1.0,
};

const SLIDER_RANGES = {
  y: { min: -5, max: -30, step: 0.5 },
  z: { min: -5, max: -50, step: 0.5 },
  scale: { min: 0.5, max: 5.0, step: 0.1 },
};

export function bootstrapArScene(rootEl) {
  const video = rootEl.querySelector("#ar-camera");
  const canvas = rootEl.querySelector("#ar-canvas");
  const overlay = rootEl.querySelector("#ar-start-overlay");
  const startBtn = rootEl.querySelector("#ar-start-btn");
  const errorMsg = rootEl.querySelector("#ar-error-msg");
  const panel = rootEl.querySelector("#ar-panel");
  const hint = rootEl.querySelector("#ar-hint");
  const sliderY = rootEl.querySelector("#ar-slider-y");
  const sliderZ = rootEl.querySelector("#ar-slider-z");
  const sliderScale = rootEl.querySelector("#ar-slider-scale");
  const valueY = rootEl.querySelector("#ar-value-y");
  const valueZ = rootEl.querySelector("#ar-value-z");
  const valueScale = rootEl.querySelector("#ar-value-scale");

  let renderer = null;
  let scene = null;
  let camera = null;
  let modelGroup = null;
  let animationId = null;
  let mediaStream = null;
  let orientationHandler = null;

  const orientation = {
    alpha: 0,
    beta: 0,
    gamma: 0,
    screenAngle: 0,
  };

  const params = { ...DEFAULTS };

  function showError(message) {
    errorMsg.textContent = message;
    startBtn.disabled = false;
    startBtn.textContent = "重试";
  }

  function formatValue(key, val) {
    if (key === "scale") return `${val.toFixed(1)}×`;
    return `${val.toFixed(1)}m`;
  }

  function updateValueDisplays() {
    valueY.textContent = `当前高度: ${formatValue("y", params.y)}`;
    valueZ.textContent = `当前距离: ${formatValue("z", params.z)}`;
    valueScale.textContent = `当前比例: ${formatValue("scale", params.scale)}`;
  }

  function applyModelTransform() {
    if (!modelGroup) return;
    modelGroup.position.set(0, params.y, params.z);
    modelGroup.scale.setScalar(params.scale);
  }

  function initSliders() {
    Object.entries(SLIDER_RANGES).forEach(([key, range]) => {
      const slider = key === "y" ? sliderY : key === "z" ? sliderZ : sliderScale;
      slider.min = range.min;
      slider.max = range.max;
      slider.step = range.step;
      slider.value = params[key];
    });
    updateValueDisplays();

    sliderY.addEventListener("input", () => {
      params.y = parseFloat(sliderY.value);
      applyModelTransform();
      updateValueDisplays();
    });
    sliderZ.addEventListener("input", () => {
      params.z = parseFloat(sliderZ.value);
      applyModelTransform();
      updateValueDisplays();
    });
    sliderScale.addEventListener("input", () => {
      params.scale = parseFloat(sliderScale.value);
      applyModelTransform();
      updateValueDisplays();
    });
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
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      500,
    );
    camera.position.set(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.8);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    modelGroup = new THREE.Group();
    scene.add(modelGroup);
    applyModelTransform();

    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        MODEL_URL,
        (gltf) => {
          modelGroup.add(gltf.scene);
          gltf.scene.traverse((child) => {
            if (child.isMesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((mat) => {
                mat.needsUpdate = true;
                if (mat.emissive) {
                  mat.emissive.setHex(0x222222);
                  mat.emissiveIntensity = 0.15;
                }
              });
            }
          });
          resolve();
        },
        undefined,
        reject,
      );
    });
  }

  function updateCameraOrientation() {
    if (!camera) return;

    const alpha = orientation.alpha;
    const beta = orientation.beta;
    const gamma = orientation.gamma;
    const screenAngle = orientation.screenAngle;

    const euler = new THREE.Euler(beta, alpha, -gamma, "YXZ");
    const qDevice = new THREE.Quaternion().setFromEuler(euler);

    const qScreen = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      -THREE.MathUtils.degToRad(screenAngle),
    );

    camera.quaternion.copy(qScreen).multiply(qDevice);
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

  initSliders();
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
