/**
 * 走廊 100m 测试锚点（占位坐标，现场实测后替换）。
 * 沿纬度向北约每 33m 一个点（纬度 1° ≈ 111km，0.0003° ≈ 33m）。
 */
export const CORRIDOR_ORIGIN = {
  lat: 31.3151,
  lng: 120.6052,
  label: "走廊起点",
};

/** @type {Array<{ id: string, label: string, lat: number, lng: number, color: string }>} */
export const ANCHOR_POINTS = [
  {
    id: "p0",
    label: "观测点 A",
    lat: 31.3151,
    lng: 120.6052,
    color: "#ff4444",
  },
  {
    id: "p1",
    label: "观测点 B",
    lat: 31.3154,
    lng: 120.6052,
    color: "#44aa44",
  },
  {
    id: "p2",
    label: "观测点 C",
    lat: 31.3157,
    lng: 120.6052,
    color: "#4488ff",
  },
  {
    id: "p3",
    label: "观测点 D",
    lat: 31.316,
    lng: 120.6052,
    color: "#ffaa22",
  },
];
