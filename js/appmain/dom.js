export function createDomContext() {
  const hero = document.getElementById("hero");
  const heroTopbar = document.querySelector(".hero-topbar");
  const heroTopbarLeft = document.querySelector(".hero-topbar__left");
  const heroPetDockBtn = document.getElementById("hero-pet-dock-btn");
  const heroLogo = document.querySelector(".hero-logo");
  const heroPill = document.querySelector(".hero-pill");
  const heroCard = document.querySelector("#hero-card");
  const heroScrollHint = document.querySelector(".hero-card__scroll-hint");
  const heroGoBtn = document.getElementById("hero-go-btn");
  const heroCardStack = document.getElementById("hero-card-stack");
  const stackCards = Array.from(document.querySelectorAll(".stack-card"));

  return {
    hero,
    heroTopbar,
    heroTopbarLeft,
    heroPetDockBtn,
    heroLogo,
    heroPill,
    heroCard,
    heroScrollHint,
    heroGoBtn,
    heroCardStack,
    stackCards,
  };
}
