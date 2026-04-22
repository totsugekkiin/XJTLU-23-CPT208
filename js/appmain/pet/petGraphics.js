/**
 * 纯白 Q 版 3 头身占位绘制。
 * 每个绘制函数都只负责在给定的 Graphics 上画出该部位的"内容"，
 * 原点即该部位的旋转关节（pivot）：
 *   - head:   origin = 脖子；绘制向上到头顶
 *   - torso:  origin = 胯部中心；绘制向上到肩部
 *   - arm:    origin = 肩部；绘制向下到手
 *   - leg:    origin = 胯部；绘制向下到脚
 * 这样后续把 Graphics 换成 Sprite 时，只需把同一坐标系下的图像贴到
 * 对应 Container 上，不需要调整父子层级。
 */

const WHITE = 0xffffff;
const STROKE = 0x2d3142;

export const RIG_METRICS = {
  headRadius: 20,
  torsoWidth: 34,
  // 骨架躯干高度（影响头/手臂挂点与整体比例）
  torsoHeight: 32,
  armWidth: 12,
  armLength: 36,
  armInset: 6,
  shoulderX: 18,
  hipX: 9,
  legWidth: 14,
  legLength: 40,
};

export function drawHead(graphics) {
  const r = RIG_METRICS.headRadius;
  graphics.clear();
  graphics
    .circle(0, -r, r)
    .fill({ color: WHITE })
    .stroke({ color: STROKE, width: 2, alignment: 1 });
  graphics
    .circle(-6, -r - 2, 2.2)
    .fill({ color: STROKE });
  graphics
    .circle(6, -r - 2, 2.2)
    .fill({ color: STROKE });
  graphics
    .moveTo(-4, -r + 6)
    .quadraticCurveTo(0, -r + 9, 4, -r + 6)
    .stroke({ color: STROKE, width: 1.6, cap: "round" });
  graphics
    .circle(-10, -r + 4, 1.4)
    .fill({ color: 0xffbfa3, alpha: 0.9 });
  graphics
    .circle(10, -r + 4, 1.4)
    .fill({ color: 0xffbfa3, alpha: 0.9 });
  return graphics;
}

export function drawTorso(graphics) {
  const { torsoWidth, torsoHeight } = RIG_METRICS;
  graphics.clear();
  graphics
    .roundRect(-torsoWidth / 2, -torsoHeight, torsoWidth, torsoHeight, 12)
    .fill({ color: WHITE })
    .stroke({ color: STROKE, width: 2, alignment: 1 });
  return graphics;
}

export function drawArm(graphics) {
  const { armWidth, armLength } = RIG_METRICS;
  graphics.clear();
  graphics
    .roundRect(-armWidth / 2, 0, armWidth, armLength, 6)
    .fill({ color: WHITE })
    .stroke({ color: STROKE, width: 2, alignment: 1 });
  return graphics;
}

export function drawLeg(graphics) {
  const { legWidth, legLength } = RIG_METRICS;
  graphics.clear();
  graphics
    .roundRect(-legWidth / 2, 0, legWidth, legLength, 6)
    .fill({ color: WHITE })
    .stroke({ color: STROKE, width: 2, alignment: 1 });
  return graphics;
}

/**
 * 桌宠本体的轴对齐包围盒（AABB），
 * 原点为根容器（脚底中心），y 向下为正。
 * 用于 DOM 命中区定位，尺寸略大以容纳四肢摆动。
 */
export function getRigBounds() {
  const { headRadius, torsoHeight, legLength, armLength, shoulderX, armWidth } = RIG_METRICS;
  const top = -(legLength + torsoHeight + headRadius * 2) - 4;
  const bottom = legLength * 0.25;
  const halfW = shoulderX + armWidth / 2 + armLength * 0.25;
  return {
    top,
    bottom,
    height: bottom - top,
    width: halfW * 2,
    halfWidth: halfW,
  };
}
