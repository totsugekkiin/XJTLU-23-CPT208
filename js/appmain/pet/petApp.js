/**
 * 初始化 PixiJS v8 应用：
 *   - 画布透明、全屏；
 *   - 跟随 window 尺寸；
 *   - 画布自身 `pointer-events: none`，真正的拖拽命中由 DOM 层的
 *     `.pet-hitzone` 承担，从而让宠物身体之外的透明区域不会拦截
 *     下层 DOM 的点击。
 */
export async function createPetApp(PIXI, host) {
  const app = new PIXI.Application();
  await app.init({
    resizeTo: window,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    powerPreference: "high-performance",
  });

  const canvas = app.canvas;
  canvas.classList.add("pet-canvas");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.pointerEvents = "none";
  host.appendChild(canvas);

  app.stage.eventMode = "static";

  return app;
}
