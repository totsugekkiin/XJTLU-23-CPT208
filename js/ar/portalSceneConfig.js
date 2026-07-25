export const PORTAL_SOURCE_SCENE = Object.freeze({
  url: "/models/changgate-courtyard.sog",
  gaussians: 916617,
});

export const PORTAL_RUNTIME_SCENE = Object.freeze({
  url: "/models/changgate-courtyard-cropped.sog",
  gaussians: 266512,
  megabytes: 3.2,
});

export const PORTAL_RUNTIME_STORAGE_KEY =
  "changgate.portal-runtime-config.v1";

export const PORTAL_TARGET_WIDTH_MM = 260;
export const PORTAL_OPENING_WIDTH = 200 / PORTAL_TARGET_WIDTH_MM;
export const PORTAL_OPENING_HEIGHT = 260 / PORTAL_TARGET_WIDTH_MM;

export const PORTAL_VIEW_PRESET = Object.freeze({
  x: -1.05,
  y: -2.787,
  z: 0.891,
  yaw: 11.293,
  pitch: 17.08,
  roll: -7.6,
  fov: 75,
});

export const PORTAL_CROP_BOUNDS = Object.freeze({
  min: Object.freeze([-5.1, -0.65, -13.05]),
  max: Object.freeze([6.7, 17.45, 9.65]),
});

const [cropMinX, cropMinY, cropMinZ] = PORTAL_CROP_BOUNDS.min;
const [cropMaxX, cropMaxY, cropMaxZ] = PORTAL_CROP_BOUNDS.max;

export const PORTAL_CROP_BOX = Object.freeze({
  cx: (cropMinX + cropMaxX) / 2,
  cy: (cropMinY + cropMaxY) / 2,
  cz: (cropMinZ + cropMaxZ) / 2,
  sx: cropMaxX - cropMinX,
  sy: cropMaxY - cropMinY,
  sz: cropMaxZ - cropMinZ,
});

export const PORTAL_WORLD_SCALE = 1000 / 260;
export const PORTAL_REFERENCE_VIEW_DISTANCE = 600 / 260;
export const PORTAL_WALL_DEPTH = 400 / 260;
// On wide screens the editor's central frame is 59.8% of the viewport height.
// Saving its effective FOV keeps the selected content stable across devices.
export const PORTAL_EDITOR_FRAME_HEIGHT_RATIO = 0.598;

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizePortalView(value, fallback = PORTAL_VIEW_PRESET) {
  return {
    x: finiteNumber(value?.x, fallback.x),
    y: finiteNumber(value?.y, fallback.y),
    z: finiteNumber(value?.z, fallback.z),
    yaw: finiteNumber(value?.yaw, fallback.yaw),
    pitch: finiteNumber(value?.pitch, fallback.pitch),
    roll: finiteNumber(value?.roll, fallback.roll),
    fov: Math.min(100, Math.max(30, finiteNumber(value?.fov, fallback.fov))),
  };
}

export function portalFrameFov(
  viewFov,
  frameHeightRatio = PORTAL_EDITOR_FRAME_HEIGHT_RATIO,
) {
  const fullViewTangent = Math.tan(
    (finiteNumber(viewFov, PORTAL_VIEW_PRESET.fov) * Math.PI) / 360,
  );
  const ratio = Math.min(
    1,
    Math.max(0.05, finiteNumber(frameHeightRatio, PORTAL_EDITOR_FRAME_HEIGHT_RATIO)),
  );
  return (
    (Math.atan(fullViewTangent * ratio) * 360) /
    Math.PI
  );
}

export function normalizePortalFov(
  value,
  fallback = portalFrameFov(PORTAL_VIEW_PRESET.fov),
) {
  return Math.min(100, Math.max(5, finiteNumber(value, fallback)));
}

export function normalizePortalCrop(value, fallback = PORTAL_CROP_BOX) {
  return {
    cx: finiteNumber(value?.cx, fallback.cx),
    cy: finiteNumber(value?.cy, fallback.cy),
    cz: finiteNumber(value?.cz, fallback.cz),
    sx: Math.max(0.5, finiteNumber(value?.sx, fallback.sx)),
    sy: Math.max(0.5, finiteNumber(value?.sy, fallback.sy)),
    sz: Math.max(0.5, finiteNumber(value?.sz, fallback.sz)),
  };
}

export function portalCropBounds(crop) {
  const normalized = normalizePortalCrop(crop);
  return {
    min: [
      normalized.cx - normalized.sx / 2,
      normalized.cy - normalized.sy / 2,
      normalized.cz - normalized.sz / 2,
    ],
    max: [
      normalized.cx + normalized.sx / 2,
      normalized.cy + normalized.sy / 2,
      normalized.cz + normalized.sz / 2,
    ],
  };
}

export function readPortalRuntimeConfig() {
  try {
    const serialized = window.localStorage.getItem(
      PORTAL_RUNTIME_STORAGE_KEY,
    );
    if (!serialized) return null;
    const parsed = JSON.parse(serialized);
    if (parsed?.version !== 1) return null;
    const view = normalizePortalView(parsed.view);
    return {
      view,
      crop: normalizePortalCrop(parsed.crop),
      portalFov: normalizePortalFov(
        parsed.portalFov,
        portalFrameFov(view.fov),
      ),
      updatedAt: String(parsed.updatedAt || ""),
    };
  } catch {
    return null;
  }
}

export function savePortalRuntimeConfig({ view, crop, portalFov }) {
  const normalizedView = normalizePortalView(view);
  const config = {
    version: 1,
    view: normalizedView,
    crop: normalizePortalCrop(crop),
    portalFov: normalizePortalFov(
      portalFov,
      portalFrameFov(normalizedView.fov),
    ),
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(
    PORTAL_RUNTIME_STORAGE_KEY,
    JSON.stringify(config),
  );
  return config;
}
