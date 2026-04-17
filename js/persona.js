// PERSONA scene (P3) — transition + back button (currently no profile content logic)
// Exposes: window.PersonaScene.init(deps)

(function () {
  function init(deps) {
    const {
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
    } = deps;

    btnPersona.addEventListener("click", (e) => {
      e.preventDefault();
      personaScreen.style.display = "block";

      const tl = gsap.timeline();
      tl.to(waterLayer, { top: "-10%", rotation: 180, duration: 1.2, ease: "power2.inOut" })
        .to(
          navItems,
          {
            y: () => 100 + Math.random() * 200,
            x: () => (Math.random() - 0.5) * 300,
            rotation: () => (Math.random() - 0.5) * 90,
            opacity: 0,
            duration: 0.8,
            ease: "power1.in",
          },
          "-=1.0",
        )
        .call(() => {
          homeScreen.style.display = "none";
          tearTop.style.display = "none";
          tearBottom.style.display = "none";
          gsap.set(navItems, { clearProps: "all" });
        })
        .to(waterLayer, { opacity: 0, duration: 0.5 })
        .to(dotPattern, { opacity: 1, duration: 0.8 }, "-=0.5")
        .to(slantedBgWrapper, { x: "0%", duration: 1, ease: "power3.out" }, "-=0.6")
        .to(btnBackPersona, { autoAlpha: 1, x: 10, duration: 0.5, ease: "back.out(1.5)" }, "-=0.2");
    });

    btnBackPersona.addEventListener("click", () => {
      const tl = gsap.timeline();
      tl.to(btnBackPersona, { autoAlpha: 0, x: -20, duration: 0.3 })
        .to(slantedBgWrapper, { x: "-100%", duration: 0.6, ease: "power3.in" }, "<")
        .to(dotPattern, { opacity: 0, duration: 0.3 }, "<")
        .to(waterLayer, { opacity: 1, duration: 0.1 })
        .call(() => {
          homeScreen.style.display = "flex";
          tearTop.style.display = "block";
          tearBottom.style.display = "block";
        })
        .to(waterLayer, { top: "-200%", rotation: 0, duration: 1, ease: "power2.inOut" })
        .fromTo(
          "#home-nav",
          { opacity: 0, scale: 0.8 },
          { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.5)" },
          "-=0.5",
        )
        .call(() => {
          personaScreen.style.display = "none";
        });
    });
  }

  window.PersonaScene = { init };
})();

