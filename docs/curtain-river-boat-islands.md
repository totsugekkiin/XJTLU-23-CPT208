# 幕布转场 → 河流 → 船 → 岛屿：代码说明（给修改者用）

本文说明 **阊门挖洞/胶片** 区段之后，**幕布合拢** 如何接到 **Canvas 河流、船、岛屿** 的整条链路。修改时按文件职责定位即可。

---

## 1. 总览：不是换页，是同页多图层

- 整个流程都在 **单页** `appMain.html`（由 React 挂载的 `AppMainPage` 渲染）内完成。
- **不跳转**到新网页；幕布是 SVG 遮罩层，河流是 `#river-stage` 里的 `<canvas>`。
- 胶水入口：**[`js/appmain.js`](js/appmain.js)**。

---

## 2. 调用顺序（时间线）

```
用户滚动到 #cm-transition 段落末尾附近
    → scrollMaskZoom 计算 progress(0~1)
    → transition.handleProgress(progress)
    → 当 progress ≥ enterAt（默认 0.99）时幕布合拢 playClose()
    → GSAP 幕布 timeline 播完 → onClosed()
    → riverScene.startFlow({ duration, ease, boatDelay, boatEnterDuration })
    → Canvas 画河；船跟水头；岛屿按河流进度显示
```

向上滚回段落前段时，`handleProgress` 会触发 **reverseOpen()**，并在 **`onBeforeOpen`** 里 **`riverScene.stopAndHide()`**，河流/船/岛屿复位隐藏。

---

## 3. 关键文件与职责

| 文件 | 职责 |
|------|------|
| [`js/appmain.js`](js/appmain.js) | 组装：`createRiverScene`、`createCurtainRiverTransition`、`setupScrollMaskZoom`；在 `onClosed` 里调 `startFlow`，在 `onBeforeOpen` 里 `stopAndHide`。 |
| [`js/appmain/scrollMaskZoom.js`](js/appmain/scrollMaskZoom.js) | 在 `#cm-transition` 的 sticky 滚动区间内，根据滚动计算 **progress**，并回调 `onProgress(progress)`（胶片、遮罩、标题等动画）。 |
| [`js/appmain/curtainRiverTransition.js`](js/appmain/curtainRiverTransition.js) | 幕布 SVG：`#leftCurtain` / `#rightCurtain` 路径动画；**阈值触发**合拢/打开；合拢完成调 **`onClosed`**。 |
| [`js/appmain/riverScene.js`](js/appmain/riverScene.js) | **河流 Canvas**、`#boat-container` 船、`#river-island-layer` 岛屿布局与显隐；**`startFlow` / `stopAndHide`**。 |

### DOM 依赖（`src/pages/AppMainPage.jsx` 或原版 HTML）

- 幕布：`#curtainOverlay`、`#leftCurtain`、`#rightCurtain`
- 胶片区：`#cm-transition`、`#cm-mask-scroll`、`#maskLayer`、`#cmFilmstrip`、`#cmFilmTrack` 等
- 河流：`#river-scroll-spacer`、`#river-stage`、`#river-canvas`、`#boat-container`、`#boat`、`#river-island-layer`、若干 `.river-island`

---

## 4. 滚动 progress 如何驱动幕布

**[`setupScrollMaskZoom`](js/appmain/scrollMaskZoom.js)**（节选逻辑）：

- 监听滚动，用 `#cm-transition` 相对视口的滚动长度算出 **`progress ∈ [0,1]`**。
- 每次更新调用传入的 **`onProgress(progress)`**。

在 **`js/appmain.js`** 里：

```js
setupScrollMaskZoom({ prefersReducedMotion, onProgress: transition.handleProgress });
```

即：**胶片/挖洞的滚动进度** 与 **幕布状态机** 共用同一个 `progress`。

---

## 5. 幕布转场：`createCurtainRiverTransition`

**文件：** [`js/appmain/curtainRiverTransition.js`](js/appmain/curtainRiverTransition.js)

- **`handleProgress(progress)`**：不按滚动连续绑定幕布形状，只在跨过阈值时切换：
  - **`enterAt`（默认 0.99）**：`progress ≥ enterAt` → **`playClose()`**，幕布合拢。
  - **`leaveAt`（默认 0.985）**：已合拢且 `progress ≤ leaveAt` → **`reverseOpen()`**，幕布打开。
- **`onClosed`**：Timeline **`onComplete`** 时调用 **一次**（合拢动画真正结束）。
- **`onBeforeOpen`**：在 **`reverseOpen`** 里，真正反向播放前先调用（用于先藏河流等）。

可调构造参数（导出函数的可选参数）：

| 参数 | 含义 |
|------|------|
| `startAt` | 与提前 reverse 相关（默认 0.99） |
| `enterAt` | 达到该 progress 开始合拢（默认 0.99） |
| `leaveAt` | 低于该 progress 重新打开（默认 0.985，滞回避免抖动） |
| `beforeOpenDelay` | 打开前延迟（默认 0.12s） |

---

## 6. 河流 / 船 / 岛屿：`createRiverScene`

**文件：** [`js/appmain/riverScene.js`](js/appmain/riverScene.js)

### 6.1 `startFlow(options)`

由 **`js/appmain.js`** 里幕布 **`onClosed`** 调用，当前传入示例：

```js
riverScene.startFlow({
  duration: prefersReducedMotion ? 0.01 : 2.0,
  ease: prefersReducedMotion ? "none" : "power2.inOut",
  boatDelay: prefersReducedMotion ? 0 : 0.12,
  boatEnterDuration: prefersReducedMotion ? 0.01 : 0.65,
});
```

- **`duration` / `ease`**：GSAP 驱动内部 **`flow.riverFlowY`** 从 `0` 增长到 **`view.sceneH`**，决定河流“铺满场景高度”的快慢。
- **`boatDelay` / `boatEnterDuration`**：船入场（透明度与纵向偏移）动画，定义在同文件 `boat` 状态与 `gsap.to(boat, …)`。

### 6.2 绘制：`drawRiver`

- 用 **`visibleEndY`**（由 `riverFlowY` 与滚动共同决定）控制“河在屏幕内向下延伸”的长度。
- **主体 + 尖头**：主体画到 `bodyEndY`，末端 **`headLen`** 一段收束到尖点 **`(tipX, tipY)`**（当前实现为尖头，非墨晕）。

### 6.3 船：`syncBoat`

- 跟随 **`flow.riverFlowY`** 与 **`scroll`**，把 **`#boat-container`** 定位到河道附近并旋转朝向。

### 6.4 岛屿：`syncIslands`

- **`.river-island`** 沿 **`view.sceneH`** 等距分布；当 **`riverReady`**（河流进度足够）且在视口内时加 **`is-visible`**，并可 **`is-active`**（靠近屏幕中心）。
- 首次出现时可能有 GSAP 淡入（若代码中保留）。

### 6.5 `stopAndHide`

- 幕布 **`onBeforeOpen`** 或销毁时调用：停 GSAP、清空粒子、`spacer` 高度归零、岛屿复位、`#river-stage` 非 active。

---

## 7. 修改时常见需求对照

| 需求 | 建议改哪里 |
|------|------------|
| 更早/更晚合拢幕布 | `curtainRiverTransition.js` 的 **`enterAt` / `leaveAt`**，或在 `createCurtainRiverTransition({ ... })` 传入覆盖默认值。 |
| 幕布合拢更快/更慢 | 同文件 **`ensureTimeline`** 里 `tl.to(state, { duration, ease, … })`。 |
| 河流流得更快/更慢 | `js/appmain.js` **`startFlow` 的 `duration`**；或 `riverScene.js` **`view.sceneH`** / tween 目标。 |
| 船晚一点出现 / 入场更快 | `js/appmain.js` **`boatDelay`、`boatEnterDuration`**；或 `riverScene.js` 内船 tween。 |
| 尖头更尖/更长 | `riverScene.js` **`headLen`**、尖头段 **`taper` 指数**。 |
| 回卷胶片时河还在 | 确认 **`onBeforeOpen`** 里 **`stopAndHide`** 仍被调用；检查 `bootstrapAppMain` 是否重复绑定。 |

---

## 8. 入口与全局依赖

- **`window.gsap`**：幕布与河流 tween 依赖 GSAP；React 入口在 **`src/shared/exposeGlobals.js`** 把 npm 的 `gsap` 挂到 `window`。
- **`bootstrapAppMain`**（`js/appmain.js`）：由 **`src/pages/AppMainPage.jsx`** 在 `useEffect` 里 **`import`** 后调用；`globalThis.__APPMAIN_NO_AUTOBOOT__` 用于禁止模块顶层重复自启动。

---

## 9. 相关 UI 源码位置

- 页面结构：**[`src/pages/AppMainPage.jsx`](src/pages/AppMainPage.jsx)**（含 `#cm-transition`、`#curtainOverlay`、`#river-stage` 等）。
- 样式：**[`css/appmain.css`](css/appmain.css)**（搜索 `cm-mask`、`river-stage`、`curtain`）。

---

*文档随代码演进可能滞后；以仓库内实际文件为准。*
