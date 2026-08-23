/**
 * LCKED — Generator bridge
 * ---------------------------------------------------------------------------
 * Holds a one-shot callback used by the password-generator sidebar. When the
 * user clicks the dice button in a password field, a callback is registered
 * here. Clicking "Use this password" in the generator consumes the callback
 * and inserts the password into the originating field.
 *
 * Extracted from the vault store so the generator dialog doesn't depend on
 * the store for this simple callback plumbing.
 */

/** The module-level callback reference (never persisted). */
let _generatorCallback: ((password: string) => void) | null = null;

/**
 * Register (or clear) the generator callback. Called when a password field
 * opens the generator dialog — the callback receives the generated password
 * and inserts it into the source field.
 */
export function setGeneratorCallback(
  cb: ((password: string) => void) | null,
): void {
  _generatorCallback = cb;
}

/** Read the current callback without consuming it (e.g. to check if one is set). */
export function getGeneratorCallback(): ((password: string) => void) | null {
  return _generatorCallback;
}

/**
 * Fire the registered callback with the generated password, then clear it.
 * Returns `true` if a callback was fired, `false` if none was registered.
 */
export function consumeGeneratorCallback(password: string): boolean {
  if (_generatorCallback) {
    _generatorCallback(password);
    _generatorCallback = null;
    return true;
  }
  return false;
}

/**
 * Clear the callback WITHOUT firing it. Used when the generator dialog is
 * closed without clicking "Use this password" — so closing does NOT wipe the
 * source field with an empty string (D-1).
 */
export function clearGeneratorCallback(): void {
  _generatorCallback = null;
}
