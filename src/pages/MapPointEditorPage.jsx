import React, { useMemo, useRef, useState } from "react";
import {
  AR_FIELD_MAP_HEIGHT,
  AR_FIELD_MAP_WIDTH,
  createFieldMapPayload,
  getDefaultFieldMapLocations,
  getResolvedFieldMapLocations,
  normalizeFieldMapPosition,
  saveFieldMapLocations,
} from "../../js/ar/arFieldMapConfig.js";
import { ArFieldMapPlan, AR_FIELD_MAP_VIEWBOX } from "../components/ArFieldMapPlan.jsx";

function payloadSignature(locations) {
  return JSON.stringify(createFieldMapPayload(locations));
}

function Marker({ location, selected, onPointerDown, onSelect, onNudge }) {
  const [x, y] = location.fieldMapPosition;
  const isWindow = location.type === "window";

  return (
    <g
      className={`map-point-marker map-point-marker--${location.type}${selected ? " is-selected" : ""}`}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex="0"
      aria-label={`${location.markerLabel} ${location.label}，坐标 ${x}, ${y}`}
      onPointerDown={(event) => onPointerDown(location.id, event)}
      onClick={() => onSelect(location.id)}
      onKeyDown={(event) => {
        const deltas = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        const delta = deltas[event.key];
        if (!delta) return;
        event.preventDefault();
        onNudge(location.id, delta[0], delta[1]);
      }}
    >
      <circle className="map-point-marker__hit" r="18" />
      <circle className="map-point-marker__selection" r="15" />
      {isWindow ? (
        <>
          <rect x="-10" y="-9" width="20" height="18" rx="2" />
          <path d="M-7-6 7 6M7-6-7 6" />
          <text y="18">窗</text>
        </>
      ) : (
        <>
          <path d="M0-11c-6.4 0-11 4.6-11 11 0 7.6 11 17 11 17S11 7.6 11 0C11-6.4 6.4-11 0-11Z" />
          <circle r="6" />
          <text y="2.5">{location.markerLabel}</text>
        </>
      )}
    </g>
  );
}

export function MapPointEditorPage() {
  const [locations, setLocations] = useState(() => getResolvedFieldMapLocations());
  const [selectedId, setSelectedId] = useState(() => getResolvedFieldMapLocations()[0]?.id ?? null);
  const [draggingId, setDraggingId] = useState(null);
  const [savedSignature, setSavedSignature] = useState(() =>
    payloadSignature(getResolvedFieldMapLocations()),
  );
  const [status, setStatus] = useState("已载入当前点位；拖动后点击“保存到浏览器”即可应用到 AR 地图。");
  const svgRef = useRef(null);

  const selected = useMemo(
    () => locations.find((location) => location.id === selectedId) ?? locations[0],
    [locations, selectedId],
  );
  const dirty = payloadSignature(locations) !== savedSignature;

  function setPosition(id, position) {
    const normalized = normalizeFieldMapPosition(position);
    if (!normalized) return;
    setLocations((current) => current.map((location) =>
      location.id === id
        ? { ...location, fieldMapPosition: normalized }
        : location));
    setStatus("有未保存的点位修改。");
  }

  function nudge(id, dx, dy) {
    const location = locations.find((item) => item.id === id);
    if (!location) return;
    setSelectedId(id);
    setPosition(id, [
      location.fieldMapPosition[0] + dx,
      location.fieldMapPosition[1] + dy,
    ]);
  }

  function pointerToMap(event) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return null;
    return normalizeFieldMapPosition([
      ((event.clientX - rect.left) / rect.width) * AR_FIELD_MAP_WIDTH,
      ((event.clientY - rect.top) / rect.height) * AR_FIELD_MAP_HEIGHT,
    ]);
  }

  function startDrag(id, event) {
    event.preventDefault();
    setSelectedId(id);
    setDraggingId(id);
    svgRef.current?.setPointerCapture?.(event.pointerId);
    const position = pointerToMap(event);
    if (position) setPosition(id, position);
  }

  function moveDrag(event) {
    if (!draggingId) return;
    const position = pointerToMap(event);
    if (position) setPosition(draggingId, position);
  }

  function endDrag(event) {
    if (!draggingId) return;
    svgRef.current?.releasePointerCapture?.(event.pointerId);
    setDraggingId(null);
  }

  function save() {
    const payload = saveFieldMapLocations(locations);
    setSavedSignature(JSON.stringify(payload));
    setStatus("已保存到当前浏览器；重新打开或刷新 AR 页面即可看到新点位。");
  }

  async function copyConfig() {
    const text = JSON.stringify(createFieldMapPayload(locations), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("六个点位配置已复制，可以直接粘贴给 Codex。");
    } catch {
      setStatus("浏览器未允许复制，请从下方配置框手动复制。");
    }
  }

  function revert() {
    const saved = getResolvedFieldMapLocations();
    setLocations(saved);
    setSavedSignature(payloadSignature(saved));
    setStatus("已撤销未保存修改，恢复为浏览器中已保存的点位。");
  }

  function resetDefaults() {
    if (!window.confirm("恢复六个点位的默认位置？保存前仍可用“撤销未保存”返回。")) return;
    setLocations(getDefaultFieldMapLocations());
    setStatus("已恢复默认位置，但尚未保存。");
  }

  function saveAndOpenAr() {
    save();
    window.open("loc-ar.html?map=148753", "_blank", "noopener,noreferrer");
  }

  return (
    <div className="map-point-editor-app">
      <header className="map-point-editor-header">
        <div>
          <span>CHANGMEN · FIELD MAP</span>
          <h1>地图点位校准台</h1>
          <p>拖动 5 个竹简和 1 个窗口；右侧可输入坐标或逐像素微调。</p>
        </div>
        <nav>
          <a href="loc-ar.html">查看 AR</a>
          <a href="loc-ar-editor.html">三维锚点台</a>
        </nav>
      </header>

      <main className="map-point-editor-main">
        <section className="map-point-stage-card">
          <div className="map-point-stage-toolbar">
            <span><i /> 拖动标记调整位置</span>
            <output className={dirty ? "is-dirty" : ""}>{dirty ? "未保存" : "已保存"}</output>
          </div>
          <div className={`map-point-stage${draggingId ? " is-dragging" : ""}`}>
            <svg
              ref={svgRef}
              viewBox={AR_FIELD_MAP_VIEWBOX}
              aria-label="阊门地图六个可拖动点位"
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <ArFieldMapPlan />
              {selected && (
                <g className="map-point-guides" aria-hidden="true">
                  <path d={`M${selected.fieldMapPosition[0]} 0v${AR_FIELD_MAP_HEIGHT}`} />
                  <path d={`M0 ${selected.fieldMapPosition[1]}h${AR_FIELD_MAP_WIDTH}`} />
                </g>
              )}
              {locations.map((location) => (
                <Marker
                  key={location.id}
                  location={location}
                  selected={location.id === selected?.id}
                  onPointerDown={startDrag}
                  onSelect={setSelectedId}
                  onNudge={nudge}
                />
              ))}
            </svg>
          </div>
          <p className="map-point-stage-hint">
            坐标范围 X: 0–{AR_FIELD_MAP_WIDTH}，Y: 0–{AR_FIELD_MAP_HEIGHT}。点位会限制在地图画布内。
          </p>
        </section>

        <aside className="map-point-console">
          <section>
            <div className="map-point-console-title">
              <div>
                <span>全部位置</span>
                <h2>6 个点位</h2>
              </div>
              <b>5 竹简 + 1 窗口</b>
            </div>
            <div className="map-point-list" role="list">
              {locations.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  className={`${location.id === selected?.id ? "is-selected" : ""} is-${location.type}`}
                  onClick={() => setSelectedId(location.id)}
                >
                  <i>{location.markerLabel}</i>
                  <span><strong>{location.label}</strong><small>{location.areaLabel}</small></span>
                  <output>{location.fieldMapPosition.join(", ")}</output>
                </button>
              ))}
            </div>
          </section>

          {selected && (
            <section className="map-point-selected">
              <span>当前点位</span>
              <h2>{selected.markerLabel} · {selected.label}</h2>
              <div className="map-point-coordinate-grid">
                <label>
                  X 坐标
                  <input
                    type="number"
                    min="0"
                    max={AR_FIELD_MAP_WIDTH}
                    step="0.1"
                    value={selected.fieldMapPosition[0]}
                    onChange={(event) => setPosition(selected.id, [event.target.value, selected.fieldMapPosition[1]])}
                  />
                </label>
                <label>
                  Y 坐标
                  <input
                    type="number"
                    min="0"
                    max={AR_FIELD_MAP_HEIGHT}
                    step="0.1"
                    value={selected.fieldMapPosition[1]}
                    onChange={(event) => setPosition(selected.id, [selected.fieldMapPosition[0], event.target.value])}
                  />
                </label>
              </div>
              <div className="map-point-nudge" aria-label="点位微调">
                <button type="button" onClick={() => nudge(selected.id, -5, 0)}>X −5</button>
                <button type="button" onClick={() => nudge(selected.id, -1, 0)}>← 1</button>
                <button type="button" onClick={() => nudge(selected.id, 0, -1)}>↑ 1</button>
                <button type="button" onClick={() => nudge(selected.id, 0, 1)}>↓ 1</button>
                <button type="button" onClick={() => nudge(selected.id, 1, 0)}>1 →</button>
                <button type="button" onClick={() => nudge(selected.id, 5, 0)}>X +5</button>
              </div>
            </section>
          )}

          <section className="map-point-actions">
            <button type="button" className="is-primary" onClick={save}>保存到浏览器</button>
            <button type="button" onClick={copyConfig}>复制配置</button>
            <button type="button" onClick={saveAndOpenAr}>保存并打开 AR</button>
            <button type="button" onClick={revert} disabled={!dirty}>撤销未保存</button>
            <button type="button" onClick={resetDefaults}>恢复默认</button>
          </section>

          <p className="map-point-status" aria-live="polite">{status}</p>
          <details>
            <summary>查看当前 JSON 配置</summary>
            <pre>{JSON.stringify(createFieldMapPayload(locations), null, 2)}</pre>
          </details>
        </aside>
      </main>
    </div>
  );
}
