export function applyRootCssVariables(hero, layoutConfig) {
  if (!hero) return;
  const { padX, cardMaxWidth, primary, scrollLengthPx } = layoutConfig;
  const isMobileViewport = window.matchMedia("(max-width: 768px)").matches;
  const hiddenRatio = isMobileViewport
    ? (primary.hiddenRatioMobile ?? primary.hiddenRatio)
    : primary.hiddenRatio;

  hero.style.setProperty("--hero-pad-x", `${padX}px`);
  hero.style.setProperty("--hero-card-max-width", `${cardMaxWidth}px`);
  hero.style.setProperty("--primary-card-max-width", `${primary.maxWidth}px`);
  hero.style.setProperty("--primary-card-height-ratio", `${primary.heightRatio}`);
  hero.style.setProperty("--primary-card-radius", `${primary.radius}px`);
  hero.style.setProperty("--primary-card-pad-x", `${primary.paddingX}px`);
  hero.style.setProperty("--primary-card-pad-y", `${primary.paddingY}px`);
  hero.style.setProperty("--primary-card-pad-bottom", `${primary.paddingBottom}px`);
  hero.style.setProperty("--primary-card-hidden-ratio", `${hiddenRatio}`);
  hero.style.setProperty("--hero-scroll-length-px", `${scrollLengthPx}px`);
}

export function applyPerCardCssVariables(cardControllers) {
  cardControllers.forEach((controller) => {
    const { element, config } = controller;
    if (!element || !config) return;

    if (config.radius) element.style.setProperty("--card-radius", `${config.radius}px`);
    if (config.paddingX) element.style.setProperty("--card-pad-x", `${config.paddingX}px`);
    if (config.paddingTop) element.style.setProperty("--card-pad-y", `${config.paddingTop}px`);
    if (config.paddingBottom) element.style.setProperty("--card-pad-bottom", `${config.paddingBottom}px`);
    if (config.contentMotion?.breatheDuration) {
      element.style.setProperty("--card-breathe-duration", `${config.contentMotion.breatheDuration}s`);
    }
    if (config.contentMotion?.sheenDuration) {
      element.style.setProperty("--card-sheen-duration", `${config.contentMotion.sheenDuration}s`);
    }
  });
}
