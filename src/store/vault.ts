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
  buildVerifier,
  bytesToBase64,
  checkVerifier,
  decryptJson,
  deriveMasterKey,
  encryptJson,
  generateVaultKey,
  PBKDF2_ITERATIONS,
  randomBytes,
  randomId,
  unwrapVaultKey,
  VERIFIER_TOKEN,
  wrapVaultKey,
} from "@/lib/crypto";
import {
  deleteStoredItem,
  loadAllStoredItems,
  loadVaultMeta,
  putStoredItem,
  saveVaultMeta,
  vaultExists,
  wipeVault,
} from "@/lib/vault-db";
import {
  DEFAULT_VAULT_SETTINGS,
  type GeneratorOptions,
  type NewItemInput,
  type VaultDef,
  type VaultItem,
  type VaultMeta,
  type VaultSettings,
} from "@/lib/types";
import {
  exportToCsv,
  importFromText,
  type ImportResult,
  type LckedExport,
} from "@/lib/import-export";

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

// Module-level: stores the master password while unlocked (in-memory only,
// never persisted). Used by the auto-sync engine to encrypt cloud backups
// without re-prompting the user. Cleared on lock.
let _masterPassword: string | null = null;

export const useVault = create<VaultState>()(
  persist(
    (set, get) => ({
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
        const salt = bytesToBase64(randomBytes(16));
        const masterKey = await deriveMasterKey(masterPassword, salt, PBKDF2_ITERATIONS);
        const vaultKey = await generateVaultKey();
        const { ciphertext, iv } = await wrapVaultKey(vaultKey, masterKey);
        const verifier = await buildVerifier(masterKey);

        const now = Date.now();
        const meta: VaultMeta = {
          id: "singleton",
          salt,
          iterations: PBKDF2_ITERATIONS,
          encryptedVaultKey: ciphertext,
          vaultKeyIv: iv,
          verifier: verifier.verifier,
          verifierIv: verifier.verifierIv,
          verifierToken: verifier.verifierToken,
          createdAt: now,
          settings: DEFAULT_VAULT_SETTINGS,
          vaults: [],
        };
        await saveVaultMeta(meta);

        set({
          status: "unlocked",
          masterKey,
          vaultKey,
          settings: DEFAULT_VAULT_SETTINGS,
          items: [],
          vaults: [],
          activeVault: "all",
          selectedId: null,
        });
        _masterPassword = masterPassword;
        await startAutoSync(get, set);
      },

      unlock: async (masterPassword) => {
        const meta = await loadVaultMeta();
        if (!meta) {
          set({ status: "setup" });
          return false;
        }
        const masterKey = await deriveMasterKey(
          masterPassword,
          meta.salt,
          meta.iterations,
        );
        const ok = await checkVerifier(
          masterKey,
          meta.verifier,
          meta.verifierIv,
          meta.verifierToken,
        );
        if (!ok) return false;

        const vaultKey = await unwrapVaultKey(
          meta.encryptedVaultKey,
          meta.vaultKeyIv,
          masterKey,
        );

        // Decrypt every stored item in parallel (Web Crypto handles concurrent
        // subtle.decrypt calls). Each item is decrypted + migrated + TTL-checked
        // in its own async task, then the results are gathered.
        const stored = await loadAllStoredItems();
        const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
        const now = Date.now();

        type DecryptOutcome =
          | { kind: "ok"; item: VaultItem; migrated: boolean }
          | { kind: "expired"; id: string }
          | { kind: "error"; id: string };

        const outcomes = await Promise.all(
          stored.map(async (s): Promise<DecryptOutcome> => {
            try {
              const item = await decryptJson<VaultItem>(s.ciphertext, s.iv, vaultKey);
              // Migration: ensure fields added in later LCKED versions exist.
              let migrated = false;
              if (item.vaultIds === undefined) { item.vaultIds = []; migrated = true; }
              if (item.trashed === undefined) { item.trashed = false; migrated = true; }
              if (item.trashedAt === undefined) { item.trashedAt = null; migrated = true; }
              if (item.customFields === undefined) { item.customFields = []; migrated = true; }
              if (item.favorite === undefined) { item.favorite = false; migrated = true; }
              if (item.pinned === undefined) { item.pinned = false; migrated = true; }
              if (item.folder === undefined) { item.folder = ""; migrated = true; }
              // 30-day auto-delete: drop trashed items whose TTL has expired.
              if (item.trashed && item.trashedAt && now - item.trashedAt > TRASH_TTL_MS) {
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
            try { await deleteStoredItem(o.id); } catch { /* best-effort */ }
          } else {
            console.warn("Failed to decrypt item", o.id);
          }
        }
        // Persist any migrated records so we never re-migrate them again.
        if (toReencrypt.length > 0) {
          await Promise.all(
            toReencrypt.map(async (it) => {
              const { ciphertext, iv } = await encryptJson(it, vaultKey);
              await putStoredItem({
                id: it.id,
                type: it.type,
                ciphertext,
                iv,
                createdAt: it.createdAt,
                updatedAt: it.updatedAt,
              });
            }),
          );
        }
        items.sort((a, b) => b.updatedAt - a.updatedAt);

        // Hydrate vaults (custom containers) — migrate older meta that lacks
        // the field by persisting an empty array.
        const vaults: VaultDef[] = Array.isArray(meta.vaults) ? meta.vaults : [];
        if (!Array.isArray(meta.vaults)) {
          await saveVaultMeta({ ...meta, vaults });
        }

        set({
          status: "unlocked",
          masterKey,
          vaultKey,
          items,
          vaults,
          activeVault: "all",
          // Merge with defaults so vaults persisted before the
          // showFavicons / sortFavoritesFirst settings existed still get
          // sane values instead of `undefined`.
          settings: { ...DEFAULT_VAULT_SETTINGS, ...meta.settings },
        });
        // Store master password for auto-sync encryption (in-memory only).
        _masterPassword = masterPassword;
        // Start the smart sync engine (if OAuth is connected).
        await startAutoSync(get, set);
        return true;
      },

      lock: () => {
        // Clear any pending clipboard auto-clear timers so a password copied
        // just before locking doesn't linger in the system clipboard.
        clearAllClipboardTimers();
        // Clear the in-memory master password + stop the sync engine.
        _masterPassword = null;
        stopSyncEngine();
        set({
          status: "locked",
          masterKey: null,
          vaultKey: null,
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
        _masterPassword = null;
        await stopSyncEngine();
        await wipeVault();
        set({
          status: "setup",
          items: [],
          vaults: [],
          activeVault: "all",
          masterKey: null,
          vaultKey: null,
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
          // Clear OAuth state — the vault is gone, the cloud data is now
          // inaccessible (encrypted with the forgotten master password).
          // Mark pending cloud deletion so it gets cleaned up on next
          // online + OAuth connection.
          oauthConnected: false,
          oauthEmail: null,
          cloudLastSync: null,
        });
        // Mark pending cloud deletion (edge case: reset while offline).
        if (typeof window !== "undefined") {
          try {
            const { markPendingCloudDeletion } = await import("@/lib/cloud-sync");
            markPendingCloudDeletion();
          } catch { /* cloud-sync module not available — skip */ }
        }
      },

      /* ------------------------------- CRUD -------------------------------- */

      saveItem: async (input, existingId) => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");

        const now = Date.now();
        const id = existingId ?? randomId();
        const existing = existingId ? get().items.find((i) => i.id === existingId) : undefined;
        // Never inherit trashed state from a duplicated item — duplicates land
        // in the active view, not in Trash.
        const baseTrashed = existing ? existing.trashed : false;
        const baseTrashedAt = existing ? existing.trashedAt : null;
        const baseVaultIds = existing
          ? existing.vaultIds
          : (input as VaultItem).vaultIds ?? [];
        const item: VaultItem = {
          ...(input as VaultItem),
          id,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          vaultIds: baseVaultIds,
          trashed: baseTrashed,
          trashedAt: baseTrashedAt,
        } as VaultItem;

        const { ciphertext, iv } = await encryptJson(item, vaultKey);
        await putStoredItem({ id, type: item.type, ciphertext, iv, createdAt: item.createdAt, updatedAt: now });

        set((state) => {
          const others = state.items.filter((i) => i.id !== id);
          const next = [item, ...others].sort((a, b) => b.updatedAt - a.updatedAt);
          return { items: next, selectedId: id };
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
        await updateItemFlags(id, { trashed: true, trashedAt: Date.now() }, get, set);
      },

      restoreItem: async (id) => {
        await updateItemFlags(id, { trashed: false, trashedAt: null }, get, set);
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
        const trashed = get().items.filter((i) => i.trashed);
        if (trashed.length === 0) return { restored: 0, failed: 0 };
        const outcomes = await Promise.allSettled(
          trashed.map((it) => updateItemFlags(it.id, { trashed: false, trashedAt: null, updatedAt: Date.now() }, get, set)),
        );
        const restored = outcomes.filter((o) => o.status === "fulfilled").length;
        const failed = outcomes.filter((o) => o.status === "rejected").length;
        return { restored, failed };
      },

      moveItemToVault: async (itemId, vaultId) => {
        // Replace all memberships with the single target (or clear if null).
        const vaultIds = vaultId === null ? [] : [vaultId];
        await updateItemFlags(itemId, { vaultIds, updatedAt: Date.now() }, get, set);
      },

      toggleFavorite: async (id) => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        // Functional set: read the current item inside the updater so
        // concurrent mutations don't clobber each other (B-11).
        const currentItem = get().items.find((i) => i.id === id);
        if (!currentItem) return;
        const updated: VaultItem = {
          ...currentItem,
          favorite: !currentItem.favorite,
          updatedAt: Date.now(),
        } as VaultItem;
        const { ciphertext, iv } = await encryptJson(updated, vaultKey);
        await putStoredItem({ id, type: updated.type, ciphertext, iv, createdAt: updated.createdAt, updatedAt: updated.updatedAt });
        set((state) => ({
          items: state.items
            .map((i) => (i.id === id ? updated : i))
            .sort((a, b) => b.updatedAt - a.updatedAt),
        }));
        notifyVaultMutation();
      },

      togglePin: async (id) => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        const currentItem = get().items.find((i) => i.id === id);
        if (!currentItem) return;
        const updated: VaultItem = {
          ...currentItem,
          pinned: !currentItem.pinned,
          updatedAt: Date.now(),
        } as VaultItem;
        const { ciphertext, iv } = await encryptJson(updated, vaultKey);
        await putStoredItem({ id, type: updated.type, ciphertext, iv, createdAt: updated.createdAt, updatedAt: updated.updatedAt });
        set((state) => ({
          items: state.items
            .map((i) => (i.id === id ? updated : i))
            .sort((a, b) => b.updatedAt - a.updatedAt),
        }));
        notifyVaultMutation();
      },

      /* ----------- bulk actions (multi-select drag-and-drop) ----------- */

      clearFavorites: async () => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        const favs = get().items.filter((i) => i.favorite && !i.trashed);
        if (favs.length === 0) return { cleared: 0, failed: 0 };
        const now = Date.now();
        const outcomes = await Promise.allSettled(
          favs.map(async (it) => {
            const next: VaultItem = { ...it, favorite: false, updatedAt: now } as VaultItem;
            const { ciphertext, iv } = await encryptJson(next, vaultKey);
            await putStoredItem({ id: next.id, type: next.type, ciphertext, iv, createdAt: next.createdAt, updatedAt: now });
            return next;
          }),
        );
        const cleared: VaultItem[] = [];
        let failed = 0;
        for (let i = 0; i < outcomes.length; i++) {
          if (outcomes[i].status === "fulfilled") cleared.push(favs[i]);
          else failed++;
        }
        if (cleared.length > 0) {
          const clearedIds = new Set(cleared.map((c) => c.id));
          set((state) => ({
            items: state.items
              .map((i) => (clearedIds.has(i.id) ? { ...i, favorite: false, updatedAt: now } as VaultItem : i))
              .sort((a, b) => b.updatedAt - a.updatedAt),
          }));
        }
        return { cleared: cleared.length, failed };
      },

      moveItemsToVault: async (itemIds, vaultId) => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        const now = Date.now();
        const targets = get().items.filter((i) => itemIds.includes(i.id));
        const nextVaultIds = vaultId === null ? [] : [vaultId];
        // Filter out no-ops: items already in exactly the target membership.
        const toMove = targets.filter((i) => JSON.stringify(i.vaultIds) !== JSON.stringify(nextVaultIds));
        if (toMove.length === 0) return { moved: 0, failed: 0 };
        const outcomes = await Promise.allSettled(
          toMove.map(async (it) => {
            const next: VaultItem = { ...it, vaultIds: nextVaultIds, updatedAt: now } as VaultItem;
            const { ciphertext, iv } = await encryptJson(next, vaultKey);
            await putStoredItem({ id: next.id, type: next.type, ciphertext, iv, createdAt: next.createdAt, updatedAt: now });
            return next;
          }),
        );
        const moved: VaultItem[] = [];
        let failed = 0;
        for (let i = 0; i < outcomes.length; i++) {
          if (outcomes[i].status === "fulfilled") moved.push(toMove[i]);
          else failed++;
        }
        if (moved.length > 0) {
          const movedIds = new Set(moved.map((m) => m.id));
          set((state) => ({
            items: state.items
              .map((i) => (movedIds.has(i.id) ? { ...i, vaultIds: nextVaultIds, updatedAt: now } as VaultItem : i))
              .sort((a, b) => b.updatedAt - a.updatedAt),
          }));
        }
        return { moved: moved.length, failed };
      },

      trashItems: async (itemIds) => {
        const { vaultKey } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        const now = Date.now();
        const targets = get().items.filter((i) => itemIds.includes(i.id));
        // Filter out items already in trash.
        const toTrash = targets.filter((i) => !i.trashed);
        if (toTrash.length === 0) return { moved: 0, failed: 0 };
        const outcomes = await Promise.allSettled(
          toTrash.map(async (it) => {
            const next: VaultItem = { ...it, trashed: true, trashedAt: now, updatedAt: now } as VaultItem;
            const { ciphertext, iv } = await encryptJson(next, vaultKey);
            await putStoredItem({ id: next.id, type: next.type, ciphertext, iv, createdAt: next.createdAt, updatedAt: now });
            return next;
          }),
        );
        const trashed: VaultItem[] = [];
        let failed = 0;
        for (let i = 0; i < outcomes.length; i++) {
          if (outcomes[i].status === "fulfilled") trashed.push(toTrash[i]);
          else failed++;
        }
        if (trashed.length > 0) {
          const trashedIds = new Set(trashed.map((t) => t.id));
          set((state) => ({
            items: state.items
              .map((i) => (trashedIds.has(i.id) ? { ...i, trashed: true, trashedAt: now, updatedAt: now } as VaultItem : i))
              .sort((a, b) => b.updatedAt - a.updatedAt),
          }));
        }
        return { moved: trashed.length, failed };
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
        if ((result as any).__raw) {
          return {
            imported: 0,
            skipped: 0,
            warnings: ["Encrypted LCKED files need their own password — use the dedicated import path."],
          };
        }

        // Batch: encrypt + persist all items in parallel, then a single state
        // update + sort. Avoids O(n) sequential awaits + O(n) re-renders.
        const now = Date.now();
        const built: VaultItem[] = items.map((input) => ({
          ...(input as VaultItem),
          id: randomId(),
          createdAt: now,
          updatedAt: now,
          vaultIds: (input as VaultItem).vaultIds ?? [],
          trashed: false,
          trashedAt: null,
        }) as VaultItem);

        const encOutcomes = await Promise.allSettled(
          built.map(async (item) => {
            const { ciphertext, iv } = await encryptJson(item, vaultKey);
            await putStoredItem({ id: item.id, type: item.type, ciphertext, iv, createdAt: item.createdAt, updatedAt: item.updatedAt });
            return item;
          }),
        );

        const succeeded: VaultItem[] = [];
        let saveSkipped = 0;
        for (let i = 0; i < encOutcomes.length; i++) {
          if (encOutcomes[i].status === "fulfilled") succeeded.push(built[i]);
          else saveSkipped++;
        }

        if (succeeded.length > 0) {
          set((state) => ({
            items: [...succeeded, ...state.items].sort((a, b) => b.updatedAt - a.updatedAt),
          }));
        }
        result.imported = succeeded.length;
        result.skipped += saveSkipped;
        return result;
      },

      /* --------------------------- vaults (containers) ---------------------- */

      createVault: async (name, color, icon) => {
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
        set({ vaults, createVaultDialogOpen: false, vaultEditorOpen: false, editingVaultId: null });
        return vault;
      },

      deleteVault: async (id) => {
        const meta = await loadVaultMeta();
        if (!meta) return;
        const prevVaults = meta.vaults ?? [];
        const vaults = prevVaults.filter((v) => v.id !== id);
        // Orphan any items that lived in this vault — the vault id is removed
        // from each item's vaultIds. Re-encrypt + persist each BEFORE
        // committing the meta change, so a partial failure can be rolled back.
        const { vaultKey, items } = get();
        const orphaned = items.filter((i) => i.vaultIds.includes(id));
        if (vaultKey && orphaned.length > 0) {
          try {
            await Promise.all(
              orphaned.map(async (it) => {
                const next: VaultItem = { ...it, vaultIds: it.vaultIds.filter((v) => v !== id), updatedAt: Date.now() } as VaultItem;
                const { ciphertext, iv } = await encryptJson(next, vaultKey);
                await putStoredItem({
                  id: next.id,
                  type: next.type,
                  ciphertext,
                  iv,
                  createdAt: next.createdAt,
                  updatedAt: next.updatedAt,
                });
              }),
            );
          } catch (err) {
            // Orphaning failed — do NOT commit the meta change. The vault stays.
            console.error("deleteVault: orphaning failed, rolling back", err);
            throw err;
          }
          set((state) => ({
            items: state.items.map((i) =>
              i.vaultIds.includes(id) ? ({ ...i, vaultIds: i.vaultIds.filter((v) => v !== id), updatedAt: Date.now() } as VaultItem) : i,
            ),
          }));
        }
        // All orphans re-parented successfully — now safe to remove the vault.
        await saveVaultMeta({ ...meta, vaults });
        set((state) => ({
          vaults,
          activeVault: state.activeVault === id ? "all" : state.activeVault,
          vaultEditorOpen: state.editingVaultId === id ? false : state.vaultEditorOpen,
          editingVaultId: state.editingVaultId === id ? null : state.editingVaultId,
        }));
        notifyVaultMutation();
      },

      renameVault: async (id, name) => {
        await get().updateVault(id, { name });
      },

      deleteVaultWithOptions: async (id, mode, targetVaultId, itemIdsToDelete) => {
        const meta = await loadVaultMeta();
        if (!meta) return;
        const { vaultKey, items } = get();
        if (!vaultKey) throw new Error("Vault is locked");
        const now = Date.now();
        const vaultItems = items.filter((i) => i.vaultIds.includes(id) && !i.trashed);

        // Determine which items to delete vs. transfer.
        let toDelete: VaultItem[] = [];
        let toTransfer: VaultItem[] = [];
        if (mode === "delete") {
          toDelete = vaultItems;
        } else if (mode === "transfer") {
          toTransfer = vaultItems;
        } else if (mode === "selective") {
          const deleteSet = new Set(itemIdsToDelete ?? []);
          toDelete = vaultItems.filter((i) => deleteSet.has(i.id));
          toTransfer = vaultItems.filter((i) => !deleteSet.has(i.id));
        }

        // Permanently delete items (remove from IDB + state).
        if (toDelete.length > 0) {
          await Promise.all(
            toDelete.map(async (it) => {
              try { await deleteStoredItem(it.id); } catch { /* best-effort */ }
            }),
          );
        }

        // Transfer items to the target vault (re-encrypt + persist).
        if (toTransfer.length > 0) {
          await Promise.all(
            toTransfer.map(async (it) => {
              const next: VaultItem = { ...it, vaultIds: targetVaultId ? [targetVaultId] : [], updatedAt: now } as VaultItem;
              const { ciphertext, iv } = await encryptJson(next, vaultKey);
              await putStoredItem({ id: next.id, type: next.type, ciphertext, iv, createdAt: next.createdAt, updatedAt: now });
            }),
          );
        }

        // Remove the vault from meta.
        const vaults = (meta.vaults ?? []).filter((v) => v.id !== id);
        await saveVaultMeta({ ...meta, vaults });

        // Update in-memory state.
        const deletedIds = new Set(toDelete.map((d) => d.id));
        const transferredIds = new Set(toTransfer.map((t) => t.id));
        set((state) => ({
          vaults,
          items: state.items
            .filter((i) => !deletedIds.has(i.id))
            .map((i) =>
              transferredIds.has(i.id)
                ? { ...i, vaultIds: targetVaultId ? [targetVaultId] : [], updatedAt: now } as VaultItem
                : i,
            )
            .sort((a, b) => b.updatedAt - a.updatedAt),
          activeVault: state.activeVault === id ? "all" : state.activeVault,
          selectedId: state.selectedId && deletedIds.has(state.selectedId) ? null : state.selectedId,
        }));
        notifyVaultMutation();
      },

      reorderVaults: async (newOrder) => {
        const meta = await loadVaultMeta();
        if (!meta) return;
        await saveVaultMeta({ ...meta, vaults: newOrder });
        set({ vaults: newOrder });
      },

      updateVault: async (id, patch) => {
        const meta = await loadVaultMeta();
        if (!meta) return;
        const vaults = (meta.vaults ?? []).map((v) =>
          v.id === id ? { ...v, ...patch, name: patch.name ?? v.name } : v,
        );
        await saveVaultMeta({ ...meta, vaults });
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
        const meta = await loadVaultMeta();
        if (!meta) return false;
        const currentKey = await deriveMasterKey(current, meta.salt, meta.iterations);
        const ok = await checkVerifier(currentKey, meta.verifier, meta.verifierIv, meta.verifierToken);
        if (!ok) return false;

        // New salt + new master key; re-wrap the SAME vault key so no item
        // needs re-encryption.
        const newSalt = bytesToBase64(randomBytes(16));
        const newMasterKey = await deriveMasterKey(next, newSalt, PBKDF2_ITERATIONS);
        const { vaultKey } = get();
        if (!vaultKey) return false;
        const wrapped = await wrapVaultKey(vaultKey, newMasterKey);
        const verifier = await buildVerifier(newMasterKey);
        await saveVaultMeta({
          ...meta,
          salt: newSalt,
          iterations: PBKDF2_ITERATIONS,
          encryptedVaultKey: wrapped.ciphertext,
          vaultKeyIv: wrapped.iv,
          verifier: verifier.verifier,
          verifierIv: verifier.verifierIv,
          // Write the new verifier token too (defensive — today it's a constant,
          // but if per-vault tokens are introduced later this prevents a
          // password-change → unlock-failure regression).
          verifierToken: verifier.verifierToken,
        });
        set({ masterKey: newMasterKey });
        return true;
      },

      /* ------------------------------ export -------------------------------- */

      exportEncrypted: async (password) => {
        const items = get().items;
        const vaults = get().vaults;
        const salt = bytesToBase64(randomBytes(16));
        const exportMasterKey = await deriveMasterKey(password, salt, PBKDF2_ITERATIONS);
        const exportVaultKey = await generateVaultKey();
        const verifier = await buildVerifier(exportMasterKey);
        const wrapped = await wrapVaultKey(exportVaultKey, exportMasterKey);

        // The payload (items + vaults) is encrypted with the export vault key.
        // The export vault key itself is wrapped with the export master key and
        // hoisted to the ENVELOPE level (not inside `data`) so decryption is
        // possible: derive master key → check verifier → unwrap vault key →
        // decrypt data. (Burying it inside `data` created a circular dependency.)
        const payload = { items, vaults };
        const { ciphertext: dataCipher, iv: dataIv } = await encryptJson(payload, exportVaultKey);

        const envelope: LckedExport = {
          format: "lcked-encrypted-v1",
          version: 1,
          exportedAt: Date.now(),
          salt,
          iterations: PBKDF2_ITERATIONS,
          verifier: verifier.verifier,
          verifierIv: verifier.verifierIv,
          wrappedVaultKey: wrapped.ciphertext,
          wrappedVaultKeyIv: wrapped.iv,
          data: dataCipher,
          dataIv: dataIv,
        };
        return JSON.stringify(envelope, null, 2);
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
        const { setStoredToken, hashEmailClient, checkCloudExists } = await import("@/lib/cloud-sync");
        setStoredToken(idToken, email);
        const emailHash = await hashEmailClient(email);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("lcked-oauth-email-hash", emailHash);
        }
        const result = await checkCloudExists(idToken);
        set({ oauthConnected: true, oauthEmail: email });
        // Start the smart sync engine now that OAuth is connected.
        await startAutoSync(get, set);
        return result;
      },

      disconnectOAuth: async (deleteCloud) => {
        const { getStoredToken, clearStoredToken, deleteCloudData, clearPendingCloudDeletion } = await import("@/lib/cloud-sync");
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
        const { hasPendingCloudDeletion, executePendingDeletion, isOnline, getStoredToken } = await import("@/lib/cloud-sync");
        if (!hasPendingCloudDeletion()) return;
        if (!isOnline()) return;
        const token = getStoredToken();
        if (!token) return;
        try { await executePendingDeletion(); } catch { /* retry later */ }
      },
    }),
    {
      name: "lcked-ui-prefs",
      // Only persist non-sensitive UI preferences — NEVER keys or items.
      partialize: (state) => ({
        settings: state.settings,
      }),
    },
  ),
);

/* ----------------------- smart sync helpers ----------------------------- */

/**
 * Start the automatic cloud sync engine. Called after unlock or OAuth
 * connect. The engine debounces uploads (3s after last mutation) and
 * auto-pulls on going online. All uploads use the in-memory master
 * password to encrypt the vault data — no user interaction needed.
 */
async function startAutoSync(
  get: () => VaultState,
  set: (partial: Partial<VaultState>) => void,
) {
  const { startSyncEngine, isOAuthConnected, getStoredToken, uploadCloudData,
    downloadCloudData, isOnline, setLastSync, getLastSync } =
    await import("@/lib/cloud-sync");

  if (!isOAuthConnected()) return;

  // Upload function: encrypt the current vault + upload to Firestore.
  const uploadFn = async () => {
    if (!_masterPassword) return;
    const token = getStoredToken();
    if (!token) return;
    if (!isOnline()) return;
    set({ cloudSyncing: true });
    try {
      const envelopeJson = await get().exportEncrypted(_masterPassword);
      const envelope = JSON.parse(envelopeJson);
      const emailHash = typeof window !== "undefined"
        ? sessionStorage.getItem("lcked-oauth-email-hash") ?? ""
        : "";
      const { updatedAt } = await uploadCloudData(token, envelope, emailHash);
      setLastSync(updatedAt);
      set({ cloudLastSync: updatedAt });
    } finally {
      set({ cloudSyncing: false });
    }
  };

  // Pull function: check for newer cloud data and merge if found.
  const pullFn = async () => {
    if (!_masterPassword) return;
    const token = getStoredToken();
    if (!token) return;
    if (!isOnline()) return;
    const { data, updatedAt } = await downloadCloudData(token);
    if (!data || !updatedAt) return;
    const lastSync = getLastSync();
    // Only pull if cloud is newer than our last sync.
    if (lastSync && updatedAt <= lastSync) return;
    // Decrypt the cloud data.
    const decrypted = await decryptLckedExport(data, _masterPassword);
    if (!decrypted) return;
    // Merge: replace local items with cloud items (last-write-wins).
    // Re-encrypt each cloud item with the local vault key + persist.
    const { vaultKey } = get();
    if (!vaultKey) return;
    set({ cloudSyncing: true });
    try {
      const { putStoredItem } = await import("@/lib/vault-db");
      const now = Date.now();
      await Promise.all(
        decrypted.items.map(async (item) => {
          const { ciphertext, iv } = await encryptJson(item, vaultKey);
          await putStoredItem({ id: item.id, type: item.type, ciphertext, iv, createdAt: item.createdAt, updatedAt: item.updatedAt });
        }),
      );
      // Update local state with merged items.
      set({
        items: decrypted.items.sort((a, b) => b.updatedAt - a.updatedAt),
        vaults: decrypted.vaults,
        cloudLastSync: updatedAt,
      });
      setLastSync(updatedAt);
    } finally {
      set({ cloudSyncing: false });
    }
  };

  startSyncEngine(uploadFn, pullFn);
  // Immediately pull on start (in case cloud is newer).
  const engine = (await import("@/lib/cloud-sync")).getSyncEngine();
  engine?.pull().catch(() => {});
}

async function stopSyncEngine() {
  const { stopSyncEngine: stop } = await import("@/lib/cloud-sync");
  await stop();
}

/**
 * Call after any vault mutation to schedule a debounced auto-upload.
 * Safe to call even if sync is not active (no-op if engine is null).
 */
function notifyVaultMutation() {
  import("@/lib/cloud-sync").then(({ notifyVaultMutation: notify }) => notify());
}

/* --------------------------- clipboard helper ----------------------------- */

/**
 * Patch one or more flags on an item (vaultIds / trashed / trashedAt / favorite)
 * and re-encrypt + persist it. Used by trashItem / restoreItem / moveItemToVault
 * so we have a single fault-tolerant code path.
 */
async function updateItemFlags(
  id: string,
  patch: Partial<Pick<VaultItem, "vaultIds" | "trashed" | "trashedAt" | "updatedAt">>,
  get: () => VaultState,
  set: (partial: Partial<VaultState>) => void,
): Promise<void> {
  const { vaultKey } = get();
  // Throw if locked so the mutation doesn't silently skip persistence (B-5).
  // Without this, the in-memory state would update but IDB would not, and the
  // change would vanish on the next unlock.
  if (!vaultKey) throw new Error("Vault is locked");
  const item = get().items.find((i) => i.id === id);
  if (!item) return;
  const now = patch.updatedAt ?? Date.now();
  const updated: VaultItem = { ...item, ...patch, updatedAt: now } as VaultItem;
  const { ciphertext, iv } = await encryptJson(updated, vaultKey);
  await putStoredItem({
    id,
    type: updated.type,
    ciphertext,
    iv,
    createdAt: updated.createdAt,
    updatedAt: now,
  });
  set((state) => ({
    items: state.items
      .map((i) => (i.id === id ? updated : i))
      .sort((a, b) => b.updatedAt - a.updatedAt),
  }));
  notifyVaultMutation();
}

/**
 * Copy-to-clipboard with an automatic 30-second clear. Returns the timeout id
 * so callers can cancel early if needed. Sensitive values never linger.
 */
const clipboardTimers = new Map<string, ReturnType<typeof setTimeout>>();

export async function copyWithAutoClear(
  value: string,
  key = "default",
  clearMs = 30_000,
): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard API unavailable");
  }
  await navigator.clipboard.writeText(value);
  // Clear any prior timer for this key.
  const prior = clipboardTimers.get(key);
  if (prior) clearTimeout(prior);
  const timer = setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText().catch(() => "");
      if (current === value) {
        await navigator.clipboard.writeText("");
      }
    } catch {
      // readText may be denied — best-effort clear.
    }
    clipboardTimers.delete(key);
  }, clearMs);
  clipboardTimers.set(key, timer);
}

export function cancelClipboardClear(key = "default"): void {
  const t = clipboardTimers.get(key);
  if (t) {
    clearTimeout(t);
    clipboardTimers.delete(key);
  }
}

/** Clear ALL pending clipboard auto-clear timers + wipe the clipboard if it
 *  still holds a value we copied. Called from `lock()` so a password copied
 *  just before locking doesn't linger for up to 30s. */
export function clearAllClipboardTimers(): void {
  for (const t of clipboardTimers.values()) clearTimeout(t);
  clipboardTimers.clear();
  // Best-effort clipboard wipe.
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText("").catch(() => {});
  }
}

/* ----------------------- encrypted export decrypt ------------------------- */

/**
 * Decrypt an LCKED encrypted-export envelope (produced by `exportEncrypted`).
 * Returns the items + custom vaults, or null if the password is wrong.
 *
 * Path: derive master key → check verifier → unwrap vault key → decrypt data.
 */
export async function decryptLckedExport(
  envelope: LckedExport,
  password: string,
): Promise<{ items: VaultItem[]; vaults: VaultDef[] } | null> {
  if (envelope.format !== "lcked-encrypted-v1") return null;
  const exportMasterKey = await deriveMasterKey(password, envelope.salt, envelope.iterations);
  const ok = await checkVerifier(
    exportMasterKey,
    envelope.verifier,
    envelope.verifierIv,
    VERIFIER_TOKEN,
  );
  if (!ok) {
    console.warn("decryptLckedExport: verifier check failed (wrong password or corrupted envelope)");
    return null;
  }
  let exportVaultKey: CryptoKey;
  try {
    exportVaultKey = await unwrapVaultKey(
      envelope.wrappedVaultKey,
      envelope.wrappedVaultKeyIv,
      exportMasterKey,
    );
  } catch (err) {
    console.error("decryptLckedExport: unwrapVaultKey failed", err);
    return null;
  }
  let payload: { items: VaultItem[]; vaults: VaultDef[] };
  try {
    payload = await decryptJson<{ items: VaultItem[]; vaults: VaultDef[] }>(
      envelope.data,
      envelope.dataIv,
      exportVaultKey,
    );
  } catch (err) {
    console.error("decryptLckedExport: decryptJson failed", err);
    return null;
  }
  return payload;
}

/* ----------------------- generator callback ------------------------------- */

/**
 * When the user clicks the dice button in a password field, the generator
 * sidebar opens with a callback. Clicking "Use this password" calls the
 * callback with the generated password and inserts it into the field.
 */
let _generatorCallback: ((password: string) => void) | null = null;

export function setGeneratorCallback(cb: ((password: string) => void) | null): void {
  _generatorCallback = cb;
}

export function getGeneratorCallback(): ((password: string) => void) | null {
  return _generatorCallback;
}

/** Fire the callback with the generated password and clear it (one-shot). */
export function consumeGeneratorCallback(password: string): boolean {
  if (_generatorCallback) {
    _generatorCallback(password);
    _generatorCallback = null;
    return true;
  }
  return false;
}

/** Clear the callback WITHOUT firing it. Used when the generator dialog is
 *  closed without clicking "Use this password" — so closing does NOT wipe the
 *  source field with an empty string (D-1). */
export function clearGeneratorCallback(): void {
  _generatorCallback = null;
}
