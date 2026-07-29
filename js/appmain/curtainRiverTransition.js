const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const clamp01 = (v) => clamp(v, 0, 1);

export function createCurtainRiverTransition({
  curtainOverlayId = "curtainOverlay",
  startAt = 0.99,
  enterAt = 0.99,
  leaveAt = 0.985,
  onClosed,
  onBeforeOpen,
  onOpened,
  beforeOpenDelay = 0.06,
  beforeOpenFadeDuration = 0.18,
} = {}) {
  const gsap = typeof window !== "undefined" ? window.gsap : null;
  if (!gsap) {
    console.warn("[curtainTransition] GSAP 未加载，幕布转场不可用");
  }

  const getEls = () => {
    const curtainOverlay = document.getElementById(curtainOverlayId);
    const leftCurtain = document.getElementById("leftCurtain");
    const rightCurtain = document.getElementById("rightCurtain");
    return { curtainOverlay, leftCurtain, rightCurtain };
  };

  const state = { topP: 0, botP: 0 };
  let tl = null;
  let phase = "open";
  let hasCalledClosed = false;
  let pendingBeforeOpen = null;
  let fadeTween = null;

  function setCurtainPaths(leftCurtain, rightCurtain) {
    const lPath = `M0,0 L${state.topP},0 L${state.botP},100 L0,100 Z`;
    const rPath = `M100,0 L${100 - state.topP},0 L${100 - state.botP},100 L100,100 Z`;
    leftCurtain.setAttribute("d", lPath);
    rightCurtain.setAttribute("d", rPath);
  }

  function killPendingBeforeOpen() {
    if (!pendingBeforeOpen) return;
    pendingBeforeOpen.kill();
    pendingBeforeOpen = null;
  }

  function showCurtainOverlay() {
    const { curtainOverlay } = getEls();
    if (!curtainOverlay) return;
    if (fadeTween) {
      fadeTween.kill();
      fadeTween = null;
    }
    curtainOverlay.style.opacity = "1";
    curtainOverlay.classList.add("is-active");
  }

  function ensureTimeline() {
    if (tl || !gsap) return;
    const { curtainOverlay, leftCurtain, rightCurtain } = getEls();
    if (!curtainOverlay || !leftCurtain || !rightCurtain) return;

    const update = () => setCurtainPaths(leftCurtain, rightCurtain);

    tl = gsap.timeline({ paused: true });
    tl.eventCallback("onStart", () => {
      showCurtainOverlay();
      update();
    });
    tl.eventCallback("onComplete", () => {
      phase = "closed";
      if (!hasCalledClosed) {
        hasCalledClosed = true;
        if (typeof onClosed === "function") {
          try {
            onClosed();
          } catch (e) {
            console.error("[curtainTransition] onClosed 回调执行失败", e);
          }
        }
      }
    });
    tl.eventCallback("onReverseComplete", () => {
      phase = "open";
      curtainOverlay.classList.remove("is-active");
      curtainOverlay.style.opacity = "";
      state.topP = 0;
      state.botP = 0;
      update();
      hasCalledClosed = false;
      if (typeof onOpened === "function") {
        try {
          onOpened();
        } catch (e) {
          console.error("[curtainTransition] onOpened 回调执行失败", e);
        }
      }
    });

    // 1) 上端先合
    tl.to(state, { topP: 52, duration: 0.6, ease: "power3.in", onUpdate: update }, 0);
    // 2) 下端延迟合，形成斜切
    tl.to(state, { botP: 52, duration: 0.6, ease: "power3.in", delay: 0.15, onUpdate: update }, 0);
  }

  function playClose() {
    ensureTimeline();
    if (!tl || phase === "closing" || phase === "closed") return;
    killPendingBeforeOpen();
    showCurtainOverlay();
    phase = "closing";
    tl.play();
  }

  function reverseOpen() {
    ensureTimeline();
    if (!tl || phase === "open" || phase === "opening") return;
    killPendingBeforeOpen();
    tl.pause();
    phase = "opening";

    const beginOpen = () => {
      if (phase !== "opening") return;
      if (typeof onBeforeOpen === "function") {
        try {
          onBeforeOpen();
        } catch (e) {
          console.error("[curtainTransition] onBeforeOpen 回调执行失败", e);
        }
      }

      pendingBeforeOpen = gsap.delayedCall(Math.max(0, beforeOpenDelay), () => {
        pendingBeforeOpen = null;
        if (phase !== "opening") return;
        tl.reverse();
      });
    };

    const { curtainOverlay } = getEls();
    if (!curtainOverlay) {
      beginOpen();
      return;
    }

    const currentOpacity = Number.parseFloat(getComputedStyle(curtainOverlay).opacity) || 0;
    if (fadeTween) {
      fadeTween.kill();
      fadeTween = null;
    }
    curtainOverlay.style.opacity = String(currentOpacity);
    curtainOverlay.classList.add("is-active");

    if (currentOpacity >= 0.995 || beforeOpenFadeDuration <= 0) {
      curtainOverlay.style.opacity = "1";
      beginOpen();
      return;
    }

    fadeTween = gsap.to(curtainOverlay, {
      opacity: 1,
      duration: beforeOpenFadeDuration,
      ease: "power2.out",
      onComplete: () => {
        fadeTween = null;
        beginOpen();
      },
    });
  }

  function fadeOutAndHide({ duration = 0.65 } = {}) {
    const { curtainOverlay } = getEls();
    if (!curtainOverlay || !gsap) return;
    if (fadeTween) fadeTween.kill();
    fadeTween = gsap.to(curtainOverlay, {
      opacity: 0,
      duration,
      ease: "power2.out",
      onComplete: () => {
        fadeTween = null;
        curtainOverlay.classList.remove("is-active");
        curtainOverlay.style.opacity = "";
      },
    });
  }

  // 固定点触发：不把动画进度绑定滚动，只在跨阈值时切换 play/reverse
  function handleProgress(progress) {
    const p = clamp01(progress);
    const closeThreshold = Math.max(clamp01(startAt), clamp01(enterAt));
    const openThreshold = Math.min(clamp01(leaveAt), closeThreshold);

    if ((phase === "open" || phase === "opening") && p >= closeThreshold) {
      playClose();
      return;
    }

    if ((phase === "closing" || phase === "closed") && p <= openThreshold) {
      reverseOpen();
    }
  }

  function destroy() {
    killPendingBeforeOpen();
    if (fadeTween) {
      fadeTween.kill();
      fadeTween = null;
    }
    tl?.kill?.();
    tl = null;
    phase = "open";
    hasCalledClosed = false;
    const { curtainOverlay, leftCurtain, rightCurtain } = getEls();
    curtainOverlay?.classList.remove("is-active");
    if (curtainOverlay) curtainOverlay.style.opacity = "";
    state.topP = 0;
    state.botP = 0;
    if (leftCurtain && rightCurtain) setCurtainPaths(leftCurtain, rightCurtain);
  }

  return {
    handleProgress,
    playClose,
    reverseOpen,
    fadeOutAndHide,
    destroy,
    get phase() {
      return phase;
    },
  };
}

