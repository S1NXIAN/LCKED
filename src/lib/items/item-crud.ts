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
import type { NewItemInput, VaultItem } from "@/lib/types";
import { putStoredItem } from "@/lib/vault/vault-db";

/* ─── Item policy primitives ────────────────────────────── */

/**
 * Canonical defaults for a brand-new item. The single source of truth for
 * the fields every empty item shares; both new-item creation and legacy-item
 * migration reference it so the two can't drift. Timestamps are deliberately
 * absent — they're always stamped fresh at write time.
 *
 * Frozen: the arrays are shared by reference into every item that inherits
 * the defaults, so a future in-place mutation must crash loudly at the
 * mutation site instead of silently corrupting every item in the vault.
 */
export const ITEM_DEFAULTS = Object.freeze({
  favorite: false,
  pinned: false,
  folder: "",
  customFields: Object.freeze([]) as unknown as VaultItem["customFields"],
  vaultIds: Object.freeze([]) as unknown as string[],
  trashed: false,
  trashedAt: null,
});

/** Order items by most-recently-updated. The one sort every list uses. */
export function sortItems(items: VaultItem[]): VaultItem[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Downgrade a stored item to a NewItemInput — drops id + timestamps only. */
export function toItemInput(item: VaultItem): NewItemInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = item;
  return rest;
}

/**
 * Encrypt an item and persist the ciphertext to IndexedDB. The shared body
 * behind every item write (create, patch, bulk patch, migration, re-encrypt).
 */
export async function encryptAndPersist(
  item: VaultItem,
  vaultKey: CryptoKey,
): Promise<void> {
  const { ciphertext, iv } = await encryptJson(item, vaultKey);
  await putStoredItem({
    id: item.id,
    type: item.type,
    ciphertext,
    iv,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  });
}

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

  await encryptAndPersist(updated, vaultKey);

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
    items.map(async (item, _i) => {
      const patch = patchFn(item);
      const updated: VaultItem = {
        ...item,
        ...patch,
        updatedAt: now,
      } as VaultItem;
      await encryptAndPersist(updated, vaultKey);
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
 *                  On create, `createdAt`/`updatedAt` are restore-only
 *                  overrides: present → preserved, absent → stamped now.
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
      trashedAt:
        input.trashedAt !== undefined ? input.trashedAt : existing.trashedAt,
      vaultIds: input.vaultIds ?? existing.vaultIds,
    };

    await encryptAndPersist(item, vaultKey);
    return item;
  }

  const item: VaultItem = {
    ...ITEM_DEFAULTS,
    ...(input as VaultItem),
    id: randomId(),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    // Create always starts as an active, untrashed item: input may not sneak
    // in trashed state or a `vaultIds: undefined` that would crash the list
    // (`item.vaultIds.includes`). Real membership arrays survive.
    trashed: ITEM_DEFAULTS.trashed,
    trashedAt: ITEM_DEFAULTS.trashedAt,
    vaultIds: (input as VaultItem).vaultIds ?? ITEM_DEFAULTS.vaultIds,
  };

  await encryptAndPersist(item, vaultKey);
  return item;
}

/**
 * Batch-create items with partial-failure resilience.
 * Each item is encrypted and persisted independently via allSettled.
 *
 * @param vaultKey  Decrypted vault CryptoKey.
 * @param items     Raw parsed items (no IDs; timestamps, if any, are
 *                  deliberately discarded — every import is stamped fresh).
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
    ...ITEM_DEFAULTS,
    ...(input as VaultItem),
    id: randomId(),
    createdAt: now,
    updatedAt: now,
    trashed: ITEM_DEFAULTS.trashed,
    trashedAt: ITEM_DEFAULTS.trashedAt,
    vaultIds: (input as VaultItem).vaultIds ?? ITEM_DEFAULTS.vaultIds,
  }));

  const outcomes = await Promise.allSettled(
    built.map(async (item) => {
      await encryptAndPersist(item, vaultKey);
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
