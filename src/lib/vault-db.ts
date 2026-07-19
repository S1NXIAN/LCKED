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
export function getDB(): LckedDB {
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

export async function putStoredItem(item: StoredItem): Promise<void> {
  await getDB().items.put(item);
}

export async function deleteStoredItem(id: string): Promise<void> {
  await getDB().items.delete(id);
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

/** Approximate storage usage so we can warn before hitting quota. */
export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate();
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
  }
  return { usage: 0, quota: 0 };
}
