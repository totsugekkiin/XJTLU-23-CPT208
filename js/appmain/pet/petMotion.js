/**
 * 简化弹簧阻尼器，用于四肢 / 头部等次级运动。
 *   step(target, dt):
 *     vel = (vel + (target - angle) * stiffness) * damping
 *     angle += vel * dt
 *
 * dt 基于 Pixi ticker.deltaTime（1.0 ≈ 一帧 60Hz），
 * 不需要真实物理单位也能得到稳定的视觉反馈。
 */
export function createSpring({ stiffness = 0.2, damping = 0.78, rest = 0 } = {}) {
  let angle = rest;
  let vel = 0;

  return {
    get angle() {
      return angle;
    },
    step(target, dt = 1) {
      const clampedDt = Math.max(0.0001, Math.min(dt, 2.5));
      vel = (vel + (target - angle) * stiffness) * damping;
      angle += vel * clampedDt;
      return angle;
    },
    reset(value = rest) {
      angle = value;
      vel = 0;
    },
  };
}

/**
 * 维护最近 N ms 的指针采样，用来平滑估算"甩动速度"。
 */
export function createVelocitySampler(windowMs = 120) {
  const history = [];

  return {
    push(x, y, now = performance.now()) {
      history.push({ t: now, x, y });
      while (history.length && now - history[0].t > windowMs) {
        history.shift();
      }
    },
    clear() {
      history.length = 0;
    },
    sample() {
      if (history.length < 2) return { vx: 0, vy: 0 };
      const first = history[0];
      const last = history[history.length - 1];
      const dt = Math.max(1, last.t - first.t);
      return {
        vx: (last.x - first.x) / dt,
        vy: (last.y - first.y) / dt,
      };
    },
  };
}
