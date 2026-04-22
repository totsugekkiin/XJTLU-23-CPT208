export const PET_STATES = Object.freeze({
  IDLE: "idle",
  DRAGGING: "dragging",
  HOMING: "homing",
  WAVING: "waving",
  PLACED: "placed",
});

/**
 * 轻量级状态机：只负责状态枚举与变更广播，
 * 具体行为（目标位置、插值速度、动画调度）交给消费方决定。
 */
export function createPetStateMachine(initial = PET_STATES.IDLE) {
  let current = initial;
  const listeners = new Set();

  const setState = (next) => {
    if (next === current) return;
    const prev = current;
    current = next;
    listeners.forEach((cb) => {
      try {
        cb(next, prev);
      } catch (err) {
        console.error("[pet] state listener error", err);
      }
    });
  };

  return {
    get state() {
      return current;
    },
    is(s) {
      return current === s;
    },
    setState,
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
