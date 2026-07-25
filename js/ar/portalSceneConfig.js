export const PORTAL_SOURCE_SCENE = Object.freeze({
  url: "/models/changgate-courtyard.sog",
  gaussians: 916617,
});

export const PORTAL_RUNTIME_SCENE = Object.freeze({
  url: "/models/changgate-courtyard-cropped.sog",
  gaussians: 266512,
  megabytes: 3.2,
});

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
