/** @typedef {'idle' | 'initializing' | 'loading_map' | 'localizing' | 'localized' | 'error'} TrackingPhase */

/** @type {{ phase: TrackingPhase, mapId: number, localizeCount: number, lastLocalizedAt: number | null, error: string | null, webxrSupported: boolean, position: { x: number, y: number, z: number } | null }} */
export const trackingState = {
  phase: "idle",
  mapId: 148539,
  localizeCount: 0,
  lastLocalizedAt: null,
  error: null,
  webxrSupported: false,
  position: null,
};

/** @type {Set<() => void>} */
const listeners = new Set();

export function onTrackingStateChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * @param {Partial<typeof trackingState>} patch
 */
export function updateTrackingState(patch) {
  Object.assign(trackingState, patch);
  listeners.forEach((cb) => cb());
}
