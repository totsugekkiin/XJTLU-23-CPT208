import React, { useEffect } from "react";
import { AR_MAP_PROFILES } from "../../js/ar/arAnchors.js";

export function ArPage() {
  const exitAr = () => {
    const returnUrl = new URL("appMain.html?variant=ar&resume=gate", window.location.href);
    window.location.replace(returnUrl.href);
  };

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
        <a-scene
          id="ar-marker-scene"
          class="ar-marker-scene"
          embedded="true"
          vr-mode-ui="enabled: false"
          renderer="alpha: true; antialias: true; colorManagement: true"
          color-space="sRGB"
          device-orientation-permission-ui="enabled: false"
        >
          <a-entity id="ar-marker-target" />
          <a-camera
            position="0 0 0"
            look-controls="enabled: false"
          />
        </a-scene>
      </div>

      <div id="ar-ui">
        <div id="ar-start-overlay">
          <div className="ar-start-mark" aria-hidden="true">簡</div>
          <div className="ar-start-copy">
            <span>阊门 · 实景导览</span>
            <h1>在现场查看阊门历史</h1>
            <p>开启相机后，将建筑区域或识别图案完整置入画面。识别成功后，历史场景和竹简会出现在对应位置。</p>
          </div>
          <label className="ar-field ar-dev-only" htmlFor="ar-map-select">
            识别区域
            <select id="ar-map-select" defaultValue="all">
              <option value="all">全部区域（自动识别）</option>
              {AR_MAP_PROFILES.map((profile) => (
                <option key={profile.mapId} value={profile.mapId}>
                  {profile.label} ({profile.mapId})
                </option>
              ))}
            </select>
          </label>
          <button id="ar-start-btn" type="button">
            开始实景导览
          </button>
          <div id="ar-preload" className="ar-preload" aria-live="polite">
            <div className="ar-preload__copy">
              <span id="ar-preload-status">正在准备导览内容…</span>
              <span id="ar-preload-percent">8%</span>
            </div>
            <div
              id="ar-preload-progress"
              className="ar-preload__track"
              role="progressbar"
              aria-label="导览内容准备进度"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="8"
            >
              <span id="ar-preload-progress-bar" style={{ width: "8%" }} />
            </div>
            <small>内容会在阅读说明时载入，也可以直接开始</small>
          </div>
          <p id="ar-error-msg" />
        </div>

        <section id="ar-guide" className="is-hidden" data-state="scanning" aria-live="polite">
          <div className="ar-reticle" aria-hidden="true">
            <i /><i /><i /><i />
            <span className="ar-reticle__scan" />
          </div>
          <div className="ar-guide__status">
            <span className="ar-guide__indicator" aria-hidden="true" />
            <span>
              <strong id="ar-guide-title">正在识别现场</strong>
              <small id="ar-guide-detail">对准建筑区域，或将完整纹理边框放入画面</small>
              <span id="ar-guide-progress" className="ar-guide__progress" aria-hidden="true">
                <i id="ar-guide-progress-bar" />
              </span>
            </span>
          </div>
        </section>

        <aside id="ar-story" className="is-hidden" aria-hidden="true">
          <button id="ar-story-close" type="button" aria-label="关闭竹简介绍">×</button>
          <span className="ar-story__eyebrow">阊门 · 姑苏八门</span>
          <h2>阖闾建城与阊门位置</h2>
          <p>据传统文献记载，公元前514年，吴王阖闾命伍子胥主持建城。阊门设在古城西北，并以水门、陆门分别连接河道和道路。</p>
          <p className="ar-story__hint">移动手机可查看竹简不同位置，关闭介绍后继续识别现场。</p>
        </aside>

        <div id="ar-controls" className="is-hidden ar-dev-only">
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

        <div id="ar-hint" className="is-hidden ar-dev-only">
          <p>对准已选地图覆盖区域。定位成功后会显示该地图对应的 AR 模型；多地图模式下以识别结果为准。</p>
          <button id="ar-hint-toggle" type="button" aria-expanded="true" aria-label="最小化提示信息">
            -
          </button>
        </div>

        <div id="ar-debug" className="is-hidden ar-dev-only" aria-live="polite">
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
              <span>Unified AR Debug</span>
              <button id="ar-copy-debug" type="button">
                复制 debug
              </button>
            </div>
          <div id="ar-debug-grid" className="ar-debug__grid">
            <div className="ar-debug__item">
              <span>状态</span>
              <strong id="ar-debug-status">idle</strong>
            </div>
            <div className="ar-debug__item">
              <span>Map ID</span>
              <strong id="ar-debug-map">-</strong>
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
              <span>当前模式</span>
              <strong id="ar-debug-mode">scanning</strong>
            </div>
            <div className="ar-debug__item">
              <span>MindAR</span>
              <strong id="ar-debug-marker">not started</strong>
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
          </div>
          <ol id="ar-debug-log" className="ar-debug__log" />
          </div>
        </div>
      </div>

      <nav id="ar-back-nav">
        <a id="ar-back" className="ar-dev-only" href="loc-ar-editor.html">
          摆放工具
        </a>
        <button id="ar-exit" type="button" onClick={exitAr}>
          退出实景导览
        </button>
      </nav>
    </div>
  );
}
