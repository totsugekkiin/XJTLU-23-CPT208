const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const clamp01 = (v) => clamp(v, 0, 1);

function getAngleDeg(dx, dy) {
  // 让船“朝向前进方向”，屏幕 y 向下为正，所以 atan2(dy, dx)
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function clampAbs(v, maxAbs) {
  return Math.max(-maxAbs, Math.min(maxAbs, v));
}

function getRiverCenterX({ centerX, y }) {
  // 主轨迹固定：只与 y 有关（不随时间扭动）
  // 增大蜿蜒：更大的振幅 + 更长的波长（主弯道更明显）
  const amp = Math.max(30, window.innerWidth * 0.18);
  const a = Math.sin(y * 0.0038) * amp;
  const b = Math.sin(y * 0.011) * (amp * 0.42);
  return centerX + a + b;
}

export function createRiverScene({
  stageId = "river-stage",
  canvasId = "river-canvas",
  boatContainerId = "boat-container",
  boatId = "boat",
  spacerId = "river-scroll-spacer",
  islandLayerId = "river-island-layer",
  sceneHeight = null,
} = {}) {
  const gsap = typeof window !== "undefined" ? window.gsap : null;
  const stage = document.getElementById(stageId);
  const canvas = document.getElementById(canvasId);
  const boatContainer = document.getElementById(boatContainerId);
  const boatEl = document.getElementById(boatId);
  const spacer = document.getElementById(spacerId);
  const islandLayer = document.getElementById(islandLayerId);
  const islandEls = islandLayer
    ? Array.from(islandLayer.querySelectorAll(".river-island"))
    : [];

  if (!stage || !canvas) {
    console.warn("[riverScene] 缺少 river-stage 或 river-canvas，跳过初始化");
    return null;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.warn("[riverScene] Canvas 2D context 获取失败");
    return null;
  }

  let raf = null;
  let isActive = false;
  let riverAnimState = "idle"; // idle | flowing | done
  let flowTween = null;
  let hasLoggedBlank = false;
  let lastFlowLogAt = 0;

  const flow = {
    riverFlowY: 0,
  };

  const boat = {
    angleDeg: 0,
    revealAlpha: 1,
    enterOffsetPx: 0,
    enterTween: null,
  };

  const track = {
    startX: window.innerWidth / 2,
  };

  const fx = {
    continuousRippleRadius: 0,
    particles: [],
    lastParticleAt: 0,
  };

  const view = {
    w: 0,
    h: 0,
    dpr: 1,
    sceneH: 0,
  };

  const scroll = {
    startY: 0,
  };

  function measure() {
    view.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    view.sceneH = Number.isFinite(sceneHeight) ? sceneHeight : Math.max(view.h * 2.6, view.h + 1800);

    canvas.width = Math.floor(view.w * view.dpr);
    canvas.height = Math.floor(view.h * view.dpr);

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  function getCenterX(worldY) {
    return getRiverCenterX({ centerX: track.startX, y: worldY });
  }

  function getRiverHalfWidth(worldY, t) {
    const base = Math.max(48, view.w * 0.085);
    const breathe = Math.sin(worldY * 0.012 + t * 0.001) * (base * 0.16);
    const pulse = Math.sin(worldY * 0.05 - t * 0.0022) * (base * 0.06);
    return Math.max(34, base + breathe + pulse);
  }

  function drawRiver({ t }) {
    const HEAD_LEN_MAX = 150;
    const SHOULDER_BULGE_RATIO = 0.12;
    const TIP_INNER_RATIO = 0.08;

    const scrollDelta = Math.max(0, window.scrollY - scroll.startY);
    // 关键修正：底部“固定空白”来自把 scrollDelta 从可视长度里扣掉。
    // 设计目标是：视口内永远有河道（沿着 worldY 前进），而不是滚到末端变成 0。
    const grownAhead = flow.riverFlowY - scrollDelta;
    const reachedBottom =
      riverAnimState === "done" || grownAhead >= view.h + HEAD_LEN_MAX;

    const tipY = Math.min(grownAhead, view.h);
    const visibleForBlank = riverAnimState === "done" ? view.h : tipY;
    if (visibleForBlank <= 0.5) {
      if (!hasLoggedBlank && isActive && (riverAnimState === "flowing" || riverAnimState === "done")) {
        hasLoggedBlank = true;
      }
      return;
    }

    const step = 10; // 越小越细腻，越大越省性能
    const left = [];
    const right = [];

    function sampleStripTo(endY) {
      left.length = 0;
      right.length = 0;
      let lastY = -1;
      for (let screenY = 0; screenY <= endY; screenY += step) {
        const worldY = scrollDelta + screenY;
        const cx = getCenterX(worldY);
        const hw = getRiverHalfWidth(worldY, t);

        // 只让边缘扭动：wobble 叠加在左右岸上，中心线不动
        const wobble = Math.sin(worldY * 0.09 + t * 0.003) * 2.0;
        left.push({ x: cx - hw + wobble, y: screenY });
        right.push({ x: cx + hw + wobble, y: screenY });
        lastY = screenY;
      }
      if (endY > 0.01 && lastY < endY - 0.01) {
        const worldY = scrollDelta + endY;
        const cx = getCenterX(worldY);
        const hw = getRiverHalfWidth(worldY, t);
        const wobble = Math.sin(worldY * 0.09 + t * 0.003) * 2.0;
        left.push({ x: cx - hw + wobble, y: endY });
        right.push({ x: cx + hw + wobble, y: endY });
      }
    }

    ctx.save();

    // 水头已触底并被“吸入”完成：平底铺满（视口内不再出现尖头）
    if (reachedBottom) {
      sampleStripTo(view.h);

      ctx.beginPath();
      ctx.moveTo(left[0].x, left[0].y);
      for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
      for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
      ctx.closePath();

      ctx.fillStyle = "rgba(6, 28, 45, 0.92)";
      ctx.fill();

      ctx.globalCompositeOperation = "screen";
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.moveTo(left[0].x, left[0].y);
      for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(right[0].x, right[0].y);
      for (let i = 1; i < right.length; i++) ctx.lineTo(right[i].x, right[i].y);
      ctx.stroke();

      ctx.restore();
      return;
    }

    // 泪滴水头：主体条带 + 底部圆润外扩肩 + 尖点
    const bodyEndY = Math.max(0, grownAhead - HEAD_LEN_MAX);
    const tipLen = tipY - bodyEndY;
    sampleStripTo(bodyEndY);

    const leftBodyX = left[left.length - 1].x;
    const rightBodyX = right[right.length - 1].x;
    const cxTip = getCenterX(scrollDelta + tipY);
    const hwBody = getRiverHalfWidth(scrollDelta + bodyEndY, t);
    const bulge = hwBody * SHOULDER_BULGE_RATIO;
    const innerX = hwBody * TIP_INNER_RATIO;

    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
    ctx.bezierCurveTo(
      leftBodyX - bulge,
      bodyEndY + tipLen * 0.35,
      cxTip - innerX,
      tipY - tipLen * 0.05,
      cxTip,
      tipY
    );
    ctx.bezierCurveTo(
      cxTip + innerX,
      tipY - tipLen * 0.05,
      rightBodyX + bulge,
      bodyEndY + tipLen * 0.35,
      rightBodyX,
      bodyEndY
    );
    for (let i = right.length - 2; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();

    ctx.fillStyle = "rgba(6, 28, 45, 0.92)";
    ctx.fill();

    ctx.globalCompositeOperation = "screen";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
    ctx.bezierCurveTo(
      leftBodyX - bulge,
      bodyEndY + tipLen * 0.35,
      cxTip - innerX,
      tipY - tipLen * 0.05,
      cxTip,
      tipY
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(right[0].x, right[0].y);
    for (let i = 1; i < right.length; i++) ctx.lineTo(right[i].x, right[i].y);
    ctx.bezierCurveTo(
      rightBodyX + bulge,
      bodyEndY + tipLen * 0.35,
      cxTip + innerX,
      tipY - tipLen * 0.05,
      cxTip,
      tipY
    );
    ctx.stroke();

    ctx.restore();
  }

  function spawnParticles(t, rateMultiplier) {
    const now = t;
    const interval = Math.max(18, 85 / Math.max(1, rateMultiplier));
    if (now - fx.lastParticleAt < interval) return;
    fx.lastParticleAt = now;

    const scrollDelta = Math.max(0, window.scrollY - scroll.startY);
    const screenY = Math.random() * Math.min(view.h, Math.max(1, flow.riverFlowY - scrollDelta));
    const worldY = scrollDelta + screenY;
    const x =
      getCenterX(worldY) + (Math.random() - 0.5) * getRiverHalfWidth(worldY, t) * 1.5;
    fx.particles.push({
      x,
      y: screenY,
      r: 0.8 + Math.random() * 1.8,
      a: 0.12 + Math.random() * 0.25,
      vx: (Math.random() - 0.5) * 0.2,
      vy: 0.15 + Math.random() * 0.35,
      life: 1,
    });

    if (fx.particles.length > 260) fx.particles.splice(0, fx.particles.length - 260);
  }

  function updateAndDrawParticles(t, rateMultiplier) {
    spawnParticles(t, rateMultiplier);
    fx.continuousRippleRadius += 0.35 * rateMultiplier;
    const ripple = (Math.sin(t * 0.0025) * 0.5 + 0.5) * 0.6 + 0.2;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const p = fx.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.006 * Math.max(1, rateMultiplier * 0.9);
      const a = Math.max(0, p.a * p.life);
      if (p.life <= 0 || p.y > view.h + 40) {
        fx.particles.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.9 + ripple), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function syncIslands() {
    if (!islandEls.length) return;
    const count = islandEls.length;
    const scrollDelta = Math.max(0, window.scrollY - scroll.startY);

    // 沿场景高度等距分布（两端留白），让岛屿与河流进度对齐
    const spacing = view.sceneH / (count + 1);

    const centerScreenY = view.h * 0.5;
    const activateRadius = view.h * 0.32;
    // 岛屿应始终贴着可视区向上移动，离开视口时隐藏以节省合成
    const offscreenPad = 260;

    for (let i = 0; i < count; i += 1) {
      const el = islandEls[i];
      const worldY = (i + 1) * spacing;
      const screenY = worldY - scrollDelta;

      const inViewport =
        screenY >= -offscreenPad && screenY <= view.h + offscreenPad;
      const riverReady =
        isActive &&
        (riverAnimState === "flowing" || riverAnimState === "done") &&
        flow.riverFlowY >= worldY - view.h * 0.2;

      if (inViewport && riverReady) {
        el.style.transform = `translate3d(0, ${screenY}px, 0)`;
        const cx = getCenterX(worldY);
        const hw = getRiverHalfWidth(worldY, 0);
        el.style.setProperty("--river-cx", `${cx}px`);
        el.style.setProperty("--river-hw", `${hw}px`);
        const edgePad = 12;
        const landLeft = Math.max(0, cx - hw - edgePad);
        const landRight = Math.max(0, view.w - (cx + hw) - edgePad);
        const textOnRight = landRight > landLeft;
        el.classList.toggle("river-island--text-on-right", textOnRight);
        el.classList.toggle("river-island--text-on-left", !textOnRight);
        if (!el.classList.contains("is-visible")) {
          el.classList.add("is-visible");
          // 首次出现：字与图一起淡入（不改变布局，只做透明/微缩放）
          if (gsap) {
            gsap.killTweensOf(el);
            gsap.fromTo(
              el,
              { opacity: 0, scale: 0.985 },
              { opacity: 1, scale: 1, duration: 0.65, ease: "power2.out" }
            );
          }
        }
        const shouldActivate = Math.abs(screenY - centerScreenY) < activateRadius;
        el.classList.toggle("is-active", shouldActivate);
      } else {
        el.style.removeProperty("--river-cx");
        el.style.removeProperty("--river-hw");
        if (el.classList.contains("is-active")) el.classList.remove("is-active");
        if (el.classList.contains("is-visible")) el.classList.remove("is-visible");
      }
    }
  }


  function resetIslands() {
    for (let i = 0; i < islandEls.length; i += 1) {
      const el = islandEls[i];
      el.classList.remove("is-active");
      el.classList.remove("is-visible");
      el.style.opacity = "";
      el.style.transformOrigin = "";
      el.style.removeProperty("--river-cx");
      el.style.removeProperty("--river-hw");
      el.style.transform = "translate3d(-9999px, -9999px, 0)";
    }
  }

  function syncBoat(t) {
    if (!boatContainer || !boatEl) return;

    // 船在水面上跟随：放在“当前水头”稍上方
    const scrollDelta = Math.max(0, window.scrollY - scroll.startY);
    const fadeP = clamp01(((flow.riverFlowY - scrollDelta) - view.h * 0.5) / (view.h * 0.25));
    boatContainer.style.opacity = String(fadeP * (boat.revealAlpha ?? 1));
    if (fadeP <= 0.02) return;

    const visibleEndY = flow.riverFlowY - scrollDelta;
    // 俯视视角：船固定在屏幕上半部，不要沉到屏幕底部
    const preferredY = view.h * 0.42;
    // 但不能超过“水头”太多，否则看起来船漂在未生成的水面上
    const maxY = Math.max(0, visibleEndY - 90);
    const screenY = clamp(Math.min(preferredY, maxY), 0, view.h - 140) + (boat.enterOffsetPx ?? 0);
    const worldY = scrollDelta + screenY;
    const x = getCenterX(worldY);
    // 船头随时指向流动方向：用河道切线方向决定朝向
    const sampleDy = 40;
    const x2 = getCenterX(worldY + sampleDy);
    const BOAT_HEADING_OFFSET_DEG = 90;
    const targetAngle = getAngleDeg(x2 - x, sampleDy) + BOAT_HEADING_OFFSET_DEG;
    // 小平滑，避免高频抖动
    boat.angleDeg += (targetAngle - boat.angleDeg) * 0.18;

    // 让 (x, screenY) 对齐船的“中心点”，不再用左上角贴合
    boatContainer.style.transform = `translate3d(${x}px, ${screenY}px, 0) translate(-50%, -50%) rotate(${boat.angleDeg}deg)`;
  }

  function render(t) {
    ctx.clearRect(0, 0, view.w, view.h);

    // 防止滚动推进速度大于生长速度导致“追不上”的空白：
    // 仅在用户已经滚动（scrollDelta > 0）时启用兜底；幕布刚合上、用户还没滚动时
    // 让 GSAP 把 riverFlowY 从 0 自然涨上来，呈现“水头从上往下流”的视觉。
    if (riverAnimState === "flowing") {
      const scrollDelta = Math.max(0, window.scrollY - scroll.startY);
      if (scrollDelta > 0) {
        const minNeeded = scrollDelta + view.h + 80;
        if (flow.riverFlowY < minNeeded) flow.riverFlowY = minNeeded;
      }
    }

    drawRiver({ t });
    syncBoat(t);
    syncIslands();

    const rate = riverAnimState === "done" ? 2.6 : 1;
    updateAndDrawParticles(t, rate);
  }

  function tick(t) {
    render(t);
    raf = requestAnimationFrame(tick);
  }

  function ensureRaf() {
    if (raf !== null) return;
    raf = requestAnimationFrame(tick);
  }

  function stopRaf() {
    if (raf === null) return;
    cancelAnimationFrame(raf);
    raf = null;
  }

  function setActive(next) {
    isActive = !!next;
    stage.classList.toggle("is-active", isActive);
    stage.setAttribute("aria-hidden", isActive ? "false" : "true");
    if (boatContainer) boatContainer.style.opacity = isActive ? "1" : "0";
  }

  function stopAndHide() {
    if (flowTween) {
      flowTween.kill();
      flowTween = null;
    }
    riverAnimState = "idle";
    flow.riverFlowY = 0;
    fx.continuousRippleRadius = 0;
    fx.particles = [];
    fx.lastParticleAt = 0;
    if (spacer) spacer.style.height = "0px";
    resetIslands();
    if (boat.enterTween) {
      boat.enterTween.kill();
      boat.enterTween = null;
    }
    boat.revealAlpha = 1;
    boat.enterOffsetPx = 0;
    setActive(false);
    stopRaf();
  }

  function startFlow({
    duration = 3.0,
    ease = "power2.inOut",
    boatDelay = 0.25,
    boatEnterDuration = 0.9,
    onReachedBottom,
  } = {}) {
    if (!gsap) {
      console.warn("[riverScene] GSAP 未加载，无法启动 riverFlowY 动画");
      return;
    }
    if (riverAnimState === "flowing") return;

    riverAnimState = "flowing";
    let reachedBottomFired = false;
    track.startX = window.innerWidth / 2;
    flow.riverFlowY = 0;
    scroll.startY = window.scrollY;
    hasLoggedBlank = false;
    fx.continuousRippleRadius = 0;
    fx.particles = [];
    fx.lastParticleAt = 0;
    resetIslands();

    setActive(true);
    ensureRaf();
    if (spacer) spacer.style.height = `${Math.floor(view.sceneH)}px`;

    if (flowTween) flowTween.kill();
    flowTween = gsap.to(flow, {
      riverFlowY: view.sceneH,
      duration,
      ease,
      onUpdate: () => {
        // 当水头触底后就认为“蔓延完成”，可用于解锁滚动
        // 这里复用 drawRiver 里用于 reachedBottom 的阈值（view.h + HEAD_LEN_MAX）
        if (!reachedBottomFired && typeof onReachedBottom === "function") {
          const HEAD_LEN_MAX = 150;
          const scrollDelta = Math.max(0, window.scrollY - scroll.startY);
          const grownAhead = flow.riverFlowY - scrollDelta;
          if (grownAhead >= view.h + HEAD_LEN_MAX) {
            reachedBottomFired = true;
            try {
              onReachedBottom();
            } catch (e) {
              console.error("[riverScene] onReachedBottom failed", e);
            }
          }
        }

        const now = Date.now();
        if (now - lastFlowLogAt > 700) {
          lastFlowLogAt = now;
          const scrollDelta = Math.max(0, window.scrollY - scroll.startY);
        }
      },
      onComplete: () => {
        // 兜底：如果没有触发“触底”阈值，也要确保回调能触发一次
        if (!reachedBottomFired && typeof onReachedBottom === "function") {
          reachedBottomFired = true;
          try {
            onReachedBottom();
          } catch (e) {
            console.error("[riverScene] onReachedBottom failed", e);
          }
        }
        riverAnimState = "done";
        flowTween = null;
      },
    });

    // 船：从上方开出来（配合河流先“渗出”一点点）
    if (boatContainer) {
      if (boat.enterTween) boat.enterTween.kill();
      boat.revealAlpha = 0;
      boat.enterOffsetPx = -160;
      boat.enterTween = gsap.to(boat, {
        revealAlpha: 1,
        enterOffsetPx: 0,
        duration: boatEnterDuration,
        delay: Math.max(0, boatDelay),
        ease: "power2.out",
        onComplete: () => {
          boat.enterTween = null;
        },
      });
    }
  }

  function destroy() {
    stopRaf();
    window.removeEventListener("resize", onResize);
  }

  function onResize() {
    measure();
  }

  measure();
  window.addEventListener("resize", onResize, { passive: true });

  // 初始：不自动进入河流段落（等幕布合上触发）
  setActive(false);
  if (boatContainer) boatContainer.style.opacity = "0";

  return {
    destroy,
    startFlow,
    stopAndHide,
    get state() {
      return { active: isActive, sceneHeight: view.sceneH, riverFlowY: flow.riverFlowY };
    },
  };
}

