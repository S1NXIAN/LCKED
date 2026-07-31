/**
 * LCKED — Vault store (Zustand)
 * ---------------------------------------------------------------------------
 * Owns the auth state machine + every vault mutation. CryptoKey objects live
 * only in memory here — they are NEVER persisted. All async actions are
 * fault-tolerant: a failed IndexedDB write reverts the optimistic UI change.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  deleteStoredItem,
  loadVaultMeta,
  saveVaultMeta,
  vaultExists,
  wipeVault,
} from "@/lib/vault-db";
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
  exportToCsv,
  importFromText,
} from "@/lib/import-export";
import { clearAllClipboardTimers } from "@/lib/clipboard";
import * as vaultManager from "@/lib/vault-manager";
import { patchItem, patchItems, writeItem, writeItems } from "@/lib/item-crud";
import {
  createVault,
  unlockVault,
  clearSession,
  changeMasterPassword as changeMasterPasswordAuth,
  exportEncrypted as exportEncryptedPayload,
} from "@/lib/vault-auth";
import {
  setMasterPassword,
  clearMasterPassword,
  markPendingCloudDeletion,
  startSync,
  stopSyncEngine,
  notifyVaultMutation,
  hashEmailClient,
  setStoredToken,
  getStoredToken,
  clearStoredToken,
  deleteCloudData,
  clearPendingCloudDeletion,
  hasPendingCloudDeletion,
  isOnline,
  executePendingDeletion,
  checkCloudExists,
} from "@/lib/cloud-sync";

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
  commandOpen: boolean;

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
  /** Replace an item's vault memberships with a single target vault.
   *  Pass `null` to clear all vault memberships (item lives only in All Items). */
  moveItemToVault: (itemId: string, vaultId: string | null) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  /** Unfavorite ALL favorited items at once. */
  clearFavorites: () => Promise<{ cleared: number; failed: number }>;
  /** Replace vault memberships for multiple items (drag-and-drop move). */
  moveItemsToVault: (itemIds: string[], vaultId: string | null) => Promise<{ moved: number; failed: number }>;
  trashItems: (itemIds: string[]) => Promise<{ moved: number; failed: number }>;
  duplicateItem: (id: string) => Promise<void>;
  /** Duplicate an item into a specific vault. The copy is a fully independent
   *  record (new ID) assigned to the target vault — deleting the original or
   *  the copy does NOT affect the other. Replaces the old "add to vault"
   *  membership approach which symlinked one item across vaults. */
  copyItemToVault: (itemId: string, vaultId: string) => Promise<void>;
  importItems: (filename: string, text: string) => Promise<ImportResult>;

  // vault (custom containers) CRUD
  createVault: (name: string, color: string, icon: string) => Promise<VaultDef>;
  deleteVault: (id: string) => Promise<void>;
  renameVault: (id: string, name: string) => Promise<void>;
  updateVault: (id: string, patch: Partial<Omit<VaultDef, "id" | "createdAt">>) => Promise<void>;
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
  setCommandOpen: (open: boolean) => void;

  // Cloud sync (automatic, debounced)
  oauthConnected: boolean;
  oauthEmail: string | null;
  cloudLastSync: number | null;
  cloudSyncing: boolean;
  connectOAuth: (idToken: string, email: string) => Promise<{ exists: boolean; updatedAt: number | null }>;
  disconnectOAuth: (deleteCloud: boolean) => Promise<void>;
  checkPendingDeletion: () => Promise<void>;
}

export const useVault = create<VaultState>()(
  persist(
    (set, get) => {
      const applyItems = (updated: VaultItem[]) => {
        if (updated.length === 0) return;
        set((state) => {
          const updatedMap = new Map(updated.map((u) => [u.id, u]));
          return {
            items: state.items
              .map((i) => updatedMap.get(i.id) ?? i)
              .sort((a, b) => b.updatedAt - a.updatedAt),
          };
        });
        notifyVaultMutation();
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
      commandOpen: false,

      // Cloud sync state
      oauthConnected: false,
      oauthEmail: null,
      cloudLastSync: null,
      cloudSyncing: false,

      /* ------------------------------ lifecycle ------------------------------ */

      init: async () => {
        try {
          if (typeof window === "undefined") return;
          const exists = await vaultExists();
          set({ status: exists ? "locked" : "setup" });
          // Check for pending cloud deletion (edge case: vault was reset
          // while offline). If online + has a stored OAuth token, execute
          // the deletion now.
          try {
            await get().checkPendingDeletion();
          } catch { /* best-effort */ }
        } catch (err) {
          console.error("init failed", err);
          set({ status: "setup" });
        }
      },

      setupVault: async (masterPassword) => {
        const result = await createVault(masterPassword);
        setMasterPassword(masterPassword);
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
        await startSync(get, set);
      },

      unlock: async (masterPassword) => {
        const result = await unlockVault(masterPassword);
        if (!result.ok) return false;
        setMasterPassword(result.masterPassword);
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
        await startSync(get, set);
        return true;
      },

      lock: () => {
        clearAllClipboardTimers();
        clearMasterPassword();
        stopSyncEngine();
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
          commandOpen: false,
          importExportOpen: false,
          vaultEditorOpen: false,
          editingVaultId: null,
          createVaultDialogOpen: false,
        });
      },

      resetVault: async () => {
        clearAllClipboardTimers();
        clearMasterPassword();
        await stopSyncEngine();
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
          commandOpen: false,
          importExportOpen: false,
          vaultEditorOpen: false,
          editingVaultId: null,
          createVaultDialogOpen: false,
          oauthConnected: false,
          oauthEmail: null,
          cloudLastSync: null,
        });
        // Mark pending cloud deletion (edge case: reset while offline).
        if (typeof window !== "undefined") {
          try {
            markPendingCloudDeletion();
          } catch { /* best-effort */ }
        }
      },

      /* ------------------------------- CRUD -------------------------------- */

      saveItem: async (input, existingId) => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");

        const existing = existingId ? get().items.find((i) => i.id === existingId) : undefined;
        const item = await writeItem(vaultKey, input, existing);

        set((state) => {
          const others = state.items.filter((i) => i.id !== item.id);
          const next = [item, ...others].sort((a, b) => b.updatedAt - a.updatedAt);
          return { items: next, selectedId: item.id };
        });
        notifyVaultMutation();
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
        const updated = await patchItem(vaultKey, item, { trashed: true, trashedAt: Date.now() });
        applyItems([updated]);
      },

      restoreItem: async (id) => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        const item = get().items.find((i) => i.id === id);
        if (!item) return;
        const updated = await patchItem(vaultKey, item, { trashed: false, trashedAt: null });
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
            items: [...state.items, ...prev.filter((i) => failedIds.has(i.id))].sort(
              (a, b) => b.updatedAt - a.updatedAt,
            ),
          }));
          throw new Error(`Could not delete ${failedIds.size} item(s)`);
        }
      },

      restoreAllTrash: async () => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        const trashed = get().items.filter((i) => i.trashed);
        if (trashed.length === 0) return { restored: 0, failed: 0 };
        const { updated, failed } = await patchItems(vaultKey, trashed, () => ({ trashed: false, trashedAt: null }));
        applyItems(updated);
        return { restored: updated.length, failed };
      },

      moveItemToVault: async (itemId, vaultId) => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        const item = get().items.find((i) => i.id === itemId);
        if (!item) return;
        const vaultIds = vaultId === null ? [] : [vaultId];
        const updated = await patchItem(vaultKey, item, { vaultIds });
        applyItems([updated]);
      },

      toggleFavorite: async (id) => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        const currentItem = get().items.find((i) => i.id === id);
        if (!currentItem) return;
        const updated = await patchItem(vaultKey, currentItem, { favorite: !currentItem.favorite });
        applyItems([updated]);
      },

      togglePin: async (id) => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        const currentItem = get().items.find((i) => i.id === id);
        if (!currentItem) return;
        const updated = await patchItem(vaultKey, currentItem, { pinned: !currentItem.pinned });
        applyItems([updated]);
      },

      /* ----------- bulk actions (multi-select drag-and-drop) ----------- */

      clearFavorites: async () => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        const favs = get().items.filter((i) => i.favorite && !i.trashed);
        if (favs.length === 0) return { cleared: 0, failed: 0 };
        const { updated, failed } = await patchItems(vaultKey, favs, () => ({ favorite: false }));
        applyItems(updated);
        return { cleared: updated.length, failed };
      },

      moveItemsToVault: async (itemIds, vaultId) => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        const targets = get().items.filter((i) => itemIds.includes(i.id));
        const nextVaultIds = vaultId === null ? [] : [vaultId];
        // Filter out no-ops: items already in exactly the target membership.
        const toMove = targets.filter((i) => JSON.stringify(i.vaultIds) !== JSON.stringify(nextVaultIds));
        if (toMove.length === 0) return { moved: 0, failed: 0 };
        const { updated, failed } = await patchItems(vaultKey, toMove, () => ({ vaultIds: nextVaultIds }));
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
        const { updated, failed } = await patchItems(vaultKey, toTrash, () => ({ trashed: true, trashedAt: Date.now() }));
        applyItems(updated);
        return { moved: updated.length, failed };
      },

      duplicateItem: async (id) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;
        // Duplicates never inherit trashed or pinned state — they land in the
        // active view, unpinned, ready for the user to customize.
        const { id: _id, createdAt: _c, updatedAt: _u, trashed: _t, trashedAt: _ta, pinned: _p, ...rest } = item;
        await get().saveItem(rest as NewItemInput);
      },

      copyItemToVault: async (itemId, vaultId) => {
        const item = get().items.find((i) => i.id === itemId);
        if (!item) return;
        // Create a fully independent copy assigned to the target vault.
        // The copy gets a fresh ID, so deleting it never affects the original
        // (and vice versa). This replaces the old "symlink" membership model.
        const { id: _id, createdAt: _c, updatedAt: _u, trashed: _t, trashedAt: _ta, pinned: _p, ...rest } = item;
        await get().saveItem({
          ...rest,
          vaultIds: [vaultId],
          favorite: false,
          pinned: false,
          trashed: false,
          trashedAt: null,
        } as NewItemInput);
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
            warnings: ["Encrypted LCKED files need their own password — use the dedicated import path."],
          };
        }

        const { succeeded, failed } = await writeItems(vaultKey, items);

        if (succeeded.length > 0) {
          set((state) => ({
            items: [...succeeded, ...state.items].sort((a, b) => b.updatedAt - a.updatedAt),
          }));
        }
        result.imported = succeeded.length;
        result.skipped += failed;
        return result;
      },

      /* --------------------------- vaults (containers) ---------------------- */

      createVault: async (name, color, icon) => {
        const { vaults } = await vaultManager.createVault(name, color, icon);
        set({ vaults, createVaultDialogOpen: false, vaultEditorOpen: false, editingVaultId: null });
        return vaults[vaults.length - 1];
      },

      deleteVault: async (id) => {
        const { vaultKey, items } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        const { vaults, updatedItems } = await vaultManager.deleteVault(id, vaultKey, items);
        set((state) => ({
          vaults,
          items: updatedItems
            ? state.items.map((i) => updatedItems.find((u) => u.id === i.id) ?? i)
            : state.items,
          activeVault: state.activeVault === id ? "all" : state.activeVault,
          vaultEditorOpen: state.editingVaultId === id ? false : state.vaultEditorOpen,
          editingVaultId: state.editingVaultId === id ? null : state.editingVaultId,
        }));
        notifyVaultMutation();
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
      setCreateVaultDialogOpen: (open) => set({ createVaultDialogOpen: open }),

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
          settings: { ...state.settings, generator: { ...state.settings.generator, ...patch } },
        }));
        notifyVaultMutation();
      },

      changeMasterPassword: async (current, next) => {
        const { vaultKey } = get();
        if (!vaultKey) return false;
        const result = await changeMasterPasswordAuth(current, next, vaultKey);
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
      setCommandOpen: (open) => set({ commandOpen: open }),

      /* --------------------------- cloud sync --------------------------- */

      connectOAuth: async (idToken, email) => {
        setStoredToken(idToken, email);
        const emailHash = await hashEmailClient(email);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("lcked-oauth-email-hash", emailHash);
        }
        const result = await checkCloudExists(idToken);
        set({ oauthConnected: true, oauthEmail: email });
        await startSync(get, set);
        return result;
      },

      disconnectOAuth: async (deleteCloud) => {
        await stopSyncEngine();
        const token = getStoredToken();
        if (deleteCloud && token) {
          try { await deleteCloudData(token); } catch { /* best-effort */ }
          clearPendingCloudDeletion();
        }
        clearStoredToken();
        set({ oauthConnected: false, oauthEmail: null, cloudLastSync: null });
      },

      checkPendingDeletion: async () => {
        if (!hasPendingCloudDeletion()) return;
        if (!isOnline()) return;
        const token = getStoredToken();
        if (!token) return;
        try { await executePendingDeletion(); } catch { /* retry later */ }
      },
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

export { decryptLckedExport, importLckedExport } from "@/lib/vault-auth";
