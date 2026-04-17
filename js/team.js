// TEAM scene (P5) — entrance/exit timelines + typewriter
// Exposes: window.TeamScene.init(deps)

(function () {
  function createTypewriter(typewriters) {
    let typingTimeouts = [];

    const clearTypewriters = () => {
      typingTimeouts.forEach(clearTimeout);
      typingTimeouts = [];
      typewriters.forEach((tw) => (tw.textContent = ""));
    };

    const typeText = (element, text) => {
      let i = 0;
      element.textContent = "";
      const type = () => {
        if (i < text.length) {
          element.textContent += text.charAt(i);
          i++;
          typingTimeouts.push(setTimeout(type, 30 + Math.random() * 20));
        }
      };
      type();
    };

    return { clearTypewriters, typeText };
  }

  function init(deps) {
    const {
      btnTeam,
      btnBackTeam,
      homeScreen,
      teamScreen,
      tearTop,
      tearBottom,
      typewriters,
    } = deps;

    const { clearTypewriters, typeText } = createTypewriter(typewriters);

    btnTeam.addEventListener("click", (e) => {
      e.preventDefault();
      clearTypewriters();
      teamScreen.style.display = "block";

      const tl = gsap.timeline();
      tl.to("#home-nav", { opacity: 0, duration: 0.1, scale: 1.2 })
        .to(tearTop, { yPercent: -120, rotation: -2, duration: 0.8, ease: "power4.inOut" })
        .to(tearBottom, { yPercent: 120, rotation: 2, duration: 0.8, ease: "power4.inOut" }, "<")
        .call(() => {
          homeScreen.style.display = "none";
        })
        .fromTo(
          ".team-card",
          { y: 800, rotation: () => Math.random() * 40 - 20, opacity: 0, scale: 0.5 },
          {
            y: 0,
            rotation: (i) => (i % 2 === 0 ? -2 : 3),
            opacity: 1,
            scale: 1,
            duration: 1.2,
            stagger: 0.15,
            ease: "elastic.out(1, 0.4)",
          },
          "-=0.2",
        )
        .to(btnBackTeam, { autoAlpha: 1, x: 10, duration: 0.3, ease: "back.out(1.7)" }, "-=1")
        .call(() => {
          typewriters.forEach((tw) => typeText(tw, tw.getAttribute("data-text") || ""));
        });
    });

    btnBackTeam.addEventListener("click", () => {
      clearTypewriters();

      const backTl = gsap.timeline();
      backTl
        .to(btnBackTeam, { autoAlpha: 0, x: -20, duration: 0.2 })
        .to(".team-card", { y: 800, opacity: 0, duration: 0.4, stagger: -0.05, ease: "power2.in" })
        .call(() => {
          homeScreen.style.display = "flex";
        })
        .to(tearTop, { yPercent: 0, rotation: 0, duration: 0.5, ease: "power4.out" })
        .to(tearBottom, { yPercent: 0, rotation: 0, duration: 0.5, ease: "power4.out" }, "<")
        .to("#home-nav", { opacity: 1, scale: 1, duration: 0.4 }, "-=0.2")
        .call(() => {
          teamScreen.style.display = "none";
        });
    });
  }

  window.TeamScene = { init };
})();

