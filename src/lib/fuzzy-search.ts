/**
 * LCKED — Lightweight fuzzy search
 * ---------------------------------------------------------------------------
 * Zero-dependency subsequence matcher with scoring. Fast enough to run
 * un-debounced across thousands of decrypted items. We match against a
 * composite string built from each item's searchable fields.
 *
 * The per-item haystack is memoised in a WeakMap keyed by item reference, so
 * repeat queries (every keystroke) don't rebuild the string. The cache
 * invalidates automatically when the item object is replaced (e.g. on save).
 */

import type { VaultItem } from "@/lib/types";

// Hoisted regex — avoid per-match allocation (A-23).
const WS_RE = /\s/;

/** Build a lowercase haystack of everything searchable for an item. */
export function searchableText(item: VaultItem): string {
  const parts: string[] = [item.name, item.folder ?? ""];
  // Defensive: legacy/corrupt items may lack `customFields` (A-21).
  for (const cf of item.customFields ?? []) parts.push(cf.name, cf.value);

  switch (item.type) {
    case "login":
      parts.push(item.details.username, item.details.notes);
      for (const u of item.details.urls ?? []) parts.push(u);
      break;
    case "note":
      parts.push(item.details.content);
      break;
    case "card":
      parts.push(item.details.cardholder, item.details.brand, item.details.notes);
      break;
    case "identity":
      parts.push(
        item.details.firstName,
        item.details.lastName,
        item.details.email,
        item.details.phone,
        item.details.company,
        item.details.city,
        item.details.state,
        item.details.country,
        item.details.notes,
      );
      break;
  }
  return parts.join(" \u0001 ").toLowerCase();
}

// Per-item haystack cache (A-22). Keyed by item reference so it GCs when the
// item is replaced. Avoids rebuilding the haystack on every keystroke.
const _haystackCache = new WeakMap<VaultItem, string>();

function haystackFor(item: VaultItem): string {
  let h = _haystackCache.get(item);
  if (h === undefined) {
    h = searchableText(item);
    _haystackCache.set(item, h);
  }
  return h;
}

/**
 * Subsequence fuzzy match with bonus for consecutive + early matches.
 * Returns a score (higher = better) or -1 when no match.
 */
export function fuzzyScore(haystack: string, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  if (haystack.includes(q)) {
    // Exact substring match — strong bonus, even stronger at the start.
    const idx = haystack.indexOf(q);
    // Clamp so very-late matches in huge haystacks don't go negative (A-24).
    return Math.max(0, 1000 - idx) + (q.length / haystack.length) * 500;
  }

  let score = 0;
  let qi = 0;
  let lastIdx = -1;
  let consecutive = 0;
  for (let i = 0; i < haystack.length && qi < q.length; i++) {
    if (haystack[i] === q[qi]) {
      let bonus = 10;
      if (lastIdx === i - 1) {
        consecutive++;
        bonus += consecutive * 5;
      } else {
        consecutive = 0;
      }
      if (i === 0 || WS_RE.test(haystack[i - 1])) bonus += 8; // word boundary
      score += bonus;
      lastIdx = i;
      qi++;
    }
  }
  if (qi < q.length) return -1; // didn't match all query chars
  // Penalise long haystacks slightly so short relevant items rank higher.
  return score - Math.floor(haystack.length / 50);
}

export interface ScoredItem {
  item: VaultItem;
  score: number;
}

export function searchItems(items: VaultItem[], query: string): VaultItem[] {
  const trimmed = query.trim();
  if (!trimmed) return items;

  const scored: ScoredItem[] = [];
  for (const item of items) {
    const score = fuzzyScore(haystackFor(item), trimmed);
    if (score >= 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
