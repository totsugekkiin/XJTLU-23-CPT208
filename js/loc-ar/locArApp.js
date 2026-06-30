import {
  accuracyToSignal,
  formatCoord,
  formatDistance,
  haversineDistance,
} from "./geoUtils.js";
import { gpsState, onGpsStateChange, updateGpsState } from "./gpsState.js";
import { createPlacementManager } from "./placementManager.js";
import { MAX_PLACEMENTS, MIN_PLACE_DISTANCE_M } from "./placementConfig.js";
import { StabilityTracker } from "./stabilityTracker.js";

const AR_SCRIPTS = [
  "vendor/aframe.min.js",
  "vendor/ar-threex-location-only.js",
  "vendor/aframe-ar.js",
];

let arLibsPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-loc-ar-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.dataset.locArSrc = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "1";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => {
      reject(new Error(`脚本加载失败：${src}`));
    }, { once: true });
    document.head.appendChild(script);
  });
}

function loadArLibs() {
  if (window.AFRAME?.registerComponent) return Promise.resolve();
  if (!arLibsPromise) {
    arLibsPromise = AR_SCRIPTS.reduce(
      (chain, src) => chain.then(() => loadScript(src)),
      Promise.resolve(),
    );
  }
  return arLibsPromise;
}

function showBootError(message) {
  const errorMsg = document.getElementById("loc-ar-error-msg");
  const startBtn = document.getElementById("loc-ar-start-btn");
  const bootStatus = document.getElementById("loc-ar-boot-status");
  if (errorMsg) errorMsg.textContent = message;
  if (bootStatus) bootStatus.textContent = "加载失败";
  if (startBtn) {
    startBtn.disabled = false;
    startBtn.textContent = "重试";
  }
}

function setBootStatus(text, ready = false) {
  const bootStatus = document.getElementById("loc-ar-boot-status");
  if (!bootStatus) return;
  bootStatus.textContent = text;
  bootStatus.classList.toggle("is-ready", ready);
}

function waitForAframe(timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    if (window.AFRAME?.registerComponent) {
      resolve();
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      if (window.AFRAME?.registerComponent) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error("AR 库初始化超时，请刷新重试。"));
      }
    }, 50);
  });
}

function waitForSceneLoaded(sceneEl, timeoutMs = 25000) {
  if (sceneEl.hasLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("AR 场景初始化超时，请重试。"));
    }, timeoutMs);
    sceneEl.addEventListener(
      "loaded",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function createArScene(host) {
  const scene = document.createElement("a-scene");
  scene.id = "loc-ar-scene";
  scene.setAttribute("vr-mode-ui", "enabled: false");
  scene.setAttribute("embedded", "");
  scene.setAttribute("renderer", "alpha: true; antialias: true");
  scene.setAttribute(
    "arjs",
    "sourceType: webcam; videoTexture: true; debugUIEnabled: false",
  );

  const camera = document.createElement("a-camera");
  camera.setAttribute("gps-new-camera", "gpsMinDistance: 0; positionMinAccuracy: 100");
  scene.appendChild(camera);
  host.appendChild(scene);
  return scene;
}

/**
 * @param {HTMLElement} rootEl
 * @returns {() => void}
 */
export function bootstrapLocAr(rootEl) {
  const gate = document.getElementById("loc-ar-gate");
  const startBtn = document.getElementById("loc-ar-start-btn");
  const errorMsg = document.getElementById("loc-ar-error-msg");
  const sceneHost = rootEl.querySelector("#loc-ar-scene-host");
  const statusLat = rootEl.querySelector("#loc-gps-lat");
  const statusLng = rootEl.querySelector("#loc-gps-lng");
  const statusAcc = rootEl.querySelector("#loc-gps-acc");
  const statusTime = rootEl.querySelector("#loc-gps-time");
  const signalBars = rootEl.querySelector("#loc-gps-signal");
  const signalLabel = rootEl.querySelector("#loc-gps-signal-label");
  const placementList = rootEl.querySelector("#loc-placement-list");
  const metricJitter = rootEl.querySelector("#loc-metric-jitter");
  const metricJump = rootEl.querySelector("#loc-metric-jump");
  const metricDrift = rootEl.querySelector("#loc-metric-drift");
  const placeBtn = rootEl.querySelector("#loc-place-btn");
  const resetBtn = rootEl.querySelector("#loc-reset-btn");
  const panelToggle = rootEl.querySelector("#loc-metrics-toggle");
  const placeHint = rootEl.querySelector("#loc-place-hint");

  if (!gate || !startBtn || !sceneHost) {
    showBootError("页面结构异常，请刷新重试。");
    return () => {};
  }

  const tracker = new StabilityTracker();
  /** @type {HTMLElement | null} */
  let sceneEl = null;
  /** @type {ReturnType<typeof createPlacementManager> | null} */
  let placementManager = null;
  let lastGpsPos = null;
  let started = false;
  let starting = false;

  function showError(message) {
    if (errorMsg) errorMsg.textContent = message;
    startBtn.disabled = false;
    startBtn.textContent = "重试";
    gate.classList.remove("is-hidden");
    rootEl.classList.remove("is-loc-ar-active");
  }

  function showPlaceHint(message) {
    if (placeHint) placeHint.textContent = message;
  }

  function updatePlaceButton() {
    if (!placeBtn || !placementManager) return;
    const count = placementManager.placementCount;
    placeBtn.textContent = `放置 (${count}/${MAX_PLACEMENTS})`;
    placeBtn.disabled = !placementManager.canPlace || !placementManager.origin;
  }

  function renderSignal(accuracy) {
    if (!signalBars || !signalLabel) return;
    const { level, label } = accuracyToSignal(accuracy);
    signalLabel.textContent = label;
    signalBars.querySelectorAll(".loc-signal__bar").forEach((bar, i) => {
      bar.classList.toggle("is-active", i < level);
    });
  }

  function renderPlacementList() {
    if (!placementList) return;

    if (gpsState.lat == null || gpsState.lng == null) {
      placementList.innerHTML = "<p class='loc-placement-list__empty'>等待 GPS…</p>";
      return;
    }

    if (!placementManager?.origin) {
      placementList.innerHTML =
        "<p class='loc-placement-list__empty'>等待 GPS 以标记起点…</p>";
      return;
    }

    const user = { lat: gpsState.lat, lng: gpsState.lng };
    const origin = placementManager.origin;
    const distToOrigin = haversineDistance(user, origin);
    let html = `<div class="loc-placement-row">
      <span class="loc-placement-row__dot" style="background:#88ccff;border-radius:50%"></span>
      <span class="loc-placement-row__name">起点球体</span>
      <span class="loc-placement-row__meta">${formatCoord(origin.lat)}, ${formatCoord(origin.lng)} · 距你 ${formatDistance(distToOrigin)}</span>
    </div>`;

    let prev = { lat: origin.lat, lng: origin.lng };
    placementManager.placements.forEach((p) => {
      const distFromOrigin = haversineDistance(
        { lat: origin.lat, lng: origin.lng },
        p,
      );
      const distFromPrev = haversineDistance(prev, p);
      const accText =
        p.accuracy != null ? ` · ±${p.accuracy.toFixed(1)}m` : "";
      html += `<div class="loc-placement-row">
        <span class="loc-placement-row__dot" style="background:${p.color}"></span>
        <span class="loc-placement-row__name">${p.label}</span>
        <span class="loc-placement-row__meta">${formatCoord(p.lat)}, ${formatCoord(p.lng)}${accText}<br>距起点 ${formatDistance(distFromOrigin)} · 距上一点 ${formatDistance(distFromPrev)}</span>
      </div>`;
      prev = p;
    });

    placementList.innerHTML = html;
    updatePlaceButton();
  }

  function renderStatus() {
    if (!statusLat || !statusLng) return;
    statusLat.textContent = formatCoord(gpsState.lat);
    statusLng.textContent = formatCoord(gpsState.lng);
    statusAcc.textContent =
      gpsState.accuracy != null ? `±${gpsState.accuracy.toFixed(1)} m` : "—";
    statusTime.textContent = gpsState.timestamp
      ? new Date(gpsState.timestamp).toLocaleTimeString()
      : "—";
    renderSignal(gpsState.accuracy);
    renderPlacementList();
  }

  function renderMetrics() {
    if (!metricJitter || !metricJump || !metricDrift) return;
    const m = tracker.getMetrics();
    metricJitter.textContent =
      m.anchorScreenJitter != null ? `${m.anchorScreenJitter.toFixed(1)} px` : "—";
    metricJump.textContent =
      m.worldPositionJump != null ? `${m.worldPositionJump.toFixed(2)} m` : "—";
    metricDrift.textContent =
      m.maxDrift != null ? `${m.maxDrift.toFixed(1)} px` : "—";
  }

  const unsubGps = onGpsStateChange(() => {
    renderStatus();
    renderMetrics();
  });

  function onGpsCameraUpdate(e) {
    const { latitude, longitude } = e.detail.position;
    const accuracy = e.detail.position.accuracy ?? gpsState.accuracy;
    const speed = e.detail.position.speed ?? gpsState.speed ?? 0;

    if (lastGpsPos) {
      const jump = haversineDistance(
        { lat: lastGpsPos.lat, lng: lastGpsPos.lng },
        { lat: latitude, lng: longitude },
      );
      tracker.onWorldPositionJump(jump);
    }
    lastGpsPos = { lat: latitude, lng: longitude };

    updateGpsState({
      lat: latitude,
      lng: longitude,
      accuracy,
      speed,
      timestamp: Date.now(),
    });
    tracker.onGpsUpdate(accuracy, speed);

    if (placementManager && !placementManager.origin) {
      placementManager.setOrigin(latitude, longitude);
      showPlaceHint("起点已标记，请沿走廊走动后点击「放置」。");
      renderPlacementList();
      updatePlaceButton();
    }
  }

  function onSceneTick() {
    if (!started || !sceneEl?.camera || !placementManager) return;
    const cameraEl = sceneEl.querySelector("[gps-new-camera]");
    const threeCamera = cameraEl?.getObject3D("camera");
    if (!threeCamera || !window.THREE) return;
    tracker.tick(threeCamera, placementManager.getEntities(), gpsState.speed ?? 0);
    renderMetrics();
  }

  function bindGpsCamera() {
    if (!sceneEl) return null;
    const cameraEl = sceneEl.querySelector("[gps-new-camera]");
    if (!cameraEl) return null;
    cameraEl.addEventListener("gps-camera-update-position", onGpsCameraUpdate);
    return () => {
      cameraEl.removeEventListener("gps-camera-update-position", onGpsCameraUpdate);
    };
  }

  let unbindGpsCamera = null;

  function onPlace() {
    showPlaceHint("");
    if (errorMsg) errorMsg.textContent = "";

    if (gpsState.lat == null || gpsState.lng == null) {
      showPlaceHint("尚无 GPS 数据，请稍候。");
      return;
    }

    if (!placementManager?.origin) {
      showPlaceHint("等待起点标记完成…");
      return;
    }

    if (!placementManager.canPlace) {
      showPlaceHint("已放置 4 个观测点。");
      return;
    }

    const current = { lat: gpsState.lat, lng: gpsState.lng };
    const lastPlaced =
      placementManager.placements.length > 0
        ? placementManager.placements[placementManager.placements.length - 1]
        : placementManager.origin;

    const distFromLast = haversineDistance(current, lastPlaced);
    if (distFromLast < MIN_PLACE_DISTANCE_M) {
      showPlaceHint(
        `距上一点仅 ${formatDistance(distFromLast)}，请再走 ${MIN_PLACE_DISTANCE_M}m 以上再放置。`,
      );
      return;
    }

    placementManager.placeAt(
      gpsState.lat,
      gpsState.lng,
      gpsState.accuracy,
    );
    showPlaceHint(`已放置 ${placementManager.placementCount}/${MAX_PLACEMENTS}`);
    renderPlacementList();
    updatePlaceButton();
  }

  function onReset() {
    showPlaceHint("");
    if (errorMsg) errorMsg.textContent = "";

    if (gpsState.lat == null || gpsState.lng == null) {
      showPlaceHint("尚无 GPS 数据，无法重置。");
      return;
    }

    if (!placementManager || !sceneEl) return;

    placementManager.resetOrigin(gpsState.lat, gpsState.lng);
    tracker.resetSession();
    lastGpsPos = null;
    showPlaceHint("已重置标定，当前位置为新起点。");
    renderPlacementList();
    updatePlaceButton();
  }

  async function startExperience() {
    if (starting || started) return;
    starting = true;
    if (errorMsg) errorMsg.textContent = "";
    startBtn.disabled = true;
    startBtn.textContent = "加载中…";

    try {
      setBootStatus("正在加载 AR 组件…");
      await loadArLibs();
      await waitForAframe();
      setBootStatus("正在启动摄像头…", true);

      if (!sceneEl) {
        sceneEl = createArScene(sceneHost);
        placementManager = createPlacementManager(sceneEl);
      }

      gate.classList.add("is-hidden");
      rootEl.classList.add("is-loc-ar-active");

      await waitForSceneLoaded(sceneEl);

      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== "granted") {
          throw new Error("需要允许设备方向权限以同步 AR 视角。");
        }
      }

      if (!navigator.geolocation) {
        throw new Error("当前浏览器不支持地理定位。");
      }

      started = true;
      unbindGpsCamera = bindGpsCamera() ?? null;
      sceneEl.addEventListener("tick", onSceneTick);
      updatePlaceButton();
    } catch (err) {
      console.error("[loc-ar]", err);
      started = false;
      showError(err.message || "启动失败，请检查权限后重试。");
    } finally {
      starting = false;
      if (!started) {
        startBtn.disabled = false;
        startBtn.textContent = "重试";
      }
    }
  }

  startBtn.addEventListener("click", startExperience);
  placeBtn?.addEventListener("click", onPlace);
  resetBtn?.addEventListener("click", onReset);
  panelToggle?.addEventListener("click", () => {
    rootEl.classList.toggle("is-metrics-collapsed");
    const collapsed = rootEl.classList.contains("is-metrics-collapsed");
    panelToggle.setAttribute("aria-expanded", String(!collapsed));
    panelToggle.textContent = collapsed ? "展开" : "收起";
  });

  renderStatus();
  renderMetrics();

  return () => {
    unsubGps();
    unbindGpsCamera?.();
    if (sceneEl) sceneEl.removeEventListener("tick", onSceneTick);
    placementManager?.clear();
    started = false;
    starting = false;
  };
}

function init() {
  const root = document.getElementById("loc-ar-app");
  if (root) bootstrapLocAr(root);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
