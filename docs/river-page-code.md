# 河流界面（River Page）核心代码摘录

这份文档用于汇总“幕布合拢 → 进入河流页 → 河流从上到下蔓延 → 解锁滚动 → 可上滑退出”的关键实现位置。

> 说明：以下为**关键片段摘录**，完整实现请以源码文件为准。

## 1) DOM 结构（React 页面）

文件：`src/pages/AppMainPage.jsx`

- `#river-scroll-spacer`：进入河流页后滚动叙事的起点（用来定位“河流页顶部”）
- `#river-stage`：fixed 画布层（canvas + 岛屿层 + 船）
- `#route-section`：河流页底部的后续段（地图/纯色 mock），并用“入海漏斗”与河流衔接

```jsx
<div id="river-scroll-spacer" aria-hidden="true" />

<div className="river-stage" id="river-stage" aria-hidden="true">
  <canvas id="river-canvas" />
  <div className="river-island-layer" id="river-island-layer" aria-hidden="true">...</div>
  <div id="boat-container" aria-hidden="true">...</div>
</div>

<section className="route-after-river" id="route-section" aria-label="推荐路线">
  <svg className="river-sea-funnel" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path
      d="M 47.2 0
         C 47.2 28, 33 50, 20 70
         C 13 80, 7 90, 0 100
         L 100 100
         C 93 90, 87 80, 80 70
         C 67 50, 52.8 28, 52.8 0
         Z"
      fill="rgba(6, 28, 45, 0.92)"
    />
  </svg>

  <RouteSection heightVh={100} />
</section>
```

## 2) 河流页模式（进入/退出/滚动锁）

文件：`js/appmain.js`

### 2.1 进入河流页（幕布合拢回调）

- 在幕布完全合拢后触发 `onClosed()`
- `enterRiverPage()`：
  - 添加 `body.is-river-page`（隐藏首屏/胶片段，并允许显示地图段）
  - `#river-scroll-spacer.scrollIntoView({behavior:"auto"})` 作为河流页的“顶部”
- 滚动锁：
  - 进入河流页并滚到 spacer 后，下一帧 `lockScroll()` 锁住滚动
  - 河流“蔓延触底”后回调 `unlockScroll()` 解锁

```js
const transition = createCurtainRiverTransition({
  onClosed() {
    // 1) 进入河流页并滚到 spacer 顶部
    enterRiverPage();

    // 2) 下一帧锁滚动，再启动河流动画
    requestAnimationFrame(() => {
      lockScroll();
      riverScene.startFlow({
        duration: prefersReducedMotion ? 0.01 : 2.4,
        ease: prefersReducedMotion ? "none" : "power2.inOut",
        boatDelay: prefersReducedMotion ? 0 : 0.55,
        boatEnterDuration: prefersReducedMotion ? 0.01 : 0.7,
        onReachedBottom: () => unlockScroll(),
      });
    });
  },
  onBeforeOpen() {
    riverScene?.stopAndHide?.();
    document.body.classList.remove("is-river-page");
    riverPage.active = false;
  },
});
```

### 2.2 上滑退出河流页

- 河流页中监听 `scroll`：
  - 先要求用户从顶部往下滚开一点（`exitArmed`）
  - 再检测“明显向上滚 + 回到顶部附近”触发退出

```js
const onScrollForRiverPageExit = () => {
  if (!riverPage.active) return;
  const y = window.scrollY;
  const dy = y - (riverPage.lastScrollY ?? y);
  riverPage.lastScrollY = y;

  if (!riverPage.exitArmed) {
    if (y >= riverPage.riverTopY + 24) riverPage.exitArmed = true;
    return;
  }

  if (dy < -0.5 && y <= riverPage.riverTopY + 6) {
    exitRiverPage();
  }
};
```

## 3) 河流 Canvas：水头蔓延 + “触底完成”判定

文件：`js/appmain/riverScene.js`

### 3.1 关键状态

- `riverAnimState`: `"idle" | "flowing" | "done"`
- `flow.riverFlowY`: 由 GSAP tween 推进（表示河流向下“增长”的世界坐标）
- `scroll.startY`: 进入河流页后记录的起始 scrollY（用于计算 `scrollDelta`）

```js
let riverAnimState = "idle";
const flow = { riverFlowY: 0 };
const scroll = { startY: 0 };
```

### 3.2 水头触底判定（用于“触底后可解锁滚动”）

`drawRiver()` 内部的核心判定：

```js
const HEAD_LEN_MAX = 150;
const scrollDelta = Math.max(0, window.scrollY - scroll.startY);
const grownAhead = flow.riverFlowY - scrollDelta;
const reachedBottom = riverAnimState === "done" || grownAhead >= view.h + HEAD_LEN_MAX;
```

### 3.3 startFlow 支持 onReachedBottom 回调

- `startFlow({ onReachedBottom })`：在 tween `onUpdate` 检测触底阈值并触发一次

```js
function startFlow({ duration = 3.0, ease = "power2.inOut", onReachedBottom } = {}) {
  riverAnimState = "flowing";
  flow.riverFlowY = 0;
  scroll.startY = window.scrollY;

  let reachedBottomFired = false;
  flowTween = gsap.to(flow, {
    riverFlowY: view.sceneH,
    duration,
    ease,
    onUpdate: () => {
      if (!reachedBottomFired && typeof onReachedBottom === "function") {
        const HEAD_LEN_MAX = 150;
        const scrollDelta = Math.max(0, window.scrollY - scroll.startY);
        const grownAhead = flow.riverFlowY - scrollDelta;
        if (grownAhead >= view.h + HEAD_LEN_MAX) {
          reachedBottomFired = true;
          onReachedBottom();
        }
      }
    },
    onComplete: () => {
      if (!reachedBottomFired && typeof onReachedBottom === "function") onReachedBottom();
      riverAnimState = "done";
    },
  });
}
```

## 4) 关键 CSS（河流页模式 + 入海衔接）

文件：`css/appmain.css`

```css
/* 河流页模式：隐藏首屏/胶片 */
body.is-river-page .hero { display: none; }
body.is-river-page .cm-mask-transition { display: none; }

/* 地图段仅在河流页模式下可见 */
.route-after-river { display: none; }
body.is-river-page .route-after-river { display: block; }

/* 地图段顶部同色渐变遮盖（衔接） */
body.is-river-page .route-after-river { position: relative; }
body.is-river-page .route-after-river::before {
  content: "";
  position: absolute;
  left: 0; right: 0; top: 0;
  height: 140px;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(6, 28, 45, 0.92) 0%,
    rgba(6, 28, 45, 0.92) 35%,
    rgba(6, 28, 45, 0.55) 65%,
    rgba(6, 28, 45, 0) 100%
  );
}

/* 入海漏斗（位于渐变上层） */
.river-sea-funnel { display: none; }
body.is-river-page .river-sea-funnel {
  display: block;
  position: absolute;
  left: 0; right: 0; top: 0;
  width: 100%;
  height: clamp(70px, 10vh, 110px);
  z-index: 4;
  pointer-events: none;
}
```

