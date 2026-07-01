import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = "models/the_vast_land_no_background.glb";
const IMMERSAL_MAP_ID = 148549;
const LOCALIZE_INTERVAL_MS = 2600;
const CAPTURE_WIDTH = 480;

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
  { key: "cameraZoom", label: "摄像头缩放", min: 1, max: 3, step: 0.05, default: 1, unit: "×", group: "camera" },
];

const GROUP_LABELS = {
  model: "模型位置",
  view: "视角校正",
  camera: "摄像头画面",
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
  const hintToggle = rootEl.querySelector("#ar-hint-toggle");
  const debugPanel = rootEl.querySelector("#ar-debug");
  const debugToggle = rootEl.querySelector("#ar-debug-toggle");
  const localizeNowBtn = rootEl.querySelector("#ar-localize-now");
  const copyDebugBtn = rootEl.querySelector("#ar-copy-debug");
  const debugLog = rootEl.querySelector("#ar-debug-log");
  const debugEls = {
    status: rootEl.querySelector("#ar-debug-status"),
    map: rootEl.querySelector("#ar-debug-map"),
    camera: rootEl.querySelector("#ar-debug-camera"),
    webxr: rootEl.querySelector("#ar-debug-webxr"),
    immersal: rootEl.querySelector("#ar-debug-immersal"),
    counts: rootEl.querySelector("#ar-debug-counts"),
    latency: rootEl.querySelector("#ar-debug-latency"),
    error: rootEl.querySelector("#ar-debug-error"),
    pose: rootEl.querySelector("#ar-debug-pose"),
  };

  let renderer = null;
  let scene = null;
  let camera = null;
  let modelGroup = null;
  let animationId = null;
  let mediaStream = null;
  let orientationHandler = null;
  let localizeTimer = null;
  let localizing = false;
  let captureCanvas = null;
  let captureCtx = null;
  let baseFitScale = 1;
  /** @type {import('three').MeshStandardMaterial[]} */
  let emissiveMaterials = [];

  const qDevice = new THREE.Quaternion();
  const qScreen = new THREE.Quaternion();
  const qOffset = new THREE.Quaternion();
  const qFinal = new THREE.Quaternion();
  const qPortrait = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

  const orientation = { alpha: 0, beta: 0, gamma: 0, screenAngle: 0 };
  const debugState = {
    status: "idle",
    mapId: IMMERSAL_MAP_ID,
    camera: "waiting",
    webxr: "checking",
    immersal: "not started",
    success: 0,
    failure: 0,
    latency: "-",
    lastError: "none",
    lastPose: null,
    lastImageBytes: 0,
    video: null,
    logs: [],
  };

  const params = Object.fromEntries(SLIDER_CONFIG.map((c) => [c.key, c.default]));
  const valueEls = {};
  const sliderEls = {};

  function updateDebugPanel() {
    if (!debugPanel) return;
    debugEls.status.textContent = debugState.status;
    debugEls.map.textContent = String(debugState.mapId);
    debugEls.camera.textContent = debugState.camera;
    debugEls.webxr.textContent = debugState.webxr;
    debugEls.immersal.textContent = debugState.immersal;
    debugEls.counts.textContent = `${debugState.success} / ${debugState.failure}`;
    debugEls.latency.textContent = debugState.latency;
    debugEls.error.textContent = debugState.lastError;
    debugEls.pose.textContent = debugState.lastPose
      ? JSON.stringify(debugState.lastPose, null, 2)
      : "pose: waiting";
  }

  function logDebug(message, details = null) {
    const entry = {
      time: new Date().toLocaleTimeString(),
      message,
      details,
    };
    debugState.logs.unshift(entry);
    debugState.logs = debugState.logs.slice(0, 18);

    if (debugLog) {
      debugLog.replaceChildren(
        ...debugState.logs.map((item) => {
          const li = document.createElement("li");
          li.textContent = `[${item.time}] ${item.message}`;
          if (item.details) {
            li.title = typeof item.details === "string" ? item.details : JSON.stringify(item.details);
          }
          return li;
        }),
      );
    }

    console.info("[AR Debug]", message, details ?? "");
    updateDebugPanel();
  }

  function setDebug(patch, message = null, details = null) {
    Object.assign(debugState, patch);
    if (message) logDebug(message, details);
    else updateDebugPanel();
  }

  function getDebugSnapshot() {
    return JSON.stringify(
      {
        ...debugState,
        params: { baseFitScale, ...params },
        userAgent: navigator.userAgent,
        secureContext: window.isSecureContext,
        location: window.location.href,
      },
      null,
      2,
    );
  }

  function showError(message) {
    errorMsg.textContent = message;
    startBtn.disabled = false;
    startBtn.textContent = "重试";
    setDebug({ status: "error", lastError: message }, "启动失败", message);
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

  function applyCameraZoom() {
    video.style.transform = `scale(${params.cameraZoom})`;
    video.style.transformOrigin = "center center";
    setDebug({ cameraZoom: `${params.cameraZoom.toFixed(2)}x` });
  }

  function onParamChange(key) {
    if (key === "emissive") applyEmissive();
    else if (key === "fov") applyCameraFov();
    else if (key === "cameraZoom") applyCameraZoom();
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

  async function checkWebXrSupport() {
    if (!navigator.xr?.isSessionSupported) {
      setDebug({ webxr: "not available" }, "WebXR 不可用，使用摄像头叠加模式");
      return false;
    }

    try {
      const supported = await navigator.xr.isSessionSupported("immersive-ar");
      setDebug(
        { webxr: supported ? "immersive-ar supported" : "immersive-ar unsupported" },
        supported ? "WebXR immersive-ar 支持" : "WebXR immersive-ar 不支持，使用摄像头叠加模式",
      );
      return supported;
    } catch (err) {
      setDebug({ webxr: "check failed" }, "WebXR 检测失败", err?.message || String(err));
      return false;
    }
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

    setDebug({ status: "requesting camera", camera: "requesting" }, "申请摄像头权限");
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

    const track = mediaStream.getVideoTracks()[0];
    const settings = track?.getSettings?.() ?? {};
    debugState.video = {
      width: video.videoWidth,
      height: video.videoHeight,
      track: settings,
    };
    setDebug(
      { camera: `${video.videoWidth}x${video.videoHeight}` },
      "摄像头已打开",
      debugState.video,
    );
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
    setDebug({ status: "orientation ready" }, "设备方向监听已启用");
  }

  function getCaptureCanvas() {
    if (!captureCanvas) {
      captureCanvas = document.createElement("canvas");
      captureCtx = captureCanvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
        willReadFrequently: true,
      });
    }
    return captureCanvas;
  }

  function captureFrameDataUrl() {
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("摄像头视频尚未产生有效帧");
    }

    const ratio = video.videoHeight / video.videoWidth;
    const width = CAPTURE_WIDTH;
    const height = Math.max(1, Math.round(width * ratio));
    const target = getCaptureCanvas();
    target.width = width;
    target.height = height;
    const zoom = Math.max(1, params.cameraZoom);
    const srcWidth = video.videoWidth / zoom;
    const srcHeight = video.videoHeight / zoom;
    const srcX = (video.videoWidth - srcWidth) / 2;
    const srcY = (video.videoHeight - srcHeight) / 2;
    captureCtx.drawImage(video, srcX, srcY, srcWidth, srcHeight, 0, 0, width, height);
    const imageBase64 = target.toDataURL("image/png");
    return { imageBase64, width, height };
  }

  function getLocalizationPayload(capture) {
    const verticalFov = THREE.MathUtils.degToRad(params.fov);
    const fy = capture.height / (2 * Math.tan(verticalFov / 2));
    const fx = fy;

    return {
      action: "localize",
      mapId: IMMERSAL_MAP_ID,
      imageBase64: capture.imageBase64,
      camera: {
        fx,
        fy,
        ox: capture.width / 2,
        oy: capture.height / 2,
        width: capture.width,
        height: capture.height,
      },
      rotation: {
        qx: qFinal.x,
        qy: qFinal.y,
        qz: qFinal.z,
        qw: qFinal.w,
      },
      solverType: 1,
    };
  }

  function applyImmersalPose(result) {
    if (!camera || !result?.success) return;

    const matrix = new THREE.Matrix4().set(
      result.r00,
      result.r01,
      result.r02,
      0,
      result.r10,
      result.r11,
      result.r12,
      0,
      result.r20,
      result.r21,
      result.r22,
      0,
      0,
      0,
      0,
      1,
    );
    camera.position.set(result.px, result.py, result.pz);
    camera.quaternion.setFromRotationMatrix(matrix);
  }

  async function localizeOnce(reason = "auto") {
    if (localizing) return;

    localizing = true;
    const startedAt = performance.now();
    setDebug({ status: `localizing (${reason})`, immersal: "requesting" });

    try {
      const capture = captureFrameDataUrl();
      const payload = getLocalizationPayload(capture);
      const response = await fetch("/api/immersal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      const elapsed = Math.round(performance.now() - startedAt);

      if (!response.ok) {
        const message = data?.message || `HTTP ${response.status}`;
        debugState.failure += 1;
        setDebug(
          {
            status: "localize failed",
            immersal: "proxy/upstream error",
            latency: `${elapsed}ms`,
            lastError: message,
          },
          "Immersal 请求失败",
          data,
        );
        return;
      }

      const result = data?.result;
      const success = Boolean(result?.success);
      if (success) {
        debugState.success += 1;
        applyImmersalPose(result);
        setDebug(
          {
            status: "localized",
            immersal: "recognized",
            latency: `${data.elapsedMs ?? elapsed}ms`,
            lastError: "none",
            lastImageBytes: data.imageBytes ?? payload.imageBase64.length,
            lastPose: {
              map: result.map,
              position: {
                x: result.px,
                y: result.py,
                z: result.pz,
              },
              rotationMatrix: [
                [result.r00, result.r01, result.r02],
                [result.r10, result.r11, result.r12],
                [result.r20, result.r21, result.r22],
              ],
            },
          },
          "场景识别成功",
          result,
        );
      } else {
        debugState.failure += 1;
        setDebug(
          {
            status: "not recognized",
            immersal: "no match",
            latency: `${data.elapsedMs ?? elapsed}ms`,
            lastError: result?.error || "localization returned success=false",
            lastPose: result ?? null,
          },
          "场景暂未识别",
          result,
        );
      }
    } catch (err) {
      debugState.failure += 1;
      setDebug(
        {
          status: "localize exception",
          immersal: "error",
          latency: `${Math.round(performance.now() - startedAt)}ms`,
          lastError: err?.message || String(err),
        },
        "Immersal 定位异常",
        err?.message || String(err),
      );
    } finally {
      localizing = false;
    }
  }

  function startLocalizationLoop() {
    localizeOnce("start");
    localizeTimer = window.setInterval(() => localizeOnce("interval"), LOCALIZE_INTERVAL_MS);
    setDebug({ immersal: "loop running" }, "Immersal 连续识别循环已启动");
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
    setDebug({ status: "initializing", lastError: "none" }, "开始 AR 初始化");

    try {
      await checkWebXrSupport();
      await requestCameraPermission();
      await requestOrientationPermission();
      await initThree();
      applyCameraZoom();

      overlay.classList.add("is-hidden");
      panel.classList.remove("is-hidden");
      hint.classList.remove("is-hidden");
      debugPanel?.classList.remove("is-hidden");
      rootEl.classList.add("is-ar-active");

      startRenderLoop();
      startLocalizationLoop();
      window.addEventListener("resize", onResize);
      setDebug({ status: "running" }, "AR 渲染已启动");
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

  debugToggle?.addEventListener("click", () => {
    const collapsed = debugPanel.classList.toggle("is-collapsed");
    debugToggle.setAttribute("aria-expanded", String(!collapsed));
    debugToggle.setAttribute("aria-label", collapsed ? "展开 debug 面板" : "收起 debug 面板");
    debugToggle.textContent = collapsed ? "Debug +" : "Debug";
  });

  hintToggle?.addEventListener("click", () => {
    const collapsed = hint.classList.toggle("is-collapsed");
    hintToggle.setAttribute("aria-expanded", String(!collapsed));
    hintToggle.setAttribute("aria-label", collapsed ? "展开提示信息" : "最小化提示信息");
    hintToggle.textContent = collapsed ? "+" : "-";
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

  localizeNowBtn?.addEventListener("click", () => {
    localizeOnce("manual");
  });

  copyDebugBtn?.addEventListener("click", async () => {
    const text = getDebugSnapshot();
    try {
      await navigator.clipboard.writeText(text);
      copyDebugBtn.textContent = "已复制";
      setTimeout(() => {
        copyDebugBtn.textContent = "复制 debug";
      }, 1500);
    } catch {
      copyDebugBtn.textContent = "复制失败";
      setTimeout(() => {
        copyDebugBtn.textContent = "复制 debug";
      }, 1500);
    }
  });

  startBtn.addEventListener("click", startExperience);
  setDebug({ mapId: IMMERSAL_MAP_ID });

  return () => {
    if (animationId) cancelAnimationFrame(animationId);
    if (localizeTimer) window.clearInterval(localizeTimer);
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
