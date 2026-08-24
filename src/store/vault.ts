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
  deleteStoredItems,
  patchItems,
  sortItems,
  toItemInput,
  writeItem,
  writeItems,
} from "@/lib/items/item-crud";
import {
  type BulkResult,
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
  loadVaultMeta,
  saveVaultMeta,
  vaultExists,
  wipeVault,
} from "@/lib/vault/vault-db";
import * as vaultManager from "@/lib/vault/vault-manager";
import type { RestoreResult } from "@/lib/vault/vault-restore";
import * as vaultRestore from "@/lib/vault/vault-restore";

export type VaultStatus = "loading" | "setup" | "locked" | "unlocked";

export interface VaultState {
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

  // item CRUD — every mutation resolves to one uniform BulkResult
  saveItem: (input: NewItemInput, existingId?: string) => Promise<VaultItem>;
  /** Soft-delete — moves the item to Trash with a 30-day TTL. */
  trashItem: (id: string) => Promise<BulkResult>;
  restoreItem: (id: string) => Promise<BulkResult>;
  permanentlyDeleteItem: (id: string) => Promise<BulkResult>;
  emptyTrash: () => Promise<BulkResult>;
  restoreAllTrash: () => Promise<BulkResult>;
  toggleFavorite: (id: string) => Promise<BulkResult>;
  togglePin: (id: string) => Promise<BulkResult>;
  /** Unfavorite ALL favorited items at once. */
  clearFavorites: () => Promise<BulkResult>;
  /** Replace vault memberships for multiple items (drag-and-drop move). */
  moveItemsToVault: (
    itemIds: string[],
    vaultId: string | null,
  ) => Promise<BulkResult>;
  trashItems: (itemIds: string[]) => Promise<BulkResult>;
  /** Restore the selected trashed items (bulk counterpart of restoreItem). */
  restoreItems: (itemIds: string[]) => Promise<BulkResult>;
  /** Permanently delete the selected items (bulk counterpart of permanentlyDeleteItem). */
  permanentlyDeleteItems: (itemIds: string[]) => Promise<BulkResult>;
  duplicateItem: (id: string) => Promise<BulkResult>;
  /** Duplicate an item into a specific vault. The copy is a fully independent
   *  record (new ID) assigned to the target vault — deleting the original or
   *  the copy does NOT affect the other. Replaces the old "add to vault"
   *  membership approach which symlinked one item across vaults. */
  copyItemToVault: (itemId: string, vaultId: string) => Promise<BulkResult>;
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

      /** One guard for every action that needs decrypted items. */
      const requireVaultKey = () => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        return vaultKey;
      };

      /**
       * The one optimistic-delete transaction: drop the targets from state,
       * remove their ciphertexts, and roll back exactly the rows whose
       * IndexedDB delete failed. Every permanent-delete path routes here.
       */
      const optimisticDelete = async (
        targets: VaultItem[],
      ): Promise<BulkResult> => {
        if (targets.length === 0) return { done: 0, failed: 0 };
        const prev = get().items;
        const targetIds = new Set(targets.map((t) => t.id));
        set((state) => ({
          items: state.items.filter((i) => !targetIds.has(i.id)),
          selectedId:
            state.selectedId && targetIds.has(state.selectedId)
              ? null
              : state.selectedId,
        }));
        const { deletedIds, failedIds } = await deleteStoredItems(targets);
        if (failedIds.length > 0) {
          set((state) => ({
            items: sortItems([
              ...state.items,
              ...prev.filter((i) => failedIds.includes(i.id)),
            ]),
          }));
        }
        return { done: deletedIds.length, failed: failedIds.length };
      };

      /**
       * One mutation transaction behind every Item-mutation action: select
       * targets, filter no-ops, patch + persist, apply to state, fold the
       * counts into the uniform BulkResult. Never rejects for row-level
       * failures — a throw is reserved for the locked-vault invariant.
       */
      const mutateItems = async (
        isTarget: (item: VaultItem) => boolean,
        isNoOp: (item: VaultItem) => boolean,
        patchFn: (item: VaultItem) => Partial<VaultItem>,
      ): Promise<BulkResult> => {
        const vaultKey = requireVaultKey();
        const targets = get().items.filter((i) => isTarget(i) && !isNoOp(i));
        if (targets.length === 0) return { done: 0, failed: 0 };
        const { updated, failed } = await patchItems(
          vaultKey,
          targets,
          patchFn,
        );
        applyItems(updated);
        return { done: updated.length, failed };
      };

      // The one Trash stamp and its Untrash inverse, shared by the single
      // and bulk actions so the patch shape is defined exactly once.
      const trashPatch = () => ({ trashed: true, trashedAt: Date.now() });
      const untrashPatch = () => ({ trashed: false, trashedAt: null });

      /**
       * Single-item create/copy behind BulkResult. The locked-vault invariant
       * throws before the try, so it is never folded into a row failure.
       */
      const writeOne = async (input: NewItemInput): Promise<BulkResult> => {
        requireVaultKey();
        try {
          await get().saveItem(input);
          return { done: 1, failed: 0 };
        } catch {
          return { done: 0, failed: 1 };
        }
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
          const vaultKey = requireVaultKey();

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
        trashItem: (id) =>
          mutateItems(
            (i) => i.id === id,
            (i) => i.trashed,
            trashPatch,
          ),

        restoreItem: (id) =>
          mutateItems(
            (i) => i.id === id,
            (i) => !i.trashed,
            untrashPatch,
          ),

        permanentlyDeleteItem: (id) =>
          optimisticDelete(get().items.filter((i) => i.id === id)),

        emptyTrash: async () =>
          optimisticDelete(get().items.filter((i) => i.trashed)),

        restoreAllTrash: () =>
          mutateItems(
            (i) => i.trashed,
            () => false,
            untrashPatch,
          ),

        toggleFavorite: (id) =>
          mutateItems(
            (i) => i.id === id,
            () => false,
            (current) => ({ favorite: !current.favorite }),
          ),

        togglePin: (id) =>
          mutateItems(
            (i) => i.id === id,
            () => false,
            (current) => ({ pinned: !current.pinned }),
          ),

        /* ----------- bulk actions (multi-select drag-and-drop) ----------- */

        clearFavorites: () =>
          mutateItems(
            (i) => i.favorite && !i.trashed,
            () => false,
            () => ({ favorite: false }),
          ),

        moveItemsToVault: (itemIds, vaultId) => {
          const nextVaultIds = vaultId === null ? [] : [vaultId];
          // No-op when the item already sits in exactly the target membership.
          return mutateItems(
            (i) => itemIds.includes(i.id),
            (i) => JSON.stringify(i.vaultIds) === JSON.stringify(nextVaultIds),
            () => ({ vaultIds: nextVaultIds }),
          );
        },

        trashItems: (itemIds) =>
          mutateItems(
            (i) => itemIds.includes(i.id),
            (i) => i.trashed,
            trashPatch,
          ),

        restoreItems: (itemIds) =>
          mutateItems(
            (i) => itemIds.includes(i.id),
            (i) => !i.trashed,
            untrashPatch,
          ),

        permanentlyDeleteItems: async (itemIds) => {
          return optimisticDelete(
            get().items.filter((i) => itemIds.includes(i.id)),
          );
        },

        duplicateItem: async (id) => {
          const item = get().items.find((i) => i.id === id);
          if (!item) return { done: 0, failed: 0 };
          // Duplicates never inherit trashed or pinned state — they land in the
          // active view, unpinned, ready for the user to customize. Favorite and
          // vault membership are intentionally kept.
          return writeOne({
            ...toItemInput(item),
            pinned: false,
            trashed: false,
            trashedAt: null,
          });
        },

        copyItemToVault: async (itemId, vaultId) => {
          const item = get().items.find((i) => i.id === itemId);
          if (!item) return { done: 0, failed: 0 };
          // Create a fully independent copy assigned to the target vault.
          // The copy gets a fresh ID, so deleting it never affects the original
          // (and vice versa). This replaces the old "symlink" membership model.
          // The copy is single-vault, unfavorited, unpinned and untrashed.
          return writeOne({
            ...toItemInput(item),
            vaultIds: [vaultId],
            favorite: false,
            pinned: false,
            trashed: false,
            trashedAt: null,
          });
        },

        importItems: async (filename, text) => {
          const vaultKey = requireVaultKey();
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
          const vaultKey = requireVaultKey();
          const { items } = get();
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
