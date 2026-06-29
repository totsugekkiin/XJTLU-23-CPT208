import "aframe";
import "@ar-js-org/ar.js/aframe/build/aframe-ar.js";

import { ANCHOR_POINTS } from "./anchorConfig.js";
import {
  calibrateToAnchor,
  loadCalibration,
} from "./calibration.js";
import { spawnAnchorEntities, refreshAnchorPositions } from "./components/anchorSpawner.js";
import {
  accuracyToSignal,
  bearingBetween,
  formatCoord,
  formatDistance,
  haversineDistance,
} from "./geoUtils.js";
import { gpsState, onGpsStateChange, updateGpsState } from "./gpsState.js";
import { StabilityTracker } from "./stabilityTracker.js";

loadCalibration();

/**
 * @param {HTMLElement} rootEl
 * @returns {() => void}
 */
export function bootstrapLocAr(rootEl) {
  const overlay = rootEl.querySelector("#loc-ar-start-overlay");
  const startBtn = rootEl.querySelector("#loc-ar-start-btn");
  const errorMsg = rootEl.querySelector("#loc-ar-error-msg");
  const sceneEl = rootEl.querySelector("#loc-ar-scene");
  const statusLat = rootEl.querySelector("#loc-gps-lat");
  const statusLng = rootEl.querySelector("#loc-gps-lng");
  const statusAcc = rootEl.querySelector("#loc-gps-acc");
  const statusTime = rootEl.querySelector("#loc-gps-time");
  const signalBars = rootEl.querySelector("#loc-gps-signal");
  const signalLabel = rootEl.querySelector("#loc-gps-signal-label");
  const anchorList = rootEl.querySelector("#loc-anchor-list");
  const metricJitter = rootEl.querySelector("#loc-metric-jitter");
  const metricJump = rootEl.querySelector("#loc-metric-jump");
  const metricDrift = rootEl.querySelector("#loc-metric-drift");
  const recalibrateBtn = rootEl.querySelector("#loc-recalibrate-btn");
  const panelToggle = rootEl.querySelector("#loc-metrics-toggle");

  const tracker = new StabilityTracker();
  /** @type {HTMLElement[]} */
  let anchorEntities = [];
  let lastGpsPos = null;
  let started = false;

  function showError(message) {
    errorMsg.textContent = message;
    startBtn.disabled = false;
    startBtn.textContent = "重试";
  }

  function renderSignal(accuracy) {
    const { level, label } = accuracyToSignal(accuracy);
    signalLabel.textContent = label;
    signalBars.querySelectorAll(".loc-signal__bar").forEach((bar, i) => {
      bar.classList.toggle("is-active", i < level);
    });
  }

  function renderStatus() {
    statusLat.textContent = formatCoord(gpsState.lat);
    statusLng.textContent = formatCoord(gpsState.lng);
    statusAcc.textContent =
      gpsState.accuracy != null ? `±${gpsState.accuracy.toFixed(1)} m` : "—";
    statusTime.textContent = gpsState.timestamp
      ? new Date(gpsState.timestamp).toLocaleTimeString()
      : "—";
    renderSignal(gpsState.accuracy);

    if (gpsState.lat == null || gpsState.lng == null) {
      anchorList.innerHTML = "<p class='loc-anchor-list__empty'>等待 GPS…</p>";
      return;
    }

    const user = { lat: gpsState.lat, lng: gpsState.lng };
    anchorList.innerHTML = ANCHOR_POINTS.map((anchor) => {
      const dist = haversineDistance(user, anchor);
      const bearing = bearingBetween(user, anchor);
      return `<div class="loc-anchor-row">
        <span class="loc-anchor-row__dot" style="background:${anchor.color}"></span>
        <span class="loc-anchor-row__name">${anchor.label}</span>
        <span class="loc-anchor-row__meta">${formatDistance(dist)} · ${bearing.toFixed(0)}°</span>
      </div>`;
    }).join("");
  }

  function renderMetrics() {
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
  }

  function onSceneTick() {
    if (!started || !sceneEl?.camera) return;
    const cameraEl = sceneEl.querySelector("[gps-new-camera]");
    const threeCamera = cameraEl?.getObject3D("camera");
    if (!threeCamera) return;
    tracker.tick(threeCamera, anchorEntities, gpsState.speed ?? 0);
    renderMetrics();
  }

  function bindGpsCamera() {
    const cameraEl = sceneEl.querySelector("[gps-new-camera]");
    if (!cameraEl) return;
    cameraEl.addEventListener("gps-camera-update-position", onGpsCameraUpdate);
    return () => {
      cameraEl.removeEventListener("gps-camera-update-position", onGpsCameraUpdate);
    };
  }

  let unbindGpsCamera = null;

  function onRecalibrate() {
    if (gpsState.lat == null || gpsState.lng == null) {
      errorMsg.textContent = "尚无 GPS 数据，无法重新定位。";
      return;
    }
    errorMsg.textContent = "";

    const user = { lat: gpsState.lat, lng: gpsState.lng };
    let nearest = ANCHOR_POINTS[0];
    let nearestDist = haversineDistance(user, nearest);
    ANCHOR_POINTS.forEach((anchor) => {
      const d = haversineDistance(user, anchor);
      if (d < nearestDist) {
        nearest = anchor;
        nearestDist = d;
      }
    });

    calibrateToAnchor(user, nearest);
    refreshAnchorPositions();
    tracker.resetSession();
    lastGpsPos = null;

    recalibrateBtn.textContent = "已校准";
    setTimeout(() => {
      recalibrateBtn.textContent = "重新定位";
    }, 1500);
  }

  async function startExperience() {
    errorMsg.textContent = "";
    startBtn.disabled = true;
    startBtn.textContent = "初始化中…";

    try {
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== "granted") {
          throw new Error("需要允许设备方向权限以同步 AR 视角。");
        }
      }

      sceneEl.classList.remove("is-hidden");
      overlay.classList.add("is-hidden");
      rootEl.classList.add("is-loc-ar-active");
      started = true;

      anchorEntities = spawnAnchorEntities(sceneEl);
      unbindGpsCamera = bindGpsCamera() ?? null;
      sceneEl.addEventListener("tick", onSceneTick);
    } catch (err) {
      console.error("[loc-ar]", err);
      showError(err.message || "启动失败，请检查权限后重试。");
    }
  }

  startBtn.addEventListener("click", startExperience);
  recalibrateBtn.addEventListener("click", onRecalibrate);
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
    sceneEl?.removeEventListener("tick", onSceneTick);
    started = false;
  };
}

// Auto-bootstrap when loaded as entry module
const root = document.getElementById("loc-ar-app");
if (root) {
  bootstrapLocAr(root);
}
