/** Immersal 地图 ID，与 arScene.js 保持一致 */
export const IMMERSAL_MAP_ID = 148753;

/**
 * AR 锚点配置（地图坐标系，单位：米）
 * - position: [x, y, z]
 * - rotation: 欧拉角 [x, y, z]，弧度，Three.js XYZ 顺序
 * - scale: [x, y, z]
 */
export const AR_ANCHORS = [
  {
    id: "vast-land",
    label: "The Vast Land",
    url: "/models/the_vast_land_no_background.glb",
    position: [2.8751, -1.3072, 4.3949],
    rotation: [0, 0, 0],
    scale: [0.5, 0.5, 0.5],
  },
];
