/* =========================================================
 * scrollMaskZoom.js
 * ---------------------------------------------------------
 * 在 #cm-transition sticky 区间内，用同一份滚动 progress 驱动：
 *   1) 红色网格遮盖层 (#maskLayer) 放大 + 淡出
 *   2) "阊门" 上下两半向上/向下分别滑出（幕布拉开）
 *   3) 底层 3D 胶片轨道从右侧入场 + 横向滚动 + 每张卡片 rotateY/translateZ
 * ========================================================= */

const ZOOM_THRESHOLD = 0.2;
const MAX_MASK_SCALE = 40;
const ROTATE_Y_MAX = 28;
const TRANSLATE_Z_MAX = 220;
const LERP_ALPHA_DESKTOP = 0.12;
const LERP_ALPHA_MOBILE = 0.28;
const MOBILE_MAX_WIDTH = 768;
// lerp 收敛阈值：差值小于此值视为已到位，可停止续帧
const SETTLE_EPSILON_PX = 0.5;
const SETTLE_EPSILON_DEG = 0.05;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const lerp = (from, to, alpha) => from + (to - from) * alpha;
const isMobileViewport = () =>
  typeof window !== "undefined" &&
  (window.innerWidth <= MOBILE_MAX_WIDTH ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches));

export function setupScrollMaskZoom({ prefersReducedMotion, onEnd, onProgress } = {}) {
  if (typeof window === "undefined") return null;

  const section = document.getElementById("cm-transition");
  const scrollWrap = document.getElementById("cm-mask-scroll");
  const maskLayer = document.getElementById("maskLayer");
  const bgSun = document.getElementById("bgSun");
  const bgMoon = document.getElementById("bgMoon");
  const hTrack = document.getElementById("cmFilmTrack");
  const filmstrip = document.getElementById("cmFilmstrip");
  const titleTop = document.getElementById("cmTitleTop");
  const titleBottom = document.getElementById("cmTitleBottom");

  if (!section || !scrollWrap || !maskLayer) {
    console.warn("[scrollMaskZoom] 关键节点缺失，跳过初始化");
    return null;
  }

  // 为胶片年份随机分配 top/bottom 位置与动画延迟，增加自然感
  if (filmstrip) {
    const years = filmstrip.querySelectorAll(".cm-filmstrip__year");
    years.forEach((year) => {
      if (Math.random() > 0.5) {
        year.style.top = "15px";
        year.style.bottom = "";
      } else {
        year.style.bottom = "15px";
        year.style.top = "";
      }
      year.style.animationDelay = `${(Math.random() * 2).toFixed(2)}s`;
    });
  }

  // reduced motion：保持静态，不做 transform
  if (prefersReducedMotion) {
    maskLayer.style.transform = "scale(1)";
    if (filmstrip) filmstrip.style.opacity = "1";
    return { destroy() {} };
  }

  const items = hTrack ? Array.from(hTrack.querySelectorAll(".cm-filmstrip__item")) : [];

  let maxTranslateX = 0;
  let itemData = [];
  let entryOffsetPx = 0;
  let rafId = null;
  let currentTrackX = 0;
  let hasEnded = false;
  // 当前生效的 lerp 系数（resize 时会跟随屏宽刷新）
  let lerpAlpha = isMobileViewport() ? LERP_ALPHA_MOBILE : LERP_ALPHA_DESKTOP;

  // 缓存几何，避免 scroll 时反复读 offsetTop / offsetHeight / innerWidth 触发 forced reflow
  const geom = {
    sectionTop: 0,
    scrollLength: 1,
    vw: 0,
    vh: 0,
    halfVw: 0,
    isPortrait: false,
    orbitRadiusX: 0,
    orbitRadiusY: 0,
    titleSplitDistance: 0,
  };

  const measure = () => {
    // 缓存基础几何（在 resize / 图片 load 时刷新）
    geom.vw = window.innerWidth;
    geom.vh = window.innerHeight;
    geom.halfVw = geom.vw / 2;
    geom.isPortrait = geom.vh > geom.vw;
    geom.orbitRadiusX = geom.vw * 0.7;
    geom.orbitRadiusY = geom.isPortrait ? geom.vh * 0.85 : geom.vh * 0.35;
    geom.titleSplitDistance = geom.vh * 0.8;
    geom.sectionTop = section.offsetTop;
    geom.scrollLength = Math.max(1, scrollWrap.offsetHeight - geom.vh);

    if (!hTrack) return;

    // 清除 transform 以取基准尺寸
    hTrack.style.transform = "none";
    items.forEach((el) => {
      el.style.transform = "none";
    });

    maxTranslateX = Math.max(0, hTrack.scrollWidth - geom.vw);
    entryOffsetPx = geom.vw * 0.6;

    // 一次性读 trackRect，避免每个 item 都触发同步 layout
    const trackRect = hTrack.getBoundingClientRect();
    itemData = items.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        el,
        rawCenter: rect.left - trackRect.left + rect.width / 2,
        currentRotateY: 0,
        currentTranslateZ: 0,
      };
    });
  };

  const update = () => {
    const progress = clamp01((window.scrollY - geom.sectionTop) / geom.scrollLength);
    if (typeof onProgress === "function") {
      try {
        onProgress(progress);
      } catch (e) {
        console.error("[scrollMaskZoom] onProgress 回调执行失败", e);
      }
    }

    // panProgress：zoom 之后的“横移阶段”进度（给胶片轨道与双星公转共用）
    const panProgress =
      progress > ZOOM_THRESHOLD ? clamp01((progress - ZOOM_THRESHOLD) / (1 - ZOOM_THRESHOLD)) : 0;

    // 阶段 A：遮盖层放大 + 淡出
    const zoomProgress = clamp01(progress / ZOOM_THRESHOLD);
    const scale = Math.pow(MAX_MASK_SCALE, zoomProgress);
    maskLayer.style.transform = `scale(${scale})`;
    maskLayer.style.opacity = zoomProgress >= 1 ? "0" : String(1 - Math.pow(zoomProgress, 4) * 0.2);

    // 阊门上下两半：随 zoomProgress 分离
    const splitProgress = clamp01((zoomProgress - 0.7) / 0.3);
    if (titleTop && titleBottom) {
      const distance = geom.titleSplitDistance * splitProgress;
      const titleOpacity = 1 - splitProgress;
      titleTop.style.transform = `translateY(${-distance}px)`;
      titleTop.style.opacity = String(titleOpacity);
      titleBottom.style.transform = `translateY(${distance}px)`;
      titleBottom.style.opacity = String(titleOpacity);
    }

    // 双星交错公转（时间流逝感）
    if (bgSun && bgMoon) {
      const cycles = 3;
      const angle = panProgress * Math.PI * 2 * cycles;
      const orbitRadiusX = geom.orbitRadiusX;
      const orbitRadiusY = geom.orbitRadiusY;

      const sunX = Math.cos(angle) * orbitRadiusX;
      const sunY = Math.sin(angle) * orbitRadiusY;
      const sunZ = -700 + Math.sin(angle) * 300;

      const moonX = Math.cos(angle + Math.PI) * orbitRadiusX;
      const moonY = Math.sin(angle + Math.PI) * orbitRadiusY;
      const moonZ = -700 + Math.sin(angle + Math.PI) * 300;

      bgSun.style.transform = `translate(-50%, -50%) translateZ(${sunZ}px) translate(${sunX}px, ${sunY}px) rotate(${
        angle * 30
      }deg)`;
      bgMoon.style.transform = `translate(-50%, -50%) translateZ(${moonZ}px) translate(${moonX}px, ${moonY}px) rotate(${
        -angle * 30
      }deg)`;

      // 月相渐变：从开始到结束才刚好变满（progress: 0 -> 1）
      // 起始残月更细：把起始 shadow 调得更接近 0（绝对值更小）
      const p = progress;
      const startShadow = -8;   // 残月更细（可再调：-5 更细，-12 更厚）
      const endShadow = -300;   // 接近满月
      // 视觉上 box-shadow 的“变满速度”会显得偏快，这里用慢启动曲线拉长前段时间
      const t = clamp01(p);
      const tEase = Math.pow(t, 6); // 数值越大：越晚才明显变满（可在 2.0~3.2 之间调）
      const shadow = startShadow + (endShadow - startShadow) * tEase;

      if (t >= 0.999) {
        bgMoon.style.backgroundColor = "#fff";
        bgMoon.style.boxShadow = "none";
      } else {
        bgMoon.style.backgroundColor = "transparent";
        bgMoon.style.boxShadow = `inset ${shadow}px ${shadow}px 0 0 #fff`;
      }
    }

    // 阶段 B：胶片入场 + 横移 + 3D
    // settled：本帧所有 lerp 是否都已贴近目标。未贴近时主动续 RAF，
    // 避免 iOS Safari 滚动时 scroll 事件稀疏导致的“卡住—一帧补齐—飞过去”观感。
    let settled = true;
    if (hTrack && itemData.length > 0) {
      const targetTrackX = entryOffsetPx * (1 - panProgress) - panProgress * maxTranslateX;
      const nextTrackX = lerp(currentTrackX, targetTrackX, lerpAlpha);
      if (Math.abs(targetTrackX - nextTrackX) > SETTLE_EPSILON_PX) settled = false;
      currentTrackX = nextTrackX;
      hTrack.style.transform = `translate3d(${currentTrackX}px, 0, 0)`;

      if (filmstrip) {
        const filmOpacity = clamp01((progress - ZOOM_THRESHOLD * 0.8) / 0.1);
        filmstrip.style.opacity = String(filmOpacity);
      }

      const windowCenterX = geom.halfVw;
      itemData.forEach((data) => {
        const currentCenterX = data.rawCenter + currentTrackX;
        const offset = currentCenterX - windowCenterX;
        const normalizedOffset = offset / windowCenterX;
        const targetRotateY = -normalizedOffset * ROTATE_Y_MAX;
        const targetTranslateZ =
          -TRANSLATE_Z_MAX + normalizedOffset * normalizedOffset * TRANSLATE_Z_MAX;

        const nextRotateY = lerp(data.currentRotateY, targetRotateY, lerpAlpha);
        const nextTranslateZ = lerp(data.currentTranslateZ, targetTranslateZ, lerpAlpha);
        if (
          Math.abs(targetRotateY - nextRotateY) > SETTLE_EPSILON_DEG ||
          Math.abs(targetTranslateZ - nextTranslateZ) > SETTLE_EPSILON_PX
        ) {
          settled = false;
        }
        data.currentRotateY = nextRotateY;
        data.currentTranslateZ = nextTranslateZ;
        data.el.style.transform = `translateZ(${data.currentTranslateZ}px) rotateY(${data.currentRotateY}deg)`;
      });
    }

    if (!hasEnded && progress >= 0.999) {
      hasEnded = true;
      if (typeof onEnd === "function") {
        try {
          onEnd();
        } catch (e) {
          console.error("[scrollMaskZoom] onEnd 回调执行失败", e);
        }
      }
    }

    return settled;
  };

  const scheduleFrame = () => {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      const settled = update();
      // 未收敛则继续追，直到与目标重合（手指停下后画面也能平滑收尾）
      if (!settled) scheduleFrame();
    });
  };

  const onScroll = () => {
    scheduleFrame();
  };

  const onResize = () => {
    lerpAlpha = isMobileViewport() ? LERP_ALPHA_MOBILE : LERP_ALPHA_DESKTOP;
    measure();
    currentTrackX = 0;
    update();
  };

  measure();
  update();

  if (hTrack) {
    const imgs = hTrack.querySelectorAll("img");
    imgs.forEach((img) => {
      if (!img.complete) {
        img.addEventListener(
          "load",
          () => {
            measure();
            update();
          },
          { once: true }
        );
      }
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });

  return {
    destroy() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    },
  };
}
