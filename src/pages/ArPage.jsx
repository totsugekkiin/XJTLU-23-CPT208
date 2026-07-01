import React, { useEffect } from "react";

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
      <video id="ar-camera" autoPlay muted playsInline />

      <canvas id="ar-canvas" />

      <div id="ar-ui">
        <div id="ar-start-overlay">
          <h1>阊门 · Immersal AR 识别</h1>
          <p>点击开始后会打开后置摄像头，并用 Immersal Map 148549 尝试识别当前场景。请在已建图区域缓慢移动手机。</p>
          <button id="ar-start-btn" type="button">
            打开摄像头并开始识别
          </button>
          <p id="ar-error-msg" />
        </div>

        <div id="ar-panel" className="is-hidden">
          <button id="ar-panel-toggle" type="button" aria-expanded="true" aria-label="收起调参面板">
            ◀
          </button>
          <div id="ar-panel-inner">
            <div className="ar-panel__header">调参面板</div>
            <div id="ar-panel-body" />
            <button id="ar-copy-params" type="button">
              复制参数
            </button>
          </div>
        </div>

        <div id="ar-hint" className="is-hidden">
          <p>识别说明：将摄像头对准 Immersal Map 148549 覆盖的场景，右侧 debug 面板会实时显示识别状态。</p>
          <button id="ar-hint-toggle" type="button" aria-expanded="true" aria-label="最小化提示信息">
            -
          </button>
        </div>

        <div id="ar-debug" className="is-hidden" aria-live="polite">
          <div className="ar-debug__header">
            <span>Immersal Debug</span>
            <button id="ar-debug-toggle" type="button" aria-expanded="true" aria-label="收起 debug 面板">
              Debug
            </button>
          </div>
          <div id="ar-debug-grid" className="ar-debug__grid">
            <div className="ar-debug__item">
              <span>状态</span>
              <strong id="ar-debug-status">idle</strong>
            </div>
            <div className="ar-debug__item">
              <span>Map ID</span>
              <strong id="ar-debug-map">148549</strong>
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

      <a id="ar-back" href="index.html">
        ← 返回
      </a>
    </div>
  );
}
