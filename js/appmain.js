import { layoutConfig, cardsConfig, motionConfig } from "./appmain/config.js";
import { createDomContext } from "./appmain/dom.js";
import { setupHeroButton } from "./appmain/heroButton.js";
import { createHeroCardStackController } from "./appmain/heroCardStack.js";
import { setupHeroHint } from "./appmain/heroHint.js";
import { setupHeroCardSvgLoop } from "./appmain/heroCardSvgLoop.js";
import { setupHeroTopbar } from "./appmain/heroTopbar.js";
import { applyPerCardCssVariables, applyRootCssVariables } from "./appmain/styleVars.js";
import { createDesktopPet } from "./appmain/pet/index.js";
import { setupScrollMaskZoom } from "./appmain/scrollMaskZoom.js";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const context = createDomContext();

applyRootCssVariables(context.hero, layoutConfig);

const topbarController = setupHeroTopbar(context);
const hintController = setupHeroHint(context);

const cardStackController = createHeroCardStackController({
  context: {
    ...context,
    heroTopbarSync: () => topbarController?.sync(),
    heroHintSync: (progress) => hintController?.setByDockProgress(progress),
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

const observeSections = () => {
  if (revealSections.length === 0) return;
  if (!("IntersectionObserver" in window)) {
    revealSections.forEach((section) => section.classList.add("is-inview"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-inview");
        observer.unobserve(entry.target);
      });
    },
    { root: null, rootMargin: "0px 0px -12% 0px", threshold: 0.15 }
  );

  revealSections.forEach((section) => observer.observe(section));
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

setupScrollMaskZoom({ prefersReducedMotion });

const petHost = document.getElementById("pet-layer");
const petHitzone = document.getElementById("pet-hitzone");
const petAnchorEl = document.querySelector(".stack-card--primary");
const petTargetEl = document.getElementById("target-zone");

if (petHost && petHitzone) {
  createDesktopPet({
    host: petHost,
    hitzone: petHitzone,
    anchorEl: petAnchorEl,
    targetEl: petTargetEl,
    prefersReducedMotion,
    scale: 2,
  }).catch((err) => {
    console.error("[desktop-pet] 初始化失败", err);
  });
}

// ====== AI 聊天测试：/api/chat ======
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
  menuItems: Array.from(document.querySelectorAll("#guide-menu [data-action]")),
  root: document.getElementById("ai-chat"),
  messages: document.getElementById("ai-chat-messages"),
  form: document.getElementById("ai-chat-form"),
  input: document.getElementById("ai-chat-input"),
  send: document.getElementById("ai-chat-send"),
  close: document.getElementById("ai-chat-close"),
};

function appendChatMessage(role, text) {
  if (!chatEls.messages) return;
  const div = document.createElement("div");
  div.className =
    role === "user"
      ? "ai-chat__msg ai-chat__msg--user"
      : role === "ai"
        ? "ai-chat__msg ai-chat__msg--ai"
        : "ai-chat__msg ai-chat__msg--sys";
  div.textContent = text;
  chatEls.messages.appendChild(div);
  chatEls.messages.scrollTop = chatEls.messages.scrollHeight;
}

function setMenuOpen(nextOpen) {
  if (!chatEls.menu || !chatEls.menuPanel) return;
  chatEls.menu.classList.toggle("is-open", nextOpen);
  chatEls.menuPanel.setAttribute("aria-hidden", nextOpen ? "false" : "true");
}

function setChatOpen(nextOpen) {
  if (!chatEls.root) return;
  chatEls.root.classList.toggle("is-hidden", !nextOpen);
  chatEls.root.setAttribute("aria-hidden", nextOpen ? "false" : "true");
  if (nextOpen) {
    chatEls.input?.focus();
  }
}

// 点击“GO”后，下拉显示导览选项栏
context.heroGoBtn?.addEventListener("click", () => {
  setMenuOpen(!(chatEls.menu?.classList.contains("is-open") ?? false));
});

// 菜单项点击
if (chatEls.menuItems.length > 0) {
  chatEls.menuItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      if (action === "ai") {
        setChatOpen(true);
        return;
      }
      if (action === "route") {
        window.location.href = "map.html";
        return;
      }
      console.log("[guide-menu]", action);
    });
  });
}

// 关闭聊天
chatEls.close?.addEventListener("click", () => setChatOpen(false));
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setChatOpen(false);
});

if (chatEls.root && chatEls.form && chatEls.input && chatEls.send && chatEls.messages) {
  appendChatMessage("sys", "提示：在导览菜单点“AI 对话”，然后输入内容发送。");

  chatEls.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = chatEls.input.value.trim();
    if (!userText) return;

    appendChatMessage("user", userText);
    chatEls.input.value = "";

    chatEls.send.disabled = true;
    chatEls.input.disabled = true;
    try {
      const reply = await sendToAI(userText);
      appendChatMessage("ai", reply);
    } catch (err) {
      console.error("发送失败:", err);
      const msg =
        (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message.trim() ? err.message.trim() : null) ??
        "发送失败：请检查控制台或后端 /api/chat 是否可用。";
      appendChatMessage("sys", `发送失败：${msg}`);
    } finally {
      chatEls.send.disabled = false;
      chatEls.input.disabled = false;
      chatEls.input.focus();
    }
  });
}

