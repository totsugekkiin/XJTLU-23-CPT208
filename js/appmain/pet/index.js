import { createPetApp } from "./petApp.js";
import { createPetRig } from "./petRig.js";
import { getRigBounds, RIG_METRICS } from "./petGraphics.js";
import { createSpring, createVelocitySampler } from "./petMotion.js";
import { createPetDragInteraction } from "./petInteraction.js";
import { createPetStateMachine, PET_STATES } from "./petStateMachine.js";
import { observeTargetZone } from "./targetObserver.js";
import { parseCssNumber } from "../utils.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const WAVE_DURATION_MS = 900;
const WAVE_FREQ_HZ = 2.5;
// 注意：不同贴图“手臂朝向”不同，rotation 正负号可能需要翻转
const WAVE_DIR = 1; // -1/1：翻转抬臂方向
const WAVE_SWING_RAD = 0.65; // 挥动幅度（rad）
const WAVE_LIFT_RAD = 1.85; // 抬臂基准角（rad）

/** 与 createDesktopPet 默认参数顺序一致：躯干→双臂→双腿→头 */
export const DEFAULT_PET_TEXTURE_URLS = Object.freeze([
  "images/pet/torso.png",
  "images/pet/leftarm.png",
  "images/pet/rightarm.png",
  "images/pet/leftleg.png",
  "images/pet/rightleg.png",
  "images/pet/head.png",
]);

function loadPetPartTextures(PIXI, urls) {
  if (!PIXI?.Assets) {
    return Promise.resolve(urls.map(() => null));
  }
  return Promise.all(
    urls.map(async (url) => {
      if (!url) return null;
      try {
        return await PIXI.Assets.load(url);
      } catch (err) {
        console.warn("[desktop-pet] 部位贴图加载失败，将回退占位绘制。", err);
        return null;
      }
    })
  );
}

/**
 * 在 bootstrap 尽早调用，与首屏其它脚本并行拉取桌宠 PNG（Pixi Assets 会去重缓存）。
 * createDesktopPet 若使用相同默认 URL 会复用该 Promise。
 */
export function startPetTexturePreload(PIXI) {
  if (!PIXI?.Assets || globalThis.__PET_TEX_PRELOAD_PROMISE__) return;
  globalThis.__PET_TEX_PRELOAD_PROMISE__ = loadPetPartTextures(PIXI, [...DEFAULT_PET_TEXTURE_URLS]);
}

function applyPartSprite({
  PIXI,
  container,
  oldGraphics,
  texture,
  pivot,
  childOffset = { x: 0, y: 0 },
  desiredWidth,
  scaleMul = 1,
  scaleXMul = 1,
  scaleYMul = 1,
  zIndex = undefined,
}) {
  if (!container || !texture) return { ok: false, reason: "no-texture" };

  try {
    const sprite = new PIXI.Sprite(texture);
    sprite.pivot.set(pivot.x, pivot.y);
    sprite.position.set(childOffset?.x ?? 0, childOffset?.y ?? 0);

    const texW = texture.width || sprite.width || 1;
    const s = (desiredWidth / texW) * scaleMul;
    sprite.scale.set(s * scaleXMul, s * scaleYMul);

    if (zIndex !== undefined) {
      sprite.zIndex = zIndex;
    } else if (oldGraphics && typeof oldGraphics.zIndex === "number") {
      sprite.zIndex = oldGraphics.zIndex;
    }

    if (oldGraphics) oldGraphics.visible = false;
    container.addChild(sprite);
    return { ok: true, sprite };
  } catch (err) {
    console.warn("[desktop-pet] 部位贴图挂接失败，将回退占位绘制。", err);
    return { ok: false, reason: "apply-failed", error: err };
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
 * @param {HTMLElement=} params.heroEl         用于读取 --hero-scroll-length-px，配合 homingScrollProgress。
 * @param {number=}      params.homingScrollProgress  hero 滚动进度阈值（0~1），达到则飞向目标。
 * @param {number=}      params.homingScrollRelease   滞回下限，进度低于此则收回目标态。
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
 * @param {number=}      params.limbScaleMul   四肢贴图额外倍率（兼容旧参数），默认 3.2
 * @param {number=}      params.armScaleMul    手臂贴图额外倍率（优先于 limbScaleMul）
 * @param {number=}      params.legScaleMul    腿部贴图额外倍率（优先于 limbScaleMul）
 */
export async function createDesktopPet({
  host,
  hitzone,
  anchorEl = null,
  targetEl = null,
  heroEl = null,
  homingScrollProgress = null,
  homingScrollRelease = null,
  /** 离场后无 scroll 事件达到该毫秒数则回场（Lenis 下间隔较大，默认与 petConfig 一致） */
  scrollHideReturnMs = 2800,
  prefersReducedMotion = false,
  scale = 2,
  onHeadClick = null,
  // 拖拽松手后是否自动归位到 anchor/target；false 表示“拖到哪就停哪”
  autoReturnOnRelease = false,
  // hitzone 额外外扩（像素），只影响鼠标/触控命中范围
  hitboxPaddingX = 48,
  hitboxPaddingY = 36,
  // 只把命中区“顶部”额外上提（底部保持不变）
  hitboxTopExtra = 50,
  // 聊天气泡锚点额外上移（像素）
  chatBubbleRaise = 100,
  // 手臂“骨骼肩关节”偏移（像素，作用在 rig.leftArm/rightArm 容器上）
  // 用于：贴图站姿对了，但转动时关节不对——通过移动骨骼节点来匹配真实肩点
  leftShoulderJointOffset = { x: 6, y: -5 },
  rightShoulderJointOffset = { x: 0, y: 0 },
  headTextureUrl = "images/pet/head.png",
  // 默认按 1000x1000 导出图的关节坐标（你后续都用这套）
  // 头图：脖子点
  headNeckPivot = { x: 500, y: 510 },
  headScaleMul = 5.2,
  torsoScaleMul = 9,
  // 躯干贴图可做非等比缩放：只压短高度（不影响宽度）
  torsoScaleXMul = 1,
  torsoScaleYMul = 0.76,//躯干长度修改
  torsoTextureUrl = "images/pet/torso.png",
  // 躯干图：胯部中心点（用左右腿胯点的中点）
  torsoHipPivot = { x: (480 + 519) / 2, y: (624 + 625) / 2 },
  leftArmTextureUrl = "images/pet/leftarm.png",
  rightArmTextureUrl = "images/pet/rightarm.png",
  leftLegTextureUrl = "images/pet/leftleg.png",
  rightLegTextureUrl = "images/pet/rightleg.png",
  // 手臂图：肩关节点（你给的“左手/右手”坐标）
  leftShoulderPivot = { x: 440, y: 510 },
  rightShoulderPivot = { x: 559, y: 510 },
  // 腿图：胯关节点
  leftHipPivot = { x: 470, y: 624 },
  rightHipPivot = { x: 529, y: 625 },
  limbScaleMul = 18,
  armScaleMul = 20,
  legScaleMul = undefined,
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

  // #region agent log
  console.log("[dbg ee6ebc] createDesktopPet entry", { hasPixi: !!PIXI, hasHost: !!host, hasHitzone: !!hitzone, scale, prefersReducedMotion, hasOnHeadClick: typeof onHeadClick === "function" });
  fetch('http://127.0.0.1:7502/ingest/f422e225-c59a-490e-b033-9726b77ea0c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ee6ebc'},body:JSON.stringify({sessionId:'ee6ebc',runId:'pre-fix',hypothesisId:'H1',location:'js/appmain/pet/index.js:entry',message:'createDesktopPet entry',data:{hasPixi:!!PIXI,hasHost:!!host,hasHitzone:!!hitzone,scale,prefersReducedMotion,hasOnHeadClick:typeof onHeadClick==='function'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const partTextureUrls = [
    torsoTextureUrl,
    leftArmTextureUrl,
    rightArmTextureUrl,
    leftLegTextureUrl,
    rightLegTextureUrl,
    headTextureUrl,
  ];
  const useSharedPreload =
    typeof globalThis.__PET_TEX_PRELOAD_PROMISE__ !== "undefined" &&
    partTextureUrls.length === DEFAULT_PET_TEXTURE_URLS.length &&
    partTextureUrls.every((u, i) => u === DEFAULT_PET_TEXTURE_URLS[i]);

  const texturesPromise = useSharedPreload
    ? globalThis.__PET_TEX_PRELOAD_PROMISE__
    : loadPetPartTextures(PIXI, partTextureUrls);

  const [app, textures] = await Promise.all([createPetApp(PIXI, host), texturesPromise]);

  const rig = createPetRig(PIXI);
  rig.root.visible = false;
  rig.root.scale.set(scale);
  app.stage.addChild(rig.root);
  {
    const a = getAnchorPoint();
    rig.root.position.set(a.x, a.y);
  }

  // 层级：让双臂位于头部上方（决定顺序的是各部位 Container 的 zIndex）
  if (rig.torso) rig.torso.sortableChildren = true;
  // 腿层级：让腿部位于躯干之下
  if (rig.leftLeg) rig.leftLeg.zIndex = 1;
  if (rig.rightLeg) rig.rightLeg.zIndex = 1;
  if (rig.leftArm) rig.leftArm.zIndex = 6;
  if (rig.rightArm) rig.rightArm.zIndex = 6;
  if (rig.head && typeof rig.head.zIndex === "number") rig.head.zIndex = 4;

  // 骨骼节点微调：移动肩关节容器本身（不改贴图），保证动画旋转轴正确
  if (rig.leftArm && leftShoulderJointOffset) {
    rig.leftArm.x += leftShoulderJointOffset.x || 0;
    rig.leftArm.y += leftShoulderJointOffset.y || 0;
    // 站立外观保持不变：把子节点（占位 Graphics）反向移回去
    rig.graphics?.leftArm?.position?.set?.(-(leftShoulderJointOffset.x || 0), -(leftShoulderJointOffset.y || 0));
  }
  if (rig.rightArm && rightShoulderJointOffset) {
    rig.rightArm.x += rightShoulderJointOffset.x || 0;
    rig.rightArm.y += rightShoulderJointOffset.y || 0;
    rig.graphics?.rightArm?.position?.set?.(-(rightShoulderJointOffset.x || 0), -(rightShoulderJointOffset.y || 0));
  }

  const [
    texTorso,
    texLeftArm,
    texRightArm,
    texLeftLeg,
    texRightLeg,
    texHead,
  ] = textures;

  applyPartSprite({
    PIXI,
    container: rig.torso,
    oldGraphics: rig.graphics?.torso,
    texture: texTorso,
    pivot: torsoHipPivot,
    desiredWidth: RIG_METRICS.torsoWidth,
    scaleMul: torsoScaleMul,
    scaleXMul: torsoScaleXMul,
    scaleYMul: torsoScaleYMul,
    zIndex: 2,
  });
  applyPartSprite({
    PIXI,
    container: rig.leftArm,
    oldGraphics: rig.graphics?.leftArm,
    texture: texLeftArm,
    pivot: leftShoulderPivot,
    childOffset: {
      x: -(leftShoulderJointOffset?.x || 0),
      y: -(leftShoulderJointOffset?.y || 0),
    },
    desiredWidth: RIG_METRICS.armWidth,
    scaleMul: armScaleMul ?? limbScaleMul,
    zIndex: 6,
  });
  applyPartSprite({
    PIXI,
    container: rig.rightArm,
    oldGraphics: rig.graphics?.rightArm,
    texture: texRightArm,
    pivot: rightShoulderPivot,
    childOffset: {
      x: -(rightShoulderJointOffset?.x || 0),
      y: -(rightShoulderJointOffset?.y || 0),
    },
    desiredWidth: RIG_METRICS.armWidth,
    scaleMul: armScaleMul ?? limbScaleMul,
    zIndex: 6,
  });
  applyPartSprite({
    PIXI,
    container: rig.leftLeg,
    oldGraphics: rig.graphics?.leftLeg,
    texture: texLeftLeg,
    pivot: leftHipPivot,
    desiredWidth: RIG_METRICS.legWidth,
    scaleMul: legScaleMul ?? limbScaleMul,
    zIndex: 1,
  });
  applyPartSprite({
    PIXI,
    container: rig.rightLeg,
    oldGraphics: rig.graphics?.rightLeg,
    texture: texRightLeg,
    pivot: rightHipPivot,
    desiredWidth: RIG_METRICS.legWidth,
    scaleMul: legScaleMul ?? limbScaleMul,
    zIndex: 1,
  });
  applyPartSprite({
    PIXI,
    container: rig.head,
    oldGraphics: rig.graphics?.head,
    texture: texHead,
    pivot: headNeckPivot,
    desiredWidth: RIG_METRICS.headRadius * 2,
    scaleMul: headScaleMul,
    zIndex: 4,
  });

  rig.root.visible = true;

  rig.torso.eventMode = "dynamic";
  rig.torso.cursor = "grab";

  const fsm = createPetStateMachine(PET_STATES.IDLE);

  const anchorWorld = getAnchorPoint();
  const pos = { x: anchorWorld.x, y: anchorWorld.y };
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
  let ioTargetActive = false;
  let scrollTargetActive = false;
  let targetVisible = false;
  let waveUntil = 0;
  let waveReturnState = null;

  const anchors = {
    head: { x: pos.x, y: pos.y },
    user: { x: pos.x, y: pos.y },
    hitzone: { left: 0, top: 0, width: 0, height: 0 },
  };

  const getTargetPoint = () => {
    if (!targetEl) {
      if (scrollTargetActive || ioTargetActive) {
        return { x: window.innerWidth / 2, y: -120 };
      }
      return getAnchorPoint();
    }
    const rect = targetEl.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    };
  };

  /**
   * DOCKING 状态的目标点；为 null 时使用默认右下角，
   * 否则按 { xPercent, yPercent } 或 { x, y } 解析为视口内一个安全坐标。
   */
  let customDockSpec = null;

  /** 根节点为脚底中心：把整只宠物收进视口右下角留白内 */
  const getViewportCornerPoint = () => {
    const m = 20;
    const hw = bounds.halfWidth * scale;
    const footBottom = bounds.bottom * scale;
    const minX = hw + m;
    const maxX = window.innerWidth - m - hw;
    const minY = m + 40;
    const maxY = window.innerHeight - m - footBottom;

    if (customDockSpec) {
      let rawX;
      let rawY;
      if (Number.isFinite(customDockSpec.x) && Number.isFinite(customDockSpec.y)) {
        rawX = customDockSpec.x;
        rawY = customDockSpec.y;
      } else {
        const xp = Number.isFinite(customDockSpec.xPercent) ? customDockSpec.xPercent : 1;
        const yp = Number.isFinite(customDockSpec.yPercent) ? customDockSpec.yPercent : 1;
        rawX = window.innerWidth * xp;
        rawY = window.innerHeight * yp;
      }
      const x = maxX < minX ? window.innerWidth * 0.5 : clamp(rawX, minX, maxX);
      const y = clamp(rawY, minY, Math.max(minY, maxY));
      return { x, y };
    }

    const x = maxX < minX ? window.innerWidth * 0.5 : maxX;
    const y = Math.min(maxY, window.innerHeight - m - 8);
    return { x, y: Math.max(minY, y) };
  };

  /** 根节点 y：使整体完全移到视口上沿之外（贴图腿/裙摆 scale 远大于 bounds.bottom，需大 legPad） */
  const getOffScreenAboveY = () => {
    const margin = 120;
    const headPad = (RIG_METRICS.headRadius * 2.5 + 52) * scale;
    const legPad = (RIG_METRICS.legLength * 1.45 + 72) * scale;
    const skirtSlack = 56 * scale;
    return -margin - bounds.top * scale - headPad - legPad - skirtSlack;
  };

  const updateHitzone = () => {
    const w = bounds.width * scale + hitboxPaddingX;
    const h = bounds.height * scale + hitboxPaddingY + hitboxTopExtra;
    hitzone.style.width = `${w}px`;
    hitzone.style.height = `${h}px`;
    const left = Math.round(pos.x - w / 2);
    // 让增大的命中区在视觉上更“居中”覆盖身体
    // 同时 top 再上移 hitboxTopExtra，保证“底部位置正好”不变
    const top = Math.round(pos.y + bounds.top * scale - 8 - (hitboxPaddingY - 18) / 2 - hitboxTopExtra);
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
    anchors.user.y = pos.y + (-RIG_METRICS.legLength - RIG_METRICS.torsoHeight * 0.2) * scale - chatBubbleRaise;
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
      if (autoReturnOnRelease) {
        if (targetVisible) fsm.setState(PET_STATES.HOMING);
        else fsm.setState(PET_STATES.IDLE);
      } else {
        desired.x = pos.x;
        desired.y = pos.y;
        fsm.setState(PET_STATES.PLACED);
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
    // 点击头部：挥手 + 对话一起触发（不干扰拖拽态）
    waveUntil = performance.now() + WAVE_DURATION_MS;
    waveReturnState = null;
    fsm.setState(PET_STATES.WAVING);
    onHeadClick?.({ x: e.clientX, y: e.clientY, anchors: { ...anchors } });
  };

  hitzone.addEventListener("pointerdown", handleClickDown);
  // 某些环境下 pointerup 可能不会回到 hitzone（例如 capture 失败或事件分发差异），
  // 因此把结束事件提升到 window，保证 click 判定闭环。
  window.addEventListener("pointerup", handleClickUp);
  window.addEventListener("pointercancel", handleClickUp);

  const targetHandle = observeTargetZone({
    element: targetEl,
    threshold: 0.08,
    rootMargin: "0px 0px 52vh 0px",
    onEnter() {
      ioTargetActive = true;
    },
    onLeave() {
      ioTargetActive = false;
    },
  });

  {
    const initial = getAnchorPoint();
    pos.x = desired.x = lastPos.x = initial.x;
    pos.y = desired.y = lastPos.y = initial.y;
    rig.root.position.set(pos.x, pos.y);
    updateHitzone();
  }

  /**
   * 滚动检测挂在 window「scroll」上（与 Pixi ticker 解耦）。
   * 「一下滚」：任意一次 scroll 即离场（拖拽中 / 挥手中除外）。
   * 拖拽松手后的 PLACED 也要响应滚动，这样用户拖过桌宠后继续上下滑仍会飘走。
   */
  let lastScrollPulseAt = performance.now();
  const scrollPetArmAt = performance.now() + 450;
  const initialScrollReturnY = 8;
  /** SCROLL_EXIT 内冻结水平目标，避免随主卡锚点横向跟滚导致轨迹抖动 / 假「回屏」 */
  let scrollExitFrozenX = null;
  const isAtInitialScroll = () => Math.max(0, window.scrollY || 0) <= initialScrollReturnY;

  const onWindowScrollForPet = () => {
    const n = performance.now();
    lastScrollPulseAt = n;
    // DOCKING / PLACED 是「显式落点」状态，不应被滚动事件覆盖，
    // 与 tick() 里 river-page 分支的保护规则保持一致，避免 IO 调用 dockAtPoint
    // 后被同帧 micro-scroll 事件踩回 SCROLL_EXIT。
    if (isAtInitialScroll()) {
      scrollExitFrozenX = null;
      scrollTargetActive = false;
      if (
        !fsm.is(PET_STATES.DRAGGING) &&
        !fsm.is(PET_STATES.WAVING) &&
        !fsm.is(PET_STATES.DOCKING) &&
        !fsm.is(PET_STATES.PLACED)
      ) {
        fsm.setState(PET_STATES.IDLE);
      }
      return;
    }
    if (fsm.is(PET_STATES.SCROLL_EXIT)) return;
    if (n < scrollPetArmAt) return;
    if (
      fsm.is(PET_STATES.DRAGGING) ||
      fsm.is(PET_STATES.WAVING) ||
      fsm.is(PET_STATES.DOCKING) ||
      fsm.is(PET_STATES.PLACED)
    ) {
      return;
    }
    fsm.setState(PET_STATES.SCROLL_EXIT);
  };
  window.addEventListener("scroll", onWindowScrollForPet, { passive: true });

  const tick = (ticker) => {
    const dt = Math.max(0.0001, Math.min(ticker.deltaTime, 2.5));
    const now = performance.now();
    const isRiverPage = document.body.classList.contains("is-river-page");

    let scrollProgress = 0;
    if (homingScrollProgress != null && heroEl) {
      const sl = parseCssNumber(
        window.getComputedStyle(heroEl).getPropertyValue("--hero-scroll-length-px"),
        6000
      );
      scrollProgress = Math.max(0, window.scrollY) / Math.max(1, sl);
      const release =
        homingScrollRelease ?? Math.max(0, homingScrollProgress - 0.1);
      if (scrollProgress >= homingScrollProgress) scrollTargetActive = true;
      else if (scrollProgress < release) scrollTargetActive = false;
    }

    targetVisible = ioTargetActive || scrollTargetActive;

    const idleSinceScroll = now - lastScrollPulseAt;
    if (!isRiverPage && isAtInitialScroll() && !fsm.is(PET_STATES.DRAGGING) && !fsm.is(PET_STATES.WAVING)) {
      scrollExitFrozenX = null;
      scrollTargetActive = false;
      targetVisible = false;
      if (!fsm.is(PET_STATES.IDLE)) fsm.setState(PET_STATES.IDLE);
    }

    if (isRiverPage && !fsm.is(PET_STATES.DRAGGING) && !fsm.is(PET_STATES.WAVING) && !fsm.is(PET_STATES.DOCKING)) {
      if (!fsm.is(PET_STATES.SCROLL_EXIT)) fsm.setState(PET_STATES.SCROLL_EXIT);
    }

    if (!isRiverPage && fsm.is(PET_STATES.SCROLL_EXIT) && idleSinceScroll >= scrollHideReturnMs) {
      scrollExitFrozenX = null;
      fsm.setState(PET_STATES.IDLE);
    }

    if (
      !fsm.is(PET_STATES.DRAGGING) &&
      !fsm.is(PET_STATES.WAVING) &&
      !fsm.is(PET_STATES.PLACED) &&
      !fsm.is(PET_STATES.DOCKING) &&
      !fsm.is(PET_STATES.SCROLL_EXIT)
    ) {
      if (targetVisible && !fsm.is(PET_STATES.HOMING)) {
        fsm.setState(PET_STATES.HOMING);
      } else if (!targetVisible && fsm.is(PET_STATES.HOMING)) {
        fsm.setState(PET_STATES.IDLE);
      }
    }

    if (fsm.is(PET_STATES.WAVING)) {
      // 保持当前位置（不追随 anchor/target），只播放动作
      if (now >= waveUntil) {
        if (waveReturnState) {
          const nextState = waveReturnState;
          waveReturnState = null;
          fsm.setState(nextState);
        } else if (autoReturnOnRelease) {
          fsm.setState(targetVisible ? PET_STATES.HOMING : PET_STATES.IDLE);
        } else {
          desired.x = pos.x;
          desired.y = pos.y;
          fsm.setState(PET_STATES.PLACED);
        }
      }
    } else if (fsm.is(PET_STATES.PLACED)) {
      // 固定在当前位置：不更新 desired
    } else if (fsm.is(PET_STATES.IDLE)) {
      const a = getAnchorPoint();
      desired.x = a.x;
      desired.y = a.y;
    } else if (fsm.is(PET_STATES.HOMING)) {
      const a = getTargetPoint();
      desired.x = a.x;
      desired.y = a.y;
    } else if (fsm.is(PET_STATES.DOCKING)) {
      const c = getViewportCornerPoint();
      desired.x = c.x;
      desired.y = c.y;
    } else if (fsm.is(PET_STATES.SCROLL_EXIT)) {
      if (scrollExitFrozenX == null) scrollExitFrozenX = pos.x;
      desired.x = scrollExitFrozenX;
      desired.y = getOffScreenAboveY();
    }

    let lerpBase;
    if (fsm.is(PET_STATES.DRAGGING)) {
      lerpBase = 0.55;
    } else if (
      fsm.is(PET_STATES.HOMING) ||
      fsm.is(PET_STATES.DOCKING) ||
      fsm.is(PET_STATES.SCROLL_EXIT)
    ) {
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
      } else if (fsm.is(PET_STATES.WAVING)) {
        const t = now * 0.001;
        const phase = t * Math.PI * 2 * WAVE_FREQ_HZ;
        // 左手抬起并左右摆动，右手略微跟随
        armTargetL = (WAVE_LIFT_RAD + Math.sin(phase) * WAVE_SWING_RAD) * WAVE_DIR;
        armTargetR = -0.08 + Math.sin(phase + Math.PI) * 0.08;
        headTarget = Math.sin(phase) * 0.06;
        torsoTarget = Math.sin(phase) * 0.03;
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
    if (!fsm.is(PET_STATES.SCROLL_EXIT)) scrollExitFrozenX = null;
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
    wave({ durationMs = WAVE_DURATION_MS, returnState = PET_STATES.IDLE } = {}) {
      waveUntil = performance.now() + Math.max(0, durationMs);
      waveReturnState = returnState;
      fsm.setState(PET_STATES.WAVING);
    },
    stopWave({ returnState = PET_STATES.IDLE } = {}) {
      waveUntil = 0;
      waveReturnState = null;
      if (fsm.is(PET_STATES.WAVING)) fsm.setState(returnState);
    },
    dockToViewportCorner() {
      customDockSpec = null;
      fsm.setState(PET_STATES.DOCKING);
    },
    /**
     * 把桌宠停靠到视口里一个自定义点。
     * 接受 { xPercent, yPercent }（0~1，相对视口）或 { x, y }（像素）。
     * 不传或传 null 时等价于 dockToViewportCorner（右下角）。
     */
    dockAtPoint(spec) {
      if (spec && typeof spec === "object") {
        const hasPx = Number.isFinite(spec.x) && Number.isFinite(spec.y);
        const hasPct =
          Number.isFinite(spec.xPercent) || Number.isFinite(spec.yPercent);
        customDockSpec = hasPx || hasPct ? { ...spec } : null;
      } else {
        customDockSpec = null;
      }
      fsm.setState(PET_STATES.DOCKING);
    },
    getAnchors() {
      return anchors;
    },
    destroy() {
      hitzone.removeEventListener("pointerdown", handleClickDown);
      window.removeEventListener("pointerup", handleClickUp);
      window.removeEventListener("pointercancel", handleClickUp);
      window.removeEventListener("scroll", onWindowScrollForPet);
      window.removeEventListener("resize", onWindowResize);
      app.ticker.remove(tick);
      targetHandle.destroy();
      interaction.destroy();
      app.destroy(true, { children: true, texture: true });
    },
  };
}
