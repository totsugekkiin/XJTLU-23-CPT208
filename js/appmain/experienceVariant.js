export const EXPERIENCE_VARIANT_AR = "ar";
export const EXPERIENCE_VARIANT_TEXT = "text";

const VALID_EXPERIENCE_VARIANTS = new Set([
  EXPERIENCE_VARIANT_AR,
  EXPERIENCE_VARIANT_TEXT,
]);

export function normalizeExperienceVariant(value, fallback = EXPERIENCE_VARIANT_AR) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return VALID_EXPERIENCE_VARIANTS.has(normalized) ? normalized : fallback;
}

export function resolveExperienceVariant(
  search = typeof window !== "undefined" ? window.location.search : "",
  fallback = EXPERIENCE_VARIANT_AR,
) {
  const params = new URLSearchParams(search);
  return normalizeExperienceVariant(params.get("variant"), fallback);
}

export function createVariantHref(path, variant, extraParams = {}) {
  const url = new URL(path, "https://changmen.local/");
  url.searchParams.set("variant", normalizeExperienceVariant(variant));
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return `${url.pathname.replace(/^\//, "")}${url.search}${url.hash}`;
}
