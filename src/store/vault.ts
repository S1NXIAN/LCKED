/**
 * LCKED — Vault store (Zustand)
 * ---------------------------------------------------------------------------
 * Owns the auth state machine + every vault mutation. CryptoKey objects live
 * only in memory here — they are NEVER persisted. All async actions are
 * fault-tolerant: a failed IndexedDB write reverts the optimistic UI change.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { clearAllClipboardTimers } from "@/lib/clipboard";
import { exportToCsv, importFromText } from "@/lib/import";
import {
  patchItem,
  patchItems,
  sortItems,
  toItemInput,
  writeItem,
  writeItems,
} from "@/lib/items/item-crud";
import {
  DEFAULT_VAULT_SETTINGS,
  type GeneratorOptions,
  type ImportResult,
  type NewItemInput,
  type VaultDef,
  type VaultItem,
  type VaultSettings,
} from "@/lib/types";
import {
  changeMasterPassword as changeMasterPasswordAuth,
  clearSession,
  createVault,
  exportEncrypted as exportEncryptedPayload,
  unlockVault,
} from "@/lib/vault/vault-auth";
import {
  deleteStoredItem,
  loadVaultMeta,
  saveVaultMeta,
  vaultExists,
  wipeVault,
} from "@/lib/vault/vault-db";
import * as vaultManager from "@/lib/vault/vault-manager";
import type { RestoreResult } from "@/lib/vault/vault-restore";
import * as vaultRestore from "@/lib/vault/vault-restore";

export type VaultStatus = "loading" | "setup" | "locked" | "unlocked";

interface VaultState {
  status: VaultStatus;
  items: VaultItem[];
  /** User-defined vaults (colored containers, Proton Pass–style). */
  vaults: VaultDef[];
  /** Active vault filter: "all" | "trash" | vault id. */
  activeVault: string;
  /** Vault editor (create/rename/delete vault) dialog state. */
  vaultEditorOpen: boolean;
  editingVaultId: string | null;
  createVaultDialogOpen: boolean;
  settings: VaultSettings;
  /** UI-only selection / filter state (not persisted). */
  selectedId: string | null;
  searchQuery: string;
  /** CryptoKey handles — held in memory only while unlocked. */
  masterKey: CryptoKey | null;
  vaultKey: CryptoKey | null;
  /** Whether the active editor is open (and which item, if editing). */
  editorOpen: boolean;
  editorItemId: string | null;
  generatorOpen: boolean;
  importExportOpen: boolean;
  settingsOpen: boolean;

  // lifecycle
  init: () => Promise<void>;
  setupVault: (masterPassword: string) => Promise<void>;
  unlock: (masterPassword: string) => Promise<boolean>;
  lock: () => void;
  resetVault: () => Promise<void>;

  // item CRUD
  saveItem: (input: NewItemInput, existingId?: string) => Promise<VaultItem>;
  /** Soft-delete — moves the item to Trash with a 30-day TTL. */
  trashItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  permanentlyDeleteItem: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  restoreAllTrash: () => Promise<{ restored: number; failed: number }>;
  toggleFavorite: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  /** Unfavorite ALL favorited items at once. */
  clearFavorites: () => Promise<{ cleared: number; failed: number }>;
  /** Replace vault memberships for multiple items (drag-and-drop move). */
  moveItemsToVault: (
    itemIds: string[],
    vaultId: string | null,
  ) => Promise<{ moved: number; failed: number }>;
  trashItems: (itemIds: string[]) => Promise<{ moved: number; failed: number }>;
  /** Restore the selected trashed items (bulk counterpart of restoreItem). */
  restoreItems: (
    itemIds: string[],
  ) => Promise<{ restored: number; failed: number }>;
  /** Permanently delete the selected items (bulk counterpart of permanentlyDeleteItem). */
  permanentlyDeleteItems: (
    itemIds: string[],
  ) => Promise<{ deleted: number; failed: number }>;
  duplicateItem: (id: string) => Promise<void>;
  /** Duplicate an item into a specific vault. The copy is a fully independent
   *  record (new ID) assigned to the target vault — deleting the original or
   *  the copy does NOT affect the other. Replaces the old "add to vault"
   *  membership approach which symlinked one item across vaults. */
  copyItemToVault: (itemId: string, vaultId: string) => Promise<void>;
  importItems: (filename: string, text: string) => Promise<ImportResult>;
  /** Restore an LCKED backup (or plain import) during setup. See vault-restore.ts. */
  restoreVault: (params: {
    masterPassword: string;
    filename: string;
    fileText: string | null;
  }) => Promise<RestoreResult>;

  // vault (custom containers) CRUD
  createVault: (name: string, color: string, icon: string) => Promise<VaultDef>;
  deleteVault: (id: string) => Promise<void>;
  renameVault: (id: string, name: string) => Promise<void>;
  updateVault: (
    id: string,
    patch: Partial<Omit<VaultDef, "id" | "createdAt">>,
  ) => Promise<void>;
  /** Reorder vaults (drag-and-drop in the organize dialog). */
  reorderVaults: (newOrder: VaultDef[]) => Promise<void>;
  setActiveVault: (v: string) => void;
  setVaultEditorOpen: (open: boolean, vaultId?: string | null) => void;
  setCreateVaultDialogOpen: (open: boolean) => void;

  // settings
  updateSettings: (patch: Partial<VaultSettings>) => Promise<void>;
  updateGenerator: (patch: Partial<GeneratorOptions>) => void;
  changeMasterPassword: (current: string, next: string) => Promise<boolean>;

  // export
  exportEncrypted: (password: string) => Promise<string>;
  exportCsv: () => string;

  // UI helpers
  setSelected: (id: string | null) => void;
  setSearch: (q: string) => void;
  setEditorOpen: (open: boolean, itemId?: string | null) => void;
  setGeneratorOpen: (open: boolean) => void;
  setImportExportOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useVault = create<VaultState>()(
  persist(
    (set, get) => {
      const applyItems = (updated: VaultItem[]) => {
        if (updated.length === 0) return;
        set((state) => {
          const updatedMap = new Map(updated.map((u) => [u.id, u]));
          return {
            items: sortItems(state.items.map((i) => updatedMap.get(i.id) ?? i)),
          };
        });
      };
      return {
        status: "loading",
        items: [],
        vaults: [],
        activeVault: "all",
        vaultEditorOpen: false,
        editingVaultId: null,
        createVaultDialogOpen: false,
        settings: DEFAULT_VAULT_SETTINGS,
        selectedId: null,
        searchQuery: "",
        masterKey: null,
        vaultKey: null,
        editorOpen: false,
        editorItemId: null,
        generatorOpen: false,
        importExportOpen: false,
        settingsOpen: false,

        /* ------------------------------ lifecycle ------------------------------ */

        init: async () => {
          try {
            if (typeof window === "undefined") return;
            const exists = await vaultExists();
            set({ status: exists ? "locked" : "setup" });
          } catch (err) {
            console.error("init failed", err);
            set({ status: "setup" });
          }
        },

        setupVault: async (masterPassword) => {
          const result = await createVault(masterPassword);
          set({
            status: "unlocked",
            masterKey: result.masterKey,
            vaultKey: result.vaultKey,
            settings: result.settings,
            items: result.items,
            vaults: result.vaults,
            activeVault: "all",
            selectedId: null,
          });
        },

        unlock: async (masterPassword) => {
          const result = await unlockVault(masterPassword);
          if (!result.ok) return false;
          set({
            status: "unlocked",
            masterKey: result.masterKey,
            vaultKey: result.vaultKey,
            items: result.items,
            vaults: result.vaults,
            activeVault: "all",
            settings: result.settings,
            selectedId: null,
          });
          return true;
        },

        lock: () => {
          clearAllClipboardTimers();
          const session = clearSession();
          set({
            ...session,
            status: "locked",
            items: [],
            vaults: [],
            activeVault: "all",
            selectedId: null,
            searchQuery: "",
            editorOpen: false,
            generatorOpen: false,
            settingsOpen: false,
            importExportOpen: false,
            vaultEditorOpen: false,
            editingVaultId: null,
            createVaultDialogOpen: false,
          });
        },

        resetVault: async () => {
          clearAllClipboardTimers();
          await wipeVault();
          const session = clearSession();
          set({
            ...session,
            status: "setup",
            items: [],
            vaults: [],
            activeVault: "all",
            selectedId: null,
            settings: DEFAULT_VAULT_SETTINGS,
            editorOpen: false,
            generatorOpen: false,
            settingsOpen: false,
            importExportOpen: false,
            vaultEditorOpen: false,
            editingVaultId: null,
            createVaultDialogOpen: false,
          });
        },

        /* ------------------------------- CRUD -------------------------------- */

        saveItem: async (input, existingId) => {
          const { vaultKey } = get();
          if (!vaultKey) throw new Error("Vault is locked");

          const existing = existingId
            ? get().items.find((i) => i.id === existingId)
            : undefined;
          const item = await writeItem(vaultKey, input, existing);

          set((state) => {
            const others = state.items.filter((i) => i.id !== item.id);
            const next = sortItems([item, ...others]);
            return { items: next, selectedId: item.id };
          });
          return item;
        },

        /**
         * Soft-delete: marks the item as trashed and stamps trashedAt. The record
         * stays in IndexedDB (still encrypted) so it can be restored. Auto-purged
         * 30 days later on the next unlock.
         */
        trashItem: async (id) => {
          const { vaultKey } = get();
          if (!vaultKey) throw new Error("Vault is locked");
          const item = get().items.find((i) => i.id === id);
          if (!item) return;
          const updated = await patchItem(vaultKey, item, {
            trashed: true,
            trashedAt: Date.now(),
          });
          applyItems([updated]);
        },

        restoreItem: async (id) => {
          const { vaultKey } = get();
          if (!vaultKey) throw new Error("Vault is locked");
          const item = get().items.find((i) => i.id === id);
          if (!item) return;
          const updated = await patchItem(vaultKey, item, {
            trashed: false,
            trashedAt: null,
          });
          applyItems([updated]);
        },

        permanentlyDeleteItem: async (id) => {
          const prev = get().items;
          set((state) => ({
            items: state.items.filter((i) => i.id !== id),
            selectedId: state.selectedId === id ? null : state.selectedId,
          }));
          try {
            await deleteStoredItem(id);
          } catch (err) {
            console.error("permanent delete failed", err);
            set({ items: prev });
            throw err;
          }
        },

        emptyTrash: async () => {
          const trashed = get().items.filter((i) => i.trashed);
          const prev = get().items;
          // Optimistic: drop all trashed items from UI.
          set((state) => ({
            items: state.items.filter((i) => !i.trashed),
            selectedId:
              state.selectedId && trashed.some((t) => t.id === state.selectedId)
                ? null
                : state.selectedId,
          }));
          // Use allSettled so a single failure doesn't lose the others. Restore
          // only the items that actually failed to delete from IDB.
          const outcomes = await Promise.allSettled(
            trashed.map((t) => deleteStoredItem(t.id)),
          );
          const failedIds = new Set(
            trashed
              .filter((_, i) => outcomes[i].status === "rejected")
              .map((t) => t.id),
          );
          if (failedIds.size > 0) {
            set((state) => ({
              items: sortItems([
                ...state.items,
                ...prev.filter((i) => failedIds.has(i.id)),
              ]),
            }));
            throw new Error(`Could not delete ${failedIds.size} item(s)`);
          }
        },

        restoreAllTrash: async () => {
          const { vaultKey } = get();
          if (!vaultKey) throw new Error("Vault is locked");
          const trashed = get().items.filter((i) => i.trashed);
          if (trashed.length === 0) return { restored: 0, failed: 0 };
          const { updated, failed } = await patchItems(
            vaultKey,
            trashed,
            () => ({ trashed: false, trashedAt: null }),
          );
          applyItems(updated);
          return { restored: updated.length, failed };
        },

        toggleFavorite: async (id) => {
          const { vaultKey } = get();
          if (!vaultKey) throw new Error("Vault is locked");
          const currentItem = get().items.find((i) => i.id === id);
          if (!currentItem) return;
          const updated = await patchItem(vaultKey, currentItem, {
            favorite: !currentItem.favorite,
          });
          applyItems([updated]);
        },

        togglePin: async (id) => {
          const { vaultKey } = get();
          if (!vaultKey) throw new Error("Vault is locked");
          const currentItem = get().items.find((i) => i.id === id);
          if (!currentItem) return;
          const updated = await patchItem(vaultKey, currentItem, {
            pinned: !currentItem.pinned,
          });
          applyItems([updated]);
        },

        /* ----------- bulk actions (multi-select drag-and-drop) ----------- */

        clearFavorites: async () => {
          const { vaultKey } = get();
          if (!vaultKey) throw new Error("Vault is locked");
          const favs = get().items.filter((i) => i.favorite && !i.trashed);
          if (favs.length === 0) return { cleared: 0, failed: 0 };
          const { updated, failed } = await patchItems(vaultKey, favs, () => ({
            favorite: false,
          }));
          applyItems(updated);
          return { cleared: updated.length, failed };
        },

        moveItemsToVault: async (itemIds, vaultId) => {
          const { vaultKey } = get();
          if (!vaultKey) throw new Error("Vault is locked");
          const targets = get().items.filter((i) => itemIds.includes(i.id));
          const nextVaultIds = vaultId === null ? [] : [vaultId];
          // Filter out no-ops: items already in exactly the target membership.
          const toMove = targets.filter(
            (i) => JSON.stringify(i.vaultIds) !== JSON.stringify(nextVaultIds),
          );
          if (toMove.length === 0) return { moved: 0, failed: 0 };
          const { updated, failed } = await patchItems(
            vaultKey,
            toMove,
            () => ({ vaultIds: nextVaultIds }),
          );
          applyItems(updated);
          return { moved: updated.length, failed };
        },

        trashItems: async (itemIds) => {
          const { vaultKey } = get();
          if (!vaultKey) throw new Error("Vault is locked");
          const targets = get().items.filter((i) => itemIds.includes(i.id));
          // Filter out items already in trash.
          const toTrash = targets.filter((i) => !i.trashed);
          if (toTrash.length === 0) return { moved: 0, failed: 0 };
          const { updated, failed } = await patchItems(
            vaultKey,
            toTrash,
            () => ({ trashed: true, trashedAt: Date.now() }),
          );
          applyItems(updated);
          return { moved: updated.length, failed };
        },

        restoreItems: async (itemIds) => {
          const { vaultKey } = get();
          if (!vaultKey) throw new Error("Vault is locked");
          const targets = get().items.filter((i) => itemIds.includes(i.id));
          // Filter out items not in trash (no-ops).
          const toRestore = targets.filter((i) => i.trashed);
          if (toRestore.length === 0) return { restored: 0, failed: 0 };
          const { updated, failed } = await patchItems(
            vaultKey,
            toRestore,
            () => ({ trashed: false, trashedAt: null }),
          );
          applyItems(updated);
          return { restored: updated.length, failed };
        },

        permanentlyDeleteItems: async (itemIds) => {
          const targets = get().items.filter((i) => itemIds.includes(i.id));
          if (targets.length === 0) return { deleted: 0, failed: 0 };
          const prev = get().items;
          const targetIds = new Set(targets.map((i) => i.id));
          // Optimistic: drop the targets from UI; roll back only the rows whose
          // IndexedDB delete actually failed.
          set((state) => ({
            items: state.items.filter((i) => !targetIds.has(i.id)),
            selectedId:
              state.selectedId && targetIds.has(state.selectedId)
                ? null
                : state.selectedId,
          }));
          const outcomes = await Promise.allSettled(
            targets.map((t) => deleteStoredItem(t.id)),
          );
          const failedIds = new Set(
            targets
              .filter((_, i) => outcomes[i].status === "rejected")
              .map((t) => t.id),
          );
          if (failedIds.size > 0) {
            set((state) => ({
              items: sortItems([
                ...state.items,
                ...prev.filter((i) => failedIds.has(i.id)),
              ]),
            }));
          }
          return {
            deleted: targets.length - failedIds.size,
            failed: failedIds.size,
          };
        },

        duplicateItem: async (id) => {
          const item = get().items.find((i) => i.id === id);
          if (!item) return;
          // Duplicates never inherit trashed or pinned state — they land in the
          // active view, unpinned, ready for the user to customize. Favorite and
          // vault membership are intentionally kept.
          await get().saveItem({
            ...toItemInput(item),
            pinned: false,
            trashed: false,
            trashedAt: null,
          });
        },

        copyItemToVault: async (itemId, vaultId) => {
          const item = get().items.find((i) => i.id === itemId);
          if (!item) return;
          // Create a fully independent copy assigned to the target vault.
          // The copy gets a fresh ID, so deleting it never affects the original
          // (and vice versa). This replaces the old "symlink" membership model.
          // The copy is single-vault, unfavorited, unpinned and untrashed.
          await get().saveItem({
            ...toItemInput(item),
            vaultIds: [vaultId],
            favorite: false,
            pinned: false,
            trashed: false,
            trashedAt: null,
          });
        },

        importItems: async (filename, text) => {
          const { vaultKey } = get();
          if (!vaultKey) throw new Error("Vault is locked");
          const { result, items } = importFromText(filename, text);

          // Encrypted LCKED imports require the export's password — handled by a
          // dedicated UI flow. Here we surface a clear hint instead of failing.
          if (result.format === "lcked-json") {
            return {
              imported: 0,
              skipped: 0,
              warnings: [
                "Encrypted LCKED files need their own password — use the dedicated import path.",
              ],
            };
          }

          const { succeeded, failed } = await writeItems(vaultKey, items);

          if (succeeded.length > 0) {
            set((state) => ({
              items: sortItems([...succeeded, ...state.items]),
            }));
          }
          result.imported = succeeded.length;
          result.skipped += failed;
          return result;
        },

        restoreVault: async ({ masterPassword, filename, fileText }) => {
          return vaultRestore.restoreVault({
            masterPassword,
            filename,
            fileText,
            deps: {
              setupVault: (pw) => get().setupVault(pw),
              createCustomVault: (name, color, icon) =>
                get().createVault(name, color, icon),
              saveItem: (input) => get().saveItem(input),
              importItems: (fname, text) => get().importItems(fname, text),
            },
          });
        },

        /* --------------------------- vaults (containers) ---------------------- */

        createVault: async (name, color, icon) => {
          const { vaults } = await vaultManager.createVault(name, color, icon);
          set({
            vaults,
            createVaultDialogOpen: false,
            vaultEditorOpen: false,
            editingVaultId: null,
          });
          return vaults[vaults.length - 1];
        },

        deleteVault: async (id) => {
          const { vaultKey, items } = get();
          if (!vaultKey) throw new Error("Vault is locked");
          const { vaults, updatedItems } = await vaultManager.deleteVault(
            id,
            vaultKey,
            items,
          );
          set((state) => ({
            vaults,
            items: updatedItems
              ? state.items.map(
                  (i) => updatedItems.find((u) => u.id === i.id) ?? i,
                )
              : state.items,
            activeVault: state.activeVault === id ? "all" : state.activeVault,
            vaultEditorOpen:
              state.editingVaultId === id ? false : state.vaultEditorOpen,
            editingVaultId:
              state.editingVaultId === id ? null : state.editingVaultId,
          }));
        },

        renameVault: async (id, name) => {
          const { vaults } = await vaultManager.renameVault(id, name);
          set({ vaults, vaultEditorOpen: false, editingVaultId: null });
        },

        reorderVaults: async (newOrder) => {
          const { vaults } = await vaultManager.reorderVaults(newOrder);
          set({ vaults });
        },

        updateVault: async (id, patch) => {
          const { vaults } = await vaultManager.updateVault(id, patch);
          set({ vaults, vaultEditorOpen: false, editingVaultId: null });
        },

        setActiveVault: (v) => set({ activeVault: v, settingsOpen: false }),
        setVaultEditorOpen: (open, vaultId = null) =>
          set({ vaultEditorOpen: open, editingVaultId: vaultId }),
        setCreateVaultDialogOpen: (open) =>
          set({ createVaultDialogOpen: open }),

        /* ----------------------------- settings ------------------------------- */

        updateSettings: async (patch) => {
          const next = { ...get().settings, ...patch };
          set({ settings: next });
          const meta = await loadVaultMeta();
          if (meta) {
            await saveVaultMeta({ ...meta, settings: next });
          }
        },

        updateGenerator: (patch) => {
          set((state) => ({
            settings: {
              ...state.settings,
              generator: { ...state.settings.generator, ...patch },
            },
          }));
        },

        changeMasterPassword: async (current, next) => {
          const { vaultKey } = get();
          if (!vaultKey) return false;
          const result = await changeMasterPasswordAuth(
            current,
            next,
            vaultKey,
          );
          if (!result) return false;
          set({ masterKey: result.masterKey });
          return true;
        },

        /* ------------------------------ export -------------------------------- */

        exportEncrypted: async (password) => {
          const { items, vaults } = get();
          return exportEncryptedPayload(items, vaults, password);
        },

        exportCsv: () => exportToCsv(get().items),

        /* ------------------------------- UI ---------------------------------- */

        setSelected: (id) => set({ selectedId: id }),
        setSearch: (q) => set({ searchQuery: q }),
        setEditorOpen: (open, itemId = null) =>
          set({ editorOpen: open, editorItemId: itemId }),
        setGeneratorOpen: (open) => set({ generatorOpen: open }),
        setImportExportOpen: (open) => set({ importExportOpen: open }),
        // Opening settings no longer mutates `activeVault` (B-7). The
        // vaults-sidebar hides the indicator when `settingsOpen` is true, and
        // the user's active vault is preserved for when settings closes.
        setSettingsOpen: (open) => set({ settingsOpen: open }),
      };
    },
    {
      name: "lcked-ui-prefs",
      // Only persist non-sensitive UI preferences — NEVER keys or items.
      partialize: (state) => ({
        settings: state.settings,
      }),
    },
  ),
);

export { decryptLckedExport } from "@/lib/vault/vault-auth";
