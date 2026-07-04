import { AR_ANCHORS, IMMERSAL_MAP_ID } from "./arAnchors.js";
import { agentDebugLog, getAgentDebugLogs } from "./agentDebugLog.js";

const LOCALIZE_INTERVAL_MS = 800;
const SDK_DEVICE_LOCALIZE_INTERVAL_MS = 16;
const SDK_REST_ASSIST_INTERVAL_MS = 800;
const SDK_DEVICE_WATCHDOG_MS = 8000;
const SDK_DEBUG_INTERVAL_MS = 250;
const CAPTURE_WIDTH = 480;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const CLIENT_IMMERSAL_TOKEN = import.meta.env.VITE_IMMERSAL_TOKEN ?? "";

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function multiplyQuat(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function quatInvert(q) {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

function quatFromAxisAngle(axis, angle) {
  const half = angle * 0.5;
  const s = Math.sin(half);
  return {
    x: axis.x * s,
    y: axis.y * s,
    z: axis.z * s,
    w: Math.cos(half),
  };
}

function quatFromEuler(pitch, yaw, roll) {
  const qX = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, pitch);
  const qY = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, yaw);
  const qZ = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, roll);
  return multiplyQuat(multiplyQuat(qY, qX), qZ);
}

function deviceOrientationToQuaternion(alpha, beta, gamma, screenAngle) {
  const qScreen = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -degToRad(screenAngle));
  const qPortrait = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -Math.PI / 2);
  const qDevice = quatFromEuler(beta, alpha, -gamma);
  const qTilt = multiplyQuat(qDevice, qPortrait);
  return multiplyQuat(qScreen, qTilt);
}

function quatFromRotationMatrix(matrix) {
  const m = matrix;
  let w;
  let x;
  let y;
  let z;
  const trace = m[0][0] + m[1][1] + m[2][2];

  if (trace > 0) {
    const s = Math.sqrt(1 + trace) * 2;
    w = 0.25 * s;
    x = (m[2][1] - m[1][2]) / s;
    y = (m[0][2] - m[2][0]) / s;
    z = (m[1][0] - m[0][1]) / s;
  } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
    w = (m[2][1] - m[1][2]) / s;
    x = 0.25 * s;
    y = (m[0][1] + m[1][0]) / s;
    z = (m[0][2] + m[2][0]) / s;
  } else if (m[1][1] > m[2][2]) {
    const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
    w = (m[0][2] - m[2][0]) / s;
    x = (m[0][1] + m[1][0]) / s;
    y = 0.25 * s;
    z = (m[1][2] + m[2][1]) / s;
  } else {
    const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
    w = (m[1][0] - m[0][1]) / s;
    x = (m[0][2] + m[2][0]) / s;
    y = (m[1][2] + m[2][1]) / s;
    z = 0.25 * s;
  }

  return { x, y, z, w };
}

function restResultToPose(result) {
  const rotationMatrix = [
    [result.r00, result.r01, result.r02],
    [result.r10, result.r11, result.r12],
    [result.r20, result.r21, result.r22],
  ];
  const rotation = quatFromRotationMatrix(rotationMatrix);
  const pose = {
    map: result.map,
    position: { x: result.px, y: result.py, z: result.pz },
    rotationMatrix,
    rotation,
  };

  // #region agent log
  agentDebugLog("initial", "H2,H5", "js/ar/arScene.js:restResultToPose", "Immersal REST result converted to renderer pose", {
    map: pose.map,
    position: pose.position,
    rotationMatrix,
    rotation,
    anchors: AR_ANCHORS.map((anchor) => ({
      id: anchor.id,
      position: anchor.position,
      rotation: anchor.rotation,
      scale: anchor.scale,
    })),
  });
  // #endregion

  return pose;
}

const AXIS_ROT = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI);

export function bootstrapArScene(rootEl) {
  const video = rootEl.querySelector("#ar-camera");
  const overlay = rootEl.querySelector("#ar-start-overlay");
  const startBtn = rootEl.querySelector("#ar-start-btn");
  const errorMsg = rootEl.querySelector("#ar-error-msg");
  const controls = rootEl.querySelector("#ar-controls");
  const controlsToggle = rootEl.querySelector("#ar-controls-toggle");
  const zoomSlider = rootEl.querySelector("#ar-zoom-slider");
  const zoomValue = rootEl.querySelector("#ar-zoom-value");
  const zoomOutBtn = rootEl.querySelector("#ar-zoom-out");
  const zoomInBtn = rootEl.querySelector("#ar-zoom-in");
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

  let mediaStream = null;
  let orientationHandler = null;
  let localizeTimer = null;
  let sdkSession = null;
  let sdkFrameId = null;
  let sdkMapHandle = null;
  let localizationMode = "rest";
  let localizing = false;
  let captureCanvas = null;
  let captureCtx = null;
  let cameraZoom = 1;
  let deviceQuaternion = { x: 0, y: 0, z: 0, w: 1 };
  let hasGyro = false;
  let lastIntrinsics = { fx: 0, fy: 0, ox: 0, oy: 0 };
  let sdkFailureCount = 0;
  let sdkRestAssistPending = false;
  let sdkLastRestAssistAt = 0;
  let sdkRestAssistEnabled = false;
  let sdkDeviceWatchdogTimer = null;
  let sdkLastLocalizeCounter = 0;
  let sdkWasLocalizing = false;
  let sdkLastDebugAt = 0;
  let arRenderer = null;
  let lastMapPose = null;
  let lastSuccessfulLocalizeAt = 0;
  let restRenderFrameId = null;
  let agentLastRendererPoseLogAt = 0;
  let agentLastRestSubstituteLogAt = 0;
  let lastLocalizationGyro = { x: 0, y: 0, z: 0, w: 1 };

  const debugState = {
    status: "idle",
    mapId: IMMERSAL_MAP_ID,
    camera: "waiting",
    cameraZoom: "1.00x",
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

  function captureLocalizationGyro() {
    let gyro = null;
    if (sdkSession?.gyroData) {
      gyro = {
        x: sdkSession.gyroData.x,
        y: sdkSession.gyroData.y,
        z: sdkSession.gyroData.z,
        w: sdkSession.gyroData.w,
      };
      sdkSession.localization?.lastGyro?.set(gyro.x, gyro.y, gyro.z, gyro.w);
    } else if (hasGyro) {
      gyro = { ...deviceQuaternion };
    }
    if (gyro) {
      lastLocalizationGyro = gyro;
    }
    return gyro;
  }

  function getLastLocalizationGyro() {
    if (sdkSession?.localization?.lastGyro) {
      const g = sdkSession.localization.lastGyro;
      return { x: g.x, y: g.y, z: g.z, w: g.w };
    }
    return lastLocalizationGyro;
  }

  function applyImmersalPoseCorrection(rotation) {
    let corrected = multiplyQuat(rotation, AXIS_ROT);
    if (hasGyro) {
      corrected = multiplyQuat(corrected, quatInvert(getLastLocalizationGyro()));
    }
    return corrected;
  }

  async function waitForDeviceGyro(timeoutMs = 3000) {
    if (hasGyro) return;
    await new Promise((resolve) => {
      const deadline = performance.now() + timeoutMs;
      const tick = () => {
        if (hasGyro || performance.now() >= deadline) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  function syncSdkSolverType() {
    if (!sdkSession) return;
    sdkSession.solverType = hasGyro ? 1 : 0;
  }

  function getGyroQuaternion() {
    if (sdkSession?.gyroData) {
      const g = sdkSession.gyroData;
      return { x: g.x, y: g.y, z: g.z, w: g.w };
    }
    if (!hasGyro) return null;
    const camRot = multiplyQuat(deviceQuaternion, AXIS_ROT);
    return { x: camRot.x, y: camRot.y, z: camRot.z, w: camRot.w };
  }

  function getRendererVFov() {
    if (sdkSession && typeof sdkSession.getVFov === "function") {
      try {
        return sdkSession.getVFov();
      } catch {
        return null;
      }
    }
    return null;
  }

  function poseForRenderer(poseLike) {
    if (!poseLike) return null;
    if (poseLike.position && poseLike.rotation) {
      return {
        position: poseLike.position,
        rotation: poseLike.rotation,
      };
    }
    return null;
  }

  function markLocalizationSuccess() {
    lastSuccessfulLocalizeAt = performance.now();
  }

  function getRestModeRenderPose() {
    if (!lastMapPose) return null;
    const cam = getCameraRotation();
    const now = performance.now();
    if (now - agentLastRestSubstituteLogAt > 1000) {
      agentLastRestSubstituteLogAt = now;
      // #region agent log
      agentDebugLog("initial", "H1", "js/ar/arScene.js:getRestModeRenderPose", "REST render loop replaces localized rotation with device camera rotation", {
        localizationMode,
        hasGyro,
        lastMapPose,
        cameraRotation: cam,
        deviceQuaternion,
      });
      // #endregion
    }
    return {
      position: { ...lastMapPose.position },
      rotation: { x: cam.qx, y: cam.qy, z: cam.qz, w: cam.qw },
    };
  }

  function updateArRendererPose(poseLike, options = {}) {
    if (!arRenderer) return;
    const pose = poseForRenderer(poseLike);
    if (!pose) return;
    if (!options.keepLastMapPose) {
      lastMapPose = pose;
    }
    const gyro = options.skipGyro ? null : getGyroQuaternion();
    const vFov = getRendererVFov();
    const now = performance.now();
    if (now - agentLastRendererPoseLogAt > 1000) {
      agentLastRendererPoseLogAt = now;
      // #region agent log
      agentDebugLog("post-fix", "H1", "js/ar/arScene.js:updateArRendererPose", "Pose handed to AR renderer", {
        localizationMode,
        options,
        pose,
        gyro,
        skipGyroReason: options.skipGyro ? "explicit" : localizationMode === "sdk" ? "sdk-gyro-at-render" : "none",
        vFov,
        hasGyro,
        cameraZoom,
        lastIntrinsics,
        video: debugState.video,
      });
      // #endregion
    }
    arRenderer.updateCameraFromPose(pose, gyro, vFov);
  }

  async function initArRenderer() {
    const cameraWrap = rootEl.querySelector("#ar-camera-wrap");
    if (!cameraWrap) return;

    const { createArRenderer } = await import("./arRenderer.js");
    arRenderer = createArRenderer(rootEl, cameraWrap);
    arRenderer.start();
    try {
      await arRenderer.ready;
      logDebug(`AR 模型已加载（${AR_ANCHORS.length} 个锚点）`);
    } catch (err) {
      logDebug("AR 模型加载失败", err?.message || String(err));
    }
  }

  function logArRendererStatus() {
    if (!arRenderer) return;
    const status = arRenderer.getStatus();
    if (status.loadError) {
      setDebug({ lastError: `AR 模型: ${status.loadError}` });
      return;
    }
    if (status.modelsReady && status.hasPose && status.renderCount > 0) return;
    const parts = [
      status.modelsReady ? "模型就绪" : "模型加载中",
      status.hasPose ? "有 pose" : "等待 pose",
      `已渲染 ${status.renderCount} 帧`,
    ];
    logDebug(`AR 渲染：${parts.join(" · ")}`, status);
  }

  function clampZoom(value) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
  }

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

    console.info("[Immersal]", message, details ?? "");
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
        localizationMode,
        cameraZoom,
        hasGyro,
        lastIntrinsics,
        deviceQuaternion,
        lastSuccessfulLocalizeAt,
        msSinceLastLocalize: lastSuccessfulLocalizeAt
          ? Math.round(performance.now() - lastSuccessfulLocalizeAt)
          : null,
        userAgent: navigator.userAgent,
        secureContext: window.isSecureContext,
        location: window.location.href,
        agentLogs: getAgentDebugLogs(),
      },
      null,
      2,
    );
  }

  function showDebugExportModal(text) {
    let modal = rootEl.querySelector("#ar-debug-export");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "ar-debug-export";
      modal.innerHTML = `
        <div class="ar-debug-export__backdrop"></div>
        <div class="ar-debug-export__panel" role="dialog" aria-modal="true" aria-label="Debug 导出">
          <div class="ar-debug-export__header">
            <strong>Debug 内容</strong>
            <button type="button" id="ar-debug-export-close">关闭</button>
          </div>
          <p class="ar-debug-export__hint">自动复制失败。请长按下方文本框，选择“全选”后复制，再发给我。</p>
          <textarea id="ar-debug-export-text" readonly></textarea>
        </div>
      `;
      rootEl.appendChild(modal);
      modal.querySelector(".ar-debug-export__backdrop")?.addEventListener("click", () => {
        modal.classList.add("is-hidden");
      });
      modal.querySelector("#ar-debug-export-close")?.addEventListener("click", () => {
        modal.classList.add("is-hidden");
      });
    }

    const textarea = modal.querySelector("#ar-debug-export-text");
    if (textarea) {
      textarea.value = text;
      textarea.focus();
      textarea.select();
    }
    modal.classList.remove("is-hidden");
  }

  async function copyTextWithFallback(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return "clipboard";
      } catch {
        // fall through
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    document.body.removeChild(textarea);
    if (copied) return "execCommand";

    if (navigator.share) {
      try {
        await navigator.share({ title: "AR Debug", text });
        return "share";
      } catch (err) {
        if (err?.name === "AbortError") return "share-cancelled";
      }
    }

    showDebugExportModal(text);
    return "modal";
  }

  function setCopyDebugButtonLabel(label, resetMs = 1800) {
    if (!copyDebugBtn) return;
    copyDebugBtn.textContent = label;
    window.setTimeout(() => {
      copyDebugBtn.textContent = "复制 debug";
    }, resetMs);
  }

  function showError(message) {
    errorMsg.textContent = message;
    startBtn.disabled = false;
    startBtn.textContent = "重试";
    setDebug({ status: "error", lastError: message }, "启动失败", message);
  }

  function updateZoomUi() {
    const label = `${cameraZoom.toFixed(2)}x`;
    if (zoomSlider) zoomSlider.value = String(cameraZoom);
    if (zoomValue) zoomValue.textContent = label;
    rootEl.style.setProperty("--ar-camera-zoom", String(cameraZoom));
    setDebug({ cameraZoom: label });
  }

  function setCameraZoom(nextZoom) {
    cameraZoom = clampZoom(nextZoom);
    updateZoomUi();
  }

  async function checkWebXrSupport() {
    if (!navigator.xr?.isSessionSupported) {
      setDebug({ webxr: "not available" }, "WebXR 不可用");
      return false;
    }

    try {
      const supported = await navigator.xr.isSessionSupported("immersive-ar");
      setDebug(
        { webxr: supported ? "immersive-ar supported" : "immersive-ar unsupported" },
        supported ? "WebXR immersive-ar 支持" : "WebXR immersive-ar 不支持",
      );
      return supported;
    } catch (err) {
      setDebug({ webxr: "check failed" }, "WebXR 检测失败", err?.message || String(err));
      return false;
    }
  }

  async function requestCameraPermission() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("当前浏览器不支持摄像头访问，请使用 Chrome 或 Safari。");
    }

    setDebug({ status: "requesting camera", camera: "requesting" }, "申请摄像头权限");
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        aspectRatio: { ideal: 4 / 3 },
        width: { ideal: 1280 },
        height: { ideal: 960 },
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
      {
        camera: `${video.videoWidth}x${video.videoHeight} (contain 1x = 完整画面)`,
      },
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
        throw new Error("需要允许动作与方向感应权限才能提交姿态数据。");
      }
    }

    orientationHandler = onDeviceOrientation;
    window.addEventListener("deviceorientation", orientationHandler, true);
    setDebug({ status: "orientation ready" }, "设备方向监听已启用");
  }

  function onDeviceOrientation(event) {
    if (event.alpha == null || event.beta == null || event.gamma == null) return;
    hasGyro = true;
    const screenAngle = window.screen?.orientation?.angle ?? window.orientation ?? 0;
    deviceQuaternion = deviceOrientationToQuaternion(
      degToRad(event.alpha ?? 0),
      degToRad(event.beta ?? 0),
      degToRad(event.gamma ?? 0),
      screenAngle,
    );
  }

  function getCameraRotation() {
    if (!hasGyro) {
      return { qx: 0, qy: 0, qz: 0, qw: 1 };
    }
    const camRot = multiplyQuat(deviceQuaternion, AXIS_ROT);
    return { qx: camRot.x, qy: camRot.y, qz: camRot.z, qw: camRot.w };
  }

  function getIntrinsics(capture) {
    const ox = capture.width / 2;
    const oy = capture.height / 2;
    // 未接入 Immersal devget 设备标定时，发送 0 让服务端估计焦距。
    lastIntrinsics = { fx: 0, fy: 0, ox, oy };
    return lastIntrinsics;
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

  function getActiveCameraVideo() {
    return sdkSession?.camera?.el ?? video;
  }

  function captureFrameDataUrl(sourceVideo = getActiveCameraVideo()) {
    if (!sourceVideo?.videoWidth || !sourceVideo?.videoHeight) {
      throw new Error("摄像头视频尚未产生有效帧");
    }

    const ratio = sourceVideo.videoHeight / sourceVideo.videoWidth;
    const width = CAPTURE_WIDTH;
    const height = Math.max(1, Math.round(width * ratio));
    const target = getCaptureCanvas();
    target.width = width;
    target.height = height;

    let srcX = 0;
    let srcY = 0;
    let srcWidth = sourceVideo.videoWidth;
    let srcHeight = sourceVideo.videoHeight;

    if (cameraZoom > 1) {
      srcWidth = sourceVideo.videoWidth / cameraZoom;
      srcHeight = sourceVideo.videoHeight / cameraZoom;
      srcX = (sourceVideo.videoWidth - srcWidth) / 2;
      srcY = (sourceVideo.videoHeight - srcHeight) / 2;
    }

    captureCtx.drawImage(sourceVideo, srcX, srcY, srcWidth, srcHeight, 0, 0, width, height);
    return {
      imageBase64: target.toDataURL("image/png"),
      width,
      height,
    };
  }

  function getLocalizationPayload(capture) {
    const intrinsics = getIntrinsics(capture);
    const rotation = getCameraRotation();
    const solverType = hasGyro ? 1 : 0;

    return {
      action: "localize",
      mapId: IMMERSAL_MAP_ID,
      imageBase64: capture.imageBase64,
      camera: {
        fx: intrinsics.fx,
        fy: intrinsics.fy,
        ox: intrinsics.ox,
        oy: intrinsics.oy,
        width: capture.width,
        height: capture.height,
      },
      rotation,
      solverType,
    };
  }

  async function requestImmersalLocalization(reason = "auto") {
    captureLocalizationGyro();
    const capture = captureFrameDataUrl();
    const payload = getLocalizationPayload(capture);
    const startedAt = performance.now();
    const response = await fetch("/api/immersal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    const elapsed = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      const message = data?.message || data?.upstream || `HTTP ${response.status}`;
      throw new Error(typeof message === "string" ? message : JSON.stringify(message));
    }

    return {
      elapsed,
      payload,
      data,
      result: data?.result,
      reason,
    };
  }

  function feedPoseToTracker(pose, time = performance.now()) {
    if (!sdkSession || typeof window.icvPosePut !== "function") return false;

    const correctedRotation = applyImmersalPoseCorrection(pose.rotation);
    const position = new Float32Array([pose.position.x, pose.position.y, pose.position.z]);
    const rotation = new Float32Array([
      correctedRotation.x,
      correctedRotation.y,
      correctedRotation.z,
      correctedRotation.w,
    ]);
    window.icvPosePut(time, new Uint8Array(position.buffer), new Uint8Array(rotation.buffer));

    sdkSession.localizeInfo.handle = pose.map ?? sdkSession.localizeInfo.handle;
    sdkSession.localizeInfo.position.x = pose.position.x;
    sdkSession.localizeInfo.position.y = pose.position.y;
    sdkSession.localizeInfo.position.z = pose.position.z;
    sdkSession.localizeInfo.rotation.set(
      correctedRotation.x,
      correctedRotation.y,
      correctedRotation.z,
      correctedRotation.w,
    );
    sdkSession.localizeInfo.elapsedTime = 0;
    sdkSession.localization.counter += 1;
    return true;
  }

  function getTrackedPoseSnapshot(now) {
    if (!sdkSession || sdkSession.localization.counter <= 0) return null;

    let estimatedPose = null;
    if (typeof window.icvPoseGet === "function") {
      try {
        estimatedPose = sdkSession.getEstimatedPose(now);
      } catch (err) {
        console.warn("[Immersal] Tracker pose read failed", err);
      }
    }

    const info = sdkSession.localizeInfo;
    return {
      mode: sdkRestAssistEnabled ? "sdk-device+rest" : "sdk-device",
      mapHandle: info.handle,
      position: estimatedPose
        ? { x: estimatedPose.position[0], y: estimatedPose.position[1], z: estimatedPose.position[2] }
        : { ...info.position },
      rotation: estimatedPose
        ? {
            x: estimatedPose.rotation[0],
            y: estimatedPose.rotation[1],
            z: estimatedPose.rotation[2],
            w: estimatedPose.rotation[3],
          }
        : {
            x: info.rotation.x,
            y: info.rotation.y,
            z: info.rotation.z,
            w: info.rotation.w,
          },
      estimated: Boolean(estimatedPose),
    };
  }

  async function localizeOnce(reason = "auto") {
    if (localizing) return;

    localizing = true;
    const startedAt = performance.now();
    setDebug({ status: `localizing (${reason})`, immersal: "requesting" });

    try {
      const localization = await requestImmersalLocalization(reason);
      const { result, data, elapsed, payload } = localization;

      if (result?.success) {
        debugState.success += 1;
        markLocalizationSuccess();
        const rawPose = restResultToPose(result);
        const pose = {
          ...rawPose,
          rotation: applyImmersalPoseCorrection(rawPose.rotation),
        };
        lastMapPose = poseForRenderer(pose);
        updateArRendererPose(pose, { skipGyro: true });
        logArRendererStatus();
        setDebug(
          {
            status: "localized",
            immersal: "recognized",
            latency: `${data.elapsedMs ?? elapsed}ms`,
            lastError: "none",
            lastImageBytes: data.imageBytes ?? payload.imageBase64.length,
            lastPose: pose,
          },
          "场景识别成功",
          result,
        );
      } else {
        debugState.failure += 1;
        const failReason = result?.error && result.error !== "none"
          ? result.error
          : "场景未匹配（success=false）";
        setDebug(
          {
            status: "not recognized",
            immersal: "no match",
            latency: `${data.elapsedMs ?? elapsed}ms`,
            lastError: failReason,
            lastPose: result ?? null,
          },
          "场景暂未识别",
          { result, solverType: hasGyro ? 1 : 0, intrinsics: lastIntrinsics, hasGyro },
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

  function trackSdkLocalizeAttempts() {
    if (!sdkSession) return;

    const counter = sdkSession.localization.counter;
    const isLocalizing = sdkSession.localization.localizing;

    if (sdkWasLocalizing && !isLocalizing) {
      if (counter > sdkLastLocalizeCounter) {
        sdkLastLocalizeCounter = counter;
        markLocalizationSuccess();
      } else {
        sdkFailureCount += 1;
      }
    } else if (counter > sdkLastLocalizeCounter) {
      sdkLastLocalizeCounter = counter;
      markLocalizationSuccess();
    }

    sdkWasLocalizing = isLocalizing;
  }

  function updateSdkDebug(now) {
    if (!sdkSession || now - sdkLastDebugAt < SDK_DEBUG_INTERVAL_MS) return;
    sdkLastDebugAt = now;

    trackSdkLocalizeAttempts();

    const counter = sdkSession.localization.counter;
    const trackedPose = getTrackedPoseSnapshot(now);
    const hasPose = Boolean(trackedPose);
    const immersalLabel = sdkRestAssistEnabled
      ? sdkRestAssistPending
        ? "device + rest requesting"
        : "device + rest assist"
      : sdkSession.localization.localizing
        ? "device requesting"
        : "device tracking";

    setDebug({
      status: hasPose
        ? sdkRestAssistEnabled
          ? "tracking (sdk-device+rest)"
          : "tracking (sdk-device)"
        : "sdk localizing",
      immersal: immersalLabel,
      success: counter,
      failure: sdkFailureCount,
      latency: sdkSession.localizeInfo.elapsedTime
        ? `${Math.round(sdkSession.localizeInfo.elapsedTime)}ms`
        : debugState.latency,
      lastError: hasPose ? "none" : debugState.lastError,
      lastPose: trackedPose ?? debugState.lastPose,
    });
    if (hasPose) logArRendererStatus();
  }

  async function runSdkRestAssist(reason = "assist") {
    if (!sdkSession || sdkRestAssistPending) return;

    sdkRestAssistPending = true;
    sdkLastRestAssistAt = performance.now();
    const startedAt = performance.now();

    try {
      const localization = await requestImmersalLocalization(reason);
      const { result, data, elapsed } = localization;

      if (result?.success) {
        const pose = restResultToPose(result);
        feedPoseToTracker(pose, startedAt);
        const tracked = getTrackedPoseSnapshot(performance.now()) ?? poseForRenderer(pose);
        lastMapPose = tracked;
        updateArRendererPose(tracked);
        logDebug("REST 辅助识别成功，Tracker 已初始化", { reason, elapsed: data.elapsedMs ?? elapsed });
      } else {
        sdkFailureCount += 1;
        logDebug("REST 辅助识别未匹配", { reason, result });
      }
    } catch (err) {
      sdkFailureCount += 1;
      logDebug("REST 辅助识别失败", err?.message || String(err));
    } finally {
      sdkRestAssistPending = false;
      sdkLastDebugAt = 0;
      updateSdkDebug(performance.now());
    }
  }

  function startSdkDeviceWatchdog() {
    if (sdkDeviceWatchdogTimer) window.clearTimeout(sdkDeviceWatchdogTimer);
    sdkDeviceWatchdogTimer = window.setTimeout(() => {
      sdkDeviceWatchdogTimer = null;
      if (!sdkSession || sdkSession.localization.counter > 0) return;
      sdkRestAssistEnabled = true;
      logDebug(
        `设备端 ${SDK_DEVICE_WATCHDOG_MS / 1000}s 内未成功，启用 REST 辅助识别`,
        { hasGyro, solverType: sdkSession.solverType },
      );
      runSdkRestAssist("watchdog");
    }, SDK_DEVICE_WATCHDOG_MS);
  }

  function startSdkFrameLoop() {
    const tick = (now) => {
      if (!sdkSession) return;

      syncSdkSolverType();

      if (sdkMapHandle >= 0 && sdkSession.continuousLocalization) {
        sdkSession.localizeDevice(now);
      }

      if (
        sdkRestAssistEnabled &&
        !sdkRestAssistPending &&
        now - sdkLastRestAssistAt >= SDK_REST_ASSIST_INTERVAL_MS
      ) {
        runSdkRestAssist("interval");
      }

      if (sdkSession.localization.counter > 0) {
        const trackedPose = getTrackedPoseSnapshot(now);
        if (trackedPose) {
          updateArRendererPose(trackedPose);
        }
      } else if (lastMapPose) {
        updateArRendererPose(lastMapPose);
      }

      updateSdkDebug(now);
      sdkFrameId = requestAnimationFrame(tick);
    };

    sdkFrameId = requestAnimationFrame(tick);
  }

  function startRestRenderLoop() {
    const tick = () => {
      const pose = getRestModeRenderPose();
      if (pose) {
        updateArRendererPose(pose, { keepLastMapPose: true, skipGyro: true });
      }
      restRenderFrameId = requestAnimationFrame(tick);
    };
    restRenderFrameId = requestAnimationFrame(tick);
  }

  async function startImmersalSdkLocalization() {
    if (!CLIENT_IMMERSAL_TOKEN) {
      throw new Error("前端未配置 VITE_IMMERSAL_TOKEN，跳过 SDK 连续定位。");
    }

    setDebug({ status: "sdk initializing", immersal: "loading sdk" }, "开始初始化 Immersal SDK");
    await waitForDeviceGyro();

    let session = null;
    try {
      const sdkUrl = "/vendor/immersal/immersal.js";
      const { Immersal } = await import(/* @vite-ignore */ sdkUrl);
      const cameraWrap = rootEl.querySelector("#ar-camera-wrap") ?? rootEl;
      session = await Immersal.Initialize(cameraWrap, {
        developerToken: CLIENT_IMMERSAL_TOKEN,
        mapIds: [IMMERSAL_MAP_ID],
        continuousLocalization: true,
        continuousInterval: SDK_DEVICE_LOCALIZE_INTERVAL_MS,
        solverType: hasGyro ? 1 : 0,
        imageDownScale: 0.25,
      });

      sdkSession = session;
      syncSdkSolverType();
      localizationMode = "sdk";
      rootEl.classList.add("is-sdk-camera");
      arRenderer?.bringCanvasToFront();

      setDebug({ status: "sdk loading map", immersal: "loading map" }, "正在下载并加载地图到设备…");
      sdkMapHandle = await session.loadMap(IMMERSAL_MAP_ID);

      setDebug(
        {
          status: "sdk ready",
          camera: `${session.camera.width}x${session.camera.height} (SDK camera)`,
          immersal: "device tracking",
          lastError: "none",
        },
        "Immersal SDK 设备端连续识别已启动",
        { width: session.camera.width, height: session.camera.height, mapHandle: sdkMapHandle },
      );

      startSdkFrameLoop();
      startSdkDeviceWatchdog();
    } catch (err) {
      session?.dispose?.();
      sdkSession = null;
      sdkMapHandle = null;
      localizationMode = "rest";
      rootEl.classList.remove("is-sdk-camera");
      throw err;
    }
  }

  function startLocalizationLoop() {
    localizationMode = "rest";
    localizeOnce("start");
    localizeTimer = window.setInterval(() => localizeOnce("interval"), LOCALIZE_INTERVAL_MS);
    startRestRenderLoop();
    setDebug({ immersal: "REST loop running" }, "Immersal REST 定时识别循环已启动");
  }

  async function checkImmersalConfig() {
    if (!CLIENT_IMMERSAL_TOKEN) {
      throw new Error("未配置 VITE_IMMERSAL_TOKEN，请在环境变量中设置 Immersal developer token。");
    }

    let restAssistReady = false;
    try {
      const response = await fetch("/api/immersal");
      const data = await response.json().catch(() => null);
      restAssistReady = Boolean(response.ok && data?.hasToken);
    } catch {
      restAssistReady = false;
    }

    setDebug(
      {
        immersal: restAssistReady
          ? `ready (map ${IMMERSAL_MAP_ID}, device + REST fallback)`
          : `ready (map ${IMMERSAL_MAP_ID}, device only)`,
      },
      restAssistReady
        ? "Immersal 已配置：优先设备端，失败时 REST 辅助"
        : "Immersal 已配置：仅设备端（REST 辅助不可用）",
      { mapId: IMMERSAL_MAP_ID, hasToken: true, restAssistReady },
    );
  }

  async function startExperience() {
    errorMsg.textContent = "";
    startBtn.disabled = true;
    startBtn.textContent = "初始化中…";
    setDebug({ status: "initializing", lastError: "none" }, "开始 Immersal 测试");

    try {
      await checkImmersalConfig();
      await checkWebXrSupport();
      await requestOrientationPermission();
      updateZoomUi();

      overlay.classList.add("is-hidden");
      controls?.classList.remove("is-hidden");
      hint?.classList.remove("is-hidden");
      debugPanel?.classList.remove("is-hidden");
      rootEl.classList.add("is-ar-active");

      await initArRenderer();

      try {
        await startImmersalSdkLocalization();
        setDebug({ status: "running (sdk)" }, "Immersal SDK 连续定位已启动");
      } catch (sdkErr) {
        console.warn("[Immersal] SDK fallback to REST", sdkErr);
        setDebug(
          { status: "sdk fallback", immersal: "using REST fallback", lastError: sdkErr?.message || String(sdkErr) },
          "SDK 初始化失败，回退 REST 定时定位",
          sdkErr?.message || String(sdkErr),
        );
        await requestCameraPermission();
        startLocalizationLoop();
        setDebug({ status: "running (rest)" }, "Immersal REST 测试已启动");
      }
    } catch (err) {
      console.error("[Immersal]", err);
      showError(err.message || "启动失败，请检查权限设置后重试。");
    }
  }

  controlsToggle?.addEventListener("click", () => {
    const collapsed = controls.classList.toggle("is-collapsed");
    controlsToggle.setAttribute("aria-expanded", String(!collapsed));
    controlsToggle.setAttribute("aria-label", collapsed ? "展开缩放控制" : "收起缩放控制");
    controlsToggle.textContent = collapsed ? "缩放 +" : "缩放";
  });

  debugToggle?.addEventListener("click", () => {
    const collapsed = debugPanel.classList.toggle("is-collapsed");
    debugToggle.setAttribute("aria-expanded", String(!collapsed));
    debugToggle.setAttribute("aria-label", collapsed ? "展开 debug 面板" : "收起 debug 面板");
    debugToggle.textContent = collapsed ? "▶" : "◀";
  });

  hintToggle?.addEventListener("click", () => {
    const collapsed = hint.classList.toggle("is-collapsed");
    hintToggle.setAttribute("aria-expanded", String(!collapsed));
    hintToggle.setAttribute("aria-label", collapsed ? "展开提示信息" : "最小化提示信息");
    hintToggle.textContent = collapsed ? "+" : "-";
  });

  zoomSlider?.addEventListener("input", () => {
    setCameraZoom(parseFloat(zoomSlider.value));
  });

  zoomOutBtn?.addEventListener("click", () => {
    setCameraZoom(cameraZoom - ZOOM_STEP);
  });

  zoomInBtn?.addEventListener("click", () => {
    setCameraZoom(cameraZoom + ZOOM_STEP);
  });

  localizeNowBtn?.addEventListener("click", async () => {
    if (sdkSession) {
      setDebug({ status: "sdk localizing (manual)", immersal: "device requesting" });
      syncSdkSolverType();
      try {
        await sdkSession.localizeDeviceAsync();
        markLocalizationSuccess();
        const trackedPose = getTrackedPoseSnapshot(performance.now());
        if (trackedPose) {
          updateArRendererPose(trackedPose);
        }
        setDebug(
          {
            status: sdkRestAssistEnabled ? "tracking (sdk-device+rest)" : "tracking (sdk-device)",
            immersal: "device recognized",
            success: sdkSession.localization.counter,
            lastError: "none",
            lastPose: trackedPose ?? debugState.lastPose,
          },
          "手动设备端识别成功",
          sdkSession.localizeInfo,
        );
      } catch (err) {
        sdkFailureCount += 1;
        if (!sdkRestAssistEnabled) {
          sdkRestAssistEnabled = true;
          logDebug("手动设备端识别失败，尝试 REST 辅助");
          await runSdkRestAssist("manual-fallback");
          return;
        }
        setDebug(
          {
            status: "sdk not recognized",
            immersal: "device no match",
            failure: sdkFailureCount,
            lastError: err?.message || String(err),
          },
          "手动设备端识别失败",
          err?.message || String(err),
        );
      }
      return;
    }
    localizeOnce("manual");
  });

  copyDebugBtn?.addEventListener("click", async () => {
    const text = getDebugSnapshot();
    const result = await copyTextWithFallback(text);
    if (result === "clipboard" || result === "execCommand") {
      setCopyDebugButtonLabel("已复制");
    } else if (result === "share") {
      setCopyDebugButtonLabel("已分享");
    } else if (result === "share-cancelled") {
      setCopyDebugButtonLabel("已取消");
    } else {
      setCopyDebugButtonLabel("请手动复制", 2500);
    }
  });

  startBtn.addEventListener("click", startExperience);
  setDebug({ mapId: IMMERSAL_MAP_ID });

  return () => {
    if (localizeTimer) window.clearInterval(localizeTimer);
    if (sdkDeviceWatchdogTimer) window.clearTimeout(sdkDeviceWatchdogTimer);
    if (sdkFrameId) cancelAnimationFrame(sdkFrameId);
    if (restRenderFrameId) cancelAnimationFrame(restRenderFrameId);
    arRenderer?.dispose();
    if (sdkMapHandle != null) {
      sdkSession?.freeMap(sdkMapHandle).catch((err) => {
        console.warn("[Immersal] freeMap failed", err);
      });
    }
    sdkSession?.dispose?.();
    rootEl.classList.remove("is-sdk-camera");
    if (orientationHandler) {
      window.removeEventListener("deviceorientation", orientationHandler, true);
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
    }
  };
}
