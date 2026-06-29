const EARTH_RADIUS_M = 6_371_000;

/** @param {number} accuracy meters, from GeolocationPosition.coords.accuracy */
export function accuracyToSignal(accuracy) {
  if (accuracy == null || Number.isNaN(accuracy)) return { level: 0, label: "无信号" };
  if (accuracy <= 8) return { level: 3, label: "强" };
  if (accuracy <= 20) return { level: 2, label: "中" };
  return { level: 1, label: "弱" };
}

export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

/** Haversine distance in meters. */
export function haversineDistance(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Geographic bearing from a to b in degrees [0, 360). */
export function bearingBetween(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Short-range ENU offset in meters (east, north). */
export function latLngToEnu(origin, point) {
  const latRad = toRad(origin.lat);
  const east =
    toRad(point.lng - origin.lng) * Math.cos(latRad) * EARTH_RADIUS_M;
  const north = toRad(point.lat - origin.lat) * EARTH_RADIUS_M;
  return { east, north };
}

export function formatCoord(value, digits = 6) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return "—";
  if (meters < 1000) return `${meters.toFixed(1)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
