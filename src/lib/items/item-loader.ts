/**
 * LCKED — Item Loader (load-time policy)
 * ---------------------------------------------------------------------------
 * Loads the vault's decrypted contents for a session: decrypt every stored
 * row with the Vault Key, migrate legacy records onto ITEM_DEFAULTS, purge
 * Trash past its TTL, and return the canonical sorted list.
 *
 * This is the one decrypt-migrate path — unlock, and any future export or
 * backup feature, must read items through here so the logic can't fork.
 *
 * Zustand-free by design, like item-crud: takes the Vault Key and touches
 * persistence directly; tests fake it by mocking the vault-db module.
 */

import { decryptJson } from "@/lib/crypto";
import {
  encryptAndPersist,
  ITEM_DEFAULTS,
  sortItems,
} from "@/lib/items/item-crud";
import type { VaultItem } from "@/lib/types";
import { deleteStoredItem, loadAllStoredItems } from "@/lib/vault/vault-db";

/** How long a trashed item survives before the next load purges it. */
const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Load the vault's decrypted contents: parallel-decrypt every stored row,
 * backfill legacy records (re-encrypting those), skip rows that no longer
 * decrypt, and purge Trash older than TRASH_TTL_MS best-effort. The expiry
 * check runs after backfill, so classification sees the migrated shape.
 * Returns items ordered most-recently-updated first.
 */
export async function loadDecryptedItems(
  vaultKey: CryptoKey,
): Promise<VaultItem[]> {
  const now = Date.now();
  const stored = await loadAllStoredItems();

  type Outcome =
    | { kind: "ok"; item: VaultItem; migrated: boolean }
    | { kind: "expired"; id: string }
    | { kind: "error"; id: string };

  const outcomes = await Promise.all(
    stored.map(async (s): Promise<Outcome> => {
      try {
        const item = await decryptJson<VaultItem>(s.ciphertext, s.iv, vaultKey);
        // Backfill every ITEM_DEFAULTS field the legacy record lacks, so a
        // default added there migrates automatically. True = re-encrypt.
        let migrated = false;
        for (const [field, value] of Object.entries(ITEM_DEFAULTS)) {
          if (item[field as keyof VaultItem] === undefined) {
            Object.assign(item, { [field]: value });
            migrated = true;
          }
        }
        if (
          item.trashed &&
          item.trashedAt &&
          now - item.trashedAt > TRASH_TTL_MS
        ) {
          return { kind: "expired", id: item.id };
        }
        return { kind: "ok", item, migrated };
      } catch {
        return { kind: "error", id: s.id };
      }
    }),
  );

  const items: VaultItem[] = [];
  const toReencrypt: VaultItem[] = [];
  for (const o of outcomes) {
    if (o.kind === "ok") {
      if (o.migrated) toReencrypt.push(o.item);
      items.push(o.item);
    } else if (o.kind === "expired") {
      try {
        await deleteStoredItem(o.id);
      } catch {
        /* best-effort */
      }
    }
  }
  // ponytail: bare Promise.all kept verbatim from the old unlock flow — one
  // failed persist aborts the load. Per-row tolerance is a behavior change;
  // own issue if ever wanted.
  if (toReencrypt.length > 0) {
    await Promise.all(toReencrypt.map((it) => encryptAndPersist(it, vaultKey)));
  }
  return sortItems(items);
}
