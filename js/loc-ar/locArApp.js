import * as THREE from "three";
import { checkWebXRSupport, createImmersalRuntime, getImmersalDiagnostics } from "./immersalClient.js";
import { IMMERSAL_MAP_ID, validateImmersalConfig } from "./immersalConfig.js";
import { createPlacementManager } from "./placementManager.js";
import { MAX_PLACEMENTS, MIN_PLACE_DISTANCE_M } from "./placementConfig.js";
import { requestSensorPermissions } from "./sensorPermissions.js";
import { StabilityTracker } from "./stabilityTracker.js";
import {
  onTrackingStateChange,
  trackingState,
  updateTrackingState,
} from "./trackingState.js";

const PHASE_LABELS = {
  idle: "待命",
  initializing: "初始化中",
  loading_map: "加载地图",
  localizing: "定位中",
  localized: "已定位",
  error: "错误",
};

function formatCoord(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(3);
}

function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return "—";
  if (meters < 1) return `${(meters * 100).toFixed(0)} cm`;
  return `${meters.toFixed(1)} m`;
}

function formatTime(ts) {
  return ts ? new Date(ts).toLocaleTimeString() : "—";
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

/**
 * @param {HTMLElement} rootEl
 * @returns {() => void}
 */
export function bootstrapLocAr(rootEl) {
  const gate = document.getElementById("loc-ar-gate");
  const startBtn = document.getElementById("loc-ar-start-btn");
  const errorMsg = document.getElementById("loc-ar-error-msg");
  const sceneHost = rootEl.querySelector("#loc-ar-scene-host");
  const statusMapId = rootEl.querySelector("#loc-vps-map-id");
  const statusPhase = rootEl.querySelector("#loc-vps-phase");
  const statusPos = rootEl.querySelector("#loc-vps-position");
  const statusAttempts = rootEl.querySelector("#loc-vps-attempts");
  const statusTime = rootEl.querySelector("#loc-vps-time");
  const statusWebxr = rootEl.querySelector("#loc-vps-webxr");
  const statusDiag = rootEl.querySelector("#loc-vps-diag");
  const statusSignalLabel = rootEl.querySelector("#loc-vps-signal-label");
  const signalBars = rootEl.querySelector("#loc-vps-signal");
  const placementList = rootEl.querySelector("#loc-placement-list");
  const metricJitter = rootEl.querySelector("#loc-metric-jitter");
  const metricJump = rootEl.querySelector("#loc-metric-jump");
  const metricDrift = rootEl.querySelector("#loc-metric-drift");
  const placeBtn = rootEl.querySelector("#loc-place-btn");
  const localizeBtn = rootEl.querySelector("#loc-localize-btn");
  const localizeServerBtn = rootEl.querySelector("#loc-localize-server-btn");
  const resetBtn = rootEl.querySelector("#loc-reset-btn");
  const panelToggle = rootEl.querySelector("#loc-metrics-toggle");
  const placeHint = rootEl.querySelector("#loc-place-hint");

  if (!gate || !startBtn || !sceneHost) {
    showBootError("页面结构异常，请刷新重试。");
    return () => {};
  }

  const tracker = new StabilityTracker();
  /** @type {Awaited<ReturnType<typeof createImmersalRuntime>> | null} */
  let runtime = null;
  /** @type {ReturnType<typeof createPlacementManager> | null} */
  let placementManager = null;
  let started = false;
  let starting = false;
  let originPlaced = false;
  let lastCameraPos = null;
  let metricsTimer = 0;
  let localizeStartTime = 0;
  let serverLocalizeTried = false;
  let localizingStuckSince = 0;

  function showError(message) {
    if (errorMsg) errorMsg.textContent = message;
    startBtn.disabled = false;
    startBtn.textContent = "重试";
    gate.classList.remove("is-hidden");
    rootEl.classList.remove("is-loc-ar-active");
    updateTrackingState({ phase: "error", error: message });
  }

  function showPlaceHint(message) {
    if (placeHint) placeHint.textContent = message;
  }

  function renderSignal() {
    if (!signalBars || !statusSignalLabel) return;
    const count = trackingState.localizeCount;
    const level = count > 5 ? 3 : count > 2 ? 2 : count > 0 ? 1 : 0;
    const label =
      count > 5 ? "稳定" : count > 2 ? "良好" : count > 0 ? "弱" : "未定位";
    statusSignalLabel.textContent = label;
    signalBars.querySelectorAll(".loc-signal__bar").forEach((bar, i) => {
      bar.classList.toggle("is-active", i < level);
    });
  }

  function updatePlaceButton() {
    if (!placeBtn || !placementManager) return;
    const count = placementManager.placementCount;
    placeBtn.textContent = `放置 (${count}/${MAX_PLACEMENTS})`;
    placeBtn.disabled =
      !placementManager.canPlace ||
      !placementManager.origin ||
      trackingState.phase !== "localized";
  }

  function renderPlacementList() {
    if (!placementList) return;

    if (!placementManager?.origin) {
      placementList.innerHTML =
        "<p class='loc-placement-list__empty'>等待 Immersal 定位成功…</p>";
      return;
    }

    let html = `<div class="loc-placement-row">
      <span class="loc-placement-row__dot" style="background:#88ccff;border-radius:50%"></span>
      <span class="loc-placement-row__name">定位锚点</span>
      <span class="loc-placement-row__meta">地图原点 (0, 0, 0) · 立方体 + 标签</span>
    </div>`;

    let prev = new THREE.Vector3(0, 0, 0);
    placementManager.placements.forEach((p) => {
      const distFromOrigin = p.position.distanceTo(new THREE.Vector3(0, 0, 0));
      const distFromPrev = p.position.distanceTo(prev);
      html += `<div class="loc-placement-row">
        <span class="loc-placement-row__dot" style="background:#${p.color.toString(16).padStart(6, "0")}"></span>
        <span class="loc-placement-row__name">${p.label}</span>
        <span class="loc-placement-row__meta">
          (${formatCoord(p.position.x)}, ${formatCoord(p.position.y)}, ${formatCoord(p.position.z)})<br>
          距锚点 ${formatDistance(distFromOrigin)} · 距上一点 ${formatDistance(distFromPrev)}
        </span>
      </div>`;
      prev = p.position.clone();
    });

    placementList.innerHTML = html;
    updatePlaceButton();
  }

  function renderStatus() {
    if (statusMapId) statusMapId.textContent = String(IMMERSAL_MAP_ID);
    if (statusPhase) {
      statusPhase.textContent = PHASE_LABELS[trackingState.phase] || trackingState.phase;
    }
    if (statusPos && trackingState.position) {
      const { x, y, z } = trackingState.position;
      statusPos.textContent = `${formatCoord(x)}, ${formatCoord(y)}, ${formatCoord(z)}`;
    } else if (statusPos) {
      statusPos.textContent = "—";
    }
    if (statusTime) statusTime.textContent = formatTime(trackingState.lastLocalizedAt);
    if (statusAttempts) {
      statusAttempts.textContent = String(trackingState.localizeCount);
    }
    if (statusWebxr) {
      statusWebxr.textContent = trackingState.webxrSupported ? "支持" : "回退模式";
    }
    if (statusDiag && runtime?.immersal) {
      const d = getImmersalDiagnostics(runtime.immersal);
      statusDiag.textContent = `相机 ${d.cameraSize} · 视频状态 ${d.videoState} · 定位中 ${d.localizing ? "是" : "否"}`;
    } else if (statusDiag) {
      statusDiag.textContent = "—";
    }
    renderSignal();
    renderPlacementList();
  }

  function renderMetrics() {
    if (!metricJitter || !metricJump || !metricDrift) return;
    const m = tracker.getMetrics();
    metricJitter.textContent =
      m.anchorScreenJitter != null ? `${m.anchorScreenJitter.toFixed(1)} px` : "—";
    metricJump.textContent =
      m.poseJump != null ? `${m.poseJump.toFixed(2)} m` : "—";
    metricDrift.textContent =
      m.maxDrift != null ? `${m.maxDrift.toFixed(1)} px` : "—";
  }

  const unsubTracking = onTrackingStateChange(() => {
    renderStatus();
    renderMetrics();
  });

  function pollTracking() {
    if (!runtime) return;

    const localized = runtime.isLocalized();
    const counter = runtime.immersal.localization.counter;
    const { localizing } = runtime.immersal.localization;

    if (localizing) {
      if (!localizingStuckSince) localizingStuckSince = Date.now();
      else if (Date.now() - localizingStuckSince > 4000) {
        runtime.immersal.localization.localizing = false;
        localizingStuckSince = 0;
      }
    } else {
      localizingStuckSince = 0;
    }

    if (localized) {
      const pos = runtime.camera.position;
      if (lastCameraPos) {
        const jump = pos.distanceTo(lastCameraPos);
        if (jump > 0.01) tracker.onPoseJump(jump);
      }
      lastCameraPos = pos.clone();

      updateTrackingState({
        phase: "localized",
        localizeCount: counter,
        lastLocalizedAt: Date.now(),
        position: { x: pos.x, y: pos.y, z: pos.z },
        error: null,
      });
      tracker.onTrackingUpdate(counter);

      if (!originPlaced && placementManager) {
        placementManager.setOriginAtAnchor();
        originPlaced = true;
        showPlaceHint("定位成功！已在定位点放置 AR 内容。");
        renderPlacementList();
        updatePlaceButton();
      }
    } else if (counter > 0) {
      updateTrackingState({
        phase: "localizing",
        localizeCount: counter,
      });
    } else if (localizeStartTime > 0) {
      const elapsed = Date.now() - localizeStartTime;
      if (elapsed > 15000 && elapsed < 16000) {
        showPlaceHint(
          "仍未定位成功：请确认你在 Map 148542 建图现场，并缓慢左右扫描墙面与走廊特征。",
        );
      }
      if (elapsed > 25000 && !serverLocalizeTried && runtime.immersal) {
        serverLocalizeTried = true;
        showPlaceHint("正在尝试云端定位…");
        runtime.immersal.localizeServerAsync().catch(() => {
          showPlaceHint("云端定位也未成功，请换角度重试或点击「触发定位」。");
        });
      }
    }

    if (placementManager && runtime.camera) {
      tracker.tick(runtime.camera, placementManager.getEntities(), 0);
      renderMetrics();
    }

    if (statusDiag && runtime.immersal) {
      const d = getImmersalDiagnostics(runtime.immersal);
      statusDiag.textContent = `相机 ${d.cameraSize} · 视频状态 ${d.videoState} · 定位中 ${d.localizing ? "是" : "否"}`;
    }
  }

  function onPlace() {
    showPlaceHint("");
    if (errorMsg) errorMsg.textContent = "";

    if (trackingState.phase !== "localized" || !runtime) {
      showPlaceHint("尚未完成定位，请对准已建图区域。");
      return;
    }

    if (!placementManager?.origin) {
      showPlaceHint("等待定位锚点…");
      return;
    }

    if (!placementManager.canPlace) {
      showPlaceHint("已放置 4 个 AR 点。");
      return;
    }

    const camPos = new THREE.Vector3();
    runtime.camera.getWorldPosition(camPos);
    camPos.y = 0;

    const lastPlaced =
      placementManager.placements.length > 0
        ? placementManager.placements[placementManager.placements.length - 1].position
        : new THREE.Vector3(0, 0, 0);

    const dist = camPos.distanceTo(lastPlaced);
    if (dist < MIN_PLACE_DISTANCE_M) {
      showPlaceHint(
        `距上一点仅 ${formatDistance(dist)}，请移动 ${MIN_PLACE_DISTANCE_M}m 以上再放置。`,
      );
      return;
    }

    placementManager.placeAt(camPos);
    showPlaceHint(`已放置 ${placementManager.placementCount}/${MAX_PLACEMENTS}`);
    renderPlacementList();
    updatePlaceButton();
  }

  function onReset() {
    showPlaceHint("");
    if (errorMsg) errorMsg.textContent = "";

    if (!placementManager || trackingState.phase !== "localized") {
      showPlaceHint("定位未完成，无法重置。");
      return;
    }

    placementManager.resetAnchor();
    originPlaced = true;
    tracker.resetSession();
    lastCameraPos = null;
    showPlaceHint("已重置锚点内容。");
    renderPlacementList();
    updatePlaceButton();
  }

  async function triggerDeviceLocalize() {
    if (!runtime?.immersal) return;
    showPlaceHint("正在触发设备端定位…");
    try {
      await runtime.immersal.localizeDeviceAsync();
      showPlaceHint("设备端定位成功。");
    } catch {
      showPlaceHint("设备端定位失败，可尝试「云端定位」或换角度扫描。");
    }
  }

  async function triggerServerLocalize() {
    if (!runtime?.immersal) return;
    showPlaceHint("正在触发云端定位…");
    try {
      await runtime.immersal.localizeServerAsync();
      showPlaceHint("云端定位成功。");
    } catch {
      showPlaceHint("云端定位失败，请确认在建图区域且光线充足。");
    }
  }

  async function startExperience() {
    if (starting || started) return;

    const configError = validateImmersalConfig();
    if (configError) {
      showBootError(configError);
      return;
    }

    starting = true;
    if (errorMsg) errorMsg.textContent = "";
    startBtn.disabled = true;
    startBtn.textContent = "加载中…";

    try {
      setBootStatus("请求传感器权限…");
      await requestSensorPermissions();

      setBootStatus("检测 WebXR…");
      const webxrSupported = await checkWebXRSupport();
      updateTrackingState({ webxrSupported, phase: "initializing" });

      setBootStatus("正在初始化 Immersal SDK…");
      runtime = await createImmersalRuntime(sceneHost);
      updateTrackingState({ phase: "loading_map" });

      placementManager = createPlacementManager(runtime.scene);

      gate.classList.add("is-hidden");
      rootEl.classList.add("is-loc-ar-active");

      setBootStatus("正在启动定位…", true);
      runtime.startRenderLoop();

      // Kick off an explicit localize attempt once the camera is ready.
      runtime.immersal.localizeDeviceAsync().catch(() => {});

      metricsTimer = window.setInterval(pollTracking, 100);
      localizeStartTime = Date.now();
      serverLocalizeTried = false;

      started = true;
      updateTrackingState({ phase: "localizing" });
      showPlaceHint("请缓慢扫描周围环境以完成 VPS 定位…");
      updatePlaceButton();
    } catch (err) {
      console.error("[loc-ar]", err);
      started = false;
      if (runtime) {
        await runtime.destroy();
        runtime = null;
      }
      showError(err?.message || "启动失败，请检查 HTTPS、权限与 Token 后重试。");
    } finally {
      starting = false;
      if (!started) {
        startBtn.disabled = false;
        startBtn.textContent = "重试";
      }
    }
  }

  startBtn.addEventListener("click", startExperience);
  localizeBtn?.addEventListener("click", triggerDeviceLocalize);
  localizeServerBtn?.addEventListener("click", triggerServerLocalize);
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
    unsubTracking();
    if (metricsTimer) clearInterval(metricsTimer);
    placementManager?.clear();
    runtime?.destroy();
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
