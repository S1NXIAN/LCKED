/**
 * LCKED — IndexedDB persistence via Dexie
 * ---------------------------------------------------------------------------
 * Two object stores:
 *   • meta   — single row holding salt, wrapped vault key, verifier, settings.
 *   • items  — one row per vault item, storing only ciphertext + timestamps.
 *
 * No plaintext ever lives here. If IndexedDB is unavailable or corrupt, the
 * UI offers a destructive "reset vault" path with explicit confirmation.
 */

import Dexie, { type Table } from "dexie";

import type { StoredItem, VaultMeta } from "@/lib/types";

export class LckedDB extends Dexie {
  meta!: Table<VaultMeta, "singleton">;
  items!: Table<StoredItem, string>;

  constructor() {
    super("lcked-vault");
    this.version(1).stores({
      // `&` = primary key; only index what we actually query by.
      meta: "&id",
      items: "&id, type, updatedAt, createdAt",
    });
  }
}

let _db: LckedDB | null = null;

/**
 * Lazily instantiate the DB. The vault code only ever runs in the browser
 * (all entry points are client components), so `indexedDB` is available.
 */
function getDB(): LckedDB {
  if (_db) return _db;
  _db = new LckedDB();
  return _db;
}

/** True if a vault has been initialised (meta row exists). */
export async function vaultExists(): Promise<boolean> {
  const db = getDB();
  const count = await db.meta.count();
  return count > 0;
}

export async function loadVaultMeta(): Promise<VaultMeta | undefined> {
  return getDB().meta.get("singleton");
}

export async function saveVaultMeta(meta: VaultMeta): Promise<void> {
  await getDB().meta.put(meta);
}

export async function loadAllStoredItems(): Promise<StoredItem[]> {
  return getDB().items.toArray();
}

/**
 * Which of these ids still have a stored row? Item mutations use it to
 * revalidate against IndexedDB, so a tab whose state outlived a deletion in
 * another tab refuses to write the deleted Item back.
 */
export async function existingStoredIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await getDB().items.bulkGet(ids);
  return new Set(
    rows.filter((row): row is StoredItem => Boolean(row)).map((row) => row.id),
  );
}

export async function putStoredItem(item: StoredItem): Promise<void> {
  await getDB().items.put(item);
}

export async function deleteStoredItem(id: string): Promise<void> {
  await getDB().items.delete(id);
}

/**
 * Commit a custom-vault deletion in one transaction: the re-encrypted item
 * rows and the Vault metadata land together, so a failure leaves both stores
 * untouched. Used by vault-manager.deleteVault.
 */
export async function writeVaultDeletion(
  meta: VaultMeta,
  items: StoredItem[],
): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.meta, db.items, async () => {
    await db.items.bulkPut(items);
    await db.meta.put(meta);
  });
}

/**
 * Nuclear option: wipe the entire vault. Used only when the user explicitly
 * confirms a reset (e.g. after forgetting the master password).
 */
export async function wipeVault(): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.meta, db.items, async () => {
    await db.meta.clear();
    await db.items.clear();
  });
}
