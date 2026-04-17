export function setupHeroTopbar(context) {
  const { heroTopbar, heroLogo, heroPill } = context;
  if (!heroTopbar || !heroLogo || !heroPill) return;

  return {
    sync() {
      gsap.set([heroTopbar, heroLogo, heroPill], { y: 0 });
    },
  };
}
