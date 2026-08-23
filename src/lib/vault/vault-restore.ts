/**
 * LCKED — Vault Restore Orchestration
 * ---------------------------------------------------------------------------
 * Collapses the setup screen's fragile 6-step restore sequence into a single
 * store-free function. The module imports the existing parsers and export
 * decryptor, and receives the store's actions as a small capability bundle —
 * so the choreography stays pure, readable and unit-testable.
 *
 * Guarantees:
 *   • Decryption happens BEFORE the main vault is created, so a wrong backup
 *     password returns `{ ok: false, reason: "wrong-password" }` and never
 *     leaves an empty vault behind.
 *   • Custom vaults are re-created first, then items are remapped through a
 *     pure name+color+icon match (unmatched ids are dropped) and saved
 *     best-effort — one failed write never aborts the rest.
 *   • The plain (non-encrypted) import path and the "no file, just create"
 *     path flow through the same entry point.
 */

import { importFromText, type LckedExport } from "@/lib/import";
import { toItemInput } from "@/lib/items/item-crud";
import type { NewItemInput, VaultDef, VaultItem } from "@/lib/types";
import { decryptLckedExport } from "@/lib/vault/vault-auth";

export type RestoreResult =
  | { ok: true; imported: number }
  | { ok: false; reason: "wrong-password" | "invalid-file" };

/** The store's actions the restore choreography depends on. */
export interface RestoreDeps {
  /** Set up the main vault (the encrypted vault envelope). */
  setupVault: (masterPassword: string) => Promise<void>;
  /** Create a custom vault container; resolves with the newly-created vault. */
  createCustomVault: (
    name: string,
    color: string,
    icon: string,
  ) => Promise<VaultDef>;
  /** Save one item (encrypt + persist). Rejects on failure. */
  saveItem: (input: NewItemInput) => Promise<unknown>;
  /** Import parsed items from a plain (non-encrypted) file. */
  importItems: (
    filename: string,
    text: string,
  ) => Promise<{ imported: number }>;
}

export interface RestoreOptions {
  masterPassword: string;
  filename: string;
  fileText: string | null;
  deps: RestoreDeps;
}

/** Match the backup's vaults to the freshly-created ones by name+color+icon.
 *  Returns the old-id → new-id map. Unmatched ids are dropped at remap time.
 *
 *  Fresh vaults are CONSUMED on match, so two old vaults that share a
 *  name+color+icon triple (duplicate vaults are allowed) map to DISTINCT fresh
 *  vaults — a plain find() would collapse both onto the first match, silently
 *  merging the second vault's items into the first and leaving its fresh vault
 *  empty. */
export function buildVaultIdMap(
  oldVaults: VaultDef[],
  newVaults: VaultDef[],
): Map<string, string> {
  const map = new Map<string, string>();
  const pool = new Map<string, VaultDef[]>();
  for (const nv of newVaults) {
    const key = `${nv.name}\u0000${nv.color}\u0000${nv.icon}`;
    const list = pool.get(key);
    if (list) list.push(nv);
    else pool.set(key, [nv]);
  }
  for (const oldV of oldVaults) {
    const key = `${oldV.name}\u0000${oldV.color}\u0000${oldV.icon}`;
    const fresh = pool.get(key)?.shift();
    if (fresh) map.set(oldV.id, fresh.id);
  }
  return map;
}

/** Remap an item's vault memberships through the old→new id map. */
export function remapVaultIds(
  vaultIds: string[] | undefined,
  map: Map<string, string>,
): string[] {
  return (vaultIds ?? [])
    .map((oldId) => map.get(oldId))
    .filter((id): id is string => Boolean(id));
}

/** Consolidated restore entry point used by the setup screen. */
export async function restoreVault(
  options: RestoreOptions,
): Promise<RestoreResult> {
  const { masterPassword, filename, fileText, deps } = options;

  // Decrypt BEFORE creating anything: a wrong backup password must never
  // leave an empty vault behind (user story 2). A damaged/foreign file is
  // reported separately from a wrong password.
  let decrypted: { items: VaultItem[]; vaults: VaultDef[] } | null = null;
  let isLckedExport = false;
  if (fileText) {
    const parsed = importFromText(filename, fileText);
    if (parsed.result.format === "lcked-json") {
      isLckedExport = true;
      // format === "lcked-json" guarantees the parser validated the
      // envelope's shape; the decryptor re-checks everything downstream.
      const result = await decryptLckedExport(
        parsed.result.raw as LckedExport,
        masterPassword,
      );
      if (!result.ok) {
        return {
          ok: false,
          reason:
            result.reason === "wrong-password"
              ? "wrong-password"
              : "invalid-file",
        };
      }
      decrypted = result;
    }
  }

  // Create the main vault before importing anything (user story 6).
  await deps.setupVault(masterPassword);

  if (isLckedExport && decrypted) {
    const { items, vaults } = decrypted;
    // Re-create custom vaults, collecting the fresh ids from the capability's
    // return values — no reach into store state mid-sequence.
    const createdVaults: VaultDef[] = [];
    for (const v of vaults) {
      try {
        createdVaults.push(
          await deps.createCustomVault(v.name, v.color, v.icon),
        );
      } catch {
        // Best-effort — a failed container must not abort the restore. The
        // vault is then absent from the id-map, so its items' memberships are
        // dropped; log it rather than dropping silently.
        console.warn(`restoreVault: could not re-create vault "${v.name}"`);
      }
    }
    const map = buildVaultIdMap(vaults, createdVaults);
    let imported = 0;
    for (const item of items) {
      try {
        await deps.saveItem({
          ...toItemInput(item),
          // Preserve the backup's original timestamps — a restored vault keeps
          // its created/updated history (writeItem honors these overrides).
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          vaultIds: remapVaultIds(item.vaultIds, map),
          trashed: false,
          trashedAt: null,
        });
        imported++;
      } catch {
        /* best-effort per item — one bad row must not lose the rest (user story 7) */
      }
    }
    return { ok: true, imported };
  }

  if (fileText) {
    const result = await deps.importItems(filename, fileText);
    return { ok: true, imported: result.imported };
  }

  return { ok: true, imported: 0 };
}
