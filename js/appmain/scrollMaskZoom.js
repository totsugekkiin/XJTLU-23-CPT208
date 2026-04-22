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
const LERP_ALPHA = 0.12;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const lerp = (from, to, alpha) => from + (to - from) * alpha;

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

  const measure = () => {
    if (!hTrack) return;

    // 清除 transform 以取基准尺寸
    hTrack.style.transform = "none";
    items.forEach((el) => {
      el.style.transform = "none";
    });

    maxTranslateX = Math.max(0, hTrack.scrollWidth - window.innerWidth);
    entryOffsetPx = window.innerWidth * 0.6;

    itemData = items.map((el) => {
      const rect = el.getBoundingClientRect();
      const trackRect = hTrack.getBoundingClientRect();
      return {
        el,
        rawCenter: rect.left - trackRect.left + rect.width / 2,
        currentRotateY: 0,
        currentTranslateZ: 0,
      };
    });
  };

  const update = () => {
    const sectionTop = section.offsetTop;
    const scrollLength = Math.max(1, scrollWrap.offsetHeight - window.innerHeight);
    const progress = clamp01((window.scrollY - sectionTop) / scrollLength);
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
      const distance = window.innerHeight * 0.8 * splitProgress;
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
      const isPortrait = window.innerHeight > window.innerWidth;
      const orbitRadiusX = window.innerWidth * 0.7;
      const orbitRadiusY = isPortrait ? window.innerHeight * 0.85 : window.innerHeight * 0.35;

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
    if (hTrack && itemData.length > 0) {
      const targetTrackX = entryOffsetPx * (1 - panProgress) - panProgress * maxTranslateX;
      currentTrackX = lerp(currentTrackX, targetTrackX, LERP_ALPHA);
      hTrack.style.transform = `translate3d(${currentTrackX}px, 0, 0)`;

      if (filmstrip) {
        const filmOpacity = clamp01((progress - ZOOM_THRESHOLD * 0.8) / 0.1);
        filmstrip.style.opacity = String(filmOpacity);
      }

      const windowCenterX = window.innerWidth / 2;
      itemData.forEach((data) => {
        const currentCenterX = data.rawCenter + currentTrackX;
        const offset = currentCenterX - windowCenterX;
        const normalizedOffset = offset / windowCenterX;
        const targetRotateY = -normalizedOffset * ROTATE_Y_MAX;
        const targetTranslateZ =
          -TRANSLATE_Z_MAX + normalizedOffset * normalizedOffset * TRANSLATE_Z_MAX;

        data.currentRotateY = lerp(data.currentRotateY, targetRotateY, LERP_ALPHA);
        data.currentTranslateZ = lerp(data.currentTranslateZ, targetTranslateZ, LERP_ALPHA);
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
  };

  const onScroll = () => {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(() => {
      update();
      rafId = null;
    });
  };

  const onResize = () => {
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
