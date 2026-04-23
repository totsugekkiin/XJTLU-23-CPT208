export function setupHeroTopbar(context) {
  const { heroTopbar, heroTopbarLeft, heroPetDockBtn, heroLogo, heroPill } = context;
  if (!heroTopbar || !heroLogo || !heroPill) return;

  return {
    sync() {
      const els = [heroTopbar, heroLogo, heroPill];
      if (heroTopbarLeft) els.push(heroTopbarLeft);
      if (heroPetDockBtn) els.push(heroPetDockBtn);
      gsap.set(els, { y: 0 });
    },
  };
}
