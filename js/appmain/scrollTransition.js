/* =========================================================
 * scrollTransition.js
 * ---------------------------------------------------------
 * 使用 GSAP ScrollTrigger + Lenis 实现三幕转场：
 *   1) 胶囊 (.cm-transition__capsule) Pin + Scrub 放大填屏
 *   2) 胶囊内竖排文字淡出
 *   3) 新面板 (.cm-reveal) 从右向左横向滑入，覆盖黑色胶囊
 * ========================================================= */

export function setupScrollTransition({ prefersReducedMotion } = {}) {
  // 必要依赖检查：GSAP / ScrollTrigger 必须通过 CDN 加载
  if (typeof window === "undefined") return null;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) {
    console.warn("[scrollTransition] GSAP/ScrollTrigger 未就绪，跳过转场初始化");
    return null;
  }

  // 注册插件（重复注册是幂等的）
  gsap.registerPlugin(ScrollTrigger);

  const capsule = document.getElementById("cm-capsule");
  const pinEl = document.querySelector("#cm-transition .cm-transition__pin");
  const gridEl = document.querySelector("#cm-transition .cm-transition__grid");
  const revealEl = document.getElementById("cm-reveal");
  const capsuleText = capsule?.querySelector(".cm-transition__text");

  if (!capsule || !pinEl || !gridEl || !revealEl) {
    console.warn("[scrollTransition] 关键 DOM 节点缺失，跳过");
    return null;
  }

  /* -----------------------------------------------------------
   * prefers-reduced-motion 降级：
   * 直接让胶囊保持静态、横向面板直接归位可见，避免任何 pin/scrub。
   * ---------------------------------------------------------- */
  if (prefersReducedMotion) {
    gsap.set(revealEl, { xPercent: 0 });
    return { lenis: null, destroy() {} };
  }

  /* -----------------------------------------------------------
   * Lenis 平滑滚动：只有在非「减少动态」时才启用
   * Lenis 会接管 wheel/touch 并调用 window.scrollTo，所以原生的
   *  window "scroll" 事件仍会派发，因此 cardStackController
   *  的 onScroll 仍可正常工作。
   * ---------------------------------------------------------- */
  let lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({
      duration: 1.15,
      smoothWheel: true,
      // 更自然的缓动曲线
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    // 把 Lenis 的 raf 循环接到 GSAP 自己的 ticker 上，
    // 这样 ScrollTrigger 每帧都会基于最新的 scroll 位置计算
    const onTick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    // 每次 Lenis 滚动后显式通知 ScrollTrigger 更新
    lenis.on("scroll", ScrollTrigger.update);
  }

  /* -----------------------------------------------------------
   * 计算胶囊放大到「铺满整屏」所需的 scale
   * 为确保黑底在任何屏幕比例下都彻底覆盖视口，
   *  取两轴 scale 的 max，再加一点点 buffer 防止边缘漏色。
   * ---------------------------------------------------------- */
  const computeFillScale = () => {
    // 先把当前的变换还原到 scale=1，这样测量得到的是「基准尺寸」
    gsap.set(capsule, { clearProps: "transform" });
    const rect = capsule.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sx = vw / Math.max(1, rect.width);
    const sy = vh / Math.max(1, rect.height);
    // 额外放大 10%，避免放大动画中因亚像素抖动露出背景
    return Math.max(sx, sy) * 1.1;
  };

  let fillScale = computeFillScale();

  /* -----------------------------------------------------------
   * 主时间线：Pin + Scrub（三幕：胶囊放大 → 文字淡出 → 面板横向滑入）
   * -----------
   *  trigger   : `.cm-transition__pin`——整个 pin 容器
   *  start     : "top top"——pin 容器顶部顶到视口顶部时开始
   *  end       : "+=220%"——增加滚动距离，给第三幕“横向滑入”留出空间
   *  pin       : true / scrub: 1 / anticipatePin: 1 / invalidateOnRefresh
   * ---------------------------------------------------------- */
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: pinEl,
      start: "top top",
      end: "+=220%",
      pin: true,
      pinSpacing: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      // 如需调试可打开：markers: true,
    },
  });

  // 初始化胶囊样式（进入 pin 前的可视状态）
  gsap.set(capsule, {
    scale: 1,
    borderRadius: 9999,
    transformOrigin: "center center",
  });
  gsap.set(gridEl, {
    scale: 1,
    yPercent: 0,
    transformOrigin: "50% 50%",
  });
  // 横向面板初始：藏在右屏外，等胶囊填屏 + 文字淡出后再滑入
  gsap.set(revealEl, { xPercent: 100 });

  // 幕一（0 ~ 0.55）：胶囊从 scale=1 放大至 fillScale，圆角 9999 → 0
  tl.to(
    capsule,
    {
      scale: () => fillScale, // 函数形式，refresh 时会重取最新值
      borderRadius: 0,
      backgroundColor: "#5a0f1d",
      duration: 0.55,
    },
    0
  );
  tl.to(
    gridEl,
    {
      scale: () => fillScale,
      yPercent: -4,
      duration: 0.55,
    },
    0
  );

  // 幕二（0.55 ~ 0.65）：胶囊里的竖排文字淡出
  if (capsuleText) {
    tl.to(
      capsuleText,
      { opacity: 0, duration: 0.1 },
      0.55
    ).addLabel("textGone", 0.65);
  } else {
    tl.addLabel("textGone", 0.65);
  }

  // 幕三（0.65 ~ 1）：新面板从右向左横向滑入，覆盖已经填屏的黑色胶囊
  tl.to(
    revealEl,
    { xPercent: 0, duration: 0.35, ease: "power2.out" },
    0.65
  );

  /* -----------------------------------------------------------
   * 窗口尺寸变化时，重新计算 fillScale，避免横竖屏切换后胶囊
   * 放大尺寸不足以填满屏幕。ScrollTrigger.refresh() 会重新
   * 调用 tween 中 `scale: () => fillScale` 的函数值。
   * ---------------------------------------------------------- */
  const handleResize = () => {
    fillScale = computeFillScale();
    ScrollTrigger.refresh();
  };
  window.addEventListener("resize", handleResize, { passive: true });

  // 在 ScrollTrigger 首次完成测量后，再跑一次，确保尺寸稳定
  ScrollTrigger.addEventListener("refreshInit", () => {
    fillScale = computeFillScale();
  });

  return {
    lenis,
    destroy() {
      window.removeEventListener("resize", handleResize);
      tl.scrollTrigger?.kill();
      tl.kill();
      if (lenis) {
        lenis.destroy();
      }
    },
  };
}
