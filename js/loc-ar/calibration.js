const STORAGE_KEY = "loc-ar-calibration";

/** @type {{ latOffset: number, lngOffset: number }} */
export const calibration = {
  latOffset: 0,
  lngOffset: 0,
};

export function loadCalibration() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    calibration.latOffset = Number(data.latOffset) || 0;
    calibration.lngOffset = Number(data.lngOffset) || 0;
  } catch {
    /* ignore */
  }
}

export function saveCalibration() {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      latOffset: calibration.latOffset,
      lngOffset: calibration.lngOffset,
    }),
  );
}

export function resetCalibration() {
  calibration.latOffset = 0;
  calibration.lngOffset = 0;
  saveCalibration();
}

/** Apply calibration offset to anchor coordinates for AR.js placement. */
export function adjustedAnchorCoords(lat, lng) {
  return {
    lat: lat + calibration.latOffset,
    lng: lng + calibration.lngOffset,
  };
}

/**
 * Align current raw GPS to target anchor (stand on anchor when recalibrating).
 * @param {{ lat: number, lng: number }} raw
 * @param {{ lat: number, lng: number }} target
 */
export function calibrateToAnchor(raw, target) {
  calibration.latOffset = raw.lat - target.lat;
  calibration.lngOffset = raw.lng - target.lng;
  saveCalibration();
}
