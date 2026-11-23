/**
 * LCKED — cross-tab Vault coordination
 * ---------------------------------------------------------------------------
 * Tabs holding the same Vault share one lock state over BroadcastChannel.
 * There is no server and no persisted key material: a tab that locks or
 * resets announces it, and every other open tab drops its in-memory keys.
 */

export type VaultSyncEvent = "lock" | "reset";

const CHANNEL_NAME = "lcked-vault";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/** Announce a lock/reset to the other tabs. */
export function broadcastVaultEvent(type: VaultSyncEvent): void {
  getChannel()?.postMessage({ type });
}

/**
 * Subscribe to lock/reset events from other tabs. Returns an unsubscribe
 * function; without BroadcastChannel support this is a no-op subscription.
 */
export function onVaultSync(
  handler: (event: VaultSyncEvent) => void,
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (event: MessageEvent<{ type?: VaultSyncEvent }>) => {
    const type = event.data?.type;
    if (type === "lock" || type === "reset") handler(type);
  };
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}
