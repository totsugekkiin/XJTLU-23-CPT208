/**
 * TEST VERSION — AR ink-reveal experiment (v1).
 *
 * This module is deliberately isolated. Remove it, the matching React
 * component/CSS file, and the clearly marked integration points to roll the
 * whole experiment back.
 */

const AUTO_START_KEY = "changmen.ar.ink-reveal-test.autostart.v1";
const PAPER_COLOR = "#f3efe4";
const DISSOLVE_DURATION_MS = 1850;

// TEST VERSION master switch: change true to false to disable the entire
// experiment immediately without deleting any files.
export const INK_REVEAL_TEST_ENABLED = true;

function readSessionFlag() {
  try {
    return window.sessionStorage.getItem(AUTO_START_KEY) === "1";
  } catch {
    return false;
  }
}

export function hasInkRevealAutoStartRequest() {
  return typeof window !== "undefined" && readSessionFlag();
}

export function consumeInkRevealAutoStartRequest() {
  if (typeof window === "undefined" || !readSessionFlag()) return false;
  try {
    window.sessionStorage.removeItem(AUTO_START_KEY);
  } catch {
    // The in-memory result is still enough for the current navigation.
  }
  return true;
}

function setAutoStartRequest() {
  try {
    window.sessionStorage.setItem(AUTO_START_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

function getOverlayParts(root = document) {
  const overlay = root.querySelector("#ar-ink-reveal-test");
  return {
    overlay,
    canvas: overlay?.querySelector("#ar-ink-reveal-test-canvas") ?? null,
    status: overlay?.querySelector("#ar-ink-reveal-test-status") ?? null,
  };
}

function setStatus(statusEl, message) {
  if (statusEl) statusEl.textContent = message;
}

function paintPaper(canvas) {
  if (!canvas) return null;

  // One CSS pixel per canvas pixel keeps this short-lived effect inexpensive
  // on high-DPI phones while remaining visually soft like wet paper.
  const width = Math.max(1, Math.round(window.innerWidth));
  const height = Math.max(1, Math.round(window.innerHeight));
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return null;

  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
  context.fillStyle = PAPER_COLOR;
  context.fillRect(0, 0, width, height);

  // Lightweight paper fibres. They are generated once, not every frame.
  context.lineWidth = 0.55;
  for (let index = 0; index < 560; index += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const length = 4 + Math.random() * 22;
    context.strokeStyle = Math.random() > 0.45
      ? "rgba(116, 94, 61, 0.055)"
      : "rgba(255, 255, 255, 0.18)";
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length, y + (Math.random() - 0.5) * 2.4);
    context.stroke();
  }

  return context;
}

function activateOverlay(parts, message) {
  if (!parts.overlay) return;
  parts.overlay.classList.remove("is-dissolving", "is-error");
  parts.overlay.classList.add("is-active");
  parts.overlay.setAttribute("aria-hidden", "false");
  if (parts.canvas) parts.canvas.style.opacity = "1";
  setStatus(parts.status, message);
  paintPaper(parts.canvas);
  parts.overlay.classList.add("is-canvas-ready");
}

function deactivateOverlay(parts) {
  if (!parts.overlay) return;
  parts.overlay.classList.remove("is-active", "is-canvas-ready", "is-dissolving", "is-error");
  parts.overlay.setAttribute("aria-hidden", "true");
  if (parts.canvas) parts.canvas.style.opacity = "1";
}

function requestOrientationPermission() {
  const orientationEvent = window.DeviceOrientationEvent;
  const motionEvent = window.DeviceMotionEvent;
  const permissionOwner =
    typeof orientationEvent?.requestPermission === "function"
      ? orientationEvent
      : typeof motionEvent?.requestPermission === "function"
        ? motionEvent
        : null;

  if (!permissionOwner) return Promise.resolve("not-required");
  return permissionOwner.requestPermission().then((result) => {
    if (result !== "granted") {
      throw new Error("需要方向传感器权限才能开启实景导览。");
    }
    return result;
  });
}

function requestPreludeCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("当前浏览器不支持摄像头访问。"));
  }
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
}

/**
 * TEST VERSION integration for the GO link. Permission calls begin in the
 * original click gesture, then an auto-start flag bridges the page navigation.
 */
export async function beginInkRevealTestNavigation(event) {
  if (!INK_REVEAL_TEST_ENABLED) return;
  event.preventDefault();
  const anchor = event.currentTarget;
  if (!anchor || anchor.getAttribute("aria-busy") === "true") return;

  const destination = anchor.href;
  const parts = getOverlayParts(document);
  anchor.setAttribute("aria-busy", "true");
  activateOverlay(parts, "正在唤醒实景…");

  // iOS requires the sensor request to begin inside the click handler. Camera
  // access itself can safely follow it; sequencing avoids overlapping two
  // native permission sheets on first launch.
  const orientationPromise = requestOrientationPermission();
  let preludeStream = null;

  try {
    await orientationPromise;
    preludeStream = await requestPreludeCamera();

    setStatus(parts.status, "实景已就绪，正在展开…");
    setAutoStartRequest();
    preludeStream?.getTracks().forEach((track) => track.stop());
    window.setTimeout(() => window.location.assign(destination), 120);
  } catch (error) {
    preludeStream?.getTracks().forEach((track) => track.stop());
    parts.overlay?.classList.add("is-error");
    setStatus(parts.status, error?.message || "摄像头启动失败，请检查权限后重试。");
    window.setTimeout(() => {
      deactivateOverlay(parts);
      anchor.removeAttribute("aria-busy");
    }, 1800);
  }
}

function waitForVideoFrame(video) {
  if (video?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video?.removeEventListener("loadeddata", finish);
      video?.removeEventListener("playing", finish);
      resolve();
    };
    video?.addEventListener("loadeddata", finish, { once: true });
    video?.addEventListener("playing", finish, { once: true });
    window.setTimeout(finish, 1800);
  });
}

function createDissolveSpots(width, height) {
  const diagonal = Math.hypot(width, height);
  return Array.from({ length: 34 }, (_, index) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * diagonal * 0.36;
    return {
      x: width * 0.5 + Math.cos(angle) * distance,
      y: height * 0.5 + Math.sin(angle) * distance,
      delay: (index / 34) * 0.48 + Math.random() * 0.08,
      radius: diagonal * (0.11 + Math.random() * 0.11),
      stretch: 0.62 + Math.random() * 0.85,
      rotation: Math.random() * Math.PI,
    };
  });
}

function eraseInkBloom(context, spot, amount) {
  if (amount <= 0) return;
  const eased = 1 - Math.pow(1 - Math.min(1, amount), 3);
  const radius = Math.max(1, spot.radius * eased);

  context.save();
  context.globalCompositeOperation = "destination-out";
  context.translate(spot.x, spot.y);
  context.rotate(spot.rotation);
  context.scale(1, spot.stretch);
  const gradient = context.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius);
  gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
  gradient.addColorStop(0.68, "rgba(0, 0, 0, 0.96)");
  gradient.addColorStop(0.86, "rgba(0, 0, 0, 0.46)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function createInkRevealTestController(rootEl, video) {
  const parts = getOverlayParts(rootEl);
  let frameId = 0;
  let disposed = false;

  function prepare(message = "正在唤醒实景…") {
    if (disposed) return;
    activateOverlay(parts, message);
  }

  async function reveal() {
    if (disposed || !parts.overlay || !parts.canvas) return;
    if (!parts.overlay.classList.contains("is-active")) prepare();
    await waitForVideoFrame(video);
    if (disposed) return;

    setStatus(parts.status, "画卷正在化为实景…");
    parts.overlay.classList.add("is-dissolving");

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      parts.overlay.style.opacity = "0";
      await new Promise((resolve) => window.setTimeout(resolve, 220));
      parts.overlay.style.opacity = "";
      deactivateOverlay(parts);
      return;
    }

    const context = parts.canvas.getContext("2d", { alpha: true });
    if (!context) {
      deactivateOverlay(parts);
      return;
    }
    const spots = createDissolveSpots(parts.canvas.width, parts.canvas.height);
    const startedAt = performance.now();

    await new Promise((resolve) => {
      const draw = (now) => {
        if (disposed) {
          resolve();
          return;
        }
        const progress = Math.min(1, (now - startedAt) / DISSOLVE_DURATION_MS);
        for (const spot of spots) {
          const localProgress = (progress - spot.delay) / Math.max(0.01, 1 - spot.delay);
          eraseInkBloom(context, spot, localProgress);
        }
        if (progress > 0.78) {
          parts.canvas.style.opacity = String(Math.max(0, 1 - (progress - 0.78) / 0.22));
        }
        if (progress >= 1) {
          context.clearRect(0, 0, parts.canvas.width, parts.canvas.height);
          resolve();
          return;
        }
        frameId = window.requestAnimationFrame(draw);
      };
      frameId = window.requestAnimationFrame(draw);
    });

    if (!disposed) deactivateOverlay(parts);
  }

  function cancel() {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    deactivateOverlay(parts);
  }

  function dispose() {
    disposed = true;
    cancel();
  }

  return { prepare, reveal, cancel, dispose };
}
