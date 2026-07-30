import React, { useEffect, useState } from "react";
import { AR_MAP_PROFILES } from "../../js/ar/arAnchors.js";
import {
  AR_FIELD_MAP_STORAGE_KEY,
  getResolvedFieldMapLocations,
} from "../../js/ar/arFieldMapConfig.js";
import { ArFieldMapPlan, AR_FIELD_MAP_VIEWBOX } from "./ArFieldMapPlan.jsx";

function MapFoldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3.5 5.5 5-2 7 2 5-2v15l-5 2-7-2-5 2z" />
      <path d="M8.5 3.5v15M15.5 5.5v15" />
    </svg>
  );
}

export function ArBambooMap() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMapId, setActiveMapId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMap = params.get("map");
    const requestedMapId = requestedMap == null ? Number.NaN : Number(requestedMap);
    return Number.isFinite(requestedMapId) ? requestedMapId : null;
  });

  const [locations, setLocations] = useState(() => getResolvedFieldMapLocations());

  useEffect(() => {
    const rootEl = document.getElementById("ar-app");
    if (!rootEl) return undefined;

    const onLocalizedMapChange = (event) => {
      const nextMapId = Number(event.detail?.mapId);
      if (Number.isFinite(nextMapId)) setActiveMapId(nextMapId);
    };

    rootEl.addEventListener("ar:localized-map-change", onLocalizedMapChange);
    return () => rootEl.removeEventListener("ar:localized-map-change", onLocalizedMapChange);
  }, []);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === AR_FIELD_MAP_STORAGE_KEY) {
        setLocations(getResolvedFieldMapLocations());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const activeProfile = AR_MAP_PROFILES.find((profile) => profile.mapId === activeMapId);

  return (
    <aside className={`ar-bamboo-map${isOpen ? " is-open" : ""}`}>
      <button
        className="ar-bamboo-map__toggle"
        type="button"
        aria-expanded={isOpen}
        aria-controls="ar-bamboo-map-panel"
        onClick={() => setIsOpen((open) => !open)}
      >
        <MapFoldIcon />
        <span>竹简地图</span>
      </button>

      {isOpen && (
        <section id="ar-bamboo-map-panel" className="ar-bamboo-map__panel" aria-label="竹简点位地图">
          <header className="ar-bamboo-map__header">
            <div>
              <span>阊门 · 城墙现场</span>
              <h2>竹简分布图</h2>
            </div>
            <button type="button" aria-label="收起竹简地图" onClick={() => setIsOpen(false)}>×</button>
          </header>

          <div className="ar-bamboo-map__canvas">
            <svg viewBox={AR_FIELD_MAP_VIEWBOX} role="img" aria-labelledby="ar-bamboo-map-title ar-bamboo-map-desc">
              <title id="ar-bamboo-map-title">阊门城墙竹简分布图</title>
              <desc id="ar-bamboo-map-desc">沿城墙与城门布置的五处竹简和一处历史窗口。</desc>
              <ArFieldMapPlan />
              {locations.map((location) => {
                const [x, y] = location.fieldMapPosition;
                const isActive = activeMapId === location.mapId;
                const isWindow = location.type === "window";
                return (
                  <g
                    key={location.id}
                    className={`ar-bamboo-map__pin${isWindow ? " ar-bamboo-map__pin--window" : ""}${isActive ? " is-active" : ""}`}
                    data-map-id={location.mapId ?? undefined}
                    transform={`translate(${x} ${y})`}
                  >
                    <title>{`${location.markerLabel}. ${location.label}（${location.areaLabel}）`}</title>
                    <circle className="ar-bamboo-map__pin-pulse" r="13" />
                    {isWindow ? (
                      <>
                        <rect x="-10" y="-9" width="20" height="18" rx="2" />
                        <path d="M-7-6 7 6M7-6-7 6" />
                        <text y="18">窗</text>
                      </>
                    ) : (
                      <>
                        <path d="M0-10c-6 0-10 4-10 10 0 7 10 16 10 16S10 7 10 0C10-6 6-10 0-10Z" />
                        <circle r="5.5" />
                        <text y="2.4">{location.markerLabel}</text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="ar-bamboo-map__status" aria-live="polite">
            <i aria-hidden="true" />
            <span>
              {activeProfile
                ? `当前已定位：${activeProfile.label} · 已高亮该区域竹简`
                : "5 处竹简 · 1 处窗口 · 到达点位附近后对准城墙识别"}
            </span>
          </div>

          <ol className="ar-bamboo-map__legend">
            {locations.map((location) => (
              <li
                key={`${location.id}-legend`}
                className={`${activeMapId === location.mapId ? "is-active" : ""}${location.type === "window" ? " is-window" : ""}`}
              >
                <b>{location.markerLabel}</b>
                <span>{location.label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </aside>
  );
}
