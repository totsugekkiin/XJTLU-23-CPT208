/** 默认测试地图（单地图模式或未指定时使用） */
export const DEFAULT_MAP_ID = 148688;

/**
 * 多地图 AR 配置：每张 Immersal 地图可有独立锚点
 * - mapId: Immersal 地图 ID
 * - label: 显示名称
 * - anchors: 该地图坐标系下的模型锚点
 */
export const AR_MAP_PROFILES = [
  {
    mapId: 148688,
    label: "Map 148688",
    anchors: [
      {
        id: "vast-land",
        label: "The Vast Land",
        url: "/models/the_vast_land_no_background.glb",
        position: [0.2061, -0.0643, 0.1626],
        rotation: [0, 0, 0],
        scale: [0.05, 0.05, 0.05],
      },
    ],
  },
  {
    mapId: 148752,
    label: "小悬眼",
    anchors: [
      {
        id: "vast-land",
        label: "The Vast Land",
        url: "/models/the_vast_land_no_background.glb",
        position: [2.8569, 1.0034, 22.1759],
        rotation: [0, 0.1613, 0],
        scale: [0.05, 0.05, 0.05],
      },
    ],
  },
  {
    mapId: 148753,
    label: "Map 148753",
    anchors: [
      {
        id: "vast-land",
        label: "The Vast Land",
        url: "/models/the_vast_land_no_background.glb",
        position: [2.8751, -1.3072, 4.3949],
        rotation: [0, 0, 0],
        scale: [0.5, 0.5, 0.5],
      },
    ],
  },
  {
    mapId: 148755,
    label: "城墙大悬眼",
    anchors: [
      {
        id: "vast-land",
        label: "The Vast Land",
        url: "/models/the_vast_land_no_background.glb",
        position: [-0.004, -0.1412, 0.6506],
        rotation: [-0.3146, 0, 0],
        scale: [0.05, 0.05, 0.05],
      },
    ],
  },
  {
    mapId: 148756,
    label: "城墙垛口",
    anchors: [
      {
        id: "vast-land",
        label: "The Vast Land",
        url: "/models/the_vast_land_no_background.glb",
        position: [15.5465, 0.645, 36.3138],
        rotation: [0, 0.4142, 0],
        scale: [0.25, 0.25, 0.5],
      },
    ],
  },
];

export function getAllMapIds() {
  return AR_MAP_PROFILES.map((profile) => profile.mapId);
}

export function getMapProfile(mapId) {
  const id = Number(mapId);
  return AR_MAP_PROFILES.find((profile) => profile.mapId === id) ?? null;
}

export function getAnchorsForMap(mapId) {
  return getMapProfile(mapId)?.anchors ?? [];
}

export function getMapProfilesForIds(mapIds) {
  const idSet = new Set(mapIds.map(Number));
  return AR_MAP_PROFILES.filter((profile) => idSet.has(profile.mapId));
}

export function resolveActiveMapIds(options = {}) {
  const search = options.search ?? (typeof window !== "undefined" ? window.location.search : "");
  const selectedValue = options.selectedValue ?? "all";
  const params = new URLSearchParams(search);

  if (params.has("map")) {
    const id = Number(params.get("map"));
    if (Number.isFinite(id)) return [id];
  }

  if (params.has("maps")) {
    const ids = params
      .get("maps")
      .split(",")
      .map((part) => Number(part.trim()))
      .filter(Number.isFinite);
    if (ids.length > 0) return ids;
  }

  if (selectedValue !== "all") {
    const id = Number(selectedValue);
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
