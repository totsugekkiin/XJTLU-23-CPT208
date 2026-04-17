export function setupHeroButton(context) {
  const { heroGoBtn, stackCards } = context;
  const primaryCard = stackCards[0] || null;

  heroGoBtn?.addEventListener("click", () => {
    if (!primaryCard) return;

    gsap.fromTo(
      primaryCard,
      { scale: 1 },
      { scale: 0.985, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.inOut" }
    );
  });
}
