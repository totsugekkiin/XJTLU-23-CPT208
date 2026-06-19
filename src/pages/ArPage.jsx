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
          <div className="ar-panel__row">
            <label className="ar-panel__label" htmlFor="ar-slider-y">
              高度(Y)
            </label>
            <input
              id="ar-slider-y"
              className="ar-panel__slider"
              type="range"
              defaultValue={-12}
            />
            <span id="ar-value-y" className="ar-panel__value">
              当前高度: -12.0m
            </span>
          </div>
          <div className="ar-panel__row">
            <label className="ar-panel__label" htmlFor="ar-slider-z">
              距离(Z)
            </label>
            <input
              id="ar-slider-z"
              className="ar-panel__slider"
              type="range"
              defaultValue={-20}
            />
            <span id="ar-value-z" className="ar-panel__value">
              当前距离: -20.0m
            </span>
          </div>
          <div className="ar-panel__row">
            <label className="ar-panel__label" htmlFor="ar-slider-scale">
              比例(Scale)
            </label>
            <input
              id="ar-slider-scale"
              className="ar-panel__slider"
              type="range"
              defaultValue={1}
            />
            <span id="ar-value-scale" className="ar-panel__value">
              当前比例: 1.0×
            </span>
          </div>
        </div>

        <p id="ar-hint" className="is-hidden">
          测试说明：请向下俯视，使用上方滑块将古代建筑与真实地面对齐，并记录最优参数。
        </p>
      </div>

      <a id="ar-back" href="index.html">
        ← 返回
      </a>
    </div>
  );
}
