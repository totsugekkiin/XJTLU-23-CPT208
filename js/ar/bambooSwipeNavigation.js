export const BAMBOO_SWIPE_MIN_DISTANCE = 44;
export const BAMBOO_SWIPE_AXIS_BIAS = 1.15;

export function getHorizontalSwipeStep(start, end, options = {}) {
  if (!start || !end) return 0;

  const deltaX = Number(end.x) - Number(start.x);
  const deltaY = Number(end.y) - Number(start.y);
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return 0;

  const minDistance = options.minDistance ?? BAMBOO_SWIPE_MIN_DISTANCE;
  const axisBias = options.axisBias ?? BAMBOO_SWIPE_AXIS_BIAS;
  if (Math.abs(deltaX) < minDistance) return 0;
  if (Math.abs(deltaX) < Math.abs(deltaY) * axisBias) return 0;

  return deltaX < 0 ? 1 : -1;
}

export function getAdjacentBambooContentId(contentIds, currentId, step) {
  if (!Array.isArray(contentIds) || contentIds.length === 0) return currentId ?? null;
  if (!step || contentIds.length === 1) return currentId ?? contentIds[0];

  const currentIndex = contentIds.indexOf(currentId);
  if (currentIndex < 0) return contentIds[0];

  const direction = step > 0 ? 1 : -1;
  return contentIds[(currentIndex + direction + contentIds.length) % contentIds.length];
}
