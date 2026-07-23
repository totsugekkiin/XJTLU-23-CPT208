import React, { useEffect } from "react";
import { AR_MAP_PROFILES, DEFAULT_MAP_ID, getMapProfile } from "../../js/ar/arAnchors.js";

export function ArEditorPage() {
  const requestedMapId = Number(new URLSearchParams(window.location.search).get("map"));
  const initialMapId = getMapProfile(requestedMapId)?.mapId ?? DEFAULT_MAP_ID;

  useEffect(() => {
    let cleanup = null;
    let cancelled = false;

    (async () => {
      const rootEl = document.getElementById("ar-editor-app");
      if (!rootEl || cancelled) return;

      const mod = await import("../../js/ar/arPlacementEditor.js");
      if (cancelled) return;
      cleanup = mod.bootstrapArPlacementEditor(rootEl);
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div id="ar-editor-app">
      <canvas id="ar-editor-canvas" />

      <aside id="ar-editor-panel">
        <header className="ar-editor-panel__header">
          <span className="ar-editor-kicker">IMMERSAL MAP {initialMapId}</span>
          <h1>悬眼遮罩校准台</h1>
          <p>让青色遮罩与点云中的悬眼孔洞重合；调好后复制当前参数即可。</p>
        </header>

        <section className="ar-editor-section">
          <h2>地图参考</h2>
          <label className="ar-editor-field">
            编辑地图
            <select id="ar-editor-map-select" defaultValue={String(initialMapId)}>
              {AR_MAP_PROFILES.map((profile) => (
                <option key={profile.mapId} value={profile.mapId}>
                  {profile.label} ({profile.mapId})
                </option>
              ))}
            </select>
          </label>
          <p id="ar-editor-map-hint" className="ar-editor-hint">
            Map {initialMapId} · 白色为场景点，绿色为扫描轨迹
          </p>
          <div className="ar-editor-row">
            <button id="ar-editor-load-sparse" type="button">
              加载稀疏点云
            </button>
            <button id="ar-editor-load-dense" type="button">
              加载稠密点云
            </button>
          </div>
          <div className="ar-editor-sliders">
            <label>
              点大小 <output id="ar-editor-point-size-output">0.018</output>
              <input id="ar-editor-point-size" type="range" min="0.002" max="0.06" step="0.001" defaultValue="0.018" />
            </label>
            <label>
              点云透明度 <output id="ar-editor-point-opacity-output">100%</output>
              <input id="ar-editor-point-opacity" type="range" min="0.05" max="1" step="0.05" defaultValue="1" />
            </label>
          </div>
          <label className="ar-editor-file">
            本地参考 (.ply / .glb)
            <input id="ar-editor-ref-file" type="file" accept=".ply,.glb,.gltf" />
          </label>
          <div className="ar-editor-row">
            <button id="ar-editor-toggle-ref" type="button">
              隐藏点云
            </button>
            <button id="ar-editor-toggle-grid" type="button">
              隐藏网格
            </button>
            <button id="ar-editor-reset-camera" type="button">
              重置视角
            </button>
          </div>
          <p className="ar-editor-hint">
            方向键 / WASD 平移视角，Q/E 升降，Shift 加速（输入框聚焦时无效）。
          </p>
        </section>

        <section className="ar-editor-section">
          <h2>遮罩锚点</h2>
          <label className="ar-editor-field">
            当前锚点
            <select id="ar-editor-anchor-select" />
          </label>
          <label id="ar-editor-model-file-field" className="ar-editor-file">
            替换模型 (.glb)
            <input id="ar-editor-model-file" type="file" accept=".glb,.gltf" />
          </label>
          <div className="ar-editor-modes">
            <button id="ar-editor-mode-translate" type="button" className="is-active">
              移动
            </button>
            <button id="ar-editor-mode-rotate" type="button">
              旋转
            </button>
            <button id="ar-editor-mode-scale" type="button">
              缩放
            </button>
          </div>
          <p className="ar-editor-hint">拖曳彩色 Gizmo 粗调，使用下方按钮精调。</p>
        </section>

        <section id="ar-editor-portal-section" className="ar-editor-section ar-editor-portal-section">
          <h2>遮罩精调</h2>
          <div className="ar-editor-view-presets" aria-label="观察视角">
            <button type="button" data-ar-view="entrance">入口正视</button>
            <button type="button" data-ar-view="perspective">透视</button>
            <button type="button" data-ar-view="side">侧视</button>
            <button type="button" data-ar-view="top">俯视</button>
          </div>
          <label className="ar-editor-field ar-editor-step-field">
            精调步长
            <select id="ar-editor-nudge-step" defaultValue="0.005">
              <option value="0.001">1 mm</option>
              <option value="0.005">5 mm</option>
              <option value="0.01">1 cm</option>
              <option value="0.05">5 cm</option>
            </select>
          </label>
          <div className="ar-editor-nudge-list">
            {[
              ["px", "位置 X"], ["py", "位置 Y"], ["pz", "位置 Z"],
              ["sx", "墙深 X"], ["sy", "洞高 Y"], ["sz", "洞宽 Z"],
            ].map(([field, label]) => (
              <div className="ar-editor-nudge" key={field}>
                <span>{label}</span>
                <button type="button" data-ar-nudge={field} data-ar-sign="-1" aria-label={`${label} 减少`}>−</button>
                <output id={`ar-editor-${field}-readout`}>0.000</output>
                <button type="button" data-ar-nudge={field} data-ar-sign="1" aria-label={`${label} 增加`}>＋</button>
              </div>
            ))}
          </div>
          <div className="ar-editor-rotation-nudge">
            <span>旋转步进 0.5°</span>
            {[["rx", "X"], ["ry", "Y"], ["rz", "Z"]].map(([field, label]) => (
              <div key={field}>
                <b>{label}</b>
                <button type="button" data-ar-nudge={field} data-ar-sign="-1">−</button>
                <button type="button" data-ar-nudge={field} data-ar-sign="1">＋</button>
              </div>
            ))}
          </div>
          <div className="ar-editor-sliders">
            <label>
              遮罩透明度 <output id="ar-editor-portal-opacity-output">28%</output>
              <input id="ar-editor-portal-opacity" type="range" min="0.05" max="0.8" step="0.01" defaultValue="0.28" />
            </label>
          </div>
          <div className="ar-editor-row">
            <button id="ar-editor-toggle-portal-test" type="button" className="ar-editor-primary">
              隐藏透视测试场景
            </button>
            <button id="ar-editor-reset-anchor" type="button">恢复初始遮罩</button>
            <button id="ar-editor-copy-current" type="button" className="ar-editor-primary">复制当前参数</button>
          </div>
          <p className="ar-editor-hint">
            彩色物体位于墙后不同距离。保持“入口正视”后用 WASD 左右移动，观察近处物体比远处物体移动得更快。
          </p>
          <pre id="ar-editor-portal-summary" className="ar-editor-summary" />
        </section>

        <details className="ar-editor-section ar-editor-details">
          <summary>直接输入完整数值</summary>
          <div className="ar-editor-grid">
            <label>
              位置 X
              <input id="ar-editor-px" type="number" step="0.01" defaultValue="0" />
            </label>
            <label>
              位置 Y
              <input id="ar-editor-py" type="number" step="0.01" defaultValue="0" />
            </label>
            <label>
              位置 Z
              <input id="ar-editor-pz" type="number" step="0.01" defaultValue="0" />
            </label>
            <label>
              旋转 X°
              <input id="ar-editor-rx" type="number" step="1" defaultValue="0" />
            </label>
            <label>
              旋转 Y°
              <input id="ar-editor-ry" type="number" step="1" defaultValue="0" />
            </label>
            <label>
              旋转 Z°
              <input id="ar-editor-rz" type="number" step="1" defaultValue="0" />
            </label>
            <label>
              <span id="ar-editor-sx-label">墙深 X</span>
              <input id="ar-editor-sx" type="number" step="0.01" defaultValue="1" />
            </label>
            <label>
              <span id="ar-editor-sy-label">洞高 Y</span>
              <input id="ar-editor-sy" type="number" step="0.01" defaultValue="1" />
            </label>
            <label>
              <span id="ar-editor-sz-label">洞宽 Z</span>
              <input id="ar-editor-sz" type="number" step="0.01" defaultValue="1" />
            </label>
          </div>
        </details>

        <section className="ar-editor-section">
          <h2>完整配置（高级）</h2>
          <div className="ar-editor-row">
            <button id="ar-editor-export" type="button" className="ar-editor-primary">
              下载 arAnchors.js
            </button>
            <button id="ar-editor-copy" type="button">
              复制全部配置
            </button>
            <button id="ar-editor-import" type="button">
              导入 JSON
            </button>
            <input id="ar-editor-import-file" type="file" accept=".json" hidden />
          </div>
        </section>

        <p id="ar-editor-status" className="ar-editor-status">
          初始化中…
        </p>
      </aside>

      <nav className="ar-editor-nav">
        <a href={`loc-ar.html?map=${initialMapId}`}>← AR 测试</a>
        <a href="index.html">首页</a>
      </nav>
    </div>
  );
}
