import { clamp } from "./utils.js";

export function setupHeroSurface({ context, motionConfig, prefersReducedMotion }) {
  const { heroCard, heroCardStack } = context;
  if (prefersReducedMotion || !heroCard || !heroCardStack) return;

  const createQuickTo = (target, prop, vars) => {
    if (typeof gsap?.quickTo === "function") return gsap.quickTo(target, prop, vars);
    const setter = typeof gsap?.quickSetter === "function" ? gsap.quickSetter(target, prop) : null;
    return (value) => {
      if (setter) setter(value);
      else gsap.set(target, { [prop]: value });
    };
  };

  const setPointerX = createQuickTo(heroCard, "--pointer-x", {
    duration: 0.22,
    ease: "power3.out",
    overwrite: "auto",
  });
  const setPointerY = createQuickTo(heroCard, "--pointer-y", {
    duration: 0.22,
    ease: "power3.out",
    overwrite: "auto",
  });
  const setTiltX = createQuickTo(heroCardStack, "--tilt-x", {
    duration: 0.26,
    ease: "power3.out",
    overwrite: "auto",
  });
  const setTiltY = createQuickTo(heroCardStack, "--tilt-y", {
    duration: 0.26,
    ease: "power3.out",
    overwrite: "auto",
  });

  let pendingX = null;
  let pendingY = null;
  let rafId = null;

  const updateSurface = (clientX, clientY) => {
    const rect = heroCard.getBoundingClientRect();
    const localX = clamp(clientX - rect.left, 0, rect.width || 1);
    const localY = clamp(clientY - rect.top, 0, rect.height || 1);
    const xRatio = rect.width ? localX / rect.width : 0.5;
    const yRatio = rect.height ? localY / rect.height : 0.5;
    const tiltX = (xRatio - 0.5) * motionConfig.tactile.hoverTiltX;
    const tiltY = (0.5 - yRatio) * motionConfig.tactile.hoverTiltY;

    setPointerX(`${Math.round(xRatio * 100)}%`);
    setPointerY(`${Math.round(yRatio * 100)}%`);
    setTiltX(`${tiltX.toFixed(2)}deg`);
    setTiltY(`${tiltY.toFixed(2)}deg`);
  };

  heroCard.addEventListener("pointermove", (event) => {
    pendingX = event.clientX;
    pendingY = event.clientY;
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      if (pendingX === null || pendingY === null) return;
      updateSurface(pendingX, pendingY);
    });
  });

  heroCard.addEventListener("pointerdown", (event) => {
    updateSurface(event.clientX, event.clientY);
    gsap.to(heroCardStack, {
      scaleX: motionConfig.tactile.pressScaleX,
      scaleY: motionConfig.tactile.pressScaleY,
      duration: 0.08,
      ease: "power2.out",
      yoyo: true,
      repeat: 1,
      overwrite: "auto",
    });
  });

  heroCard.addEventListener("pointerleave", () => {
    pendingX = null;
    pendingY = null;
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }

    setPointerX("50%");
    setPointerY("50%");
    setTiltX("0deg");
    setTiltY("0deg");
    gsap.to(heroCardStack, { scaleX: 1, scaleY: 1, duration: 0.45, ease: "power3.out", overwrite: "auto" });
  });
}
