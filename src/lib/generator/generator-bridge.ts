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

/** Components subscribed to pending-callback changes (the Generator panel). */
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Subscribe to callback changes. The Generator panel uses this through
 * `useSyncExternalStore` so an open sheet swaps between Copy and
 * "Use this password" as soon as the source field opens or closes.
 */
export function subscribeGeneratorCallback(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Register (or clear with `null`) the generator callback. Called when a
 * password field opens the generator dialog — the callback receives the
 * generated password and inserts it into the source field.
 */
export function setGeneratorCallback(
  cb: ((password: string) => void) | null,
): void {
  if (_generatorCallback === cb) return;
  _generatorCallback = cb;
  emit();
}

/** Whether a source field is waiting for a generated password. */
export function hasGeneratorCallback(): boolean {
  return _generatorCallback !== null;
}

/**
 * Clear `cb` only if it is still the registered callback. A PasswordField
 * calls this from its unmount cleanup so a closed field never leaves a dead
 * "Use this password" action behind, while a newer field's callback survives.
 */
export function clearGeneratorCallback(cb: (password: string) => void): void {
  if (_generatorCallback === cb) {
    _generatorCallback = null;
    emit();
  }
}

/**
 * Fire the registered callback with the generated password, then clear it.
 * Returns `true` if a callback was fired, `false` if none was registered.
 */
export function consumeGeneratorCallback(password: string): boolean {
  if (_generatorCallback) {
    _generatorCallback(password);
    _generatorCallback = null;
    emit();
    return true;
  }
  return false;
}
