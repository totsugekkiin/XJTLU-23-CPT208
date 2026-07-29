/** 默认测试地图（单地图模式或未指定时使用） */
export const DEFAULT_MAP_ID = 148753;

/**
 * 多地图 AR 配置：每张 Immersal 地图可有独立锚点
 * - mapId: Immersal 地图 ID
 * - label: 显示名称
 * - anchors: 该地图坐标系下的模型锚点
 */
export const AR_MAP_PROFILES = [
  {
    mapId: 148753,
    label: "Part 1",
    anchors: [
      {
        id: "bamboo-notice",
        label: "阊门竹简",
        type: "bamboo-notice",
        url: "/models/bamboo-notice-ar.glb",
        content: "modern",
        position: [2.4187, -0.439, -1.2079],
        rotation: [0, -0.5203, 0],
        scale: [1.3485, 1.3339, 2.2],
      },
    ],
  },
  {
    mapId: 149877,
    label: "Part 2",
    anchors: [
      {
        id: "bamboo-notice",
        label: "阊门竹简 1",
        type: "bamboo-notice",
        url: "/models/bamboo-notice-ar.glb",
        content: "ming-qing",
        position: [0.8467, -0.3162, 3.8729],
        rotation: [3.1416, -0.9895, 3.1416],
        scale: [1.5421, 1.4866, 1],
      },
      {
        id: "bamboo-notice-2",
        label: "阊门竹简 2",
        type: "bamboo-notice",
        url: "/models/bamboo-notice-ar.glb",
        content: "southern-song",
        position: [-1.8524, -0.3162, 7.5703],
        rotation: [3.1416, -0.9895, 3.1416],
        scale: [1.5421, 1.4866, 1],
      },
    ],
  },
  {
    mapId: 149878,
    label: "Part 3",
    anchors: [
      {
        id: "bamboo-notice",
        label: "阊门竹简 1",
        type: "bamboo-notice",
        url: "/models/bamboo-notice-ar.glb",
        content: "tang",
        position: [0.8032, -0.61, 4.6908],
        rotation: [3.1416, -0.1139, 3.1416],
        scale: [1, 1, 1],
      },
      {
        id: "bamboo-notice-2",
        label: "阊门竹简 2",
        type: "bamboo-notice",
        url: "/models/bamboo-notice-ar.glb",
        content: "spring-autumn",
        position: [-2.9579, -0.6099, -0.8632],
        rotation: [0, 0.2169, 0],
        scale: [1, 1, 1],
      },
    ],
  },
];

export function getAllMapIds() {
  return AR_MAP_PROFILES.map((profile) => profile.mapId);
}

const MAP_ID_ALIASES = new Map();

function normalizeMapId(mapId) {
  const id = Number(mapId);
  return MAP_ID_ALIASES.get(id) ?? id;
}

export function getMapProfile(mapId) {
  const id = normalizeMapId(mapId);
  return AR_MAP_PROFILES.find((profile) => profile.mapId === id) ?? null;
}

export function getAnchorsForMap(mapId) {
  return getMapProfile(mapId)?.anchors ?? [];
}

export function getMapProfilesForIds(mapIds) {
  const idSet = new Set(mapIds.map(normalizeMapId));
  return AR_MAP_PROFILES.filter((profile) => idSet.has(profile.mapId));
}

export function resolveActiveMapIds(options = {}) {
  const search = options.search ?? (typeof window !== "undefined" ? window.location.search : "");
  const selectedValue = options.selectedValue ?? "all";
  const params = new URLSearchParams(search);

  if (params.has("map")) {
    const id = normalizeMapId(params.get("map"));
    if (Number.isFinite(id)) return [id];
  }

  if (params.has("maps")) {
    const ids = params
      .get("maps")
      .split(",")
      .map((part) => normalizeMapId(part.trim()))
      .filter(Number.isFinite);
    if (ids.length > 0) return ids;
  }

  if (selectedValue !== "all") {
    const id = normalizeMapId(selectedValue);
    if (Number.isFinite(id)) return [id];
  }

  return getAllMapIds();
}

export function formatMapIdList(mapIds) {
  return mapIds.join(", ");
}

/** @deprecated 使用 DEFAULT_MAP_ID 或 resolveActiveMapIds */
export const IMMERSAL_MAP_ID = DEFAULT_MAP_ID;

/** @deprecated 使用 getAnchorsForMap(mapId) */
export const AR_ANCHORS = getAnchorsForMap(DEFAULT_MAP_ID);
