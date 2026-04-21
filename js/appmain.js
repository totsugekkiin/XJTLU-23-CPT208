import { layoutConfig, cardsConfig, motionConfig } from "./appmain/config.js";
import { createDomContext } from "./appmain/dom.js";
import { setupHeroButton } from "./appmain/heroButton.js";
import { createHeroCardStackController } from "./appmain/heroCardStack.js";
import { setupHeroHint } from "./appmain/heroHint.js";
import { setupHeroCardSvgLoop } from "./appmain/heroCardSvgLoop.js";
import { setupHeroTopbar } from "./appmain/heroTopbar.js";
import { applyPerCardCssVariables, applyRootCssVariables } from "./appmain/styleVars.js";
import { createDesktopPet } from "./appmain/pet/index.js";
import { setupScrollMaskZoom } from "./appmain/scrollMaskZoom.js";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const context = createDomContext();

applyRootCssVariables(context.hero, layoutConfig);

const topbarController = setupHeroTopbar(context);
const hintController = setupHeroHint(context);

const cardStackController = createHeroCardStackController({
  context: {
    ...context,
    heroTopbarSync: () => topbarController?.sync(),
    heroHintSync: (progress) => hintController?.setByDockProgress(progress),
    prefersReducedMotion,
  },
  cardsConfig,
  motionConfig,
});

applyPerCardCssVariables(cardStackController.controllers);
setupHeroCardSvgLoop({
  stackCards: context.stackCards,
  prefersReducedMotion,
});
setupHeroButton(context);

let rafId = null;
const revealSections = Array.from(document.querySelectorAll(".reveal-section"));

const observeSections = () => {
  if (revealSections.length === 0) return;
  if (!("IntersectionObserver" in window)) {
    revealSections.forEach((section) => section.classList.add("is-inview"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-inview");
        observer.unobserve(entry.target);
      });
    },
    { root: null, rootMargin: "0px 0px -12% 0px", threshold: 0.15 }
  );

  revealSections.forEach((section) => observer.observe(section));
};

const onScroll = () => {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    document.body.classList.toggle("is-scrolled", window.scrollY > 24);
    cardStackController.updateByScroll();
    rafId = null;
  });
};

const onViewportResize = () => {
  applyRootCssVariables(context.hero, layoutConfig);
  cardStackController.updateByScroll();
};

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onViewportResize, { passive: true });
observeSections();
document.body.classList.toggle("is-scrolled", window.scrollY > 24);
cardStackController.updateByScroll();

setupScrollMaskZoom({ prefersReducedMotion });

const petHost = document.getElementById("pet-layer");
const petHitzone = document.getElementById("pet-hitzone");
const petAnchorEl = document.querySelector(".stack-card--primary");
const petTargetEl = document.getElementById("target-zone");

if (petHost && petHitzone) {
  createDesktopPet({
    host: petHost,
    hitzone: petHitzone,
    anchorEl: petAnchorEl,
    targetEl: petTargetEl,
    prefersReducedMotion,
    scale: 2,
  }).catch((err) => {
    console.error("[desktop-pet] 初始化失败", err);
  });
}

