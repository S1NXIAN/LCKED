/**
 * Keyboard cursor for the vault item listbox. Returns the index the cursor
 * should move to, or null when the key does not navigate. `current` is -1
 * when no option is active yet.
 */
export function nextOptionIndex(
  key: string,
  current: number,
  count: number,
): number | null {
  if (count === 0) return null;
  switch (key) {
    case "ArrowDown":
      return current < 0 ? 0 : Math.min(current + 1, count - 1);
    case "ArrowUp":
      return current < 0 ? count - 1 : Math.max(current - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
