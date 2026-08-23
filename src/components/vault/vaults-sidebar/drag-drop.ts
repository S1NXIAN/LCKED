import type * as React from "react";

/**
 * Extract item IDs from a drag-drop event. Handles BOTH:
 *   - `text/lcked-items` → JSON array of IDs (multi-select drag)
 *   - `text/lcked-item`  → single ID string (classic single-item drag)
 * Returns an empty array if neither is present.
 */
export function parseDraggedIds(e: React.DragEvent): string[] {
  // Multi-select drag carries a JSON array of IDs.
  const multi = e.dataTransfer.getData("text/lcked-items");
  if (multi) {
    try {
      const parsed: unknown = JSON.parse(multi);
      if (
        Array.isArray(parsed) &&
        parsed.every((id): id is string => typeof id === "string")
      ) {
        return parsed;
      }
    } catch {
      // Malformed JSON — fall through to single-item.
    }
  }
  // Single-item drag.
  const single = e.dataTransfer.getData("text/lcked-item");
  return single ? [single] : [];
}

/** Signal the item-list to exit multi-select mode after a successful
 *  multi-select drop (the items have been moved/trashed/favorited). */
export function exitMultiSelect() {
  window.dispatchEvent(new CustomEvent("lcked:exit-multi-select"));
}
