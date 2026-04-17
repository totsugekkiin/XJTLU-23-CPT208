import { clamp, mapRange, parseCssNumber, snap } from "./utils.js";

function createCardControllers(stackCards, cardsConfig) {
  return cardsConfig
    .map((config) => {
      const byIndex = stackCards.find((card) => Number(card.dataset.cardIndex) === config.index);
      const byClass = stackCards.find((card) => card.classList.contains(config.variantClass));
      const element = byIndex || byClass || null;
      if (!element) return null;
      const contentNodes = Array.from(
        element.querySelectorAll(
          ".hero-card__title, .hero-card__description, .hero-card__actions, .hero-card__scroll-hint"
        )
      );
      return { id: config.id, index: config.index, config, element, contentNodes };
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);
}

export function createHeroCardStackController({ context, cardsConfig, motionConfig }) {
  const { hero, heroCard, heroCardStack, stackCards, heroTopbarSync, heroHintSync, prefersReducedMotion } = context;
  const controllers = createCardControllers(stackCards, cardsConfig);
  let activeCardId = null;

  const setCardContentVisible = (id, visible) => {
    const card = controllers.find((item) => item.id === id);
    if (!card) return;
    card.contentNodes.forEach((node) => gsap.set(node, { opacity: visible ? 1 : 0 }));
  };

  const applyCardStyle = (id, style) => {
    const card = controllers.find((item) => item.id === id);
    if (!card) return;
    gsap.set(card.element, style);
  };

  const setCardActive = (id) => {
    if (id === activeCardId) return;
    activeCardId = id;
    controllers.forEach((card) => card.element.classList.toggle("is-active", card.id === id));
  };

  const getDockBottom = (progress) => {
    const heroStyles = window.getComputedStyle(hero);
    const primary = controllers[0];
    const cardHeight = primary?.element?.offsetHeight || heroCard.offsetHeight || 0;
    const hiddenRatio = parseCssNumber(heroStyles.getPropertyValue("--primary-card-hidden-ratio"), 0);
    const hiddenSize = cardHeight * hiddenRatio;
    const initialBottom = -hiddenSize;
    const targetBottom = (window.innerHeight - cardHeight) / 2 + 16;
    const moveProgress = clamp(progress / motionConfig.stages.dockEnd, 0, 1);
    return initialBottom + (targetBottom - initialBottom) * moveProgress;
  };

  const renderDock = () => {
    setCardActive("primary");
    controllers.forEach((card, index) => {
      const base = card.config.stackLayout || { x: 0, y: 0, rotate: 0, scale: 1 };
      setCardContentVisible(card.id, index === 0);
      applyCardStyle(card.id, {
        opacity: index === 0 ? 1 : 0,
        x: index === 0 ? 0 : snap(base.x),
        y: index === 0 ? 0 : snap(base.y),
        z: 0,
        rotateY: 0,
        rotateX: 0,
        rotateZ: index === 0 ? 0 : base.rotate,
        scale: index === 0 ? 1 : base.scale,
        scaleX: 1,
        scaleY: 1,
        filter: "none",
        zIndex: controllers.length - index,
      });
    });
  };

  const renderSwitch = (progress) => {
    const switchProgress = (progress - motionConfig.stages.dockEnd) / (motionConfig.stages.switchEnd - motionConfig.stages.dockEnd);
    const p = clamp(switchProgress, 0, 1);
    const edgeEnd = motionConfig.switch.point;
    const flipEnd = motionConfig.switch.faceOutEnd;
    const scatterStart = motionConfig.switch.scatterStart ?? flipEnd;

    const primaryEdgeProgress = clamp(mapRange(p, 0, edgeEnd, 0, 1), 0, 1);
    const flipProgress = clamp(mapRange(p, edgeEnd, flipEnd, 0, 1), 0, 1);
    const scatterProgress = clamp(mapRange(p, scatterStart, 1, 0, 1), 0, 1);
    const switched = p >= edgeEnd;
    const primaryRotateY = primaryEdgeProgress * motionConfig.switch.primaryRotateYMax;
    const stackScaleX = mapRange(flipProgress, 0, 1, motionConfig.switch.stackScaleXMin, 1);
    const stackRotateY = mapRange(flipProgress, 0, 1, -90, 0);
    const stackFrontReady = flipProgress >= 0.8;

    const primaryOpacity = switched ? 1 - clamp(mapRange(p, edgeEnd, edgeEnd + 0.14, 0, 1), 0, 1) : 1;
    const stackOpacity = switched ? clamp(mapRange(p, edgeEnd + 0.02, edgeEnd + 0.18, 0, 1), 0, 1) : 0;
    setCardActive(switched ? "blue" : "primary");

    controllers.forEach((card, index) => {
      const base = card.config.stackLayout || { x: 0, y: 0, rotate: 0, scale: 1 };
      const isPrimary = index === 0;
      if (isPrimary) {
        setCardContentVisible(card.id, !switched);
      } else {
        setCardContentVisible(card.id, switched && stackFrontReady);
      }
      applyCardStyle(card.id, {
        opacity: isPrimary ? primaryOpacity : stackOpacity,
        x: isPrimary ? 0 : snap(base.x * scatterProgress),
        y: isPrimary ? 0 : snap(base.y * scatterProgress),
        z: 0,
        rotateY: isPrimary ? primaryRotateY : stackRotateY,
        rotateX: 0,
        rotateZ: isPrimary ? 0 : base.rotate * scatterProgress,
        scaleX: isPrimary ? 1 : stackScaleX,
        scaleY: 1,
        zIndex: controllers.length - index,
      });
    });
  };

  const renderRelease = (progress) => {
    const releaseProgress = Math.max(
      0,
      (progress - motionConfig.stages.switchEnd) / (motionConfig.stages.releaseEnd - motionConfig.stages.switchEnd)
    );
    const activeIndex = clamp(1 + Math.floor(Math.min(releaseProgress, 1) * (controllers.length - 1)), 1, controllers.length - 1);
    setCardActive(controllers[activeIndex]?.id || "blue");

    controllers.forEach((card, index) => {
      const base = card.config.stackLayout || { x: 0, y: 0, rotate: 0 };
      const release = card.config.release || { liftY: 212, driftX: 24, rotateDelta: 7 };
      const segmentStart = index / controllers.length;
      const segmentEnd = (index + 1) / controllers.length;
      const local = Math.max((releaseProgress - segmentStart) / (segmentEnd - segmentStart), 0);
      const driftDirection = release.driftX >= 0 ? 1 : -1;
      const driftX = base.x + local * Math.abs(release.driftX) * driftDirection;
      const offscreenLiftY = Math.max(
        release.liftY,
        window.innerHeight + (card.element?.offsetHeight || 0) + 120
      );
      const liftedY = base.y - local * offscreenLiftY;
      const rotateZ = base.rotate + local * release.rotateDelta;
      setCardContentVisible(card.id, index !== 0);

      applyCardStyle(card.id, {
        // 释放阶段不再淡出：卡片保持可见，依靠位移飘出屏幕
        opacity: index === 0 ? 0 : 1,
        x: snap(driftX),
        y: snap(liftedY),
        z: 0,
        rotateY: 0,
        rotateX: 0,
        rotateZ,
        scaleX: 1,
        scaleY: 1,
        zIndex: controllers.length - index,
      });
    });
  };

  const updateByScroll = () => {
    if (prefersReducedMotion || !hero || !heroCard || !heroCardStack || controllers.length === 0) return;
    const scrollY = Math.max(0, window.scrollY);
    const heroStyles = window.getComputedStyle(hero);
    const scrollLengthPx = parseCssNumber(heroStyles.getPropertyValue("--hero-scroll-length-px"), 1);
    const progress = Math.max(0, scrollY / Math.max(1, scrollLengthPx));

    heroTopbarSync?.();
    gsap.set(heroCard, { bottom: getDockBottom(progress), y: 0, transformPerspective: 620 });
    heroHintSync?.(clamp(Math.min(progress, 1) / motionConfig.stages.dockEnd, 0, 1));

    if (progress <= motionConfig.stages.dockEnd) {
      renderDock();
      return;
    }
    if (progress <= motionConfig.stages.switchEnd) {
      renderSwitch(progress);
      return;
    }
    renderRelease(progress);
  };

  return {
    controllers,
    setCardActive,
    applyCardStyle,
    setCardContentVisible,
    updateByScroll,
  };
}
