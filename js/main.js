// Main entry: gather shared DOM and init scenes.
// Requires: gsap loaded before this file.

document.addEventListener("DOMContentLoaded", () => {
  const homeScreen = document.getElementById("home-screen");

  const btnTeam = document.getElementById("btn-team");
  const btnBackTeam = document.getElementById("btn-back-team");

  const teamScreen = document.getElementById("team-screen");
  const tearTop = document.getElementById("tear-top");
  const tearBottom = document.getElementById("tear-bottom");
  const typewriters = document.querySelectorAll(".typewriter");

  window.TeamScene?.init({
    btnTeam,
    btnBackTeam,
    homeScreen,
    teamScreen,
    tearTop,
    tearBottom,
    typewriters,
  });
});
