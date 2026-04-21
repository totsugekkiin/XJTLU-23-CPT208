export function setupScrollMaskZoom({ prefersReducedMotion } = {}) {
  if (typeof window === "undefined") return null;

  const section = document.getElementById("cm-transition");
  const scrollWrap = document.getElementById("cm-mask-scroll");
  const maskLayer = document.getElementById("maskLayer");

  if (!section || !scrollWrap || !maskLayer) {
    console.warn("[scrollMaskZoom] 关键节点缺失，跳过初始化");
    return null;
  }

  if (prefersReducedMotion) {
    maskLayer.style.transform = "scale(1)";
    return { destroy() {} };
  }

  const maxScale = 40;
  let rafId = null;

  const clamp01 = (value) => Math.min(1, Math.max(0, value));

  const update = () => {
    const sectionTop = section.offsetTop;
    const scrollLength = Math.max(1, scrollWrap.offsetHeight - window.innerHeight);
    const progress = clamp01((window.scrollY - sectionTop) / scrollLength);
    const scale = Math.pow(maxScale, progress);
    maskLayer.style.transform = `scale(${scale})`;
  };

  const onScroll = () => {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(() => {
      update();
      rafId = null;
    });
  };

  const onResize = () => update();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  update();

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
