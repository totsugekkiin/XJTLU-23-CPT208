import React, { useEffect } from "react";
import { IMMERSAL_MAP_ID } from "../../js/ar/arAnchors.js";

export function ArPage() {
  useEffect(() => {
    let cleanup = null;
    let cancelled = false;

    (async () => {
      const rootEl = document.getElementById("ar-app");
      if (!rootEl || cancelled) return;

      const mod = await import("../../js/ar/arScene.js");
      if (cancelled) return;
      cleanup = mod.bootstrapArScene(rootEl);
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div id="ar-app" data-ar-mode="loc-ar">
      <div id="ar-camera-wrap">
        <video id="ar-camera" autoPlay muted playsInline />
      </div>

      <div id="ar-ui">
        <div id="ar-start-overlay">
          <h1>Immersal 场景识别测试</h1>
          <p>打开摄像头后，系统会针对 Map {IMMERSAL_MAP_ID} 持续发起定位请求。请在现场已建图区域缓慢移动手机。</p>
          <button id="ar-start-btn" type="button">
            打开摄像头并开始识别
          </button>
          <p id="ar-error-msg" />
        </div>

        <div id="ar-controls" className="is-hidden">
          <div className="ar-controls__header">
            <span>摄像头缩放</span>
            <button id="ar-controls-toggle" type="button" aria-expanded="true" aria-label="收起缩放控制">
              缩放
            </button>
          </div>
          <div className="ar-controls__body">
            <div className="ar-controls__buttons">
              <button id="ar-zoom-out" type="button" aria-label="缩小">
                -
              </button>
              <span id="ar-zoom-value">1.00x</span>
              <button id="ar-zoom-in" type="button" aria-label="放大">
                +
              </button>
            </div>
            <input
              id="ar-zoom-slider"
              className="ar-controls__slider"
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              defaultValue="1"
            />
          </div>
        </div>

        <div id="ar-hint" className="is-hidden">
          <p>对准 Map {IMMERSAL_MAP_ID} 覆盖区域。定位成功后叠加 AR 模型。走动时需持续识别成功，否则位置会漂移。</p>
          <button id="ar-hint-toggle" type="button" aria-expanded="true" aria-label="最小化提示信息">
            -
          </button>
        </div>

        <div id="ar-debug" className="is-hidden" aria-live="polite">
          <button
            id="ar-debug-toggle"
            type="button"
            aria-expanded="true"
            aria-label="收起 debug 面板"
          >
            ◀
          </button>
          <div className="ar-debug__inner">
            <div className="ar-debug__header">
              <span>Immersal Debug</span>
            </div>
          <div id="ar-debug-grid" className="ar-debug__grid">
            <div className="ar-debug__item">
              <span>状态</span>
              <strong id="ar-debug-status">idle</strong>
            </div>
            <div className="ar-debug__item">
              <span>Map ID</span>
              <strong id="ar-debug-map">{IMMERSAL_MAP_ID}</strong>
            </div>
            <div className="ar-debug__item">
              <span>摄像头</span>
              <strong id="ar-debug-camera">waiting</strong>
            </div>
            <div className="ar-debug__item">
              <span>WebXR</span>
              <strong id="ar-debug-webxr">checking</strong>
            </div>
            <div className="ar-debug__item">
              <span>Immersal</span>
              <strong id="ar-debug-immersal">not started</strong>
            </div>
            <div className="ar-debug__item">
              <span>成功/失败</span>
              <strong id="ar-debug-counts">0 / 0</strong>
            </div>
            <div className="ar-debug__item">
              <span>耗时</span>
              <strong id="ar-debug-latency">-</strong>
            </div>
            <div className="ar-debug__item">
              <span>最后错误</span>
              <strong id="ar-debug-error">none</strong>
            </div>
          </div>
          <pre id="ar-debug-pose">pose: waiting</pre>
          <div className="ar-debug__actions">
            <button id="ar-localize-now" type="button">
              手动识别一次
            </button>
            <button id="ar-copy-debug" type="button">
              复制 debug
            </button>
          </div>
          <ol id="ar-debug-log" className="ar-debug__log" />
          </div>
        </div>
      </div>

      <nav id="ar-back-nav">
        <a id="ar-back" href="loc-ar-editor.html">
          摆放工具
        </a>
        <a href="index.html">← 返回</a>
      </nav>
    </div>
  );
}
