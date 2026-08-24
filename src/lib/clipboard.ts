/**
 * LCKED — Clipboard auto-clear
 * ---------------------------------------------------------------------------
 * Sensible-value clipboard helpers with automatic timed clearing. Copied
 * passwords, TOTP codes, and other secrets are wiped from the system
 * clipboard after a configurable timeout (default 30s).
 */

/** Map of named clipboard timers, keyed so multiple callers can each manage
 *  their own auto-clear lifecycle independently. */
const clipboardTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Copy a value to the system clipboard and schedule an automatic clear after
 * `clearMs` milliseconds. Calling `copyWithAutoClear` with the same `key`
 * cancels the prior timer for that key (prevents stale clear callbacks).
 */
export async function copyWithAutoClear(
  value: string,
  key = "default",
  clearMs = 30_000,
): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard API unavailable");
  }
  await navigator.clipboard.writeText(value);
  // Clear any prior timer for this key.
  const prior = clipboardTimers.get(key);
  if (prior) clearTimeout(prior);
  const clearIfUnchanged = async () => {
    try {
      const current = await navigator.clipboard.readText().catch(() => "");
      if (current === value) {
        await navigator.clipboard.writeText("");
      }
    } catch {
      // readText may be denied — best-effort clear.
    }
    clipboardTimers.delete(key);
  };
  const timer = setTimeout(() => void clearIfUnchanged(), clearMs);
  clipboardTimers.set(key, timer);
}

/** Clear ALL pending clipboard auto-clear timers + wipe the clipboard if it
 *  still holds a value we copied. Called from `lock()` so a password copied
 *  just before locking doesn't linger for up to 30s. */
export function clearAllClipboardTimers(): void {
  for (const t of clipboardTimers.values()) clearTimeout(t);
  clipboardTimers.clear();
  // Best-effort clipboard wipe.
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText("").catch(() => {});
  }
}
