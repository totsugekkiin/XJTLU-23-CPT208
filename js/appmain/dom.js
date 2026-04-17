export function createDomContext() {
  const hero = document.getElementById("hero");
  const heroTopbar = document.querySelector(".hero-topbar");
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
    heroLogo,
    heroPill,
    heroCard,
    heroScrollHint,
    heroGoBtn,
    heroCardStack,
    stackCards,
  };
}
