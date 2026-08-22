/**
 * LCKED — Vault Container Manager
 * ---------------------------------------------------------------------------
 * Pure vault-container operations extracted from the Zustand store. No
 * zustand/React dependency. Each function reads/writes VaultMeta from
 * IndexedDB (via vault-db.ts) and handles item re-encryption for orphaned
 * items during vault delete.
 *
 * The caller (the store) applies returned state fragments via set() and
 * wires result to UI state (dialogs, notifications).
 */

import { randomId } from "@/lib/crypto";
import { loadVaultMeta, saveVaultMeta } from "@/lib/vault/vault-db";
import type { VaultDef, VaultItem } from "@/lib/types";
import { encryptAndPersist } from "@/lib/item-crud";

/* ─── Types ─────────────────────────────────────────────── */

export interface VaultMutation {
  vaults: VaultDef[];
  /** Items that were re-encrypted (e.g. orphaned items after vault delete). */
  updatedItems?: VaultItem[];
}

/* ─── Implementation ────────────────────────────────────── */

/**
 * Create a new vault container. Saves the updated vault list to IndexedDB.
 *
 * @param name  Display name (empty/whitespace trims to "Untitled vault").
 * @param color Vault color id (from VAULT_COLORS).
 * @param icon  Vault icon id (from VAULT_ICONS).
 * @returns     VaultMutation with the full vaults array.
 */
export async function createVault(
  name: string,
  color: string,
  icon: string,
): Promise<VaultMutation> {
  const meta = await loadVaultMeta();
  if (!meta) throw new Error("Vault meta missing");
  const vault: VaultDef = {
    id: randomId(),
    name: name.trim() || "Untitled vault",
    color,
    icon,
    createdAt: Date.now(),
  };
  const vaults = [...(meta.vaults ?? []), vault];
  await saveVaultMeta({ ...meta, vaults });
  return { vaults };
}

/**
 * Update an existing vault's mutable fields (name, color, icon).
 * No-op when no vault matches `id`.
 *
 * @param id    Vault id to patch.
 * @param patch Fields to merge (id and createdAt are excluded).
 * @returns     VaultMutation with the full vaults array.
 */
export async function updateVault(
  id: string,
  patch: Partial<Omit<VaultDef, "id" | "createdAt">>,
): Promise<VaultMutation> {
  const meta = await loadVaultMeta();
  if (!meta) return { vaults: [] };
  const vaults = (meta.vaults ?? []).map((v) =>
    v.id === id ? { ...v, ...patch, name: patch.name ?? v.name } : v,
  );
  await saveVaultMeta({ ...meta, vaults });
  return { vaults };
}

/**
 * Rename a vault. Thin wrapper over updateVault.
 *
 * @param id   Vault id to rename.
 * @param name New display name.
 */
export async function renameVault(
  id: string,
  name: string,
): Promise<VaultMutation> {
  return updateVault(id, { name });
}

/**
 * Delete a vault. Orphans any items that belonged to the deleted vault
 * (removes the vault id from each item's vaultIds and re-encrypts) before
 * committing the meta change. If orphaning fails, meta is NOT saved
 * (rollback).
 *
 * @param id       Vault id to delete.
 * @param vaultKey Decrypted vault CryptoKey (required for re-encryption).
 * @param items    Current in-memory items (used to find orphaned items).
 * @returns        VaultMutation with the updated vaults and re-encrypted items.
 */
export async function deleteVault(
  id: string,
  vaultKey: CryptoKey,
  items: VaultItem[],
): Promise<VaultMutation> {
  const meta = await loadVaultMeta();
  if (!meta) return { vaults: [] };

  const vaults = (meta.vaults ?? []).filter((v) => v.id !== id);
  const orphaned = items.filter((i) => i.vaultIds.includes(id));

  if (orphaned.length > 0) {
    const reencrypted = await Promise.all(
      orphaned.map(async (it) => {
        const next: VaultItem = {
          ...it,
          vaultIds: it.vaultIds.filter((v) => v !== id),
          updatedAt: Date.now(),
        } as VaultItem;
        await encryptAndPersist(next, vaultKey);
        return next;
      }),
    );
    await saveVaultMeta({ ...meta, vaults });
    return { vaults, updatedItems: reencrypted };
  }

  await saveVaultMeta({ ...meta, vaults });
  return { vaults };
}

/**
 * Reorder vaults (drag-and-drop in the organize dialog). Saves the exact
 * order given.
 *
 * @param newOrder The full vaults array in the desired display order.
 */
export async function reorderVaults(
  newOrder: VaultDef[],
): Promise<VaultMutation> {
  const meta = await loadVaultMeta();
  if (!meta) return { vaults: [] };
  await saveVaultMeta({ ...meta, vaults: newOrder });
  return { vaults: newOrder };
}
