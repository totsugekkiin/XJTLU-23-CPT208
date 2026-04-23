/**
 * 包装 IntersectionObserver，仅暴露 onEnter / onLeave 回调。
 * 若浏览器不支持，则立即触发 onEnter，让宠物行为有合理降级。
 */
export function observeTargetZone({
  element,
  threshold = 0.35,
  /** 扩大根视口（例如底部加 vh）可让目标区更早被判为“进入视口” */
  rootMargin = "0px 0px 0px 0px",
  onEnter,
  onLeave,
} = {}) {
  if (!element) {
    return { destroy() {} };
  }

  if (!("IntersectionObserver" in window)) {
    onEnter?.({ intersectionRatio: 1, isIntersecting: true });
    return { destroy() {} };
  }

  let lastVisible = false;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const visibleNow =
          entry.isIntersecting && entry.intersectionRatio >= threshold;
        if (visibleNow && !lastVisible) {
          lastVisible = true;
          onEnter?.(entry);
        } else if (!visibleNow && lastVisible) {
          lastVisible = false;
          onLeave?.(entry);
        }
      }
    },
    {
      threshold: [0, threshold, Math.min(1, threshold + 0.25), 1],
      rootMargin,
    }
  );

  observer.observe(element);

  return {
    destroy() {
      observer.disconnect();
    },
  };
}
