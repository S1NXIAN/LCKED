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

import { encryptJson, randomId } from "@/lib/crypto";
import { putStoredItem } from "@/lib/vault-db";
import type { NewItemInput, VaultItem } from "@/lib/types";

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
 * @param patchFn   Called per item; should return the partial fields to merge.
 * @returns         `{ updated, failed }` — `updated` is the list of freshly
 *                  encrypted-and-persisted items; `failed` is the count of
 *                  items whose encrypt/persist rejected.
 */
export async function patchItems(
  vaultKey: CryptoKey,
  items: VaultItem[],
  patchFn: (item: VaultItem) => Partial<VaultItem>,
): Promise<{ updated: VaultItem[]; failed: number }> {
  const now = Date.now();
  const outcomes = await Promise.allSettled(
    items.map(async (item, i) => {
      const patch = patchFn(item);
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

/**
 * Create or fully update a single item: build the VaultItem, inherit
 * existing-appropriate defaults (trashed state, vaultIds, createdAt),
 * apply caller overrides, encrypt, persist to IndexedDB, and return.
 *
 * @param vaultKey  Decrypted vault CryptoKey.
 * @param input     Desired item fields (NewItemInput or partial VaultItem).
 * @param existing  If present, inherit trashed/trashedAt/vaultIds/createdAt
 *                  from this item. Overrides in `input` win after inheritance.
 */
export async function writeItem(
  vaultKey: CryptoKey,
  input: NewItemInput,
  existing?: VaultItem,
): Promise<VaultItem> {
  const now = Date.now();

  if (existing) {
    const item: VaultItem = {
      ...(input as VaultItem),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
      trashed: input.trashed !== undefined ? input.trashed : existing.trashed,
      trashedAt: input.trashedAt !== undefined ? input.trashedAt : existing.trashedAt,
      vaultIds: input.vaultIds ?? existing.vaultIds,
    } as VaultItem;

    const { ciphertext, iv } = await encryptJson(item, vaultKey);
    await putStoredItem({
      id: item.id,
      type: item.type,
      ciphertext,
      iv,
      createdAt: item.createdAt,
      updatedAt: now,
    });

    return item;
  }

  const item: VaultItem = {
    ...(input as VaultItem),
    id: randomId(),
    createdAt: now,
    updatedAt: now,
    trashed: false,
    trashedAt: null,
    vaultIds: (input as VaultItem).vaultIds ?? [],
  } as VaultItem;

  const { ciphertext, iv } = await encryptJson(item, vaultKey);
  await putStoredItem({
    id: item.id,
    type: item.type,
    ciphertext,
    iv,
    createdAt: item.createdAt,
    updatedAt: now,
  });

  return item;
}

/**
 * Batch-create items with partial-failure resilience.
 * Each item is encrypted and persisted independently via allSettled.
 *
 * @param vaultKey  Decrypted vault CryptoKey.
 * @param items     Raw parsed items (no IDs/timestamps yet).
 * @returns         `{ succeeded, failed }` — succeeded are the fully-built
 *                  VaultItem instances (with id, createdAt, updatedAt set).
 */
export async function writeItems(
  vaultKey: CryptoKey,
  items: NewItemInput[],
): Promise<{ succeeded: VaultItem[]; failed: number }> {
  if (items.length === 0) return { succeeded: [], failed: 0 };

  const now = Date.now();
  const built: VaultItem[] = items.map((input) => ({
    ...(input as VaultItem),
    id: randomId(),
    createdAt: now,
    updatedAt: now,
    trashed: false,
    trashedAt: null,
    vaultIds: (input as VaultItem).vaultIds ?? [],
  })) as VaultItem[];

  const outcomes = await Promise.allSettled(
    built.map(async (item) => {
      const { ciphertext, iv } = await encryptJson(item, vaultKey);
      await putStoredItem({
        id: item.id,
        type: item.type,
        ciphertext,
        iv,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
      return item;
    }),
  );

  const succeeded: VaultItem[] = [];
  let failed = 0;
  for (const o of outcomes) {
    if (o.status === "fulfilled") succeeded.push(o.value);
    else failed++;
  }

  return { succeeded, failed };
}
