import React, { useEffect, useRef, useState } from "react";
import AMapLoader from "@amap/amap-jsapi-loader";

const AMAP_SECURITY_JS_CODE = "7b80e9ec4e6400788e44a7c44fb9046c";
const AMAP_KEY = "a8729c788702c9611d7b0fd190f52632";

/** 苏州阊门文化带一带（略偏阊门站点），作为默认中心 */
const SUZHOU_DEFAULT_CENTER = [120.6052, 31.3151];

/**
 * 地图观感（蓝色天际/雾感）相关：
 * - `viewMode: "3D"` + 较大 `pitch` 时，WebGL 天空层容易呈现偏蓝的雾化天际线；
 * - 改为 `"2D"` 或把 `pitch` 调到 0～30，可明显减弱；
 * - 若保留 3D，可尝试 `skyColor`（仅 3D 生效）改成偏灰/米色，减轻蓝色感。
 */
const MAP_VIEW_OPTIONS = {
  viewMode: "2D",
  pitch: 0,
  // 若仍想用 3D，可改为例如：
  // viewMode: "3D",
  // pitch: 35,
  // skyColor: "#e8e5df",
};

// 双线路数据源：points 顺序即为途经顺序（首点为起点，末点为终点，中间为途经点）
const routeData = {
  waterAlley: {
    id: "waterAlley",
    name: "经典水巷线",
    labels: ["慢行", "桥巷"],
    points: [
      [120.605632, 31.315194], // 阊门 (起点)
      [120.60319, 31.316538], // 七里山塘 (途经点)
      [120.598821, 31.320438], // 荣阳楼 (终点)
    ],
  },
  nightTour: {
    id: "nightTour",
    name: "夜游氛围线",
    labels: ["灯火", "小吃"],
    points: [
      [120.605632, 31.315194], // 阊门 (起点)
      [120.606385, 31.311352], // 石路步行街 (途经点)
      [120.605581, 31.310156], // 南浩街 (途经点)
      [120.60319, 31.316538], // 七里山塘夜景 (终点)
    ],
  },
};

function formatAmapErr(err) {
  if (!err) return "未知错误";
  if (typeof err === "string") return err;
  const msg = err?.message ? String(err.message) : null;
  const info = err?.info ? String(err.info) : null;
  const infocode = err?.infocode ? String(err.infocode) : null;
  const parts = [msg, info, infocode].filter(Boolean);
  return parts.length ? parts.join(" / ") : "未知错误";
}

function appendCoordRing(ring, lng, lat) {
  const last = ring[ring.length - 1];
  if (last && last[0] === lng && last[1] === lat) return;
  ring.push([lng, lat]);
}

/** 将步行方案中各路段的 path 展平为折线坐标（经纬度数组） */
function flattenWalkStepsToRing(steps) {
  const ring = [];
  for (const step of steps || []) {
    const path = step?.path;
    if (!path) continue;
    const arr = Array.isArray(path) ? path : [];
    for (const pt of arr) {
      let lng;
      let lat;
      if (pt && typeof pt.lng === "number" && typeof pt.lat === "number") {
        lng = pt.lng;
        lat = pt.lat;
      } else if (pt && typeof pt.getLng === "function" && typeof pt.getLat === "function") {
        lng = pt.getLng();
        lat = pt.getLat();
      } else continue;
      appendCoordRing(ring, lng, lat);
    }
  }
  return ring;
}

/**
 * 路线推荐区 - 布艺拼贴手机版 (Felt Patchwork Style)
 * 步行路径由高德 `AMap.Walking` 分段规划（途经点顺序固定）；Walking 不支持单次查询多途经点，故按段合并绘制。
 */
export function RouteSection({ showBackButton = false, standalone = false, heightVh = 100 } = {}) {
  const sectionClass = standalone ? "felt-section felt-section--standalone" : "felt-section";

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  /** 仅用于发起步行查询；不绑定 map，避免多次 search 时互相覆盖线路 */
  const walkingInstanceRef = useRef(null);
  /** 手动绘制的折线/标注，需在切换路线或卸载时移除 */
  const routeOverlaysRef = useRef([]);
  /** Loader 返回的 AMap 命名空间，用于构造 LngLat 等，不放入 useState */
  const amapRef = useRef(null);

  const [activeRouteId, setActiveRouteId] = useState("waterAlley");
  const [routeTip, setRouteTip] = useState("加载中…");
  /** 仅控制加载蒙层与文案，不存放地图/路线几何数据 */
  const [mapReady, setMapReady] = useState(false);

  const clearRouteOverlays = () => {
    const map = mapInstanceRef.current;
    const list = routeOverlaysRef.current;
    if (!map || !list?.length) {
      routeOverlaysRef.current = [];
      return;
    }
    try {
      list.forEach((ov) => {
        try {
          ov?.setMap?.(null);
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
    routeOverlaysRef.current = [];
  };

  const drawRoute = (routeIdOrEvent) => {
    let routeId = null;
    if (typeof routeIdOrEvent === "string") {
      routeId = routeIdOrEvent;
    } else {
      const el = routeIdOrEvent?.currentTarget;
      const dsId = el?.getAttribute?.("data-route-id") ?? el?.dataset?.routeId ?? null;
      if (typeof dsId === "string" && dsId.trim()) routeId = dsId.trim();
    }

    if (!routeId) return;

    const AMapNs = amapRef.current;
    const walking = walkingInstanceRef.current;
    const map = mapInstanceRef.current;
    const cfg = routeData[routeId];

    if (!AMapNs || !walking || !map || !cfg) {
      console.warn("未找到路线配置或地图/步行服务未就绪", routeId);
      setRouteTip("地图未就绪：请等待加载完成后再试（或刷新页面）");
      return;
    }

    const currentRouteName = cfg.name || "未知线路";

    setActiveRouteId(routeId);
    setRouteTip("正在规划路线…");

    const pts = cfg.points || [];
    if (pts.length < 2) {
      setRouteTip(`路线「${currentRouteName}」坐标不足，无法规划`);
      return;
    }

    clearRouteOverlays();
    try {
      walking.clear();
    } catch (e) {
      console.warn("[Walking] clear:", e);
    }

    const toLngLat = (p) => new AMapNs.LngLat(Number(p?.[0]), Number(p?.[1]));

    // 业务参数：起点、终点、途经点（顺序已定；Walking 需按段查询后合并）
    const startLngLat = toLngLat(pts[0]);
    const endLngLat = toLngLat(pts[pts.length - 1]);
    const waypoints = pts.length > 2 ? pts.slice(1, -1).map(toLngLat) : [];

    const searchSegment = (origin, destination) =>
      new Promise((resolve, reject) => {
        walking.search(origin, destination, (status, result) => {
          if (status !== "complete") {
            const info = result?.info ? String(result.info) : String(status);
            reject(new Error(info));
            return;
          }
          const route = result?.routes?.[0];
          if (!route) {
            reject(new Error("no_route"));
            return;
          }
          resolve(route);
        });
      });

    (async () => {
      let totalDistance = 0;
      let totalDuration = 0;
      const mergedRing = [];

      try {
        for (let i = 0; i < pts.length - 1; i += 1) {
          const origin = toLngLat(pts[i]);
          const destination = toLngLat(pts[i + 1]);
          const route = await searchSegment(origin, destination);
          const d = route.distance != null ? Number(route.distance) : 0;
          const t = route.time != null ? Number(route.time) : 0;
          if (Number.isFinite(d)) totalDistance += d;
          if (Number.isFinite(t)) totalDuration += t;
          const ring = flattenWalkStepsToRing(route.steps);
          for (const c of ring) {
            appendCoordRing(mergedRing, c[0], c[1]);
          }
        }

        if (mergedRing.length < 2) {
          setRouteTip(`规划失败：${currentRouteName}（未得到有效步行路径）`);
          return;
        }

        const line = new AMapNs.Polyline({
          path: mergedRing,
          strokeColor: "#cc5628",
          strokeOpacity: 0.95,
          strokeWeight: 8,
          strokeStyle: "solid",
          lineJoin: "round",
          lineCap: "round",
          isOutline: true,
          outlineColor: "rgba(255,255,255,0.9)",
          outlineWeight: 2,
          zIndex: 120,
        });
        line.setMap(map);
        routeOverlaysRef.current.push(line);

        const mkStart = new AMapNs.Marker({
          position: startLngLat,
          anchor: "bottom-center",
          title: "起点",
          zIndex: 130,
        });
        mkStart.setMap(map);
        routeOverlaysRef.current.push(mkStart);

        const mkEnd = new AMapNs.Marker({
          position: endLngLat,
          anchor: "bottom-center",
          title: "终点",
          zIndex: 130,
        });
        mkEnd.setMap(map);
        routeOverlaysRef.current.push(mkEnd);

        waypoints.forEach((lngLat, idx) => {
          const mkVia = new AMapNs.Marker({
            position: lngLat,
            anchor: "bottom-center",
            title: `途经点 ${idx + 1}`,
            zIndex: 125,
          });
          mkVia.setMap(map);
          routeOverlaysRef.current.push(mkVia);
        });

        try {
          map.setFitView(routeOverlaysRef.current);
        } catch {
          // ignore
        }

        const km = totalDistance > 0 ? (totalDistance / 1000).toFixed(2) : null;
        const min = totalDuration > 0 ? Math.round(totalDuration / 60) : null;
        setRouteTip(
          `步行路线已生成：${currentRouteName}${km ? ` · ${km}km` : ""}${min != null ? ` · 约${min}分钟` : ""}`
        );
      } catch (err) {
        console.error("[Walking] search failed:", err);
        setRouteTip(`规划失败：${currentRouteName} · ${formatAmapErr(err)}`);
      }
    })();
  };

  useEffect(() => {
    let cancelled = false;
    let resizeObs = null;
    let io = null;

    const init = async () => {
      if (!mapContainerRef.current) return;

      window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_JS_CODE };

      let AMapNs;
      try {
        AMapNs = await AMapLoader.load({
          key: AMAP_KEY,
          version: "2.0",
          plugins: ["AMap.Walking"],
        });
      } catch (e) {
        console.error("[amap] loader failed:", e);
        setRouteTip(`地图加载失败：${formatAmapErr(e)}（请检查网络或密钥配置）`);
        return;
      }

      if (cancelled || !mapContainerRef.current) return;

      amapRef.current = AMapNs;

      let map;
      try {
        map = new AMapNs.Map(mapContainerRef.current, {
          center: SUZHOU_DEFAULT_CENTER,
          zoom: 15,
          resizeEnable: true,
          ...MAP_VIEW_OPTIONS,
        });
      } catch (e) {
        console.error("[amap] map init failed:", e);
        setRouteTip(`地图初始化失败：${formatAmapErr(e)}（请刷新或更换浏览器）`);
        return;
      }

      if (cancelled) {
        try {
          map.destroy();
        } catch {
          // ignore
        }
        return;
      }

      mapInstanceRef.current = map;

      let walking;
      try {
        walking = new AMapNs.Walking({});
      } catch (e) {
        console.error("[amap] Walking init failed:", e);
        setRouteTip(`步行导航插件初始化失败：${formatAmapErr(e)}`);
        try {
          map.destroy();
        } catch {
          // ignore
        }
        mapInstanceRef.current = null;
        return;
      }

      walkingInstanceRef.current = walking;

      const tryResize = () => {
        try {
          mapInstanceRef.current?.resize?.();
        } catch {
          // ignore
        }
      };
      tryResize();
      if ("ResizeObserver" in window && mapContainerRef.current) {
        resizeObs = new ResizeObserver(() => tryResize());
        resizeObs.observe(mapContainerRef.current);
      }
      if ("IntersectionObserver" in window && mapContainerRef.current) {
        io = new IntersectionObserver(
          (entries) => {
            if (entries?.[0]?.isIntersecting) tryResize();
          },
          { threshold: 0.01 }
        );
        io.observe(mapContainerRef.current);
      }

      setMapReady(true);
      setRouteTip("请选择一条推荐路线");
      window.requestAnimationFrame(() => tryResize());

      drawRoute("waterAlley");
    };

    init();

    return () => {
      cancelled = true;
      try {
        io?.disconnect?.();
        resizeObs?.disconnect?.();
      } catch {
        // ignore
      }
      try {
        routeOverlaysRef.current?.forEach?.((ov) => {
          try {
            ov?.setMap?.(null);
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore
      }
      routeOverlaysRef.current = [];
      try {
        walkingInstanceRef.current?.clear?.();
      } catch {
        // ignore
      }
      try {
        mapInstanceRef.current?.destroy?.();
      } catch {
        // ignore
      }
      walkingInstanceRef.current = null;
      mapInstanceRef.current = null;
      amapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      className={sectionClass}
      id={standalone ? undefined : "route-section"}
      aria-label="推荐路线"
      style={standalone ? undefined : { height: `${heightVh}vh`, minHeight: "720px" }}
    >
      <style>{`
        .felt-section {
          --felt-bg: #f4efe6;
          --felt-green: #234e35;
          --felt-orange: #cc5628;
          --felt-dark: #2c2c2c;
          --thread-light: rgba(255, 255, 255, 0.7);
          --thread-dark: rgba(44, 44, 44, 0.6);

          position: relative;
          width: 100%;
          height: 100vh;
          background-color: var(--felt-bg);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 16px;
          box-sizing: border-box;
          font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
        }

        .felt-section *,
        .felt-section *::before,
        .felt-section *::after {
          box-sizing: inherit;
        }

        .felt-section--standalone {
          position: fixed;
          inset: 0;
          z-index: 1;
          height: 100%;
          min-height: 100%;
        }

        .felt-section::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.12'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 1;
        }

        .patch {
          position: relative;
          border-radius: 4px;
          box-shadow: 2px 4px 6px rgba(0, 0, 0, 0.15);
          z-index: 10;
        }

        .stitch::after {
          content: "";
          position: absolute;
          inset: 4px;
          border: 1.5px dashed var(--thread-light);
          border-radius: 2px;
          pointer-events: none;
        }

        .stitch-dark::after {
          border-color: var(--thread-dark);
        }

        .x-fix {
          position: absolute;
          color: var(--felt-orange);
          font-weight: bold;
          font-size: 14px;
          line-height: 1;
          z-index: 20;
        }

        /* 原独立标题挪入地图后，用占位条保留顶部留白（不误触地图）；略矮以便地图区更高 */
        .felt-top-spacer {
          flex-shrink: 0;
          height: 30px;
          width: 100%;
          pointer-events: none;
        }

        .felt-back-btn {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 40;
          border: 1px solid var(--felt-dark);
          background: var(--felt-bg);
          color: var(--felt-dark);
          padding: 8px 12px;
          border-radius: 4px;
          font-weight: 900;
          cursor: pointer;
          transform: rotate(-2deg);
          box-shadow: 2px 4px 6px rgba(0, 0, 0, 0.15);
        }

        .felt-header {
          flex-shrink: 0;
          margin-bottom: 12px;
          display: flex;
          justify-content: flex-end;
        }

        /* 地图 stitch 框外的胶带（不进 felt-map-board，避免算在框内「那一行」里） */
        .felt-map-board-wrap {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          margin-bottom: 12px;
          position: relative;
          z-index: 10;
        }

        .felt-map-route-label {
          flex-shrink: 0;
          display: flex;
          justify-content: flex-end;
          margin-bottom: 4px;
          padding-right: 2px;
          pointer-events: none;
        }

        .felt-map-route-label .felt-tag-tape {
          position: relative;
          right: auto;
          bottom: auto;
        }

        /* 叠在地图右上角：Route Planner（非下方路线卡片） */
        .felt-header--on-map {
          position: absolute;
          top: 12px;
          right: 10px;
          z-index: 36;
          margin: 0;
          pointer-events: none;
        }

        .felt-header--on-map .felt-main-title {
          font-size: 26px;
        }

        .felt-title-box {
          position: relative;
          transform: rotate(-2deg);
        }

        .felt-main-title {
          margin: 0;
          font-size: 32px;
          font-weight: 900;
          line-height: 0.9;
          text-align: right;
          color: var(--felt-dark);
        }

        .felt-main-title span {
          color: var(--felt-green);
        }

        .felt-tag-tape {
          position: absolute;
          right: -4px;
          bottom: -8px;
          background: var(--felt-orange);
          color: white;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: bold;
          transform: rotate(4deg);
          border: 1px solid var(--felt-dark);
        }

        .felt-map-board {
          flex: 1;
          min-height: 0;
          background: #faf5ee;
          display: flex;
          flex-direction: column;
          padding: 6px;
        }

        .felt-map-info {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 4px;
          color: var(--felt-green);
        }

        .felt-map-canvas {
          flex: 1;
          position: relative;
          border-radius: 2px;
          overflow: hidden;
          background: #dcd4c6;
        }

        .felt-map {
          width: 100%;
          height: 100%;
        }

        .felt-routes {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .felt-card {
          display: flex;
          width: 100%;
          border: none;
          background: transparent;
          padding: 0;
          color: inherit;
          cursor: pointer;
          text-align: left;
          font: inherit;
        }

        .felt-card.is-active .felt-card-body {
          transform: translateY(-1px);
          box-shadow: 3px 6px 12px rgba(0, 0, 0, 0.18);
          outline: 2px solid rgba(204, 86, 40, 0.55);
          outline-offset: 2px;
        }

        .felt-card.is-active .felt-pin {
          filter: saturate(1.1) brightness(1.05);
        }

        .felt-card-label {
          background: var(--felt-green);
          color: white;
          writing-mode: vertical-rl;
          padding: 8px 4px;
          font-weight: bold;
          font-size: 14px;
          border-radius: 4px 0 0 4px;
        }

        .felt-card-label.orange {
          background: var(--felt-orange);
        }

        .felt-card-body {
          flex: 1;
          background: var(--felt-bg);
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          border-radius: 0 4px 4px 0;
        }

        .felt-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px dashed var(--thread-dark);
          padding-bottom: 4px;
          margin-bottom: 6px;
        }

        .felt-card-title {
          font-size: 18px;
          font-weight: 900;
          color: var(--felt-dark);
        }

        .felt-card-status {
          font-size: 10px;
          font-weight: bold;
          margin-top: 2px;
        }

        .felt-pin {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--felt-green);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          box-shadow: inset 0 0 0 1px var(--thread-light);
        }

        .felt-pin.orange {
          background: var(--felt-orange);
        }

        .felt-card-desc {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: bold;
        }

        .felt-mini-tag {
          background: #e0d7c6;
          padding: 1px 4px;
          font-size: 10px;
          border: 1px dashed var(--thread-dark);
        }

        @keyframes clothSpin {
          100% {
            transform: rotate(360deg);
          }
        }

        .loading-cloth {
          position: absolute;
          inset: 0;
          background: var(--felt-green);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          z-index: 30;
          transition: opacity 0.5s;
        }

        .loading-cloth.fade {
          opacity: 0;
          pointer-events: none;
        }

        .felt-routeTip {
          position: absolute;
          left: 8px;
          right: 8px;
          bottom: 8px;
          z-index: 35;
          background: rgba(244, 239, 230, 0.92);
          border: 1px solid rgba(44, 44, 44, 0.25);
          color: var(--felt-dark);
          font-size: 12px;
          font-weight: 800;
          padding: 6px 8px;
          border-radius: 4px;
          box-shadow: 2px 4px 8px rgba(0, 0, 0, 0.12);
        }
      `}</style>

      {showBackButton ? (
        <button className="felt-back-btn patch stitch stitch-dark" type="button" onClick={() => (window.location.href = "appMain.html")}>
          ◄ 返回
        </button>
      ) : null}

      <div className="felt-top-spacer" aria-hidden="true" />

      <div className="felt-map-board-wrap">
        <div className="felt-map-route-label">
          <div className="felt-tag-tape patch stitch">推荐路线</div>
        </div>

        <div className="felt-map-board patch stitch stitch-dark">
        <div className="x-fix" style={{ top: "4px", left: "6px" }}>
          x
        </div>
        <div className="x-fix" style={{ top: "4px", right: "6px" }}>
          x
        </div>
        <div className="x-fix" style={{ bottom: "4px", left: "6px" }}>
          x
        </div>
        <div className="x-fix" style={{ bottom: "4px", right: "6px" }}>
          x
        </div>

        <div className="felt-map-info">
          <span>📍 苏州 · 阊门区域</span>
          <span style={{ color: "var(--felt-dark)" }}>{mapReady ? "地图已就绪" : "加载中..."}</span>
        </div>

        <div className="felt-map-canvas stitch stitch-dark">
          <header className="felt-header felt-header--on-map" aria-label="Route Planner">
            <div className="felt-title-box">
              <h1 className="felt-main-title">
                Route
                <br />
                <span>Planner</span>
              </h1>
            </div>
          </header>

          <div id="map" ref={mapContainerRef} className="felt-map" aria-label="高德地图容器" />

          <div className={`loading-cloth stitch ${mapReady ? "fade" : ""}`}>
            <div style={{ fontSize: "24px", animation: "clothSpin 3s linear infinite" }}>🧶</div>
            <div style={{ fontWeight: "bold", marginTop: "8px", fontSize: "14px" }}>布艺拼贴中...</div>
          </div>

          <div className="felt-routeTip" aria-live="polite">
            {routeTip}
          </div>
        </div>
        </div>
      </div>

      <div className="felt-routes" aria-label="推荐路线（2 种风格）">
        <button
          className={`felt-card ${activeRouteId === "waterAlley" ? "is-active" : ""}`}
          type="button"
          aria-label="经典水巷线"
          data-route-id="waterAlley"
          onClick={() => drawRoute("waterAlley")}
        >
          <div className="felt-card-label patch stitch">第1线</div>
          <div className="felt-card-body patch stitch stitch-dark">
            <div className="felt-card-top">
              <div>
                <div className="felt-card-title">经典水巷线</div>
                <div className="felt-card-status" style={{ color: "var(--felt-green)" }}>
                  RECOMMENDED
                </div>
              </div>
              <div className="felt-pin">✓</div>
            </div>
            <div className="felt-card-desc">
              <span>游船与古桥</span>
              <span style={{ marginLeft: "auto" }} className="felt-mini-tag">
                慢行
              </span>
              <span className="felt-mini-tag">桥巷</span>
            </div>
          </div>
        </button>

        <button
          className={`felt-card ${activeRouteId === "nightTour" ? "is-active" : ""}`}
          type="button"
          aria-label="夜游氛围线"
          data-route-id="nightTour"
          onClick={() => drawRoute("nightTour")}
        >
          <div className="felt-card-label orange patch stitch">第2线</div>
          <div className="felt-card-body patch stitch stitch-dark">
            <div className="felt-card-top">
              <div>
                <div className="felt-card-title">夜游氛围线</div>
                <div className="felt-card-status" style={{ color: "var(--felt-orange)" }}>
                  HOT CHOICE
                </div>
              </div>
              <div className="felt-pin orange">✓</div>
            </div>
            <div className="felt-card-desc">
              <span>灯火与市井</span>
              <span style={{ marginLeft: "auto" }} className="felt-mini-tag">
                灯火
              </span>
              <span className="felt-mini-tag">小吃</span>
            </div>
          </div>
        </button>
      </div>
    </section>
  );
}
