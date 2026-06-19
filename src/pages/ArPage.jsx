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
    <div id="ar-app">
      <video id="ar-camera" autoPlay muted playsInline />

      <canvas id="ar-canvas" />

      <div id="ar-ui">
        <div id="ar-start-overlay">
          <h1>阊门 · 现场 AR 测试</h1>
          <p>点击开始后，将申请摄像头与设备方向权限。请在户外现场使用，并向下俯视以对齐模型。</p>
          <button id="ar-start-btn" type="button">
            开始体验
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

        <p id="ar-hint" className="is-hidden">
          测试说明：请向下俯视，使用左侧面板将古代建筑与真实地面对齐，记录参数后点「复制参数」。
        </p>
      </div>

      <a id="ar-back" href="index.html">
        ← 返回
      </a>
    </div>
  );
}
