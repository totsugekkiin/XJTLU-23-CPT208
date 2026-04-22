const MOTIF_VARIANTS = ["stack-card--blue", "stack-card--cream", "stack-card--green", "stack-card--indigo"];

function getStackAnimationTargets(card) {
  return {
    stage: card.querySelector(".stack-card__stage"),
    svg: card.querySelector(".stack-card__svg"),
    coin: card.querySelector(".motif-coin"),
    spins: card.querySelectorAll(".motif-spin"),
    floats: card.querySelectorAll(".motif-float"),
    pulses: card.querySelectorAll(".motif-pulse"),
    delay1: card.querySelectorAll(".motif-delay-1"),
    delay2: card.querySelectorAll(".motif-delay-2"),
    delay3: card.querySelectorAll(".motif-delay-3"),
  };
}

function createCardLoop(card, index) {
  const targets = getStackAnimationTargets(card);
  if (!targets.stage || !targets.svg) return [];

  const loops = [];
  const drift = 4 + index;

  gsap.set(targets.stage, { transformOrigin: "50% 50%" });
  gsap.set(targets.svg, { transformOrigin: "50% 50%" });

  if (!card.classList.contains("stack-card--cream")) {
    loops.push(
      gsap.to(targets.stage, {
        y: -drift,
        duration: 2 + index * 0.35,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      })
    );
  }

  if (card.classList.contains("stack-card--cream") && targets.coin) {
    const box = targets.coin.getBBox();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    gsap.set(targets.coin, {
      svgOrigin: `${centerX} ${centerY}`,
      transformOrigin: "50% 50%",
      x: 0,
      y: 0,
      scale: 2.5,
      rotation: 0,
    });
    loops.push(
      gsap.to(targets.coin, {
        rotation: "+=360",
        duration: 10.5,
        ease: "none",
        repeat: -1,
      })
    );
  }

  if (targets.spins.length) {
    loops.push(
      gsap.to(targets.spins, {
        rotation: "+=360",
        duration: 9 + index,
        ease: "none",
        repeat: -1,
      })
    );
  }

  if (targets.floats.length) {
    loops.push(
      gsap.to(targets.floats, {
        y: "-=6",
        duration: 1.4 + index * 0.2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 0.15,
      })
    );
  }

  if (targets.pulses.length) {
    loops.push(
      gsap.to(targets.pulses, {
        scale: 1.08,
        opacity: 0.75,
        duration: 1.3 + index * 0.18,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      })
    );
  }

  if (targets.delay1.length || targets.delay2.length || targets.delay3.length) {
    const tl = gsap.timeline({ repeat: -1 });
    if (targets.delay1.length) tl.to(targets.delay1, { opacity: 0.45, duration: 0.45, yoyo: true, repeat: 1 }, 0);
    if (targets.delay2.length) tl.to(targets.delay2, { opacity: 0.45, duration: 0.45, yoyo: true, repeat: 1 }, 0.2);
    if (targets.delay3.length) tl.to(targets.delay3, { opacity: 0.45, duration: 0.45, yoyo: true, repeat: 1 }, 0.4);
    tl.to({}, { duration: 0.8 + index * 0.1 });
    loops.push(tl);
  }

  return loops;
}

export function setupHeroCardSvgLoop({ stackCards = [], prefersReducedMotion = false }) {
  if (prefersReducedMotion || !Array.isArray(stackCards) || stackCards.length === 0) {
    return { destroy: () => {} };
  }

  const loopsByVariant = new Map();
  let activeVariant = null;

  MOTIF_VARIANTS.forEach((variant, index) => {
    const card = stackCards.find((item) => item.classList.contains(variant));
    if (!card) return;
    const loops = createCardLoop(card, index);
    loops.forEach((loop) => loop?.pause?.(0));
    loopsByVariant.set(variant, { card, loops });
  });

  const setActiveVariant = (nextVariant) => {
    if (nextVariant === activeVariant) return;
    activeVariant = nextVariant;
    loopsByVariant.forEach(({ loops }, variant) => {
      if (variant === nextVariant) loops.forEach((loop) => loop?.resume?.());
      else loops.forEach((loop) => loop?.pause?.());
    });
  };

  const pickActiveVariant = () => {
    for (const variant of MOTIF_VARIANTS) {
      const entry = loopsByVariant.get(variant);
      if (!entry?.card) continue;
      if (entry.card.classList.contains("is-active")) return variant;
    }
    return MOTIF_VARIANTS.find((variant) => loopsByVariant.has(variant)) ?? null;
  };

  setActiveVariant(pickActiveVariant());

  const observer = new MutationObserver(() => {
    const next = pickActiveVariant();
    if (next) setActiveVariant(next);
  });
  loopsByVariant.forEach(({ card }) => {
    observer.observe(card, { attributes: true, attributeFilter: ["class"] });
  });

  return {
    destroy() {
      observer.disconnect();
      loopsByVariant.forEach(({ loops }) => loops.forEach((loop) => loop?.kill?.()));
    },
  };
}
