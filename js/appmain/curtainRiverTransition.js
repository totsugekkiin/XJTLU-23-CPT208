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
  beforeOpenDelay = 0.12,
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
  let isClosed = false;
  let hasCalledClosed = false;
  let pendingBeforeOpen = null;

  function setCurtainPaths(leftCurtain, rightCurtain) {
    const lPath = `M0,0 L${state.topP},0 L${state.botP},100 L0,100 Z`;
    const rPath = `M100,0 L${100 - state.topP},0 L${100 - state.botP},100 L100,100 Z`;
    leftCurtain.setAttribute("d", lPath);
    rightCurtain.setAttribute("d", rPath);
  }

  function ensureTimeline() {
    if (tl || !gsap) return;
    const { curtainOverlay, leftCurtain, rightCurtain } = getEls();
    if (!curtainOverlay || !leftCurtain || !rightCurtain) return;

    const update = () => setCurtainPaths(leftCurtain, rightCurtain);

    tl = gsap.timeline({ paused: true });
    tl.eventCallback("onStart", () => {
      curtainOverlay.classList.add("is-active");
      update();
    });
    tl.eventCallback("onComplete", () => {
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
      curtainOverlay.classList.remove("is-active");
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
    if (!tl) return;
    isClosed = true;
    tl.play();
  }

  function reverseOpen() {
    ensureTimeline();
    if (!tl) return;
    isClosed = false;
    if (pendingBeforeOpen) {
      pendingBeforeOpen.kill();
      pendingBeforeOpen = null;
    }

    if (typeof onBeforeOpen === "function") {
      try {
        onBeforeOpen();
      } catch (e) {
        console.error("[curtainTransition] onBeforeOpen 回调执行失败", e);
      }
    }

    pendingBeforeOpen = gsap.delayedCall(Math.max(0, beforeOpenDelay), () => {
      pendingBeforeOpen = null;
      tl.reverse();
    });
  }

  function fadeOutAndHide({ duration = 0.65 } = {}) {
    const { curtainOverlay } = getEls();
    if (!curtainOverlay || !gsap) return;
    gsap.to(curtainOverlay, {
      opacity: 0,
      duration,
      ease: "power2.out",
      onComplete: () => {
        curtainOverlay.classList.remove("is-active");
        curtainOverlay.style.opacity = "";
      },
    });
  }

  // 固定点触发：不把动画进度绑定滚动，只在跨阈值时切换 play/reverse
  function handleProgress(progress) {
    // 只在末段范围才考虑触发（额外保护，避免前段误触）
    if (progress < startAt && isClosed) {
      // 如果某些情况下提前关闭了，且已回到 startAt 之前，就打开
      reverseOpen();
      return;
    }

    if (!isClosed && progress >= enterAt) {
      playClose();
      return;
    }

    if (isClosed && progress <= leaveAt) {
      reverseOpen();
    }
  }

  return { handleProgress, playClose, reverseOpen, fadeOutAndHide };
}

