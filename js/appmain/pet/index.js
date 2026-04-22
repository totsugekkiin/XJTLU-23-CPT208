import { createPetApp } from "./petApp.js";
import { createPetRig } from "./petRig.js";
import { getRigBounds, RIG_METRICS } from "./petGraphics.js";
import { createSpring, createVelocitySampler } from "./petMotion.js";
import { createPetDragInteraction } from "./petInteraction.js";
import { createPetStateMachine, PET_STATES } from "./petStateMachine.js";
import { observeTargetZone } from "./targetObserver.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

async function tryReplacePartWithSprite({
  PIXI,
  container,
  oldGraphics,
  url,
  pivot,
  desiredWidth,
  scaleMul = 1,
  zIndex = undefined,
}) {
  if (!url) return { ok: false, reason: "no-url" };
  if (!container) return { ok: false, reason: "no-container" };

  try {
    const texture = PIXI.Assets ? await PIXI.Assets.load(url) : null;
    if (!texture) return { ok: false, reason: "no-assets-api" };

    const sprite = new PIXI.Sprite(texture);
    sprite.pivot.set(pivot.x, pivot.y);
    sprite.position.set(0, 0);

    const texW = texture.width || sprite.width || 1;
    const s = (desiredWidth / texW) * scaleMul;
    sprite.scale.set(s);

    // 关键：替换成 Sprite 后继承/指定层级，避免“裙摆盖不住腿”等遮挡问题。
    if (zIndex !== undefined) {
      sprite.zIndex = zIndex;
    } else if (oldGraphics && typeof oldGraphics.zIndex === "number") {
      sprite.zIndex = oldGraphics.zIndex;
    }

    if (oldGraphics) oldGraphics.visible = false;
    container.addChild(sprite);
    return { ok: true, sprite };
  } catch (err) {
    console.warn("[desktop-pet] 部位贴图加载失败，将回退占位绘制。", err);
    return { ok: false, reason: "load-failed", error: err };
  }
}

async function tryReplaceHeadWithSprite({
  PIXI,
  rig,
  url,
  neckPivot,
  desiredHeadWidth,
}) {
  if (!url) return { ok: false, reason: "no-url" };
  if (!rig?.head) return { ok: false, reason: "no-head-node" };

  try {
    const texture = PIXI.Assets ? await PIXI.Assets.load(url) : null;
    if (!texture) return { ok: false, reason: "no-assets-api" };

    const sprite = new PIXI.Sprite(texture);
    sprite.pivot.set(neckPivot.x, neckPivot.y);
    sprite.position.set(0, 0);

    const texW = texture.width || sprite.width || 1;
    const s = desiredHeadWidth / texW;
    sprite.scale.set(s);

    if (rig.graphics?.head) rig.graphics.head.visible = false;
    rig.head.addChild(sprite);
    return { ok: true, sprite };
  } catch (err) {
    console.warn("[desktop-pet] 头部贴图加载失败，将回退占位头。", err);
    return { ok: false, reason: "load-failed", error: err };
  }
}

/**
 * 在指定 host 内启动桌面宠物。
 *
 * @param {Object}       params
 * @param {HTMLElement}  params.host           Pixi Canvas 宿主（position: fixed 的覆盖层）。
 * @param {HTMLElement}  params.hitzone        DOM 拾取区，随宠物包围盒同步尺寸。
 * @param {HTMLElement=} params.anchorEl       宠物 idle 状态下的站立参考（主橙卡）。
 * @param {HTMLElement=} params.targetEl       IntersectionObserver 监听的目标区。
 * @param {boolean}      params.prefersReducedMotion
 * @param {number=}      params.scale          占位符整体缩放，默认 2。
 * @param {string=}      params.headTextureUrl 头部 PNG 路径，默认 images/pet/head.png
 * @param {{x:number,y:number}=} params.headNeckPivot 头 PNG 内的脖子关节点像素坐标
 * @param {number=}      params.headScaleMul   头贴图额外倍率（适配整画布导出空白），默认 3.2
 * @param {number=}      params.torsoScaleMul  躯干贴图额外倍率（只影响躯干），默认 3.2
 * @param {string=}      params.torsoTextureUrl 躯干 PNG 路径，默认 images/pet/torso.png
 * @param {{x:number,y:number}=} params.torsoHipPivot 躯干 PNG 内的胯部中心像素坐标
 * @param {string=}      params.leftArmTextureUrl  左臂 PNG 路径，默认 images/pet/arm_left.png
 * @param {string=}      params.rightArmTextureUrl 右臂 PNG 路径，默认 images/pet/arm_right.png
 * @param {string=}      params.leftLegTextureUrl  左腿 PNG 路径，默认 images/pet/leg_left.png
 * @param {string=}      params.rightLegTextureUrl 右腿 PNG 路径，默认 images/pet/leg_right.png
 * @param {{x:number,y:number}=} params.leftShoulderPivot  左臂 PNG 内的肩关节像素坐标
 * @param {{x:number,y:number}=} params.rightShoulderPivot 右臂 PNG 内的肩关节像素坐标
 * @param {{x:number,y:number}=} params.leftHipPivot   左腿 PNG 内的胯关节像素坐标
 * @param {{x:number,y:number}=} params.rightHipPivot  右腿 PNG 内的胯关节像素坐标
 * @param {number=}      params.limbScaleMul   四肢贴图额外倍率，默认 3.2
 */
export async function createDesktopPet({
  host,
  hitzone,
  anchorEl = null,
  targetEl = null,
  prefersReducedMotion = false,
  scale = 2,
  onHeadClick = null,
  headTextureUrl = "images/pet/head.png",
  headNeckPivot = { x: 578, y: 553 },
  headScaleMul = 4.6,
  torsoScaleMul =9,
  torsoTextureUrl = "images/pet/torso.png",
  torsoHipPivot = { x: (561 + 622) / 2, y: 728 },
  leftArmTextureUrl = "images/pet/arm_left.png",
  rightArmTextureUrl = "images/pet/arm_right.png",
  leftLegTextureUrl = "images/pet/leg_left.png",
  rightLegTextureUrl = "images/pet/leg_right.png",
  leftShoulderPivot = { x: 560, y: 607 },
  rightShoulderPivot = { x: 537, y: 607 },
  leftHipPivot = { x: 561, y: 728 },
  rightHipPivot = { x: 622, y: 728 },
  limbScaleMul = 3.2,
} = {}) {
  const PIXI = globalThis.PIXI;
  if (!PIXI) {
    console.warn("[desktop-pet] PixiJS 未加载，桌宠未初始化。");
    return null;
  }
  if (!host || !hitzone) {
    console.warn("[desktop-pet] 缺少 host 或 hitzone 节点。");
    return null;
  }
  // #region agent log
  console.log("[dbg ee6ebc] createDesktopPet entry", { hasPixi: !!PIXI, hasHost: !!host, hasHitzone: !!hitzone, scale, prefersReducedMotion, hasOnHeadClick: typeof onHeadClick === "function" });
  fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ee6ebc'},body:JSON.stringify({sessionId:'ee6ebc',runId:'pre-fix',hypothesisId:'H1',location:'js/appmain/pet/index.js:entry',message:'createDesktopPet entry',data:{hasPixi:!!PIXI,hasHost:!!host,hasHitzone:!!hitzone,scale,prefersReducedMotion,hasOnHeadClick:typeof onHeadClick==='function'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const app = await createPetApp(PIXI, host);
  const rig = createPetRig(PIXI);
  rig.root.scale.set(scale);
  app.stage.addChild(rig.root);

  // 贴图替换：如果对应 PNG 存在，就替换占位 Graphics；否则保持默认绘制。
  // desiredWidth 使用 rig 本地坐标系下的尺寸（不包含 rig.root 的 scale）。
  await tryReplacePartWithSprite({
    PIXI,
    container: rig.torso,
    oldGraphics: rig.graphics?.torso,
    url: torsoTextureUrl,
    pivot: torsoHipPivot,
    desiredWidth: RIG_METRICS.torsoWidth,
    scaleMul: torsoScaleMul,
    zIndex: 2,
  });
  await tryReplacePartWithSprite({
    PIXI,
    container: rig.leftArm,
    oldGraphics: rig.graphics?.leftArm,
    url: leftArmTextureUrl,
    pivot: leftShoulderPivot,
    desiredWidth: RIG_METRICS.armWidth,
    scaleMul: limbScaleMul,
    zIndex: 3,
  });
  await tryReplacePartWithSprite({
    PIXI,
    container: rig.rightArm,
    oldGraphics: rig.graphics?.rightArm,
    url: rightArmTextureUrl,
    pivot: rightShoulderPivot,
    desiredWidth: RIG_METRICS.armWidth,
    scaleMul: limbScaleMul,
    zIndex: 3,
  });
  await tryReplacePartWithSprite({
    PIXI,
    container: rig.leftLeg,
    oldGraphics: rig.graphics?.leftLeg,
    url: leftLegTextureUrl,
    pivot: leftHipPivot,
    desiredWidth: RIG_METRICS.legWidth,
    scaleMul: limbScaleMul,
    zIndex: 1,
  });
  await tryReplacePartWithSprite({
    PIXI,
    container: rig.rightLeg,
    oldGraphics: rig.graphics?.rightLeg,
    url: rightLegTextureUrl,
    pivot: rightHipPivot,
    desiredWidth: RIG_METRICS.legWidth,
    scaleMul: limbScaleMul,
    zIndex: 1,
  });
  await tryReplacePartWithSprite({
    PIXI,
    container: rig.head,
    oldGraphics: rig.graphics?.head,
    url: headTextureUrl,
    pivot: headNeckPivot,
    desiredWidth: RIG_METRICS.headRadius * 2,
    scaleMul: headScaleMul,
    zIndex: 4,
  });

  rig.torso.eventMode = "dynamic";
  rig.torso.cursor = "grab";

  const fsm = createPetStateMachine(PET_STATES.IDLE);

  const pos = { x: window.innerWidth / 2, y: window.innerHeight * 0.55 };
  const desired = { x: pos.x, y: pos.y };
  const lastPos = { x: pos.x, y: pos.y };
  const worldVel = { x: 0, y: 0 };

  const springs = {
    leftArm: createSpring({ stiffness: 0.16, damping: 0.78 }),
    rightArm: createSpring({ stiffness: 0.16, damping: 0.78 }),
    leftLeg: createSpring({ stiffness: 0.12, damping: 0.84 }),
    rightLeg: createSpring({ stiffness: 0.12, damping: 0.84 }),
    head: createSpring({ stiffness: 0.22, damping: 0.72 }),
    torso: createSpring({ stiffness: 0.18, damping: 0.74 }),
  };

  const velocitySampler = createVelocitySampler(120);

  const bounds = getRigBounds();

  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let targetVisible = false;

  const anchors = {
    head: { x: pos.x, y: pos.y },
    user: { x: pos.x, y: pos.y },
    hitzone: { left: 0, top: 0, width: 0, height: 0 },
  };

  const getAnchorPoint = () => {
    if (!anchorEl) {
      return { x: window.innerWidth / 2, y: window.innerHeight * 0.7 };
    }
    const rect = anchorEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return { x: window.innerWidth / 2, y: window.innerHeight * 0.7 };
    }
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + 2,
    };
  };

  const getTargetPoint = () => {
    if (!targetEl) return getAnchorPoint();
    const rect = targetEl.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    };
  };

  const updateHitzone = () => {
    const w = bounds.width * scale + 24;
    const h = bounds.height * scale + 18;
    hitzone.style.width = `${w}px`;
    hitzone.style.height = `${h}px`;
    const left = Math.round(pos.x - w / 2);
    const top = Math.round(pos.y + bounds.top * scale - 8);
    hitzone.style.left = `${left}px`;
    hitzone.style.top = `${top}px`;

    anchors.hitzone.left = left;
    anchors.hitzone.top = top;
    anchors.hitzone.width = w;
    anchors.hitzone.height = h;

    // 头顶锚点：取头部中心略上方；用户气泡锚点：身体侧边偏上
    const headCenterY = pos.y + (-RIG_METRICS.legLength - RIG_METRICS.torsoHeight - RIG_METRICS.headRadius) * scale;
    anchors.head.x = pos.x;
    anchors.head.y = headCenterY - RIG_METRICS.headRadius * 0.9 * scale;
    anchors.user.x = pos.x + (bounds.halfWidth * scale + 18) * (pos.x < window.innerWidth * 0.5 ? 1 : -1);
    anchors.user.y = pos.y + (-RIG_METRICS.legLength - RIG_METRICS.torsoHeight * 0.2) * scale;
  };

  const interaction = createPetDragInteraction({
    hitzone,
    onDragStart({ x, y }) {
      dragOffsetX = pos.x - x;
      dragOffsetY = pos.y - y;
      velocitySampler.clear();
      velocitySampler.push(x, y);
      fsm.setState(PET_STATES.DRAGGING);
    },
    onDrag({ x, y }) {
      desired.x = x + dragOffsetX;
      desired.y = y + dragOffsetY;
      velocitySampler.push(x, y);
    },
    onDragEnd() {
      velocitySampler.clear();
      if (targetVisible) {
        fsm.setState(PET_STATES.HOMING);
      } else {
        fsm.setState(PET_STATES.IDLE);
      }
    },
  });

  // ====== 头部单击：在不影响拖拽的前提下做 click 判定 ======
  let downAt = 0;
  let downX = 0;
  let downY = 0;
  let downPointerId = null;

  const isPointInHead = (x, y) => {
    // 以屏幕坐标粗略估算头部区域（足够用于点击触发）
    const headR = RIG_METRICS.headRadius * scale * 1.25;
    const hx = anchors.head.x;
    const hy = anchors.head.y + headR * 0.4;
    const dx = x - hx;
    const dy = y - hy;
    return dx * dx + dy * dy <= headR * headR;
  };

  const handleClickDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    downAt = performance.now();
    downX = e.clientX;
    downY = e.clientY;
    downPointerId = e.pointerId ?? null;
    // #region agent log
    console.log("[dbg ee6ebc] hitzone pointerdown", { x: e.clientX, y: e.clientY, pointerId: e.pointerId });
    fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ee6ebc'},body:JSON.stringify({sessionId:'ee6ebc',runId:'pre-fix',hypothesisId:'H2',location:'js/appmain/pet/index.js:pointerdown',message:'hitzone pointerdown',data:{x:e.clientX,y:e.clientY,pointerId:e.pointerId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  };

  const handleClickUp = (e) => {
    if (downAt === 0) return;
    if (downPointerId !== null && e.pointerId !== downPointerId) return;
    const dt = performance.now() - downAt;
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    downAt = 0;
    downPointerId = null;
    if (dt > 260) return;
    if (dx * dx + dy * dy > 64) return; // 8px
    if (interaction?.isDragging?.()) return;
    const inHead = isPointInHead(e.clientX, e.clientY);
    // #region agent log
    console.log("[dbg ee6ebc] hitzone pointerup click-eval", { x: e.clientX, y: e.clientY, dt: Math.round(dt), move2: Math.round(dx * dx + dy * dy), isDragging: !!interaction?.isDragging?.(), inHead, anchorHead: { x: Math.round(anchors.head.x), y: Math.round(anchors.head.y) }, scale });
    fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ee6ebc'},body:JSON.stringify({sessionId:'ee6ebc',runId:'pre-fix',hypothesisId:'H2',location:'js/appmain/pet/index.js:pointerup',message:'hitzone pointerup click-eval',data:{x:e.clientX,y:e.clientY,dt:Math.round(dt),move2:Math.round(dx*dx+dy*dy),isDragging:!!interaction?.isDragging?.(),inHead,anchorHead:{x:Math.round(anchors.head.x),y:Math.round(anchors.head.y)},scale},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!inHead) return;
    onHeadClick?.({ x: e.clientX, y: e.clientY, anchors: { ...anchors } });
  };

  hitzone.addEventListener("pointerdown", handleClickDown);
  // 某些环境下 pointerup 可能不会回到 hitzone（例如 capture 失败或事件分发差异），
  // 因此把结束事件提升到 window，保证 click 判定闭环。
  window.addEventListener("pointerup", handleClickUp);
  window.addEventListener("pointercancel", handleClickUp);

  const targetHandle = observeTargetZone({
    element: targetEl,
    threshold: 0.35,
    onEnter() {
      targetVisible = true;
      if (!fsm.is(PET_STATES.DRAGGING)) {
        fsm.setState(PET_STATES.HOMING);
      }
    },
    onLeave() {
      targetVisible = false;
      if (fsm.is(PET_STATES.HOMING)) {
        fsm.setState(PET_STATES.IDLE);
      }
    },
  });

  {
    const initial = getAnchorPoint();
    pos.x = desired.x = lastPos.x = initial.x;
    pos.y = desired.y = lastPos.y = initial.y;
    rig.root.position.set(pos.x, pos.y);
    updateHitzone();
  }

  const tick = (ticker) => {
    const dt = Math.max(0.0001, Math.min(ticker.deltaTime, 2.5));

    if (fsm.is(PET_STATES.IDLE)) {
      const a = getAnchorPoint();
      desired.x = a.x;
      desired.y = a.y;
    } else if (fsm.is(PET_STATES.HOMING)) {
      const a = getTargetPoint();
      desired.x = a.x;
      desired.y = a.y;
    }

    let lerpBase;
    if (fsm.is(PET_STATES.DRAGGING)) {
      lerpBase = 0.55;
    } else if (fsm.is(PET_STATES.HOMING)) {
      lerpBase = prefersReducedMotion ? 0.6 : 0.09;
    } else {
      lerpBase = prefersReducedMotion ? 0.8 : 0.22;
    }
    const factor = 1 - Math.pow(1 - lerpBase, dt);

    pos.x += (desired.x - pos.x) * factor;
    pos.y += (desired.y - pos.y) * factor;

    worldVel.x = (pos.x - lastPos.x) / dt;
    worldVel.y = (pos.y - lastPos.y) / dt;
    lastPos.x = pos.x;
    lastPos.y = pos.y;

    rig.root.position.set(pos.x, pos.y);

    let armTargetL = 0;
    let armTargetR = 0;
    let legTargetL = 0;
    let legTargetR = 0;
    let headTarget = 0;
    let torsoTarget = 0;

    if (!prefersReducedMotion) {
      if (fsm.is(PET_STATES.DRAGGING)) {
        const { vx, vy } = velocitySampler.sample();
        const swing = clamp(vx * 0.45, -1.1, 1.1);
        const vertical = clamp(vy * 0.35, -0.8, 0.8);
        armTargetL = swing + vertical * 0.8 + 0.08;
        armTargetR = swing - vertical * 0.8 - 0.08;
        legTargetL = swing * 0.45 + vertical * 0.2;
        legTargetR = swing * 0.45 - vertical * 0.2;
        headTarget = -swing * 0.32;
        torsoTarget = -swing * 0.12;
      } else {
        const travelLean = clamp(worldVel.x * 0.09, -0.45, 0.45);
        armTargetL = travelLean + 0.05;
        armTargetR = travelLean - 0.05;
        legTargetL = -travelLean * 0.3;
        legTargetR = -travelLean * 0.3;
        headTarget = -travelLean * 0.18;
        torsoTarget = -travelLean * 0.05;
      }
    }

    rig.leftArm.rotation = springs.leftArm.step(armTargetL, dt);
    rig.rightArm.rotation = springs.rightArm.step(armTargetR, dt);
    rig.leftLeg.rotation = springs.leftLeg.step(legTargetL, dt);
    rig.rightLeg.rotation = springs.rightLeg.step(legTargetR, dt);
    rig.head.rotation = springs.head.step(headTarget, dt);
    rig.torso.rotation = springs.torso.step(torsoTarget, dt);

    updateHitzone();
  };

  app.ticker.add(tick);

  const onWindowResize = () => {
    updateHitzone();
  };
  window.addEventListener("resize", onWindowResize, { passive: true });

  return {
    app,
    rig,
    fsm,
    states: PET_STATES,
    getAnchors() {
      return anchors;
    },
    destroy() {
      hitzone.removeEventListener("pointerdown", handleClickDown);
      window.removeEventListener("pointerup", handleClickUp);
      window.removeEventListener("pointercancel", handleClickUp);
      window.removeEventListener("resize", onWindowResize);
      app.ticker.remove(tick);
      targetHandle.destroy();
      interaction.destroy();
      app.destroy(true, { children: true, texture: true });
    },
  };
}
