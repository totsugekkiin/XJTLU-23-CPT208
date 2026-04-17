// Main entry: gather shared DOM and init scenes.
// Requires: gsap loaded before this file.

document.addEventListener("DOMContentLoaded", () => {
  const homeScreen = document.getElementById("home-screen");
  const navItems = document.querySelectorAll(".nav-item");

  const btnTeam = document.getElementById("btn-team");
  const btnPersona = document.getElementById("btn-persona");
  const btnBackTeam = document.getElementById("btn-back-team");
  const btnBackPersona = document.getElementById("btn-back-persona");

  const teamScreen = document.getElementById("team-screen");
  const tearTop = document.getElementById("tear-top");
  const tearBottom = document.getElementById("tear-bottom");
  const typewriters = document.querySelectorAll(".typewriter");

  const personaScreen = document.getElementById("persona-screen");
  const waterLayer = document.getElementById("water-layer");
  const dotPattern = document.querySelector(".p3-dot-pattern");
  const slantedBgWrapper = document.querySelector(".slanted-bg-wrapper");

  window.TeamScene?.init({
    btnTeam,
    btnBackTeam,
    homeScreen,
    teamScreen,
    tearTop,
    tearBottom,
    typewriters,
  });

  window.PersonaScene?.init({
    btnPersona,
    btnBackPersona,
    homeScreen,
    personaScreen,
    tearTop,
    tearBottom,
    navItems,
    waterLayer,
    dotPattern,
    slantedBgWrapper,
  });
});

