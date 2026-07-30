import { BAMBOO_NOTICE_CONTENTS } from "../content/changmenExperienceContent.js";

export const AR_BAMBOO_OBSERVED_EVENT = "ar:bamboo-observed";
export const BAMBOO_COLLECTION_STORAGE_KEY = "changmen-ar-bamboo-backpack-v1";

function normalizeEntry(entry) {
  const contentId = String(entry?.contentId ?? "");
  if (!BAMBOO_NOTICE_CONTENTS[contentId]) return null;

  const mapId = entry?.mapId == null ? Number.NaN : Number(entry.mapId);
  const collectedAt = Number(entry?.collectedAt);
  return {
    contentId,
    mapId: Number.isFinite(mapId) ? mapId : null,
    anchorId: entry?.anchorId == null ? null : String(entry.anchorId),
    collectedAt: Number.isFinite(collectedAt) ? collectedAt : 0,
  };
}

export function normalizeBambooCollection(value) {
  const source = Array.isArray(value) ? value : value?.entries;
  if (!Array.isArray(source)) return [];

  const seen = new Set();
  return source.flatMap((entry) => {
    const normalized = normalizeEntry(entry);
    if (!normalized || seen.has(normalized.contentId)) return [];
    seen.add(normalized.contentId);
    return [normalized];
  });
}

export function collectBambooNotice(collection, observation, collectedAt = Date.now()) {
  const entries = normalizeBambooCollection(collection);
  const next = normalizeEntry({ ...observation, collectedAt });
  if (!next || entries.some((entry) => entry.contentId === next.contentId)) {
    return { entries, added: false, entry: next };
  }
  return { entries: [...entries, next], added: true, entry: next };
}

export function readBambooCollection(storage = globalThis?.localStorage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(BAMBOO_COLLECTION_STORAGE_KEY);
    return raw ? normalizeBambooCollection(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveBambooCollection(collection, storage = globalThis?.localStorage) {
  const entries = normalizeBambooCollection(collection);
  storage?.setItem(
    BAMBOO_COLLECTION_STORAGE_KEY,
    JSON.stringify({ version: 1, entries }),
  );
  return entries;
}
