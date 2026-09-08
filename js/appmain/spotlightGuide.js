export const SPOTLIGHT_GUIDE_STORAGE_KEY = "changmen.spotlight-guide.v1";

export const SPOTLIGHT_GUIDE_STATUS = Object.freeze({
  STARTED: "started",
  COMPLETED: "completed",
  SKIPPED: "skipped",
});

export const SPOTLIGHT_GUIDE_STEPS = Object.freeze([
  Object.freeze({
    id: "pet",
    title: "黛玉伴游",
    description: "点击黛玉的头部可以提问；按住身体，还可以把她拖到顺手的位置。",
    targetSelector: "#pet-hitzone",
    emphasisSelector: "#pet-hitzone",
    padding: 12,
    radius: 34,
  }),
  Object.freeze({
    id: "pet-recall",
    title: "召回黛玉",
    description: "黛玉离开视线时，点击这里即可把她召回屏幕右下角。",
    targetSelector: "#hero-pet-dock-btn",
    emphasisSelector: "#hero-pet-dock-btn",
    padding: 8,
    radius: 28,
  }),
  Object.freeze({
    id: "guide-menu",
    title: "互动导览",
    description: "点击这里可以快速前往影像时间轴、返回首屏或重新开始体验。",
    targetSelector: "#hero-guide-btn",
    emphasisSelector: "#hero-guide-btn",
    padding: 8,
    radius: 999,
  }),
  Object.freeze({
    id: "scroll",
    title: "开始浏览",
    description: "向上滑动页面，主题卡片会依次翻开，并带你进入后续历史内容。",
    targetSelector: "#hero-card",
    emphasisSelector: ".hero-card__scroll-hint",
    padding: 10,
    radius: 36,
  }),
]);

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readSpotlightGuideStatus(storage = null) {
  try {
    const value = resolveStorage(storage)?.getItem?.(SPOTLIGHT_GUIDE_STORAGE_KEY);
    return Object.values(SPOTLIGHT_GUIDE_STATUS).includes(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeSpotlightGuideStatus(status, storage = null) {
  if (!Object.values(SPOTLIGHT_GUIDE_STATUS).includes(status)) return false;
  try {
    resolveStorage(storage)?.setItem?.(SPOTLIGHT_GUIDE_STORAGE_KEY, status);
    return true;
  } catch {
    return false;
  }
}

export function shouldAutoStartSpotlightGuide({
  storage = null,
  force = false,
  isAtPageStart = true,
  isRiverPage = false,
} = {}) {
  if (isRiverPage || !isAtPageStart) return false;
  return force || readSpotlightGuideStatus(storage) === null;
}

export function isSpotlightReplayRequested(
  search = typeof window !== "undefined" ? window.location.search : "",
) {
  return new URLSearchParams(search).get("spotlight") === "1";
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function getSpotlightFrameRect(rect, viewport, padding = 8) {
  const viewportWidth = Math.max(0, Number(viewport?.width) || 0);
  const viewportHeight = Math.max(0, Number(viewport?.height) || 0);
  const inset = Math.max(0, Number(padding) || 0);
  const left = clamp((Number(rect?.left) || 0) - inset, 0, viewportWidth);
  const top = clamp((Number(rect?.top) || 0) - inset, 0, viewportHeight);
  const right = clamp((Number(rect?.right) || 0) + inset, left, viewportWidth);
  const bottom = clamp((Number(rect?.bottom) || 0) + inset, top, viewportHeight);

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function getSpotlightCardPosition({
  frame,
  cardSize,
  viewport,
  gap = 16,
  safeInset = 16,
} = {}) {
  const viewportWidth = Math.max(0, Number(viewport?.width) || 0);
  const viewportHeight = Math.max(0, Number(viewport?.height) || 0);
  const cardWidth = Math.max(0, Number(cardSize?.width) || 0);
  const cardHeight = Math.max(0, Number(cardSize?.height) || 0);
  const safe = Math.max(0, Number(safeInset) || 0);
  const spacing = Math.max(0, Number(gap) || 0);
  const maxLeft = Math.max(safe, viewportWidth - cardWidth - safe);
  const centeredLeft = (Number(frame?.left) || 0)
    + ((Number(frame?.width) || 0) - cardWidth) / 2;
  const left = clamp(centeredLeft, safe, maxLeft);
  const roomBelow = viewportHeight - (Number(frame?.bottom) || 0) - safe;
  const roomAbove = (Number(frame?.top) || 0) - safe;
  const roomRight = viewportWidth - (Number(frame?.right) || 0) - safe;
  const roomLeft = (Number(frame?.left) || 0) - safe;
  let placement = "below";
  let top = (Number(frame?.bottom) || 0) + spacing;
  let resolvedLeft = left;

  if (roomBelow < cardHeight + spacing && roomAbove >= cardHeight + spacing) {
    placement = "above";
    top = (Number(frame?.top) || 0) - cardHeight - spacing;
  } else if (roomBelow < cardHeight + spacing && roomAbove < cardHeight + spacing) {
    if (roomRight >= cardWidth + spacing) {
      placement = "right";
      resolvedLeft = (Number(frame?.right) || 0) + spacing;
      top = (Number(frame?.top) || 0) + ((Number(frame?.height) || 0) - cardHeight) / 2;
    } else if (roomLeft >= cardWidth + spacing) {
      placement = "left";
      resolvedLeft = (Number(frame?.left) || 0) - cardWidth - spacing;
      top = (Number(frame?.top) || 0) + ((Number(frame?.height) || 0) - cardHeight) / 2;
    }
  }

  top = clamp(top, safe, Math.max(safe, viewportHeight - cardHeight - safe));
  resolvedLeft = clamp(resolvedLeft, safe, maxLeft);
  return { left: resolvedLeft, top, placement };
}

function setBox(element, { left, top, width, height }) {
  if (!element) return;
  element.style.left = `${Math.round(left)}px`;
  element.style.top = `${Math.round(top)}px`;
  element.style.width = `${Math.max(0, Math.round(width))}px`;
  element.style.height = `${Math.max(0, Math.round(height))}px`;
}

export function createSpotlightGuide({
  root = document,
  storage = null,
  steps = SPOTLIGHT_GUIDE_STEPS,
  prefersReducedMotion = false,
  onStepChange,
  onEnd,
} = {}) {
  const ui = root.getElementById("spotlight-guide");
  const card = root.getElementById("spotlight-guide-card");
  const progress = root.getElementById("spotlight-guide-progress");
  const title = root.getElementById("spotlight-guide-title");
  const description = root.getElementById("spotlight-guide-description");
  const nextButton = root.getElementById("spotlight-guide-next");
  const skipButton = root.getElementById("spotlight-guide-skip");
  const ring = root.getElementById("spotlight-guide-ring");
  const shades = {
    top: root.getElementById("spotlight-guide-shade-top"),
    left: root.getElementById("spotlight-guide-shade-left"),
    right: root.getElementById("spotlight-guide-shade-right"),
    bottom: root.getElementById("spotlight-guide-shade-bottom"),
  };

  if (!ui || !card || !progress || !title || !description || !nextButton || !skipButton || !ring) {
    console.warn("[spotlight-guide] missing DOM nodes");
    return {
      start: () => false,
      skip() {},
      finish() {},
      destroy() {},
      isActive: () => false,
    };
  }

  let active = false;
  let currentIndex = 0;
  let activeTarget = null;
  let activeEmphasis = null;
  let previousFocus = null;
  let positionRaf = null;

  const clearEmphasis = () => {
    activeTarget?.removeAttribute("data-spotlight-target");
    activeEmphasis?.removeAttribute("data-spotlight-emphasis");
    activeTarget = null;
    activeEmphasis = null;
  };

  const getViewport = () => ({
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  });

  const position = () => {
    positionRaf = null;
    if (!active) return;

    const step = steps[currentIndex];
    const target = step ? root.querySelector(step.targetSelector) : null;
    const targetRect = target?.getBoundingClientRect?.();
    const viewport = getViewport();
    if (!targetRect || targetRect.width <= 0 || targetRect.height <= 0) {
      ui.classList.add("is-target-missing");
      const fallback = getSpotlightFrameRect({
        left: viewport.width / 2 - 2,
        right: viewport.width / 2 + 2,
        top: viewport.height / 2 - 2,
        bottom: viewport.height / 2 + 2,
      }, viewport, 0);
      setBox(ring, fallback);
      setBox(shades.top, { left: 0, top: 0, width: viewport.width, height: viewport.height });
      setBox(shades.left, { left: 0, top: 0, width: 0, height: 0 });
      setBox(shades.right, { left: 0, top: 0, width: 0, height: 0 });
      setBox(shades.bottom, { left: 0, top: 0, width: 0, height: 0 });
      return;
    }

    ui.classList.remove("is-target-missing");
    const frame = getSpotlightFrameRect(targetRect, viewport, step.padding);
    setBox(ring, frame);
    ring.style.borderRadius = `${Math.min(step.radius, frame.width / 2, frame.height / 2)}px`;

    setBox(shades.top, { left: 0, top: 0, width: viewport.width, height: frame.top });
    setBox(shades.left, { left: 0, top: frame.top, width: frame.left, height: frame.height });
    setBox(shades.right, {
      left: frame.right,
      top: frame.top,
      width: Math.max(0, viewport.width - frame.right),
      height: frame.height,
    });
    setBox(shades.bottom, {
      left: 0,
      top: frame.bottom,
      width: viewport.width,
      height: Math.max(0, viewport.height - frame.bottom),
    });

    const cardRect = card.getBoundingClientRect();
    const cardPosition = getSpotlightCardPosition({
      frame,
      cardSize: cardRect,
      viewport,
      gap: 16,
      safeInset: 16,
    });
    card.style.left = `${Math.round(cardPosition.left)}px`;
    card.style.top = `${Math.round(cardPosition.top)}px`;
    card.dataset.placement = cardPosition.placement;
  };

  const schedulePosition = () => {
    if (!active || positionRaf !== null) return;
    positionRaf = requestAnimationFrame(position);
  };

  const renderStep = () => {
    const step = steps[currentIndex];
    if (!step) return;
    clearEmphasis();
    activeTarget = root.querySelector(step.targetSelector);
    activeEmphasis = root.querySelector(step.emphasisSelector ?? step.targetSelector);
    activeTarget?.setAttribute("data-spotlight-target", "true");
    activeEmphasis?.setAttribute("data-spotlight-emphasis", "true");
    progress.textContent = `${currentIndex + 1} / ${steps.length}`;
    title.textContent = step.title;
    description.textContent = step.description;
    nextButton.textContent = currentIndex === steps.length - 1 ? "开始探索" : "下一步";
    card.dataset.step = step.id;
    onStepChange?.({ step, index: currentIndex, previousIndex: currentIndex - 1 });
    position();
    requestAnimationFrame(position);
    nextButton.focus({ preventScroll: true });
  };

  const end = (status) => {
    if (!active) return;
    active = false;
    writeSpotlightGuideStatus(status, storage);
    ui.classList.remove("is-active");
    ui.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-spotlight-guide-active");
    clearEmphasis();
    if (positionRaf !== null) cancelAnimationFrame(positionRaf);
    positionRaf = null;
    onEnd?.({ status });
    previousFocus?.focus?.({ preventScroll: true });
    previousFocus = null;
  };

  const finish = () => end(SPOTLIGHT_GUIDE_STATUS.COMPLETED);
  const skip = () => end(SPOTLIGHT_GUIDE_STATUS.SKIPPED);

  const next = () => {
    if (!active) return;
    if (currentIndex >= steps.length - 1) {
      finish();
      return;
    }
    currentIndex += 1;
    renderStep();
  };

  const start = ({ force = false } = {}) => {
    const isAtPageStart = Math.max(0, window.scrollY || 0) <= 8;
    const isRiverPage = document.body.classList.contains("is-river-page");
    if (!shouldAutoStartSpotlightGuide({ storage, force, isAtPageStart, isRiverPage })) return false;
    if (active) end(SPOTLIGHT_GUIDE_STATUS.SKIPPED);
    previousFocus = root.activeElement instanceof HTMLElement ? root.activeElement : null;
    currentIndex = 0;
    active = true;
    writeSpotlightGuideStatus(SPOTLIGHT_GUIDE_STATUS.STARTED, storage);
    ui.classList.toggle("has-reduced-motion", prefersReducedMotion);
    ui.classList.add("is-active");
    ui.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-spotlight-guide-active");
    renderStep();
    return true;
  };

  const onKeydown = (event) => {
    if (!active || event.key !== "Escape") return;
    event.preventDefault();
    skip();
  };

  nextButton.addEventListener("click", next);
  skipButton.addEventListener("click", skip);
  window.addEventListener("resize", schedulePosition, { passive: true });
  window.addEventListener("scroll", schedulePosition, { passive: true });
  window.visualViewport?.addEventListener("resize", schedulePosition, { passive: true });
  window.visualViewport?.addEventListener("scroll", schedulePosition, { passive: true });
  window.addEventListener("keydown", onKeydown);

  return {
    start,
    skip,
    finish,
    isActive: () => active,
    destroy() {
      if (active) {
        active = false;
        ui.classList.remove("is-active");
        ui.setAttribute("aria-hidden", "true");
        document.body.classList.remove("is-spotlight-guide-active");
        clearEmphasis();
      }
      if (positionRaf !== null) cancelAnimationFrame(positionRaf);
      nextButton.removeEventListener("click", next);
      skipButton.removeEventListener("click", skip);
      window.removeEventListener("resize", schedulePosition);
      window.removeEventListener("scroll", schedulePosition);
      window.visualViewport?.removeEventListener("resize", schedulePosition);
      window.visualViewport?.removeEventListener("scroll", schedulePosition);
      window.removeEventListener("keydown", onKeydown);
    },
  };
}
