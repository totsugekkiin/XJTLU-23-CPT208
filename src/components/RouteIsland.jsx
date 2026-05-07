import React, { useEffect, useRef } from "react";

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

export function RouteIsland() {
  const toastRef = useRef(null);
  const spotsRef = useRef(null);
  const routeFooterRef = useRef(null);
  const btnRouteRef = useRef(null);
  const btnClearRef = useRef(null);
  const hiddenMapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let dispose = null;

    const setToast = (txt) => {
      const el = toastRef.current;
      if (!el) return;
      el.textContent = txt;
    };

    (async () => {
      try {
        await ensureAmapScriptLoaded();
      } catch (err) {
        console.error(err);
        setToast(err?.message ? String(err.message) : "AMap 未加载成功。");
        return;
      }
      if (cancelled) return;

      // 仅用于 Driving 计算与回调；不在河流阶段展示地图本体
      const map = new window.AMap.Map(hiddenMapRef.current, {
        center: [120.604, 31.314],
        zoom: 15.5,
        viewMode: "3D",
        pitch: 45,
        mapStyle: "amap://styles/dark",
        resizeEnable: true,
      });

      let driving = null;
      await new Promise((resolve) => {
        window.AMap.plugin(["AMap.Driving"], () => {
          driving = new window.AMap.Driving({ map, hideMarkers: true });
          resolve(true);
        });
      });
      if (cancelled) {
        map.destroy?.();
        return;
      }

      const selectedIds = [];

      const updateFooter = () => {
        const count = selectedIds.length;
        const routeFooterEl = routeFooterRef.current;
        const btnRouteEl = btnRouteRef.current;
        if (!routeFooterEl || !btnRouteEl) return;
        const shouldShow = count >= 2;
        routeFooterEl.hidden = !shouldShow;
        btnRouteEl.disabled = !shouldShow || !driving;
        btnRouteEl.textContent = shouldShow ? `按已选地点导航（${count} 个点）` : "按已选地点导航";
      };

      const syncCheckboxes = () => {
        const root = spotsRef.current;
        if (!root) return;
        root.querySelectorAll(".routeIslandCheck[data-select]").forEach((el) => {
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

      const onSpotsChange = (e) => {
        const chk = e.target?.closest?.(".routeIslandCheck[data-select]");
        if (!chk) return;
        toggleSelected(chk.getAttribute("data-select"), chk.checked);
      };

      const toLngLat = (lnglat) => new window.AMap.LngLat(lnglat[0], lnglat[1]);

      const onRouteClick = async () => {
        if (selectedIds.length < 2) return;
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

      spotsRef.current?.addEventListener("change", onSpotsChange);
      btnRouteRef.current?.addEventListener("click", onRouteClick);
      btnClearRef.current?.addEventListener("click", onClearClick);

      updateFooter();
      setToast("推荐路线：勾选 2 个以上地点以生成导航。");

      dispose = () => {
        spotsRef.current?.removeEventListener("change", onSpotsChange);
        btnRouteRef.current?.removeEventListener("click", onRouteClick);
        btnClearRef.current?.removeEventListener("click", onClearClick);
        driving?.clear?.();
        map.destroy?.();
      };
    })();

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return (
    <div className="route-island-ui" aria-label="推荐路线面板">
      <div className="route-island-ui__head">
        <div className="route-island-ui__title">推荐路线</div>
        <div className="route-island-ui__hint">勾选 ≥2 个点 → 生成导航</div>
      </div>

      <div className="route-island-ui__spots" ref={spotsRef}>
        {Object.entries(SPOTS).map(([id, spot]) => (
          <label className="route-island-ui__spot" key={id}>
            <input className="routeIslandCheck" type="checkbox" data-select={id} aria-label={`勾选 ${spot.name}`} />
            <span className="route-island-ui__spotName">{spot.name}</span>
          </label>
        ))}
      </div>

      <div className="route-island-ui__footer" ref={routeFooterRef} hidden>
        <button className="route-island-ui__btn route-island-ui__btn--primary" ref={btnRouteRef} type="button" disabled>
          按已选地点导航
        </button>
        <button className="route-island-ui__btn" ref={btnClearRef} type="button">
          清空
        </button>
      </div>

      <div className="route-island-ui__toast" ref={toastRef} aria-live="polite">
        正在加载…
      </div>

      <div className="route-island-ui__hiddenMap" ref={hiddenMapRef} aria-hidden="true" />
    </div>
  );
}

