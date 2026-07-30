/**
 * LCKED — Item CRUD (patchItem / patchItems)
 * ---------------------------------------------------------------------------
 * Consolidates the encrypt-persist-update pattern so every store mutation
 * that modifies an item routes through one of these two functions instead of
 * duplicating the encryptJson / putStoredItem / sortState dance.
 *
 * Both functions handle the crypto + IndexedDB layer only — caller-owned
 * state updates (zustand set() + notifyVaultMutation) remain in the store
 * so this module has no dependency on zustand or the vault store.
 */

import { encryptJson } from "@/lib/crypto";
import { putStoredItem } from "@/lib/vault-db";
import type { VaultItem } from "@/lib/types";

/**
 * Patch a single item: merge `patch` into `item`, re-encrypt, persist to
 * IndexedDB, and return the updated record.  Does NOT update in-memory state.
 *
 * @param vaultKey  Decrypted vault CryptoKey (must be available).
 * @param item      Current decrypted item from in-memory state.
 * @param patch     Fields to merge (trashed, favorite, vaultIds, etc.).
 *                  `updatedAt` is always set to now — explicit in the patch
 *                  is accepted but overwritten.
 */
export async function patchItem(
  vaultKey: CryptoKey,
  item: VaultItem,
  patch: Partial<VaultItem>,
): Promise<VaultItem> {
  const now = Date.now();
  const updated: VaultItem = { ...item, ...patch, updatedAt: now } as VaultItem;

  const { ciphertext, iv } = await encryptJson(updated, vaultKey);
  await putStoredItem({
    id: updated.id,
    type: updated.type,
    ciphertext,
    iv,
    createdAt: updated.createdAt,
    updatedAt: now,
  });

  return updated;
}

/**
 * Patch multiple items in bulk using Promise.allSettled so a single
 * encryption / IDB failure never loses the rest.
 *
 * @param vaultKey  Decrypted vault CryptoKey.
 * @param items     Items to patch (pre-filtered to what actually needs work).
 * @param patchFn   Called per item with (item, index); should return the
 *                  partial fields to merge (or a full replacement).
 * @returns         `{ updated, failed }` — `updated` is the list of freshly
 *                  encrypted-and-persisted items; `failed` is the count of
 *                  items whose encrypt/persist rejected.
 */
export async function patchItems(
  vaultKey: CryptoKey,
  items: VaultItem[],
  patchFn: (item: VaultItem, index: number) => Partial<VaultItem>,
): Promise<{ updated: VaultItem[]; failed: number }> {
  const now = Date.now();
  const outcomes = await Promise.allSettled(
    items.map(async (item, i) => {
      const patch = patchFn(item, i);
      const updated: VaultItem = { ...item, ...patch, updatedAt: now } as VaultItem;
      const { ciphertext, iv } = await encryptJson(updated, vaultKey);
      await putStoredItem({
        id: updated.id,
        type: updated.type,
        ciphertext,
        iv,
        createdAt: updated.createdAt,
        updatedAt: now,
      });
      return updated;
    }),
  );

  const updated: VaultItem[] = [];
  let failed = 0;
  for (const o of outcomes) {
    if (o.status === "fulfilled") updated.push(o.value);
    else failed++;
  }
  return { updated, failed };
}
