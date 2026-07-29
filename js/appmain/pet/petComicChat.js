const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("is-hidden", hidden);
  el.setAttribute("aria-hidden", hidden ? "true" : "false");
}

function setText(el, text) {
  if (!el) return;
  el.textContent = text ?? "";
}

function applyPop(el) {
  if (!el) return;
  el.classList.remove("is-pop");
  // 强制 reflow 触发动画重播
  // eslint-disable-next-line no-unused-expressions
  el.offsetWidth;
  el.classList.add("is-pop");
}

export function createPetComicChat({
  pet,
  sendToAI,
  prefersReducedMotion = false,
  root = document,
  // 头顶大气泡与头部锚点的额外间隙（px）
  agentBubbleGapPx = 86,
} = {}) {
  const els = {
    ui: root.getElementById("pet-comic-ui"),
    agentBubble: root.getElementById("pet-bubble-agent"),
    agentText: root.getElementById("pet-bubble-agent-text"),
    userBubble: root.getElementById("pet-bubble-user"),
    userText: root.getElementById("pet-bubble-user-text"),
    bar: root.getElementById("pet-inputbar"),
    input: root.getElementById("pet-inputbar-input"),
    send: root.getElementById("pet-inputbar-send"),
    enter: root.getElementById("pet-inputbar-enter"),
    close: root.getElementById("pet-inputbar-close"),
  };


  if (!pet || typeof sendToAI !== "function") {
    console.warn("[pet-comic-chat] missing pet or sendToAI");
    return { destroy() {} };
  }
  if (!els.ui || !els.bar || !els.input || !els.send || !els.agentBubble || !els.userBubble) {
    console.warn("[pet-comic-chat] missing DOM nodes");
    return { destroy() {} };
  }

  let isActive = false;
  let raf = null;
  let keyboardOffsetPx = 0;
  const activationPrompt = "想了解阊门的什么？";
  let dbgSyncN = 0;

  const syncPositions = () => {
    const a = pet.getAnchors?.();
    if (!a) return;

    const headX = a.head?.x ?? 0;
    const headY = a.head?.y ?? 0;
    const userX = a.user?.x ?? 0;
    const userY = a.user?.y ?? 0;

    // 头顶大气泡：让“尾巴尖角”的顶点对准头顶锚点
    els.agentBubble.style.left = `${Math.round(headX)}px`;
    els.agentBubble.style.top = `${Math.round(headY)}px`;
    // 把气泡整体抬到“头的正上方”，并让尖角仍指向锚点
    // 12px 尾巴 + 约 24px 间隙（避免压到头部/发饰），整体更像截图里的悬浮效果
    els.agentBubble.style.transform = `translate(-50%, calc(-100% - ${Math.round(agentBubbleGapPx)}px))`;

    // 身侧小气泡：从桌宠侧边“水平弹出”（更像侧边云朵气泡）
    const side = headX < window.innerWidth * 0.5 ? 1 : -1; // 左半屏 -> 右侧弹出；右半屏 -> 左侧弹出
    const dx = 64 * side; // 约等于 w-32 + 间距（不依赖具体宽度）
    const dy = -12;
    els.userBubble.style.left = `${Math.round(userX + dx)}px`;
    els.userBubble.style.top = `${Math.round(userY + dy)}px`;
    els.userBubble.style.transform = `translate(-50%, -50%)`;

    if (dbgSyncN < 5) {
      dbgSyncN += 1;
      const agentCs = els.agentBubble ? getComputedStyle(els.agentBubble) : null;
      const userCs = els.userBubble ? getComputedStyle(els.userBubble) : null;
    }
  };

  const tick = () => {
    if (!isActive) return;
    syncPositions();
    raf = requestAnimationFrame(tick);
  };

  const setKeyboardOffset = (px) => {
    keyboardOffsetPx = clamp(px || 0, 0, Math.max(0, window.innerHeight));
    els.ui.style.setProperty("--pet-kb-offset", `${Math.round(keyboardOffsetPx)}px`);
  };

  const syncKeyboard = () => {
    const vv = window.visualViewport;
    if (!vv) {
      setKeyboardOffset(0);
      return;
    }
    const offset = window.innerHeight - vv.height - vv.offsetTop;
    setKeyboardOffset(offset);
  };

  const open = () => {
    isActive = true;
    els.ui.classList.remove("is-hidden");
    els.ui.setAttribute("aria-hidden", "false");

    // 激活态：先弹出一个“对话框”作为入口提示（符合“点击头部 Pop-up 对话框”）
    setText(els.agentText, activationPrompt);
    setHidden(els.agentBubble, false);
    if (!prefersReducedMotion) applyPop(els.agentBubble);

    setHidden(els.bar, false);
    els.bar.classList.add("is-open");

    syncPositions();
    if (raf === null) raf = requestAnimationFrame(tick);

    // 让输入条动画后再 focus，避免某些手机上滚动跳动
    window.setTimeout(() => {
      els.input.focus({ preventScroll: true });
    }, 120);
  };

  const close = () => {
    isActive = false;
    els.bar.classList.remove("is-open");
    // 关闭时只收起输入条；气泡保留最后一次内容（更像“对话记录”挂在头顶/身侧）
    setHidden(els.bar, true);
    els.ui.classList.add("is-hidden");
    els.ui.setAttribute("aria-hidden", "true");

    if (raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
    setKeyboardOffset(0);
  };

  const showUser = (text) => {
    setText(els.userText, text);
    setHidden(els.userBubble, false);
    if (!prefersReducedMotion) applyPop(els.userBubble);
  };

  const showAgent = (text) => {
    setText(els.agentText, text);
    setHidden(els.agentBubble, false);
    if (!prefersReducedMotion) applyPop(els.agentBubble);
  };

  const say = (text) => {
    isActive = true;
    els.ui.classList.remove("is-hidden");
    els.ui.setAttribute("aria-hidden", "false");
    els.bar.classList.remove("is-open");
    setHidden(els.bar, true);
    showAgent(text);
    syncPositions();
    if (raf === null) raf = requestAnimationFrame(tick);
  };

  const onBackgroundPointerDownCapture = (e) => {
    if (!isActive) return;
    const target = e.target instanceof Node ? e.target : null;
    if (!target) return;

    // 点在输入条或气泡里不关闭
    if (els.bar.contains(target)) return;
    if (els.agentBubble.contains(target)) return;
    if (els.userBubble.contains(target)) return;

    // 点在桌宠命中区不关闭（用于再次点击头部触发等）
    const hitzone = document.getElementById("pet-hitzone");
    if (hitzone && hitzone.contains(target)) return;

    close();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const text = els.input.value.trim();
    if (!text) return;

    showUser(text);
    els.input.value = "";

    if (els.send) els.send.disabled = true;
    if (els.enter) els.enter.disabled = true;
    els.input.disabled = true;
    try {
      const reply = await sendToAI(text);
      showAgent(reply);
    } catch (err) {
      console.error("[pet-comic-chat] request failed", err);
      showAgent("暂时无法回复，请稍后再试。");
    } finally {
      if (els.send) els.send.disabled = false;
      if (els.enter) els.enter.disabled = false;
      els.input.disabled = false;
      // 不在此处 close：close() 会给整层 #pet-comic-ui 加 display:none，回复刚写入时气泡弹出动画会被立刻裁掉，用户看不到「再次弹出」
      window.setTimeout(() => {
        els.input.focus({ preventScroll: true });
      }, 0);
    }
  };

  const onCloseClick = () => {
    els.input.value = "";
    close();
  };

  const handleHeadClick = () => {
    if (isActive) return;
    open();
  };

  // 把 head click 接到 pet：createDesktopPet 通过参数暴露
  // 这里采用事件回调注入：在外层创建 pet 时传入 onHeadClick -> 调用本方法
  const api = {
    open,
    close,
    say,
    toggle() {
      if (isActive) close();
      else open();
    },
    onHeadClick: handleHeadClick,
    destroy() {
      close();
      document.removeEventListener("pointerdown", onBackgroundPointerDownCapture, true);
      els.bar.removeEventListener("submit", onSubmit);
      els.close?.removeEventListener("click", onCloseClick);
      const vv = window.visualViewport;
      vv?.removeEventListener("resize", syncKeyboard);
      vv?.removeEventListener("scroll", syncKeyboard);
      window.removeEventListener("resize", syncKeyboard);
    },
  };

  // event wires
  els.bar.addEventListener("submit", onSubmit);
  els.close?.addEventListener("click", onCloseClick);
  document.addEventListener("pointerdown", onBackgroundPointerDownCapture, true);
  window.addEventListener("resize", syncKeyboard, { passive: true });
  window.visualViewport?.addEventListener("resize", syncKeyboard, { passive: true });
  window.visualViewport?.addEventListener("scroll", syncKeyboard, { passive: true });

  // 初始静默
  close();

  return api;
}

