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

  // #region agent log
  fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9fbb39'},body:JSON.stringify({sessionId:'9fbb39',runId:'pre-fix',hypothesisId:'H0',location:'js/appmain/pet/petComicChat.js:init',message:'init DOM refs',data:{href:globalThis.location?.href??null,prefersReducedMotion,agentBubbleCount:root.querySelectorAll?.('#pet-bubble-agent')?.length??null,userBubbleCount:root.querySelectorAll?.('#pet-bubble-user')?.length??null,hasAgentBubble:!!els.agentBubble,hasAgentText:!!els.agentText,hasUserBubble:!!els.userBubble,hasUserText:!!els.userText},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (!pet || typeof sendToAI !== "function") {
    console.warn("[pet-comic-chat] missing pet or sendToAI");
    return { destroy() {} };
  }
  if (!els.ui || !els.bar || !els.input || !els.send || !els.agentBubble || !els.userBubble) {
    console.warn("[pet-comic-chat] missing DOM nodes");
    // #region agent log
    fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ee6ebc'},body:JSON.stringify({sessionId:'ee6ebc',runId:'pre-fix',hypothesisId:'H3',location:'js/appmain/pet/petComicChat.js:missing-dom',message:'missing DOM nodes for pet comic chat',data:{hasUi:!!els.ui,hasBar:!!els.bar,hasInput:!!els.input,hasSend:!!els.send,hasAgentBubble:!!els.agentBubble,hasUserBubble:!!els.userBubble},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return { destroy() {} };
  }

  let isActive = false;
  let raf = null;
  let keyboardOffsetPx = 0;
  const activationPrompt = "……说吧。";
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
      // #region agent log
      fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9fbb39'},body:JSON.stringify({sessionId:'9fbb39',runId:'pre-fix',hypothesisId:'H1',location:'js/appmain/pet/petComicChat.js:syncPositions',message:'anchor+transform snapshot',data:{n:dbgSyncN,head:{x:Math.round(headX),y:Math.round(headY)},user:{x:Math.round(userX),y:Math.round(userY)},agentInline:{left:els.agentBubble?.style?.left??null,top:els.agentBubble?.style?.top??null,transform:els.agentBubble?.style?.transform??null,classIsPop:els.agentBubble?.classList?.contains('is-pop')??null},agentComputed:{transform:agentCs?.transform??null,animationName:agentCs?.animationName??null,animationDuration:agentCs?.animationDuration??null},userInline:{left:els.userBubble?.style?.left??null,top:els.userBubble?.style?.top??null,transform:els.userBubble?.style?.transform??null,classIsPop:els.userBubble?.classList?.contains('is-pop')??null},userComputed:{transform:userCs?.transform??null,animationName:userCs?.animationName??null,animationDuration:userCs?.animationDuration??null}},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
    // #region agent log
    console.log("[dbg ee6ebc] comic chat opened");
    fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ee6ebc'},body:JSON.stringify({sessionId:'ee6ebc',runId:'pre-fix',hypothesisId:'H4',location:'js/appmain/pet/petComicChat.js:open',message:'comic chat opened',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    console.log("[dbg ee6ebc] comic chat closed");
    fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ee6ebc'},body:JSON.stringify({sessionId:'ee6ebc',runId:'pre-fix',hypothesisId:'H4',location:'js/appmain/pet/petComicChat.js:close',message:'comic chat closed',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
      const msg =
        (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message.trim() ? err.message.trim() : null) ??
        "发送失败，请稍后再试。";
      showAgent(`（系统）${msg}`);
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

