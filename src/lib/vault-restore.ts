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

import { decryptLckedExport } from "@/lib/vault-auth";
import { importFromText } from "@/lib/import-export";
import { toItemInput } from "@/lib/item-crud";
import type { NewItemInput, VaultDef } from "@/lib/types";

export type RestoreResult =
  | { ok: true; imported: number }
  | { ok: false; reason: "wrong-password" };

/** The store's actions the restore choreography depends on. */
export interface RestoreDeps {
  /** Set up the main vault (the encrypted vault envelope). */
  setupVault: (masterPassword: string) => Promise<void>;
  /** Create a custom vault container; resolves with the newly-created vault. */
  createCustomVault: (name: string, color: string, icon: string) => Promise<VaultDef>;
  /** Save one item (encrypt + persist). Rejects on failure. */
  saveItem: (input: NewItemInput) => Promise<unknown>;
  /** Import parsed items from a plain (non-encrypted) file. */
  importItems: (filename: string, text: string) => Promise<{ imported: number }>;
}

export interface RestoreOptions {
  masterPassword: string;
  filename: string;
  fileText: string | null;
  deps: RestoreDeps;
}

/** Match the backup's vaults to the freshly-created ones by name+color+icon.
 *  Returns the old-id → new-id map. Unmatched ids are dropped at remap time. */
export function buildVaultIdMap(
  oldVaults: VaultDef[],
  newVaults: VaultDef[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const oldV of oldVaults) {
    const newV = newVaults.find(
      (nv) => nv.name === oldV.name && nv.color === oldV.color && nv.icon === oldV.icon,
    );
    if (newV) map.set(oldV.id, newV.id);
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
export async function restoreVault(options: RestoreOptions): Promise<RestoreResult> {
  const { masterPassword, filename, fileText, deps } = options;

  // Decrypt BEFORE creating anything: a wrong backup password must never
  // leave an empty vault behind (user story 2).
  let decrypted: Awaited<ReturnType<typeof decryptLckedExport>> = null;
  let isLckedExport = false;
  if (fileText) {
    const parsed = importFromText(filename, fileText);
    if (parsed.result.format === "lcked-json") {
      isLckedExport = true;
      decrypted = await decryptLckedExport(parsed.result.raw, masterPassword);
      if (!decrypted) return { ok: false, reason: "wrong-password" };
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
        createdVaults.push(await deps.createCustomVault(v.name, v.color, v.icon));
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
