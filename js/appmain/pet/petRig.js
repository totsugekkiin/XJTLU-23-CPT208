import { drawArm, drawHead, drawLeg, drawTorso, RIG_METRICS } from "./petGraphics.js";

/**
 * 构建场景树：
 *   Root (脚底基线，世界坐标)
 *   └── Torso (胯关节)
 *        ├── Head (脖关节)
 *        ├── LeftArm  (左肩关节)
 *        ├── RightArm (右肩关节)
 *        ├── LeftLeg  (左胯关节)
 *        └── RightLeg (右胯关节)
 *
 * 每个 Container 的本地原点即旋转枢轴，便于将 Graphics 占位符
 * 整体替换为 Sprite（只需保证新精灵的锚点与这些关节对齐）。
 */
export function createPetRig(PIXI) {
  const { Container, Graphics } = PIXI;
  const { torsoHeight, shoulderX, armInset, hipX, legLength } = RIG_METRICS;

  const root = new Container();
  root.label = "pet-root";

  const torso = new Container();
  torso.label = "pet-torso";
  torso.sortableChildren = true;
  torso.x = 0;
  torso.y = -legLength;

  const torsoGraphics = new Graphics();
  drawTorso(torsoGraphics);
  torsoGraphics.zIndex = 4;
  torso.addChild(torsoGraphics);

  const head = new Container();
  head.label = "pet-head";
  head.zIndex = 4;
  head.x = 0;
  head.y = -torsoHeight;
  const headGraphics = new Graphics();
  drawHead(headGraphics);
  head.addChild(headGraphics);

  const makeArm = (sideX, label) => {
    const arm = new Container();
    arm.label = label;
    arm.x = sideX;
    arm.y = -torsoHeight + armInset;
    const g = new Graphics();
    drawArm(g);
    arm.addChild(g);
    return { arm, graphics: g };
  };

  const leftArmBundle = makeArm(-shoulderX, "pet-arm-left");
  const rightArmBundle = makeArm(shoulderX, "pet-arm-right");
  const leftArm = leftArmBundle.arm;
  const rightArm = rightArmBundle.arm;
  leftArm.zIndex = 3;
  rightArm.zIndex = 3;

  const makeLeg = (sideX, label) => {
    const leg = new Container();
    leg.label = label;
    leg.x = sideX;
    leg.y = 0;
    const g = new Graphics();
    drawLeg(g);
    leg.addChild(g);
    return { leg, graphics: g };
  };

  const leftLegBundle = makeLeg(-hipX, "pet-leg-left");
  const rightLegBundle = makeLeg(hipX, "pet-leg-right");
  const leftLeg = leftLegBundle.leg;
  const rightLeg = rightLegBundle.leg;
  leftLeg.zIndex = 1;
  rightLeg.zIndex = 1;

  torso.addChild(leftLeg);
  torso.addChild(rightLeg);
  torso.addChild(leftArm);
  torso.addChild(rightArm);
  torso.addChild(head);

  root.addChild(torso);

  return {
    root,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    graphics: {
      torso: torsoGraphics,
      head: headGraphics,
      leftArm: leftArmBundle.graphics,
      rightArm: rightArmBundle.graphics,
      leftLeg: leftLegBundle.graphics,
      rightLeg: rightLegBundle.graphics,
    },
  };
}
