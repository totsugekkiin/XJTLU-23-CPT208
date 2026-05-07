import React, { useEffect, useRef, useState } from "react";

const AMAP_SECURITY_JS_CODE = "7b80e9ec4e6400788e44a7c44fb9046c";
const AMAP_KEY = "a8729c788702c9611d7b0fd190f52632";
const AMAP_SRC = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`;

// [AI 新增/修改] 双线路数据源
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

function ensureAmapScriptLoaded() {
  return new Promise((resolve, reject) => {
    if (window.AMap && typeof window.AMap.Map === "function") {
      resolve(true);
      return;
    }

    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_JS_CODE };

    const existing = document.querySelector(`script[src="${AMAP_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => reject(new Error("AMap 脚本加载失败")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = AMAP_SRC;
    script.async = true;
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => reject(new Error("AMap 脚本加载失败")), { once: true });
    document.head.appendChild(script);
  });
}

function formatAmapErr(err) {
  if (!err) return "未知错误";
  if (typeof err === "string") return err;
  const msg = err?.message ? String(err.message) : null;
  const info = err?.info ? String(err.info) : null;
  const infocode = err?.infocode ? String(err.infocode) : null;
  const parts = [msg, info, infocode].filter(Boolean);
  return parts.length ? parts.join(" / ") : "未知错误";
}

function formatWalkingFailure(status, result) {
  const pieces = [];
  if (status) pieces.push(String(status));
  const info = result?.info ? String(result.info) : null;
  const infocode = result?.infocode ? String(result.infocode) : null;
  if (info) pieces.push(info);
  if (infocode) pieces.push(`code=${infocode}`);
  return pieces.length ? pieces.join(" · ") : "未知失败原因";
}

function parseWalkingWebServiceResult(result) {
  const route = result?.route;
  const paths = Array.isArray(route?.paths) ? route.paths : [];
  const firstPath = paths[0] || null;
  const steps = Array.isArray(firstPath?.steps) ? firstPath.steps : [];
  const distance = firstPath?.distance != null ? Number(firstPath.distance) : null;
  const duration = firstPath?.duration != null ? Number(firstPath.duration) : null;

  const coords = [];
  for (const step of steps) {
    const pl = typeof step?.polyline === "string" ? step.polyline : "";
    if (!pl) continue;
    const pairs = pl.split(";");
    for (const pair of pairs) {
      const [lngStr, latStr] = pair.split(",");
      const lng = Number(lngStr);
      const lat = Number(latStr);
      if (Number.isFinite(lng) && Number.isFinite(lat)) coords.push([lng, lat]);
    }
  }

  const instructions = steps
    .map((s) => (typeof s?.instruction === "string" ? s.instruction.trim() : ""))
    .filter(Boolean);

  const ok = String(result?.status ?? "") === "1" && String(result?.infocode ?? "") === "10000" && coords.length >= 2;
  return { ok, coords, distance, duration, instructions };
}

/**
 * 路线推荐区 - 布艺拼贴手机版 (Felt Patchwork Style)
 */
export function RouteSection({ showBackButton = false, standalone = false, heightVh = 100 } = {}) {
  const sectionClass = standalone ? "felt-section felt-section--standalone" : "felt-section";
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [activeRouteId, setActiveRouteId] = useState("waterAlley"); // [AI 新增/修改] 默认选中经典水巷线
  const [routeTip, setRouteTip] = useState("加载中…");
  const amapMapRef = useRef(null); // [AI 新增/修改]
  const walkingRef = useRef(null); // [AI 新增/修改]
  const overlaysRef = useRef([]); // 手动绘制覆盖物（fallback 用）

  const drawFallback = (map, pts, { strokeColor = "#cc5628" } = {}) => {
    if (!map || !Array.isArray(pts) || pts.length < 2) return false;
    try {
      const path = pts.map((p) => [Number(p?.[0]), Number(p?.[1])]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (path.length < 2) return false;

      const line = new window.AMap.Polyline({
        path,
        strokeColor,
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
      overlaysRef.current.push(line);

      const mkStart = new window.AMap.Marker({
        position: path[0],
        anchor: "bottom-center",
        title: "起点",
        zIndex: 130,
      });
      mkStart.setMap(map);
      overlaysRef.current.push(mkStart);

      const mkEnd = new window.AMap.Marker({
        position: path[path.length - 1],
        anchor: "bottom-center",
        title: "终点",
        zIndex: 130,
      });
      mkEnd.setMap(map);
      overlaysRef.current.push(mkEnd);

      map.setFitView(overlaysRef.current);
      return true;
    } catch (e) {
      console.error("fallback draw failed:", e);
      return false;
    }
  };

  // 绘制并切换路线：支持 string routeId；若误传事件对象则从 data-route-id 兜底解析
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

    const map = amapMapRef.current;
    const walking = walkingRef.current;
    const cfg = routeData[routeId];

    // [安全检查] 确保 cfg 存在
    if (!map || !walking || !cfg) {
      console.warn("未找到路线配置或地图实例未就绪", routeId);
      setRouteTip("地图未就绪：请等待加载完成后再试（或刷新页面）");
      return;
    }

    // 提前缓存 name，防止异步回调时 cfg 状态异常
    const currentRouteName = cfg.name || "未知线路";

    setActiveRouteId(routeId);
    setRouteTip("正在规划路线…");

    // 清除旧覆盖物
    try {
      walking.clear?.();
      if (overlaysRef.current) {
        overlaysRef.current.forEach((ov) => ov?.setMap?.(null));
        overlaysRef.current = [];
      }
    } catch (e) {
      console.error(e);
    }

    const pts = cfg.points || [];
    if (pts.length < 2) return;

    const toLngLat = (p) => new window.AMap.LngLat(Number(p?.[0]), Number(p?.[1]));
    const origin = toLngLat(pts[0]);
    const destination = toLngLat(pts[pts.length - 1]);
    const waypoints = pts.slice(1, -1).map((p) => toLngLat(p));

    let settled = false;
    // 增加定时器引用，确保能清除
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      const ok = drawFallback(map, pts, { strokeColor: "#234e35" });
      setRouteTip(
        ok
          ? `规划超时，已使用本地连线预览：${currentRouteName}（若需真实导航，请检查高德 Key/安全密钥的域名白名单）`
          : "规划超时：本地预览绘制也失败了（请刷新重试）"
      );
    }, 3500);

    // 执行搜索
    try {
      walking.search(origin, destination, { waypoints }, (status, result) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);

        if (status === "complete") {
          // [修复点] 使用前面缓存的 currentRouteName，确保安全
          setRouteTip(`路线已生成：${currentRouteName}`);
          window.requestAnimationFrame(() => {
            try {
              map.setFitView();
            } catch (e) {}
          });
          return;
        }

        // 兼容 WebService JSONP 格式（你贴出来的 status=1 / route.paths[].steps[].polyline）
        try {
          const parsed = parseWalkingWebServiceResult(result);
          if (parsed.ok) {
            const ok2 = drawFallback(map, parsed.coords, { strokeColor: "#cc5628" });
            const km = typeof parsed.distance === "number" && Number.isFinite(parsed.distance) ? (parsed.distance / 1000).toFixed(2) : null;
            const min = typeof parsed.duration === "number" && Number.isFinite(parsed.duration) ? Math.round(parsed.duration / 60) : null;
            const head = parsed.instructions.slice(0, 2).join("；");
            setRouteTip(
              ok2
                ? `路线已生成：${currentRouteName}${km ? ` · ${km}km` : ""}${min != null ? ` · ${min}min` : ""}${head ? ` · ${head}` : ""}`
                : `路线已生成：${currentRouteName}（但绘制失败，请刷新重试）`
            );
            return;
          }
        } catch (e) {
          console.error("[walking] parse WebService result failed:", e);
        }

        const reason = formatWalkingFailure(status, result);
        console.error("Walking.search failed:", { status, result });
        const ok = drawFallback(map, pts);
        setRouteTip(
          ok
            ? `规划失败（${reason}），已展示预览：${currentRouteName}（可能是域名白名单/配额/权限问题）`
            : `规划失败（${reason}），且本地预览绘制失败（请刷新重试）`
        );
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      console.error("Walking.search threw:", err);
      const ok = drawFallback(map, pts);
      setRouteTip(ok ? `规划异常（${formatAmapErr(err)}），已展示预览：${currentRouteName}` : `规划异常（${formatAmapErr(err)}）`);
    }
  };

  useEffect(() => {
    let cancelled = false;
    /** @type {any} */
    let map = null;
    let resizeObs = null;
    let io = null;

    const init = async () => {
      if (!mapRef.current) return;
      try {
        await ensureAmapScriptLoaded();
      } catch (e) {
        console.error("[amap] script load failed:", e);
        setRouteTip(`地图脚本加载失败：${formatAmapErr(e)}（请检查网络/是否被广告拦截器拦截）`);
        return;
      }
      if (cancelled || !mapRef.current) return;

      try {
        map = new window.AMap.Map(mapRef.current, {
          center: [120.604, 31.314],
          zoom: 15,
          viewMode: "3D",
          pitch: 45,
          resizeEnable: true,
        });
      } catch (e) {
        console.error("[amap] map init failed:", e);
        setRouteTip(`地图初始化失败：${formatAmapErr(e)}（请刷新或更换浏览器）`);
        return;
      }

      amapMapRef.current = map; // [AI 新增/修改] 保存 map 实例供 drawRoute 使用

      // 容器从隐藏/尺寸变化恢复时，强制 resize，避免白屏
      const tryResize = () => {
        try {
          map?.resize?.();
        } catch {
          // ignore
        }
      };
      tryResize();
      if ("ResizeObserver" in window) {
        resizeObs = new ResizeObserver(() => tryResize());
        resizeObs.observe(mapRef.current);
      }
      if ("IntersectionObserver" in window) {
        io = new IntersectionObserver(
          (entries) => {
            if (entries?.[0]?.isIntersecting) tryResize();
          },
          { threshold: 0.01 }
        );
        io.observe(mapRef.current);
      }

      // [AI 新增/修改] 加载 AMap.Walking 插件
      try {
        await new Promise((resolve) => {
          window.AMap.plugin(["AMap.Walking"], () => {
            try {
              walkingRef.current = new window.AMap.Walking({ map });
            } catch (e) {
              console.error("[amap] Walking init failed:", e);
              walkingRef.current = null;
              setRouteTip(`步行导航组件初始化失败：${formatAmapErr(e)}（将仅显示本地预览连线）`);
            }
            resolve(true);
          });
        });
      } catch (e) {
        console.error("[amap] Walking plugin load failed:", e);
        setRouteTip(`步行导航插件加载失败：${formatAmapErr(e)}（将仅显示本地预览连线）`);
      }

      setMapReady(true);
      setRouteTip("请选择一条推荐路线");
      window.requestAnimationFrame(() => map?.resize?.());

      // [AI 新增/修改] 首次进入默认绘制“经典水巷线”
      drawRoute("waterAlley");
    };

    init();
    return () => {
      cancelled = true;
      try {
        io?.disconnect?.();
        resizeObs?.disconnect?.();
        walkingRef.current?.clear?.(); // [AI 新增/修改]
        map?.destroy?.();
      } catch {
        // ignore
      }
      map = null;
      amapMapRef.current = null; // [AI 新增/修改]
      walkingRef.current = null; // [AI 新增/修改]
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
          padding: 8px;
          margin-bottom: 16px;
        }

        .felt-map-info {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 6px;
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

        /* [AI 新增/修改] 选中态：尽量保持原有布艺风格，只做轻微强调 */
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
          transform: rotate(180deg);
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

      <header className="felt-header">
        <div className="felt-title-box">
          <h1 className="felt-main-title">
            Route
            <br />
            <span>Planner</span>
          </h1>
          <div className="felt-tag-tape patch stitch">推荐路线</div>
        </div>
      </header>

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
          <span style={{ color: "var(--felt-dark)" }}>{mapReady ? "定位成功" : "定位中..."}</span>
        </div>

        <div className="felt-map-canvas stitch stitch-dark">
          <div id="map" ref={mapRef} className="felt-map" aria-label="高德地图容器" />

          <div className={`loading-cloth stitch ${mapReady ? "fade" : ""}`}>
            <div style={{ fontSize: "24px", animation: "clothSpin 3s linear infinite" }}>🧶</div>
            <div style={{ fontWeight: "bold", marginTop: "8px", fontSize: "14px" }}>布艺拼贴中...</div>
          </div>

          <div className="felt-routeTip" aria-live="polite">
            {routeTip}
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

