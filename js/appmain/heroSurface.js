import { clamp } from "./utils.js";

export function setupHeroSurface({ context, motionConfig, prefersReducedMotion }) {
  const { heroCard, heroCardStack } = context;
  if (prefersReducedMotion || !heroCard || !heroCardStack) return;

  const updateSurface = (clientX, clientY) => {
    const rect = heroCard.getBoundingClientRect();
    const localX = clamp(clientX - rect.left, 0, rect.width || 1);
    const localY = clamp(clientY - rect.top, 0, rect.height || 1);
    const xRatio = rect.width ? localX / rect.width : 0.5;
    const yRatio = rect.height ? localY / rect.height : 0.5;
    const tiltX = (xRatio - 0.5) * motionConfig.tactile.hoverTiltX;
    const tiltY = (0.5 - yRatio) * motionConfig.tactile.hoverTiltY;

    gsap.to(heroCard, {
      "--pointer-x": `${Math.round(xRatio * 100)}%`,
      "--pointer-y": `${Math.round(yRatio * 100)}%`,
      duration: 0.22,
      ease: "power3.out",
      overwrite: "auto",
    });

    gsap.to(heroCardStack, {
      "--tilt-x": `${tiltX.toFixed(2)}deg`,
      "--tilt-y": `${tiltY.toFixed(2)}deg`,
      duration: 0.26,
      ease: "power3.out",
      overwrite: "auto",
    });
  };

  heroCard.addEventListener("pointermove", (event) => {
    updateSurface(event.clientX, event.clientY);
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
    gsap.to(heroCard, {
      "--pointer-x": "50%",
      "--pointer-y": "50%",
      duration: 0.4,
      ease: "power3.out",
      overwrite: "auto",
    });

    gsap.to(heroCardStack, {
      "--tilt-x": "0deg",
      "--tilt-y": "0deg",
      scaleX: 1,
      scaleY: 1,
      duration: 0.45,
      ease: "power3.out",
      overwrite: "auto",
    });
  });
}
