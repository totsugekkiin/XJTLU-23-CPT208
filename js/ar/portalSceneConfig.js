export const DEFAULT_PORTAL_SCENE_ID = "song";

// The Gaussian captures are Z-up. The renderer applies a 180° rotation around
// X to every scan, so physical elevation in editor world space is -Z. Keep
// this separate from the legacy serialized camera-yaw axis: changing that
// older axis would reinterpret the locked dynasty view data.
export const PORTAL_NAVIGATION_UP = Object.freeze([0, 0, -1]);

export const PORTAL_SCENES = Object.freeze({
  song: Object.freeze({
    id: "song",
    label: "宋朝",
    dynasty: "宋朝",
    source: Object.freeze({
      url: "/models/changgate-courtyard.sog",
      gaussians: 916617,
      megabytes: 10.5,
    }),
    runtime: Object.freeze({
      url: "/models/changgate-courtyard-cropped.sog",
      gaussians: 266512,
      megabytes: 3.2,
    }),
  }),
  ming: Object.freeze({
    id: "ming",
    label: "明朝",
    dynasty: "明朝",
    view: Object.freeze({
      x: 0.44,
      y: 12.648,
      z: -1.226,
      yaw: 244.3,
      pitch: 89,
      roll: 0,
      fov: 75,
    }),
    crop: Object.freeze({
      cx: -29.8,
      cy: -0.7,
      cz: 12.433,
      sx: 57.8,
      sy: 42.905,
      sz: 43.02,
      rx: 0,
      ry: 0,
      rz: 0,
    }),
    source: Object.freeze({
      url: "/models/changgate-ming.sog",
      gaussians: 832036,
      megabytes: 9.5,
    }),
    runtime: Object.freeze({
      url: "/models/changgate-ming-cropped.sog",
      gaussians: 604979,
      megabytes: 6.8,
      bounds: Object.freeze({
        min: Object.freeze([-58.7, -22.153, -9.078]),
        max: Object.freeze([-0.9, 20.753, 33.943]),
      }),
    }),
  }),
  qing: Object.freeze({
    id: "qing",
    label: "清朝",
    dynasty: "清朝",
    view: Object.freeze({
      x: -0.787,
      y: -0.294,
      z: 0.682,
      yaw: 28.587,
      pitch: 55.885,
      roll: -31.4,
      fov: 73,
    }),
    crop: Object.freeze({
      cx: 0,
      cy: 1.9,
      cz: -3.5,
      sx: 15.6,
      sy: 8.6,
      sz: 13.1,
      rx: 158.5,
      ry: 32.5,
      rz: 39,
    }),
    source: Object.freeze({
      url: "/models/changgate-qing.sog",
      gaussians: 799722,
      megabytes: 9.1,
    }),
    runtime: Object.freeze({
      url: "/models/changgate-qing-cropped.sog",
      gaussians: 607458,
      megabytes: 6.8,
      bounds: Object.freeze({
        min: Object.freeze([-9.323, -8.743, -14.16]),
        max: Object.freeze([9.323, 12.543, 7.16]),
      }),
    }),
  }),
});

export function getPortalScene(sceneId = DEFAULT_PORTAL_SCENE_ID) {
  const requestedId = String(sceneId || "")
    .trim()
    .toLowerCase();
  const normalized =
    requestedId === "default" ? DEFAULT_PORTAL_SCENE_ID : requestedId;
  return (
    PORTAL_SCENES[normalized] ??
    Object.values(PORTAL_SCENES).find(
      (scene) => scene.dynasty === sceneId || scene.label === sceneId,
    ) ??
    PORTAL_SCENES[DEFAULT_PORTAL_SCENE_ID]
  );
}

export const PORTAL_SOURCE_SCENE =
  PORTAL_SCENES[DEFAULT_PORTAL_SCENE_ID].source;

export const PORTAL_RUNTIME_SCENE =
  PORTAL_SCENES[DEFAULT_PORTAL_SCENE_ID].runtime;

export const PORTAL_RUNTIME_STORAGE_KEY =
  "changgate.portal-runtime-config.v1";

export const PORTAL_TARGET_WIDTH_MM = 260;
export const PORTAL_OPENING_WIDTH = 200 / PORTAL_TARGET_WIDTH_MM;
export const PORTAL_OPENING_HEIGHT = 260 / PORTAL_TARGET_WIDTH_MM;

export const PORTAL_VIEW_PRESET = Object.freeze({
  x: -0.508,
  y: 0.149,
  z: -0.106,
  yaw: 5.053,
  pitch: 33.08,
  roll: -7.6,
  fov: 75,
});

const LEGACY_PORTAL_VIEW_PRESET = Object.freeze({
  x: -1.05,
  y: -2.787,
  z: 0.891,
  yaw: 11.293,
  pitch: 17.08,
  roll: -7.6,
  fov: 75,
});
const PORTAL_VIEW_KEYS = Object.freeze([
  "x",
  "y",
  "z",
  "yaw",
  "pitch",
  "roll",
  "fov",
]);

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
  rx: 0,
  ry: 0,
  rz: 0,
});

export const PORTAL_WORLD_SCALE = 1000 / 260;
export const PORTAL_REFERENCE_VIEW_DISTANCE = 600 / 260;
export const PORTAL_WALL_DEPTH = 400 / 260;
export const PORTAL_PERSPECTIVE_MODES = Object.freeze({
  PHYSICAL: "physical",
  COMPOSITION: "composition",
});
// On wide screens the editor's central frame is 59.8% of the viewport height.
// Saving its effective FOV keeps the selected content stable across devices.
export const PORTAL_EDITOR_FRAME_HEIGHT_RATIO = 0.598;

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function matchesPortalView(value, preset) {
  return PORTAL_VIEW_KEYS.every((key) => {
    const current = finiteNumber(value?.[key], Number.NaN);
    return Math.abs(current - preset[key]) < 1e-4;
  });
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

export function resolvePortalPerspectivePose({
  eye,
  referenceEye,
  direction = -1,
  virtualPortalDistance,
}) {
  // MindAR expresses the target width as one unit. Calibrating that physical
  // space to the editor-selected view preserves the chosen composition at the
  // reference distance while keeping subsequent movement metrically linear.
  const farPlaneZ = (direction < 0 ? -1 : 1) * PORTAL_WALL_DEPTH;
  const referencePlaneDistance = Number(referenceEye?.z) - farPlaneZ;
  const eyePlaneDistance = Number(eye?.z) - farPlaneZ;
  const virtualDistance = Number(virtualPortalDistance);
  if (
    !Number.isFinite(referencePlaneDistance) ||
    !Number.isFinite(eyePlaneDistance) ||
    !Number.isFinite(virtualDistance) ||
    referencePlaneDistance <= 0 ||
    eyePlaneDistance <= 0 ||
    virtualDistance <= 0
  ) {
    return null;
  }

  const physicalToVirtualScale =
    virtualDistance / referencePlaneDistance;
  const deltaX =
    (Number(eye?.x) - Number(referenceEye?.x)) *
    physicalToVirtualScale;
  const deltaY =
    (Number(eye?.y) - Number(referenceEye?.y)) *
    physicalToVirtualScale;
  const deltaZ =
    (Number(eye?.z) - Number(referenceEye?.z)) *
    physicalToVirtualScale;
  if (![deltaX, deltaY, deltaZ].every(Number.isFinite)) return null;

  return {
    deltaX,
    deltaY,
    deltaZ,
    distance: eyePlaneDistance * physicalToVirtualScale,
    physicalToVirtualScale,
    eyeDistanceMm: Number(eye.z) * PORTAL_TARGET_WIDTH_MM,
    farPlaneDistanceMm: eyePlaneDistance * PORTAL_TARGET_WIDTH_MM,
  };
}

export function normalizePortalCrop(value, fallback = PORTAL_CROP_BOX) {
  return {
    cx: finiteNumber(value?.cx, fallback.cx),
    cy: finiteNumber(value?.cy, fallback.cy),
    cz: finiteNumber(value?.cz, fallback.cz),
    sx: Math.max(0.5, finiteNumber(value?.sx, fallback.sx)),
    sy: Math.max(0.5, finiteNumber(value?.sy, fallback.sy)),
    sz: Math.max(0.5, finiteNumber(value?.sz, fallback.sz)),
    rx: finiteNumber(value?.rx, fallback.rx ?? 0),
    ry: finiteNumber(value?.ry, fallback.ry ?? 0),
    rz: finiteNumber(value?.rz, fallback.rz ?? 0),
  };
}

export function portalCropBounds(crop) {
  const normalized = normalizePortalCrop(crop);
  const halfExtents = [
    normalized.sx / 2,
    normalized.sy / 2,
    normalized.sz / 2,
  ];
  const radians = [normalized.rx, normalized.ry, normalized.rz].map(
    (angle) => (angle * Math.PI) / 180,
  );
  const [sx, sy, sz] = radians.map(Math.sin);
  const [cx, cy, cz] = radians.map(Math.cos);
  const rotation = [
    cy * cz,
    sx * sy * cz - cx * sz,
    cx * sy * cz + sx * sz,
    cy * sz,
    sx * sy * sz + cx * cz,
    cx * sy * sz - sx * cz,
    -sy,
    sx * cy,
    cx * cy,
  ];
  const aabbHalfExtents = [0, 1, 2].map(
    (row) =>
      Math.abs(rotation[row * 3]) * halfExtents[0] +
      Math.abs(rotation[row * 3 + 1]) * halfExtents[1] +
      Math.abs(rotation[row * 3 + 2]) * halfExtents[2],
  );
  const center = [normalized.cx, normalized.cy, normalized.cz];
  return {
    center,
    halfExtents,
    rotation: [normalized.rx, normalized.ry, normalized.rz],
    min: center.map((value, index) => value - aabbHalfExtents[index]),
    max: center.map((value, index) => value + aabbHalfExtents[index]),
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
    const view = matchesPortalView(parsed.view, LEGACY_PORTAL_VIEW_PRESET)
      ? { ...PORTAL_VIEW_PRESET }
      : normalizePortalView(parsed.view);
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
