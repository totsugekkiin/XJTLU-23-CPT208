import { AR_MAP_PROFILES } from "./arAnchors.js";
import { getBambooNoticeContent } from "../content/changmenExperienceContent.js";

export const AR_FIELD_MAP_WIDTH = 606;
export const AR_FIELD_MAP_HEIGHT = 234;
export const AR_FIELD_MAP_STORAGE_KEY = "changmen-ar-field-map-positions-v1";

export const AR_FIELD_MAP_WINDOW = Object.freeze({
  id: "marker-window",
  type: "window",
  markerLabel: "窗",
  label: "AR 历史窗口",
  areaLabel: "城门窗口",
  fieldMapPosition: Object.freeze([470.1, 215.1]),
});

export function getDefaultFieldMapLocations() {
  let bambooIndex = 0;
  const bambooLocations = AR_MAP_PROFILES.flatMap((profile) =>
    profile.anchors
      .filter((anchor) => anchor.type === "bamboo-notice" && anchor.fieldMapPosition)
      .map((anchor) => {
        bambooIndex += 1;
        return {
          id: `bamboo-${profile.mapId}-${anchor.id}`,
          type: "bamboo",
          markerLabel: String(bambooIndex),
          label: getBambooNoticeContent(anchor.content).label,
          areaLabel: profile.label,
          mapId: profile.mapId,
          anchorId: anchor.id,
          fieldMapPosition: [...anchor.fieldMapPosition],
        };
      }),
  );

  return [
    ...bambooLocations,
    { ...AR_FIELD_MAP_WINDOW, fieldMapPosition: [...AR_FIELD_MAP_WINDOW.fieldMapPosition] },
  ];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeFieldMapPosition(position) {
  if (!Array.isArray(position) || position.length !== 2) return null;
  const x = Number(position[0]);
  const y = Number(position[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [
    Number(clamp(x, 0, AR_FIELD_MAP_WIDTH).toFixed(1)),
    Number(clamp(y, 0, AR_FIELD_MAP_HEIGHT).toFixed(1)),
  ];
}

export function normalizeFieldMapOverrides(value, locations = getDefaultFieldMapLocations()) {
  const source = value?.positions ?? value;
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};

  const knownIds = new Set(locations.map((location) => location.id));
  return Object.fromEntries(
    Object.entries(source)
      .filter(([id]) => knownIds.has(id))
      .map(([id, position]) => [id, normalizeFieldMapPosition(position)])
      .filter(([, position]) => position != null),
  );
}

export function applyFieldMapOverrides(
  locations = getDefaultFieldMapLocations(),
  overrides = {},
) {
  const normalized = normalizeFieldMapOverrides(overrides, locations);
  return locations.map((location) => ({
    ...location,
    fieldMapPosition: normalized[location.id]
      ? [...normalized[location.id]]
      : [...location.fieldMapPosition],
  }));
}

export function readFieldMapOverrides(storage = globalThis?.localStorage) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(AR_FIELD_MAP_STORAGE_KEY);
    return raw ? normalizeFieldMapOverrides(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function createFieldMapPayload(locations) {
  return {
    version: 1,
    positions: Object.fromEntries(
      locations.map((location) => [
        location.id,
        normalizeFieldMapPosition(location.fieldMapPosition),
      ]),
    ),
  };
}

export function saveFieldMapLocations(locations, storage = globalThis?.localStorage) {
  const payload = createFieldMapPayload(locations);
  storage?.setItem(AR_FIELD_MAP_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function getResolvedFieldMapLocations(storage = globalThis?.localStorage) {
  const defaults = getDefaultFieldMapLocations();
  return applyFieldMapOverrides(defaults, readFieldMapOverrides(storage));
}
