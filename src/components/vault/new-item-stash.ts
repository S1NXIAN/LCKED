/**
 * Tiny mutable stash so the command palette / icon rail can pre-select an item
 * type that the ItemEditor will pick up when it opens. ES module `let` exports
 * can't be reassigned from importers, so we use a holder object instead.
 */
import type { ItemType } from "@/lib/types";

export const newItemStash: { type: ItemType | null } = { type: null };

export function stashNewItemType(type: ItemType) {
  newItemStash.type = type;
}

export function consumeNewItemType(): ItemType | null {
  const t = newItemStash.type;
  newItemStash.type = null;
  return t;
}
