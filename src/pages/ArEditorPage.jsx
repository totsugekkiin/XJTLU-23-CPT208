import React, { useEffect } from "react";
import { IMMERSAL_MAP_ID } from "../../js/ar/arAnchors.js";

export function ArEditorPage() {
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
          <h1>AR 摆放工具</h1>
          <p>对照点云/网格摆放模型，导出后覆盖 <code>js/ar/arAnchors.js</code></p>
        </header>

        <section className="ar-editor-section">
          <h2>地图参考</h2>
          <p className="ar-editor-hint">Map {IMMERSAL_MAP_ID} · 白色为场景点，绿色为扫描轨迹</p>
          <div className="ar-editor-row">
            <button id="ar-editor-load-sparse" type="button">
              加载稀疏点云
            </button>
            <button id="ar-editor-load-dense" type="button">
              加载稠密点云
            </button>
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
        </section>

        <section className="ar-editor-section">
          <h2>模型锚点</h2>
          <label className="ar-editor-field">
            当前锚点
            <select id="ar-editor-anchor-select" />
          </label>
          <label className="ar-editor-file">
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
          <p className="ar-editor-hint">拖曳彩色 Gizmo，或在下方输入数值</p>
        </section>

        <section className="ar-editor-section">
          <h2>变换</h2>
          <div className="ar-editor-grid">
            <label>
              X
              <input id="ar-editor-px" type="number" step="0.01" defaultValue="0" />
            </label>
            <label>
              Y
              <input id="ar-editor-py" type="number" step="0.01" defaultValue="0" />
            </label>
            <label>
              Z
              <input id="ar-editor-pz" type="number" step="0.01" defaultValue="0" />
            </label>
            <label>
              Rot X°
              <input id="ar-editor-rx" type="number" step="1" defaultValue="0" />
            </label>
            <label>
              Rot Y°
              <input id="ar-editor-ry" type="number" step="1" defaultValue="0" />
            </label>
            <label>
              Rot Z°
              <input id="ar-editor-rz" type="number" step="1" defaultValue="0" />
            </label>
            <label>
              Sx
              <input id="ar-editor-sx" type="number" step="0.01" defaultValue="1" />
            </label>
            <label>
              Sy
              <input id="ar-editor-sy" type="number" step="0.01" defaultValue="1" />
            </label>
            <label>
              Sz
              <input id="ar-editor-sz" type="number" step="0.01" defaultValue="1" />
            </label>
          </div>
        </section>

        <section className="ar-editor-section">
          <h2>导出配置</h2>
          <div className="ar-editor-row">
            <button id="ar-editor-export" type="button" className="ar-editor-primary">
              下载 arAnchors.js
            </button>
            <button id="ar-editor-copy" type="button">
              复制配置
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
        <a href="loc-ar.html">← AR 测试</a>
        <a href="index.html">首页</a>
      </nav>
    </div>
  );
}
