# LCKED — Domain Context

Single-context repo. ADRs live in `docs/adr/`. A local-first password manager:
all data stays in the browser (IndexedDB), nothing leaves the device.

## Glossary

Use these terms as defined. If your output names a domain concept, use the
glossary's vocabulary — don't drift to synonyms.

- **Vault** — the encrypted store. A singleton `VaultMeta` persisted to
  IndexedDB (salt, iterations, wrapped vault key, verifier, settings, custom
  vaults). Holds the Item records.
  - **Main vault** — the implicit container, shown as "All Items"
    (`activeVault: "all"`). Not a stored `VaultDef`; every item belongs to it
    by default (empty `vaultIds`).
  - **Custom vault** — a named, colored, iconed container (`VaultDef`). Items
    join it via the `vaultIds` membership field and can belong to several.

- **Master Password** — the user's only key. There is no recovery, no reset,
  no backdoor; forgetting it loses the data permanently.

- **Master Key / Vault Key** — the crypto chain: the Master Password is
  PBKDF2-derived into a **Master Key** (with a salt), which wraps a randomly
  generated **Vault Key** (AES-256-GCM). Items are encrypted and decrypted
  with the Vault Key; the verifier proves the Master Password without storing
  it. The Master Key is never persisted; the Vault Key is held in memory while
  unlocked.

- **Item** — a stored record (`VaultItem`), a discriminated union of four
  types: **login**, **note**, **card**, **identity**. Each carries a `details`
  payload for its type plus shared fields: `favorite`, `pinned`, `folder`,
  `customFields`, `vaultIds` (membership), `trashed`/`trashedAt`, and
  created/updated timestamps. New items inherit the canonical empty defaults
  (`ITEM_DEFAULTS` in `src/lib/item-crud.ts`), and legacy records are migrated
  onto the same defaults at unlock.

- **Export** — producing a file from the current items: a plain CSV
  (`exportToCsv`) or an encrypted **Backup**. `src/lib/import-export/` owns the
  parsers and exporters.

- **Backup** — the LCKED encrypted export envelope (`lcked-encrypted-v1`), the
  only safe round-trip format. Produced by `exportEncrypted`: the export
  password derives an export Master Key that wraps a fresh export Vault Key,
  which encrypts the `{ items, vaults }` payload. Importing anything else
  (Bitwarden/Proton/1Password/KeePass) is an *import*, not a Backup.

- **Restore** — the setup-time path that brings a Backup (or a plain import)
  into a freshly created vault. Implemented by the store-free `restoreVault`
  in `src/lib/vault-restore.ts`: for a Backup it decrypts *before* creating
  anything (a wrong password returns `{ ok: false, reason: "wrong-password" }`
  and never leaves an empty vault), re-creates custom vaults, remaps item
  vault memberships by name+color+icon (unmatched ids are dropped), and saves
  items best-effort. The plain-import and no-file paths flow through the same
  entry point.

- **Untrash** — what "restore" means for a single trashed item
  (`restoreItem`/`restoreItems`/`restoreAllTrash`): clearing `trashed` and
  `trashedAt`. Do not call this *Restore* — that word is reserved for Backup
  restore above.

- **Trash** — soft-delete. Trashing marks an item `trashed` + `trashedAt`
  (record stays encrypted in IndexedDB, so it can be untrashed). On the next
  unlock, items trashed more than 30 days ago are purged (TTL). Permanent
  delete removes the ciphertext outright.

- **Favorites** — a per-item `favorite` flag with a bulk `clearFavorites`
  action.

- **Generator** — the password generator (store state + UI panel). Generates
  candidate passwords; does not store or submit them.

- **Clipboard** — copy-to-clipboard with a timed auto-clear; the app clears
  any lingering clipboard timers on state transitions.

- **TOTP** — two-factor codes generated from the secret stored on a login
  item's `details.totp`.

## Conventions

- **Active view** — the current filter (`activeVault: "all"` for the main
  vault, a custom vault id, or the trash view). UI actions (new item,
  duplicate, copy-to-vault) target the active view.
- **Item policy** — sorting (most-recently-updated), the downgrade
  `VaultItem → NewItemInput`, encrypt-and-persist, and the canonical empty
  item all live in `src/lib/item-crud.ts`; use them rather than re-implementing
  the shape.
- **Bulk actions** (trash, move, restore, permanently delete) live on the
  store, filter no-ops, batch through the item module, and return
  success/failure counts; the UI toasts from those counts. Optimistic delete
  rolls back only the rows whose IndexedDB write failed.
