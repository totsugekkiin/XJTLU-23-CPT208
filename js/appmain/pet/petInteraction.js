/**
 * 全屏拖拽实现。
 *
 * 架构说明：
 *   桌宠画布本身 `pointer-events: none`，以保证透明区域不拦截
 *   DOM 原生事件。真正的拾取区由一个尺寸随宠物包围盒同步的
 *   DOM `hitzone` 承担。一旦 pointerdown 触发，后续的 move/up
 *   监听升级到 window 级别并调用 setPointerCapture，
 *   拖拽过程中鼠标哪怕离开宠物区域也不会丢事件。
 */
export function createPetDragInteraction({ hitzone, onDragStart, onDrag, onDragEnd }) {
  if (!hitzone) return { destroy() {} };

  let activePointerId = null;

  const handlePointerDown = (event) => {
    if (activePointerId !== null) return;
    if (event.button !== undefined && event.button !== 0) return;
    activePointerId = event.pointerId;
    try {
      hitzone.setPointerCapture(activePointerId);
    } catch (_) {
      /* some browsers may refuse capture on synthetic events */
    }
    hitzone.classList.add("is-dragging");
    onDragStart?.({ x: event.clientX, y: event.clientY, event });
    event.preventDefault();
  };

  const handlePointerMove = (event) => {
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    onDrag?.({ x: event.clientX, y: event.clientY, event });
  };

  const endDrag = (event) => {
    if (activePointerId === null) return;
    if (event && event.pointerId !== activePointerId) return;
    try {
      hitzone.releasePointerCapture(activePointerId);
    } catch (_) {
      /* noop */
    }
    hitzone.classList.remove("is-dragging");
    const x = event?.clientX ?? 0;
    const y = event?.clientY ?? 0;
    activePointerId = null;
    onDragEnd?.({ x, y, event });
  };

  hitzone.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  return {
    isDragging: () => activePointerId !== null,
    destroy() {
      hitzone.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    },
  };
}
