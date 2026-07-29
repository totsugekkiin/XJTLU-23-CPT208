import { layoutConfig, cardsConfig, motionConfig, petConfig } from "./appmain/config.js";
import { createDomContext } from "./appmain/dom.js";
import { setupHeroButton } from "./appmain/heroButton.js";
import { createHeroCardStackController } from "./appmain/heroCardStack.js";
import { setupHeroHint } from "./appmain/heroHint.js";
import { setupHeroCardSvgLoop } from "./appmain/heroCardSvgLoop.js";
import { setupHeroTopbar } from "./appmain/heroTopbar.js";
import { applyPerCardCssVariables, applyRootCssVariables } from "./appmain/styleVars.js";
import { createDesktopPet, startPetTexturePreload } from "./appmain/pet/index.js";
import { createPetComicChat } from "./appmain/pet/petComicChat.js";
import { setupScrollMaskZoom } from "./appmain/scrollMaskZoom.js";
import { createCurtainRiverTransition } from "./appmain/curtainRiverTransition.js";
import { createRiverScene } from "./appmain/riverScene.js";

export function bootstrapAppMain() {
  // 屏蔽本地调试上报（127.0.0.1:7502）在生产/未启动服务时刷屏报错
  // 仅拦截 ingest 域名，不影响其它 fetch
  if (typeof window !== "undefined" && typeof window.fetch === "function" && !window.__INGEST_FETCH_PATCHED__) {
    window.__INGEST_FETCH_PATCHED__ = true;
    const _fetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      try {
        const url = typeof input === "string" ? input : input?.url;
        if (typeof url === "string" && url.includes("127.0.0.1:7502/ingest/")) {
          return Promise.resolve(new Response("", { status: 204 }));
        }
      } catch {
        // ignore
      }
      return _fetch(input, init);
    };
  }

  // 防止重复执行；React 18 StrictMode 会卸载再挂载一次，第二次必须直接跳过（不能 throw，否则开发环境主界面脚本报错）
  if (globalThis.__APPMAIN_BOOTSTRAPPED__) {
    return;
  }
  globalThis.__APPMAIN_BOOTSTRAPPED__ = true;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (globalThis.PIXI?.Assets) {
    startPetTexturePreload(globalThis.PIXI);
  }
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
      const y = window.scrollY;
      document.body.classList.toggle("is-scrolled", y > 24);
      cardStackController.updateByScroll();
      // 合并河流页“向上滑退出”逻辑到同一帧，避免再注册一个 scroll 监听器
      handleRiverPageExitScroll(y);
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
    // 当地图段进入视口时，把 fixed 河流层降到地图之下（不消失、不遮挡）
    routeSectionObserver = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        const routeOffsetTop = routeSectionEl.offsetTop;
        const layoutSettled = routeOffsetTop > window.innerHeight;
        const hasReachedRoute = window.scrollY >= Math.max(0, routeOffsetTop - window.innerHeight);
        const shouldSitBehindRoute =
          document.body.classList.contains("is-river-page") &&
          !!e?.isIntersecting &&
          layoutSettled &&
          hasReachedRoute;
        riverStageEl.classList.toggle("river-stage--behind-route", shouldSitBehindRoute);
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
    pendingExitTargetY: null,
  };

  // 河流接管期间统一管理滚动锁和待执行帧，回退时可以完整取消，避免旧任务再次把页面切回河流。
  const riverScrollLock = {
    locked: false,
    y: 0,
  };
  const preventRiverScroll = (e) => e.preventDefault();
  const preventRiverScrollKeys = (e) => {
    const keys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"];
    if (keys.includes(e.key)) e.preventDefault();
  };

  const lockRiverScroll = () => {
    if (riverScrollLock.locked) return;
    riverScrollLock.locked = true;
    riverScrollLock.y = window.scrollY;
    document.body.classList.add("is-scroll-locked");
    document.body.style.position = "fixed";
    document.body.style.top = `-${riverScrollLock.y}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    window.addEventListener("wheel", preventRiverScroll, { passive: false });
    window.addEventListener("touchmove", preventRiverScroll, { passive: false });
    window.addEventListener("keydown", preventRiverScrollKeys, { passive: false });
  };

  const unlockRiverScroll = () => {
    if (!riverScrollLock.locked) return;
    riverScrollLock.locked = false;
    document.body.classList.remove("is-scroll-locked");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.removeEventListener("wheel", preventRiverScroll);
    window.removeEventListener("touchmove", preventRiverScroll);
    window.removeEventListener("keydown", preventRiverScrollKeys);
    window.scrollTo({ top: riverScrollLock.y, behavior: "auto" });
  };

  let riverHandoffGeneration = 0;
  let pendingRiverStartRaf = null;
  let pendingCurtainRevealRaf = null;

  const cancelPendingRiverHandoff = () => {
    riverHandoffGeneration += 1;
    if (pendingRiverStartRaf !== null) {
      cancelAnimationFrame(pendingRiverStartRaf);
      pendingRiverStartRaf = null;
    }
    if (pendingCurtainRevealRaf !== null) {
      cancelAnimationFrame(pendingCurtainRevealRaf);
      pendingCurtainRevealRaf = null;
    }
  };

  const transition = createCurtainRiverTransition({
    onClosed() {
      if (!riverScene) return;
      // 幕布合拢后：幕布本身作为“地面”，河流从幕布上流下（不跳转、不切页面结构）

      const enterRiverPage = () => {
        if (riverPage.exiting) return;
        cancelWelcome({ closeBubble: true });
        // 记录进入河流前“胶片段最底部附近”的 scrollY，退出时回到这里
        const cmSection = document.getElementById("cm-transition");
        const cmWrap = document.getElementById("cm-mask-scroll");
        if (cmSection && cmWrap) {
          const scrollLength = Math.max(1, cmWrap.offsetHeight - window.innerHeight);
          riverPage.cmBottomScrollY = Math.max(0, cmSection.offsetTop + scrollLength - 4);
        } else {
          riverPage.cmBottomScrollY = window.scrollY;
        }

        // 关键：先把 spacer 撑到河流场景高度，再切换 is-river-page 与 scrollIntoView，
        // 避免 spacer 还是 0 高度时 route-after-river 的暗蓝色背景（与河流同色）
        // 紧贴 spacer 顶部露出整屏，造成“河流瞬间已经全部出现”的错觉。
        const spacer = document.getElementById("river-scroll-spacer");
        const sceneH = Number(riverScene?.state?.sceneHeight) || 0;
        if (spacer && sceneH > 0) {
          spacer.style.height = `${Math.floor(sceneH)}px`;
        }

        document.body.classList.add("is-river-page");
        riverPage.active = true;
        riverPage.exitArmed = false;
        riverPage.preScrollY = window.scrollY;
        // 进入河流“页面”后，让滚动叙事从 river-scroll-spacer 开始
        // 注意：这里必须用 auto，避免平滑滚动过程中 scrollMaskZoom 继续驱动幕布回开
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
          onReachedBottom: () => unlockRiverScroll(),
        });

      // 幕布保持完全闭合，跨过 display/layout/scroll 切换；河流至少完成一帧绘制后再淡出幕布。
      cancelPendingRiverHandoff();
      const handoffGeneration = riverHandoffGeneration;
      enterRiverPage();
      pendingRiverStartRaf = requestAnimationFrame(() => {
        pendingRiverStartRaf = null;
        if (handoffGeneration !== riverHandoffGeneration) return;
        lockRiverScroll();
        start();

        const revealCurtain = () => {
          if (handoffGeneration !== riverHandoffGeneration) return;
          pendingCurtainRevealRaf = requestAnimationFrame(() => {
            pendingCurtainRevealRaf = null;
            if (handoffGeneration !== riverHandoffGeneration) return;
            transition.fadeOutAndHide({ duration: prefersReducedMotion ? 0.01 : 0.24 });
          });
        };
        pendingCurtainRevealRaf = requestAnimationFrame(revealCurtain);
      });
    },
    onBeforeOpen() {
      // 回退时：先让幕布后内容消失，再开幕布
      cancelPendingRiverHandoff();
      unlockRiverScroll();
      riverScene?.stopAndHide?.();
      document.body.classList.remove("is-river-page");
      riverStageEl?.classList.remove("river-stage--behind-route");
      riverPage.active = false;
      if (Number.isFinite(riverPage.pendingExitTargetY)) {
        const targetY = riverPage.pendingExitTargetY;
        requestAnimationFrame(() => {
          window.scrollTo({ top: targetY, behavior: "auto" });
        });
      }
    },
    onOpened() {
      riverPage.pendingExitTargetY = null;
      riverPage.exiting = false;
    },
  });

  const exitRiverPage = () => {
    if (!riverPage.active || riverPage.exiting) return;
    riverPage.exiting = true;
    // 退出河流页：先开幕布（内部会 stopAndHide），再恢复滚动到胶片段附近
    try {
      const safeRetreat = Math.max(36, window.innerHeight * 0.08);
      riverPage.pendingExitTargetY = Math.max(
        0,
        (riverPage.cmBottomScrollY || riverPage.preScrollY) - safeRetreat
      );
      transition.reverseOpen();
    } catch (e) {
      console.error("[riverPage] reverseOpen failed", e);
      riverScene?.stopAndHide?.();
      document.body.classList.remove("is-river-page");
      riverPage.active = false;
      riverPage.pendingExitTargetY = null;
      riverPage.exiting = false;
    }
  };

  const handleRiverPageExitScroll = (y) => {
    if (!riverPage.active) return;
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

    if (isJson && payload?.type === "route_plan" && Array.isArray(payload.places) && payload.places.length >= 2) {
      const detail = {
        routeName: typeof payload.routeName === "string" && payload.routeName.trim() ? payload.routeName.trim() : "桌宠推荐路线",
        places: payload.places.map((place) => (typeof place === "string" ? place.trim() : "")).filter(Boolean),
        reply,
      };

      window.dispatchEvent(new CustomEvent("pet-route-plan", { detail }));

      const smooth = prefersReducedMotion ? "auto" : "smooth";
      window.setTimeout(() => {
        document.getElementById("route-section")?.scrollIntoView({ behavior: smooth, block: "start" });
      }, 120);
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
      if (document.body.classList.contains("is-river-page")) {
        document.getElementById("route-section")?.scrollIntoView({ behavior: smooth, block: "start" });
      } else {
        window.location.href = "map.html";
      }
      return;
    }

    if (action === "timeline") {
      setMenuOpen(false);
      document.getElementById("cm-transition")?.scrollIntoView({ behavior: smooth, block: "start" });
      return;
    }

    if (action === "hero") {
      setMenuOpen(false);
      window.location.href = "index.html";
      return;
    }

    if (action === "pet") {
      setMenuOpen(false);
      context.heroPetDockBtn?.click();
      return;
    }

    if (action === "explore") {
      setMenuOpen(false);
      window.location.href = "appMain.html";
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
  let welcomeStartTimer = null;
  let welcomeTimer = null;
  let onWelcomeScroll = null;
  let welcomeActive = false;
  let petInitCancelled = false;
  const welcomeText =
    "欢迎来到阊门探索之旅，我是您的向导林黛玉。在游览过程中，您可以随时点击我进行对话与互动；若我不在当前页面，请点击左上角的圆形按钮，即可随时将我唤回屏幕。";

  /** 进入路线推荐区时，让桌宠出现在屏幕中下偏右并讲解两条路线的区别 */
  const ROUTE_INTRO_TEXT =
    "这里为您准备了两条游览路线：第一条「经典水巷线」从阊门出发，经七里山塘到荣阳楼，主打慢行赏桥巷与游船古韵，更适合白日里悠然踱步；第二条「夜游氛围线」从阊门绕至石路步行街、南浩街，再回到七里山塘夜景，灯火映水巷、市井伴小吃，更适合夜色里寻热闹烟火。";
  const ROUTE_DOCK_POINT = { xPercent: 0.78, yPercent: 0.72 };
  let routeIntroObserver = null;
  let routeIntroActive = false;
  let routeIntroPendingEnter = false;

  function runRouteIntroEnter() {
    if (!pet || !comic) {
      routeIntroPendingEnter = true;
      return;
    }
    routeIntroPendingEnter = false;
    cancelWelcome({ closeBubble: true });
    pet.dockAtPoint?.(ROUTE_DOCK_POINT);
    comic.say?.(ROUTE_INTRO_TEXT);
  }

  function runRouteIntroLeave() {
    routeIntroPendingEnter = false;
    comic?.close?.();
    if (!pet) return;
    if (document.body.classList.contains("is-river-page")) {
      pet.fsm?.setState?.(pet.states?.SCROLL_EXIT);
    } else {
      pet.fsm?.setState?.(pet.states?.IDLE);
    }
  }

  if (routeSectionEl && "IntersectionObserver" in window) {
    /**
     * 触发逻辑：只有当路线段「基本完整滚到视口里」(>=90%) 才让桌宠登场，
     * 避免刚露头就提前触发；离场用较低阈值 (<=45%) 做迟滞，防止边缘抖动反复触发。
     */
    const ROUTE_ENTER_RATIO = 0.9;
    const ROUTE_LEAVE_RATIO = 0.45;
    routeIntroObserver = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        // 河流页进入瞬间，route-after-river 刚从 display:none 切到 block，
        // 布局还没稳定时 IO 会先于 is-scroll-locked 谎报 ratio=1、offsetTop=0。
        // 三重门槛：① 不在锁滚动期；② route 段在文档里真实位置已经稳定（offsetTop > 一屏高，
        // 排除布局未就绪的“假 0”）；③ 用户实际滚动位置已经接近 route 段。
        const isScrollLocked = document.body.classList.contains("is-scroll-locked");
        const routeOffsetTop = routeSectionEl.offsetTop;
        const layoutSettled = routeOffsetTop > window.innerHeight;
        const routeEnterScrollY = Math.max(0, routeOffsetTop - window.innerHeight * 0.25);
        const hasReachedRouteScroll = window.scrollY >= routeEnterScrollY;
        if (isScrollLocked) return;
        if (e.isIntersecting && e.intersectionRatio >= ROUTE_ENTER_RATIO && layoutSettled && hasReachedRouteScroll) {
          if (routeIntroActive) return;
          routeIntroActive = true;
          runRouteIntroEnter();
        } else if (!e.isIntersecting || e.intersectionRatio < ROUTE_LEAVE_RATIO) {
          if (!routeIntroActive) return;
          routeIntroActive = false;
          runRouteIntroLeave();
        }
      },
      { threshold: [0, 0.45, 0.7, 0.9, 1] }
    );
    routeIntroObserver.observe(routeSectionEl);
  }

  function canStartWelcome() {
    return !petInitCancelled && !document.body.classList.contains("is-river-page") && Math.max(0, window.scrollY || 0) <= 8;
  }

  function cancelWelcome({ closeBubble = false } = {}) {
    if (welcomeStartTimer !== null) {
      window.clearTimeout(welcomeStartTimer);
      welcomeStartTimer = null;
    }
    if (welcomeTimer !== null) {
      window.clearTimeout(welcomeTimer);
      welcomeTimer = null;
    }
    if (onWelcomeScroll) {
      window.removeEventListener("scroll", onWelcomeScroll);
      onWelcomeScroll = null;
    }
    pet?.stopWave?.({ returnState: pet?.states?.IDLE });
    if (closeBubble && welcomeActive) comic?.close?.();
    welcomeActive = false;
  }

  if (petHost && petHitzone) {
    (async () => {
      const created = await createDesktopPet({
        host: petHost,
        hitzone: petHitzone,
        anchorEl: petAnchorEl,
        targetEl: petTargetEl,
        heroEl: context.hero,
        ...petConfig,
        prefersReducedMotion,
        onHeadClick() {
          comic?.onHeadClick?.();
        },
      });
      if (petInitCancelled) {
        created?.destroy?.();
        return;
      }
      pet = created;
      if (!pet) return;

      onDockClick = (ev) => {
        ev.preventDefault();
        pet.dockToViewportCorner?.();
      };
      context.heroPetDockBtn?.addEventListener("click", onDockClick);

      comic = createPetComicChat({ pet, sendToAI, prefersReducedMotion });

      // 若桌宠/对话框就绪前用户已经滚到了路线段，则补发一次入场动作
      if (routeIntroActive && routeIntroPendingEnter) {
        runRouteIntroEnter();
      }

      const startWelcome = () => {
        welcomeStartTimer = null;
        if (!canStartWelcome()) return;
        cancelWelcome({ closeBubble: true });
        welcomeActive = true;
        pet?.wave?.({ durationMs: 7000, returnState: pet?.states?.IDLE });
        comic?.say?.(welcomeText);

        onWelcomeScroll = () => {
          cancelWelcome({ closeBubble: true });
        };
        window.addEventListener("scroll", onWelcomeScroll, { passive: true, once: true });

        welcomeTimer = window.setTimeout(() => {
          cancelWelcome({ closeBubble: true });
        }, 7000);
      };

      if (globalThis.__CHANGMEN_PRELOADER_DONE__) {
        welcomeStartTimer = window.setTimeout(startWelcome, 120);
      } else {
        window.addEventListener(
          "changmen-preloader-done",
          () => {
            if (!canStartWelcome()) return;
            welcomeStartTimer = window.setTimeout(startWelcome, 120);
          },
          { once: true }
        );
      }
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
      cancelWelcome({ closeBubble: false });
      chatEls.menuClose?.removeEventListener("click", onMenuCloseClick);
      guideMapEls.close?.removeEventListener("click", onGuideMapCloseClick);
      guideMapEls.root?.removeEventListener("click", onGuideMapBackdropClick);
      menuItemHandlers.forEach(([btn, handler]) => btn.removeEventListener("click", handler));
      revealObserver?.disconnect?.();
      routeSectionObserver?.disconnect?.();
      routeIntroObserver?.disconnect?.();
      if (rafId !== null) cancelAnimationFrame(rafId);
      cancelPendingRiverHandoff();
      unlockRiverScroll();
      transition.destroy?.();
      onDockClick && context.heroPetDockBtn?.removeEventListener("click", onDockClick);
      comic?.destroy?.();
      pet?.destroy?.();
      riverScene?.stopAndHide?.();
    },
  };
}

// 兼容非 React 入口：直接以模块形式引入时自动启动
if (!globalThis.__APPMAIN_NO_AUTOBOOT__) {
  bootstrapAppMain();
}
