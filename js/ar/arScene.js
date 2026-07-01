const IMMERSAL_MAP_ID = 148549;
const LOCALIZE_INTERVAL_MS = 2600;
const CAPTURE_WIDTH = 480;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;

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
  let localizing = false;
  let captureCanvas = null;
  let captureCtx = null;
  let cameraZoom = 1;
  let deviceQuaternion = { x: 0, y: 0, z: 0, w: 1 };
  let hasGyro = false;
  let lastIntrinsics = { fx: 0, fy: 0, ox: 0, oy: 0 };

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
        cameraZoom,
        hasGyro,
        lastIntrinsics,
        deviceQuaternion,
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

    let srcX = 0;
    let srcY = 0;
    let srcWidth = video.videoWidth;
    let srcHeight = video.videoHeight;

    if (cameraZoom > 1) {
      srcWidth = video.videoWidth / cameraZoom;
      srcHeight = video.videoHeight / cameraZoom;
      srcX = (video.videoWidth - srcWidth) / 2;
      srcY = (video.videoHeight - srcHeight) / 2;
    }

    captureCtx.drawImage(video, srcX, srcY, srcWidth, srcHeight, 0, 0, width, height);
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
        const message = data?.message || data?.upstream || `HTTP ${response.status}`;
        debugState.failure += 1;
        setDebug(
          {
            status: "localize failed",
            immersal: "proxy/upstream error",
            latency: `${elapsed}ms`,
            lastError: typeof message === "string" ? message : JSON.stringify(message),
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
        setDebug(
          {
            status: "localized",
            immersal: "recognized",
            latency: `${data.elapsedMs ?? elapsed}ms`,
            lastError: "none",
            lastImageBytes: data.imageBytes ?? payload.imageBase64.length,
            lastPose: {
              map: result.map,
              position: { x: result.px, y: result.py, z: result.pz },
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

  function startLocalizationLoop() {
    localizeOnce("start");
    localizeTimer = window.setInterval(() => localizeOnce("interval"), LOCALIZE_INTERVAL_MS);
    setDebug({ immersal: "loop running" }, "Immersal 连续识别循环已启动");
  }

  async function checkImmersalConfig() {
    try {
      const response = await fetch("/api/immersal");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || `HTTP ${response.status}`);
      }
      if (!data?.hasToken) {
        throw new Error("Vercel 未配置 VITE_IMMERSAL_TOKEN");
      }
      setDebug(
        { immersal: `ready (map ${data.mapId})` },
        "Immersal 代理可用",
        data,
      );
    } catch (err) {
      throw new Error(`Immersal 配置检查失败：${err.message || err}`);
    }
  }

  async function startExperience() {
    errorMsg.textContent = "";
    startBtn.disabled = true;
    startBtn.textContent = "初始化中…";
    setDebug({ status: "initializing", lastError: "none" }, "开始 Immersal 测试");

    try {
      await checkImmersalConfig();
      await checkWebXrSupport();
      await requestCameraPermission();
      await requestOrientationPermission();
      updateZoomUi();

      overlay.classList.add("is-hidden");
      controls?.classList.remove("is-hidden");
      hint?.classList.remove("is-hidden");
      debugPanel?.classList.remove("is-hidden");
      rootEl.classList.add("is-ar-active");

      startLocalizationLoop();
      setDebug({ status: "running" }, "Immersal 测试已启动");
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
    if (localizeTimer) window.clearInterval(localizeTimer);
    if (orientationHandler) {
      window.removeEventListener("deviceorientation", orientationHandler, true);
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
    }
  };
}
