/**
 * LCKED — Frecency tracking
 * ---------------------------------------------------------------------------
 * Frecency = frequency × recency-decay. Used to rank palette results and
 * the ⌘1–⌘9 favorites "most-used" slots. Persisted to localStorage so it
 * survives reloads but never touches crypto/items.
 *
 * Decay model: score = hits × 0.95^(daysSinceLastUse).
 * A command used 10 times today scores ~10; used 10 times a month ago ~3.5.
 */

const STORAGE_KEY = "lcked-frecency";
const DECAY = 0.95;

interface FrecencyEntry {
  hits: number;
  lastUsed: number; // epoch ms
}

type FrecencyMap = Record<string, FrecencyEntry>;

let cache: FrecencyMap | null = null;

function load(): FrecencyMap {
  if (cache) return cache;
  if (typeof localStorage === "undefined") return (cache = {});
  try {
    cache = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as FrecencyMap;
  } catch {
    cache = {};
  }
  return cache!;
}

function save(map: FrecencyMap) {
  cache = map;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      // quota — non-fatal
    }
  }
}

/** Record that `id` (a command or item id) was used. Call on every activation. */
export function recordUse(id: string): void {
  const map = load();
  const existing = map[id] ?? { hits: 0, lastUsed: 0 };
  map[id] = { hits: existing.hits + 1, lastUsed: Date.now() };
  save(map);
}

/** Compute the frecency score for an id (higher = more relevant). */
export function frecencyScore(id: string): number {
  const map = load();
  const entry = map[id];
  if (!entry) return 0;
  const days = (Date.now() - entry.lastUsed) / 86_400_000;
  return entry.hits * Math.pow(DECAY, days);
}

/** Sort a list of ids by frecency, descending. Ties break alphabetically. */
export function sortByFrecency(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const sa = frecencyScore(a);
    const sb = frecencyScore(b);
    if (sb !== sa) return sb - sa;
    return a.localeCompare(b);
  });
}

/** Return the top-N most-frecent ids (for ⌘1–⌘9 default slots when unpinned). */
export function topFrecency(ids: string[], n: number): string[] {
  return sortByFrecency(ids).slice(0, n);
}

/** Clear all frecency history (used by Settings → Reset). */
export function clearFrecency(): void {
  save({});
}
