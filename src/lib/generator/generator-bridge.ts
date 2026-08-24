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
 * Register (or clear with `null`) the generator callback. Called when a
 * password field opens the generator dialog — the callback receives the
 * generated password and inserts it into the source field.
 */
export function setGeneratorCallback(
  cb: ((password: string) => void) | null,
): void {
  _generatorCallback = cb;
}

/** Whether a source field is waiting for a generated password. */
export function hasGeneratorCallback(): boolean {
  return _generatorCallback !== null;
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
