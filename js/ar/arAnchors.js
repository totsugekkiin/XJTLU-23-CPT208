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
        id: "bamboo-notice",
        type: "bamboo-notice",
        label: "阊门竹简",
        url: "/models/bamboo-notice-ar.glb",
        content: "spring-autumn",
        position: [0.2061, -0.0643, 0.1626],
        rotation: [0, 0, 0],
        scale: [0.6672, 0.6672, 0.6672],
      },
    ],
  },
  {
    mapId: 149467,
    label: "小悬眼（新扫描）",
    anchors: [
      {
        id: "small-opening-portal",
        type: "portal",
        label: "小悬眼 Portal（20×26×40 cm）",
        // 新点云中悬眼入口面的初始估计；现场只需微调位置和旋转。
        position: [0.0147, -0.1179, 0.3236],
        // Portal 本地 +X 朝向观察者，-X 穿过 40 cm 墙体进入虚拟场景。
        rotation: [0.1085, 1.3233, -0.1044],
        // [X 墙深, Y 洞口高度, Z 洞口宽度]，单位为米。
        scale: [0.4, 0.26, 0.2],
        content: "calibration-grid",
      },
    ],
  },
  {
    mapId: 148753,
    label: "Map 148753",
    anchors: [
      {
        id: "bamboo-notice",
        type: "bamboo-notice",
        label: "阊门竹简",
        url: "/models/bamboo-notice-ar.glb",
        content: "spring-autumn",
        position: [2.3519, -0.439, -1.2461],
        rotation: [0, -0.5203, 0],
        scale: [1.3485, 1.3339, 2.2],
      },
    ],
  },
  {
    mapId: 148755,
    label: "城墙大悬眼",
    anchors: [
      {
        id: "bamboo-notice",
        type: "bamboo-notice",
        label: "阊门竹简",
        url: "/models/bamboo-notice-ar.glb",
        content: "spring-autumn",
        position: [-0.004, -0.1412, 0.6506],
        rotation: [-0.3146, 0, 0],
        scale: [0.17, 0.17, 0.17],
      },
    ],
  },
  {
    mapId: 148756,
    label: "城墙垛口",
    anchors: [
      {
        id: "bamboo-notice",
        type: "bamboo-notice",
        label: "阊门竹简",
        url: "/models/bamboo-notice-ar.glb",
        content: "spring-autumn",
        position: [15.5465, 0.645, 36.3138],
        rotation: [0, 0.4142, 0],
        scale: [0.85, 0.85, 1.7],
      },
    ],
  },
];

export function getAllMapIds() {
  return AR_MAP_PROFILES.map((profile) => profile.mapId);
}

const MAP_ID_ALIASES = new Map([
  // 148752 是同一悬眼的旧扫描；旧链接自动进入新地图。
  [148752, 149467],
]);

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
