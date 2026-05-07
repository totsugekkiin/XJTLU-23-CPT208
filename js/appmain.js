import { layoutConfig, cardsConfig, motionConfig, petConfig } from "./appmain/config.js";
import { createDomContext } from "./appmain/dom.js";
import { setupHeroButton } from "./appmain/heroButton.js";
import { createHeroCardStackController } from "./appmain/heroCardStack.js";
import { setupHeroHint } from "./appmain/heroHint.js";
import { setupHeroCardSvgLoop } from "./appmain/heroCardSvgLoop.js";
import { setupHeroTopbar } from "./appmain/heroTopbar.js";
import { applyPerCardCssVariables, applyRootCssVariables } from "./appmain/styleVars.js";
import { createDesktopPet } from "./appmain/pet/index.js";
import { createPetComicChat } from "./appmain/pet/petComicChat.js";
import { setupScrollMaskZoom } from "./appmain/scrollMaskZoom.js";
import { createCurtainRiverTransition } from "./appmain/curtainRiverTransition.js";
import { createRiverScene } from "./appmain/riverScene.js";

export function bootstrapAppMain() {
  // 防止在某些开发环境/热更新场景下重复执行入口脚本，导致转场回调触发两次
  if (globalThis.__APPMAIN_BOOTSTRAPPED__) {
    // #region agent log
    fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8f7e40'},body:JSON.stringify({sessionId:'8f7e40',runId:'pre-fix',hypothesisId:'H3',location:'js/appmain.js:bootstrapGuard',message:'appmain.js already bootstrapped, aborting duplicate init',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw new Error("[appmain] duplicate bootstrap prevented");
  }
  globalThis.__APPMAIN_BOOTSTRAPPED__ = true;
  // #region agent log
  fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8f7e40'},body:JSON.stringify({sessionId:'8f7e40',runId:'pre-fix',hypothesisId:'H3',location:'js/appmain.js:bootstrapGuard',message:'appmain.js bootstrap start',data:{},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const context = createDomContext();

  applyRootCssVariables(context.hero, layoutConfig);

  const topbarController = setupHeroTopbar(context);
  const hintController = setupHeroHint(context);

  const cardStackController = createHeroCardStackController({
    context: {
      ...context,
      heroTopbarSync: () => topbarController?.sync?.(),
      heroHintSync: (progress) => hintController?.setByDockProgress?.(progress),
      prefersReducedMotion,
    },
    cardsConfig,
    motionConfig,
  });

  applyPerCardCssVariables(cardStackController.controllers);
  setupHeroCardSvgLoop({
    stackCards: context.stackCards,
    prefersReducedMotion,
  });
  setupHeroButton(context);

  let rafId = null;
  const revealSections = Array.from(document.querySelectorAll(".reveal-section"));
  let revealObserver = null;

  const observeSections = () => {
    if (revealSections.length === 0) return;
    if (!("IntersectionObserver" in window)) {
      revealSections.forEach((section) => section.classList.add("is-inview"));
      return;
    }

    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-inview");
          revealObserver?.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: "0px 0px -12% 0px", threshold: 0.15 }
    );

    revealSections.forEach((section) => revealObserver.observe(section));
  };

  const onScroll = () => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      document.body.classList.toggle("is-scrolled", window.scrollY > 24);
      cardStackController.updateByScroll();
      rafId = null;
    });
  };

  const onViewportResize = () => {
    applyRootCssVariables(context.hero, layoutConfig);
    cardStackController.updateByScroll();
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onViewportResize, { passive: true });
  observeSections();
  document.body.classList.toggle("is-scrolled", window.scrollY > 24);
  cardStackController.updateByScroll();

  const riverScene = createRiverScene();
  const riverStageEl = document.getElementById("river-stage");
  const routeSectionEl = document.getElementById("route-section");
  let routeSectionObserver = null;
  if (riverStageEl && routeSectionEl && "IntersectionObserver" in window) {
    // 当地图段进入视口时，隐藏 fixed 河流层，避免遮挡文档流内容
    routeSectionObserver = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        riverStageEl.classList.toggle("river-stage--hidden-by-route", !!e?.isIntersecting);
      },
      { threshold: 0.02 }
    );
    routeSectionObserver.observe(routeSectionEl);
  }

  // ====== 河流页模式：允许向上滑“退出河流页”回到胶片段 ======
  const riverPage = {
    active: false,
    exiting: false,
    riverTopY: 0,
    preScrollY: 0,
    cmBottomScrollY: 0,
    exitArmed: false,
    lastScrollY: 0,
  };

  const transition = createCurtainRiverTransition({
    onClosed() {
      if (!riverScene) return;
      // 幕布合拢后：幕布本身作为“地面”，河流从幕布上流下（不跳转、不切页面结构）
      // #region agent log
      fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8f7e40'},body:JSON.stringify({sessionId:'8f7e40',runId:'pre-fix',hypothesisId:'H1',location:'js/appmain.js:onClosed',message:'curtain closed -> startFlow',data:{scrollY:Math.round(window.scrollY),prefersReducedMotion},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const gsap = window.gsap;
      const enterRiverPage = () => {
        if (riverPage.exiting) return;
        // 记录进入河流前“胶片段最底部附近”的 scrollY，退出时回到这里
        const cmSection = document.getElementById("cm-transition");
        const cmWrap = document.getElementById("cm-mask-scroll");
        if (cmSection && cmWrap) {
          const scrollLength = Math.max(1, cmWrap.offsetHeight - window.innerHeight);
          riverPage.cmBottomScrollY = Math.max(0, cmSection.offsetTop + scrollLength - 4);
        } else {
          riverPage.cmBottomScrollY = window.scrollY;
        }

        document.body.classList.add("is-river-page");
        riverPage.active = true;
        riverPage.exitArmed = false;
        riverPage.preScrollY = window.scrollY;
        // 进入河流“页面”后，让滚动叙事从 river-scroll-spacer 开始
        // 注意：这里必须用 auto，避免平滑滚动过程中 scrollMaskZoom 继续驱动幕布回开
        const spacer = document.getElementById("river-scroll-spacer");
        spacer?.scrollIntoView({ behavior: "auto", block: "start" });
        // 记录“河流页顶部”的 scrollY，用于检测用户向上滑到顶并退出
        riverPage.riverTopY = spacer ? spacer.offsetTop : window.scrollY;
        riverPage.lastScrollY = window.scrollY;
      };

      const start = () =>
        riverScene.startFlow({
          duration: prefersReducedMotion ? 0.01 : 2.4,
          ease: prefersReducedMotion ? "none" : "power2.inOut",
          boatDelay: prefersReducedMotion ? 0 : 0.55,
          boatEnterDuration: prefersReducedMotion ? 0.01 : 0.7,
        });

      // 双保险：确保幕布完全铺好（合拢完成）后，再启动河流/船/内容显现链路
      // 关键：先把页面切到“河流页”并跳转滚动位置，再 startFlow，确保 riverScene 记录的 scroll.startY 正确
      if (gsap?.delayedCall && !prefersReducedMotion) {
        gsap.delayedCall(0.06, () => {
          enterRiverPage();
          start();
        });
      } else {
        enterRiverPage();
        start();
      }
    },
    onBeforeOpen() {
      // 回退时：先让幕布后内容消失，再开幕布
      riverScene?.stopAndHide?.();
      document.body.classList.remove("is-river-page");
      riverPage.active = false;
    },
  });

  const exitRiverPage = () => {
    if (!riverPage.active || riverPage.exiting) return;
    riverPage.exiting = true;
    // 退出河流页：先开幕布（内部会 stopAndHide），再恢复滚动到胶片段附近
    try {
      transition.reverseOpen();
    } catch (e) {
      console.error("[riverPage] reverseOpen failed", e);
      riverScene?.stopAndHide?.();
      document.body.classList.remove("is-river-page");
      riverPage.active = false;
    }

    // 还原到胶片段“最底部附近”（避免回到初始阊门界面）
    const targetY = Math.max(0, (riverPage.cmBottomScrollY || riverPage.preScrollY) - 12);
    // display none 切换会改变文档高度：等一帧再滚动，避免浏览器把 scrollY 钳到 0
    requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: "auto" });
    });
    riverPage.exiting = false;
  };

  const onScrollForRiverPageExit = () => {
    if (!riverPage.active) return;
    const y = window.scrollY;
    const dy = y - (riverPage.lastScrollY ?? y);
    riverPage.lastScrollY = y;

    // 只有当用户已经从河流顶部往下滚开一段距离，才允许“向上滑退出”
    if (!riverPage.exitArmed) {
      if (y >= riverPage.riverTopY + 24) riverPage.exitArmed = true;
      return;
    }

    // 当用户明确向上滚，并回到河流页顶部附近：自动退出回到胶片段
    if (dy < -0.5 && y <= riverPage.riverTopY + 6) {
      exitRiverPage();
    }
  };
  window.addEventListener("scroll", onScrollForRiverPageExit, { passive: true });

  setupScrollMaskZoom({
    prefersReducedMotion,
    onProgress: (p) => {
      // 进入河流页后，禁止胶片滚动 progress 再驱动幕布状态机
      if (document.body.classList.contains("is-river-page")) return;
      transition.handleProgress(p);
    },
  });

  const petHost = document.getElementById("pet-layer");
  const petHitzone = document.getElementById("pet-hitzone");
  const petAnchorEl = document.querySelector(".stack-card--primary");
  const petTargetEl = document.getElementById("target-zone");

  async function sendToAI(userText) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: userText }),
    });

    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        (isJson && payload && typeof payload === "object" && (payload.message || payload.error) ? `${payload.message ?? payload.error}` : null) ??
        (typeof payload === "string" && payload.trim() ? payload.trim() : null) ??
        `请求失败（HTTP ${response.status}）`;
      const err = new Error(message);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    const reply = isJson && payload && typeof payload === "object" ? payload.reply : null;
    if (typeof reply !== "string" || reply.trim() === "") {
      const err = new Error("后端未返回 reply（空回复）");
      err.payload = payload;
      throw err;
    }

    console.log("AI 回复:", reply);
    return reply;
  }

  const chatEls = {
    menu: document.getElementById("guide-menu"),
    menuPanel: document.getElementById("guide-menu-panel"),
    menuClose: document.getElementById("guide-menu-close"),
    menuItems: Array.from(document.querySelectorAll("#guide-menu [data-action]")),
  };

  const guideMapEls = {
    root: document.getElementById("guide-map"),
    frame: document.getElementById("guide-map-frame"),
    close: document.getElementById("guide-map-close"),
  };

  function setMenuOpen(nextOpen) {
    if (!chatEls.menu || !chatEls.menuPanel) return;
    chatEls.menu.classList.toggle("is-open", nextOpen);
    chatEls.menu.setAttribute("aria-hidden", nextOpen ? "false" : "true");
    chatEls.menuPanel.setAttribute("aria-hidden", nextOpen ? "false" : "true");
  }

  function setGuideMapOpen(nextOpen) {
    if (!guideMapEls.root || !guideMapEls.frame) return;
    guideMapEls.root.classList.toggle("is-hidden", !nextOpen);
    guideMapEls.root.setAttribute("aria-hidden", nextOpen ? "false" : "true");
    if (nextOpen) {
      // 第一次打开时再设置 src，避免无意义加载
      if (!guideMapEls.frame.getAttribute("src")) {
        guideMapEls.frame.setAttribute("src", "map.html");
      }
    }
  }

  const onHeroPillClick = () => {
    setMenuOpen(!(chatEls.menu?.classList.contains("is-open") ?? false));
  };

  // 点击“互动导览”后，下拉显示导览选项栏
  context.heroPill?.addEventListener("click", onHeroPillClick);

  const onDocumentClickCapture = (e) => {
    if (!chatEls.menu || !chatEls.menuPanel) return;
    const isOpen = chatEls.menu.classList.contains("is-open");
    if (!isOpen) return;

    const target = e.target instanceof Node ? e.target : null;
    if (!target) return;

    if (context.heroPill?.contains(target)) return;
    if (context.heroPetDockBtn?.contains(target)) return;
    if (chatEls.menuPanel.contains(target)) return;

    setMenuOpen(false);
  };

  // 点击遮罩或页面空白处收起导览菜单（面板内点击不收起）
  document.addEventListener("click", onDocumentClickCapture, { capture: true });

  const onMenuCloseClick = () => setMenuOpen(false);
  chatEls.menuClose?.addEventListener("click", onMenuCloseClick);

  function runGuideMenuAction(action) {
    const smooth = prefersReducedMotion ? "auto" : "smooth";

    if (action === "route") {
      setMenuOpen(false);
      document.getElementById("route-section")?.scrollIntoView({ behavior: smooth, block: "start" });
      return;
    }

    if (action === "timeline") {
      setMenuOpen(false);
      document.getElementById("cm-transition")?.scrollIntoView({ behavior: smooth, block: "start" });
      return;
    }

    if (action === "hero") {
      setMenuOpen(false);
      document.getElementById("hero")?.scrollIntoView({ behavior: smooth, block: "start" });
      return;
    }

    if (action === "pet") {
      setMenuOpen(false);
      document.getElementById("pet-hitzone")?.focus({ preventScroll: false });
      return;
    }

    if (action === "explore") {
      setMenuOpen(false);
      context.heroGoBtn?.click();
      return;
    }

    console.log("[guide-menu]", action);
    setMenuOpen(false);
  }

  const menuItemHandlers = [];
  if (chatEls.menuItems.length > 0) {
    chatEls.menuItems.forEach((btn) => {
      const handler = () => {
        const action = btn.getAttribute("data-action");
        if (!action) return;
        runGuideMenuAction(action);
      };
      menuItemHandlers.push([btn, handler]);
      btn.addEventListener("click", handler);
    });
  }

  // 关闭地图：按钮/点遮罩/ESC
  const onGuideMapCloseClick = () => setGuideMapOpen(false);
  guideMapEls.close?.addEventListener("click", onGuideMapCloseClick);
  const onGuideMapBackdropClick = (e) => {
    if (e.target === guideMapEls.root) setGuideMapOpen(false);
  };
  guideMapEls.root?.addEventListener("click", onGuideMapBackdropClick);

  const onKeydown = (e) => {
    if (e.key !== "Escape") return;
    setGuideMapOpen(false);
    setMenuOpen(false);
  };
  window.addEventListener("keydown", onKeydown);

  // ====== 桌宠漫画对话：复用 /api/chat ======
  let pet = null;
  let comic = null;
  let onDockClick = null;
  let petInitCancelled = false;

  if (petHost && petHitzone) {
    (async () => {
      // #region agent log
      console.log("[dbg ee6ebc] starting createDesktopPet", { hasHost: !!petHost, hasHitzone: !!petHitzone, hasAnchor: !!petAnchorEl, hasTarget: !!petTargetEl });
      fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ee6ebc'},body:JSON.stringify({sessionId:'ee6ebc',runId:'pre-fix',hypothesisId:'H1',location:'js/appmain.js:pet-init',message:'starting createDesktopPet',data:{hasHost:!!petHost,hasHitzone:!!petHitzone,hasAnchor:!!petAnchorEl,hasTarget:!!petTargetEl},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const created = await createDesktopPet({
        host: petHost,
        hitzone: petHitzone,
        anchorEl: petAnchorEl,
        targetEl: petTargetEl,
        heroEl: context.hero,
        ...petConfig,
        prefersReducedMotion,
        scale: 2,
        onHeadClick() {
          // #region agent log
          console.log("[dbg ee6ebc] pet onHeadClick fired", { comicReady: !!comic });
          fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ee6ebc'},body:JSON.stringify({sessionId:'ee6ebc',runId:'pre-fix',hypothesisId:'H2',location:'js/appmain.js:onHeadClick',message:'pet onHeadClick fired',data:{comicReady:!!comic},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          comic?.onHeadClick?.();
        },
      });
      if (petInitCancelled) {
        created?.destroy?.();
        return;
      }
      pet = created;
      // #region agent log
      console.log("[dbg ee6ebc] createDesktopPet resolved", { petNull: pet == null, hasGetAnchors: !!pet?.getAnchors });
      fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ee6ebc'},body:JSON.stringify({sessionId:'ee6ebc',runId:'pre-fix',hypothesisId:'H1',location:'js/appmain.js:pet-created',message:'createDesktopPet resolved',data:{petNull:pet==null,hasGetAnchors:!!pet?.getAnchors},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!pet) return;

      onDockClick = (ev) => {
        ev.preventDefault();
        pet.dockToViewportCorner?.();
      };
      context.heroPetDockBtn?.addEventListener("click", onDockClick);

      comic = createPetComicChat({ pet, sendToAI, prefersReducedMotion });
      // #region agent log
      console.log("[dbg ee6ebc] createPetComicChat returned", { comicNull: comic == null, hasOnHeadClick: !!comic?.onHeadClick });
      fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ee6ebc'},body:JSON.stringify({sessionId:'ee6ebc',runId:'pre-fix',hypothesisId:'H3',location:'js/appmain.js:comic-created',message:'createPetComicChat returned',data:{comicNull:comic==null,hasOnHeadClick:!!comic?.onHeadClick},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    })().catch((err) => {
      console.error("[desktop-pet] 初始化失败", err);
    });
  }

  return {
    destroy() {
      petInitCancelled = true;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onViewportResize);
      window.removeEventListener("keydown", onKeydown);
      document.removeEventListener("click", onDocumentClickCapture, true);
      context.heroPill?.removeEventListener("click", onHeroPillClick);
      chatEls.menuClose?.removeEventListener("click", onMenuCloseClick);
      guideMapEls.close?.removeEventListener("click", onGuideMapCloseClick);
      guideMapEls.root?.removeEventListener("click", onGuideMapBackdropClick);
      menuItemHandlers.forEach(([btn, handler]) => btn.removeEventListener("click", handler));
      revealObserver?.disconnect?.();
      routeSectionObserver?.disconnect?.();
      if (rafId !== null) cancelAnimationFrame(rafId);
      onDockClick && context.heroPetDockBtn?.removeEventListener("click", onDockClick);
      comic?.destroy?.();
      pet?.destroy?.();
      riverScene?.stopAndHide?.();
      window.removeEventListener("scroll", onScrollForRiverPageExit);
    },
  };
}

// 兼容非 React 入口：直接以模块形式引入时自动启动
if (!globalThis.__APPMAIN_NO_AUTOBOOT__) {
  bootstrapAppMain();
}

