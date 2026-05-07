import React, { useEffect, useRef } from "react";
import "../../css/route-section.css";

const AMAP_SECURITY_JS_CODE = "7b80e9ec4e6400788e44a7c44fb9046c";
const AMAP_KEY = "a8729c788702c9611d7b0fd190f52632";
const AMAP_SRC = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`;

const SPOTS = {
  changmen: { name: "阊门", lnglat: [120.6056, 31.315116] },
  shantang: { name: "山塘街", lnglat: [120.59389, 31.32611] },
  yipu: { name: "艺圃", lnglat: [120.604722, 31.31525] },
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

function createHtmlMarkerEl() {
  const el = document.createElement("div");
  el.className = "cm-marker";
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "-1");
  return el;
}

function setActiveMarker(activeId, markerElsById) {
  Object.entries(markerElsById).forEach(([id, el]) => {
    el.classList.toggle("is-active", id === activeId);
  });
}

/**
 * 完整地图界面（基本等同 map.html），用于 appMain 页尾内嵌与 map.html 独立页复用
 */
export function RouteSection({ showBackButton = false, standalone = false, heightVh = 100 } = {}) {
  const sectionRef = useRef(null);
  const mapRef = useRef(null);
  const toastRef = useRef(null);
  const spotsRef = useRef(null);
  const routeFooterRef = useRef(null);
  const btnRouteRef = useRef(null);
  const btnClearRef = useRef(null);
  const btnRecenterRef = useRef(null);
  const btnBackRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let intersectionObserver = null;
    /** @type {null | (() => void)} */
    let disposeMap = null;

    const setToast = (txt) => {
      const el = toastRef.current;
      if (!el) return;
      el.textContent = txt;
    };

    const initMap = async () => {
      if (cancelled || !mapRef.current) return;

      try {
        await ensureAmapScriptLoaded();
      } catch (err) {
        console.error(err);
        setToast(err?.message ? String(err.message) : "AMap 未加载成功。");
        return;
      }
      if (cancelled || !mapRef.current) return;

      const map = new window.AMap.Map(mapRef.current, {
        center: [120.604, 31.314],
        zoom: 15.5,
        viewMode: "3D",
        pitch: 45,
        mapStyle: "amap://styles/dark",
        resizeEnable: true,
      });

      let driving = null;
      let drivingReady = false;
      const drivingReadyPromise = new Promise((resolve) => {
        window.AMap.plugin(["AMap.Driving"], () => {
          driving = new window.AMap.Driving({
            map,
            hideMarkers: true,
          });
          drivingReady = true;
          resolve(true);
        });
      });

      const markerElsById = {};
      const selectedIds = [];

      Object.entries(SPOTS).forEach(([id, spot]) => {
        const el = createHtmlMarkerEl();
        markerElsById[id] = el;

        const marker = new window.AMap.Marker({
          position: spot.lnglat,
          content: el,
          offset: new window.AMap.Pixel(-9, -9),
          clickable: true,
        });
        map.add(marker);

        el.addEventListener("mouseenter", () => setToast(`${spot.name}：hover`));
        el.addEventListener("mouseleave", () => setToast("提示：点右侧“推荐路线”里的地点按钮进行定位。"));

        marker.on("click", () => {
          setActiveMarker(id, markerElsById);
          setToast(`${spot.name}：已定位`);
          map.setZoomAndCenter(16.5, spot.lnglat, false, 850);
        });
      });

      const focusSpot = (id) => {
        const spot = SPOTS[id];
        if (!spot) return;
        setActiveMarker(id, markerElsById);
        setToast(`${spot.name}：平滑移动中…`);
        map.setZoomAndCenter(16.5, spot.lnglat, false, 850);
      };

      const updateFooter = () => {
        const count = selectedIds.length;
        const routeFooterEl = routeFooterRef.current;
        const btnRouteEl = btnRouteRef.current;
        if (!routeFooterEl || !btnRouteEl) return;

        const shouldShow = count >= 2;
        routeFooterEl.hidden = !shouldShow;
        btnRouteEl.disabled = !shouldShow || !drivingReady;
        btnRouteEl.textContent = shouldShow ? `按已选地点导航（${count} 个点）` : "按已选地点导航";
      };

      const syncCheckboxes = () => {
        const root = spotsRef.current;
        if (!root) return;
        root.querySelectorAll(".spotCheck[data-select]").forEach((el) => {
          const id = el.getAttribute("data-select");
          el.checked = selectedIds.includes(id);
        });
      };

      const toggleSelected = (id, nextChecked) => {
        if (!SPOTS[id]) return;
        const exists = selectedIds.includes(id);
        const shouldSelect = typeof nextChecked === "boolean" ? nextChecked : !exists;

        if (shouldSelect && !exists) selectedIds.push(id);
        if (!shouldSelect && exists) selectedIds.splice(selectedIds.indexOf(id), 1);

        syncCheckboxes();
        updateFooter();
        setToast(
          selectedIds.length >= 2
            ? `已勾选：${selectedIds.map((x) => SPOTS[x].name).join(" → ")}`
            : "请至少勾选 2 个地点以导航"
        );
      };

      const spotsRoot = spotsRef.current;

      const onSpotsClick = (e) => {
        if (e.target?.closest?.(".spotCheck")) return;
        const btn = e.target?.closest?.("[data-spot]");
        if (!btn) return;
        focusSpot(btn.getAttribute("data-spot"));
      };

      const onSpotsChange = (e) => {
        const chk = e.target?.closest?.(".spotCheck[data-select]");
        if (!chk) return;
        toggleSelected(chk.getAttribute("data-select"), chk.checked);
      };

      spotsRoot?.addEventListener("click", onSpotsClick);
      spotsRoot?.addEventListener("change", onSpotsChange);

      const toLngLat = (lnglat) => new window.AMap.LngLat(lnglat[0], lnglat[1]);

      const onRouteClick = async () => {
        if (selectedIds.length < 2) return;
        await drivingReadyPromise;
        if (!driving) return;

        const origin = toLngLat(SPOTS[selectedIds[0]].lnglat);
        const destination = toLngLat(SPOTS[selectedIds[selectedIds.length - 1]].lnglat);
        const waypoints = selectedIds.slice(1, -1).map((id) => toLngLat(SPOTS[id].lnglat));

        driving.clear();
        setToast("正在规划路线…");

        let done = false;
        const timeout = window.setTimeout(() => {
          if (done) return;
          setToast("规划超时：请用本地服务器方式打开页面（不要 file://），并检查 Key/安全密钥的域名白名单限制");
        }, 9000);

        driving.search(origin, destination, { waypoints }, (status, result) => {
          done = true;
          window.clearTimeout(timeout);
          if (status === "complete") {
            setToast(`路线已生成：${selectedIds.map((x) => SPOTS[x].name).join(" → ")}`);
          } else {
            console.error("Driving.search failed:", status, result);
            setToast("路线生成失败：请用本地服务器打开页面，并检查 Key/安全密钥与域名限制");
          }
        });
      };

      const onClearClick = () => {
        selectedIds.splice(0, selectedIds.length);
        syncCheckboxes();
        updateFooter();
        driving?.clear?.();
        setToast("已清空勾选与路线");
      };

      const onRecenterClick = () => {
        setActiveMarker("changmen", markerElsById);
        map.setZoomAndCenter(15.5, [120.604, 31.314], false, 850);
        setToast("已回到阊门（初始视角）");
      };

      const onBackClick = () => {
        window.location.href = "appMain.html";
      };

      btnRouteRef.current?.addEventListener("click", onRouteClick);
      btnClearRef.current?.addEventListener("click", onClearClick);
      btnRecenterRef.current?.addEventListener("click", onRecenterClick);
      if (showBackButton) btnBackRef.current?.addEventListener("click", onBackClick);

      drivingReadyPromise.then(() => updateFooter());
      updateFooter();
      setToast("地图就绪：可点“定位”，也可勾选 2 个以上地点生成导航路线。");

      window.requestAnimationFrame(() => {
        map.resize?.();
      });

      disposeMap = () => {
        spotsRoot?.removeEventListener("click", onSpotsClick);
        spotsRoot?.removeEventListener("change", onSpotsChange);
        btnRouteRef.current?.removeEventListener("click", onRouteClick);
        btnClearRef.current?.removeEventListener("click", onClearClick);
        btnRecenterRef.current?.removeEventListener("click", onRecenterClick);
        if (showBackButton) btnBackRef.current?.removeEventListener("click", onBackClick);
        driving?.clear?.();
        map.destroy?.();
      };
    };

    const sectionEl = sectionRef.current;
    if (!sectionEl) return undefined;

    const scheduleInit = () => {
      initMap().catch((err) => console.error(err));
    };

    if (!( "IntersectionObserver" in window)) {
      scheduleInit();
    } else {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          const e = entries[0];
          if (!e?.isIntersecting) return;
          intersectionObserver?.disconnect();
          intersectionObserver = null;
          scheduleInit();
        },
        { threshold: 0.05 }
      );
      intersectionObserver.observe(sectionEl);
    }

    return () => {
      cancelled = true;
      intersectionObserver?.disconnect?.();
      disposeMap?.();
    };
  }, [showBackButton]);

  const sectionClass = standalone ? "route-section route-section--standalone" : "route-section";

  return (
    <section
      ref={sectionRef}
      className={sectionClass}
      id={standalone ? undefined : "route-section"}
      aria-label="推荐路线"
      style={standalone ? undefined : { height: `${heightVh}vh`, minHeight: "720px" }}
    >
      <div id="map" ref={mapRef} aria-label="高德地图容器" />

      <div className="hud" aria-hidden="false">
        {showBackButton ? (
          <div className="hud__topbar">
            <button className="btn btn--primary" ref={btnBackRef} id="btn-back" type="button">
              ◄ 返回
            </button>
          </div>
        ) : null}

        <aside className="panel" aria-label="推荐路线">
          <div className="panel__head">
            <div className="panel__title">推荐路线</div>
            <button className="btn" ref={btnRecenterRef} id="btn-recenter" type="button">
              回到阊门
            </button>
          </div>
          <div className="panel__body" ref={spotsRef} id="spots">
            <button className="spotBtn" type="button" data-spot="changmen">
              <span className="spotBtn__pin" aria-hidden="true" />
              <span>
                <div className="spotBtn__name">阊门</div>
                <div className="spotBtn__meta">120.6056, 31.315116</div>
              </span>
              <span className="spotBtn__hint">定位</span>
              <input className="spotCheck" type="checkbox" data-select="changmen" aria-label="勾选 阊门" />
            </button>

            <button className="spotBtn" type="button" data-spot="shantang">
              <span className="spotBtn__pin" aria-hidden="true" />
              <span>
                <div className="spotBtn__name">山塘街</div>
                <div className="spotBtn__meta">120.59389, 31.32611</div>
              </span>
              <span className="spotBtn__hint">定位</span>
              <input className="spotCheck" type="checkbox" data-select="shantang" aria-label="勾选 山塘街" />
            </button>

            <button className="spotBtn" type="button" data-spot="yipu">
              <span className="spotBtn__pin" aria-hidden="true" />
              <span>
                <div className="spotBtn__name">艺圃</div>
                <div className="spotBtn__meta">120.604722, 31.31525</div>
              </span>
              <span className="spotBtn__hint">定位</span>
              <input className="spotCheck" type="checkbox" data-select="yipu" aria-label="勾选 艺圃" />
            </button>
          </div>
        </aside>

        <div className="panel__footer" ref={routeFooterRef} id="routeFooter" hidden>
          <button className="btn btn--primary" ref={btnRouteRef} id="btn-route" type="button" disabled>
            按已选地点导航
          </button>
          <button className="btn" ref={btnClearRef} id="btn-clear-select" type="button">
            清空选择
          </button>
        </div>

        <div className="toast" ref={toastRef} id="toast">
          提示：点右侧“推荐路线”里的地点按钮，地图会使用缓动动画平滑移动并缩放到该点。
        </div>
      </div>
    </section>
  );
}

