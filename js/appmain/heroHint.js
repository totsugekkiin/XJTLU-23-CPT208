import { clamp } from "./utils.js";

export function setupHeroHint(context) {
  const { heroScrollHint } = context;

  return {
    setByDockProgress(progress) {
      if (!heroScrollHint) return;
      gsap.set(heroScrollHint, { opacity: 1 - clamp(progress, 0, 1) * 0.8 });
    },
  };
}
