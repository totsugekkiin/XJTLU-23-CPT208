/** Shared GPS state for UI and stability tracker. */

/** @type {{
 *   lat: number | null,
 *   lng: number | null,
 *   accuracy: number | null,
 *   rawLat: number | null,
 *   rawLng: number | null,
 *   rawAccuracy: number | null,
 *   filtered: boolean,
 *   timestamp: number | null,
 *   speed: number | null,
 * }} */
export const gpsState = {
  lat: null,
  lng: null,
  accuracy: null,
  rawLat: null,
  rawLng: null,
  rawAccuracy: null,
  filtered: false,
  timestamp: null,
  speed: null,
};

/** @type {Set<(state: typeof gpsState) => void>} */
const listeners = new Set();

export function updateGpsState(patch) {
  Object.assign(gpsState, patch);
  listeners.forEach((fn) => fn(gpsState));
}

export function onGpsStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
