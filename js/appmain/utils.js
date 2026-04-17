export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const snap = (value) => Math.round(value);

export const mapRange = (value, inMin, inMax, outMin, outMax) => {
  if (inMin === inMax) return outMin;
  const p = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + (outMax - outMin) * p;
};

export const parseCssNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
