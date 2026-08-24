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
  (`ITEM_DEFAULTS` in `src/lib/items/item-crud.ts`), and legacy records are migrated
  onto the same defaults at unlock.

  - **Item loader** — load-time policy for stored Items: decrypt with the
    Vault Key, migrate legacy records onto canonical defaults, purge expired
    Trash (`loadDecryptedItems` in `src/lib/items/item-loader.ts`). Unlock
    calls it; export/backup features should too.

- **Import** — bringing credentials from another password manager into the
  Vault through the `src/lib/import/` parsers. One-way and best-effort: rows
  map onto Item defaults, per-row failures are reported, never fatal. Not a
  Backup round-trip — see Backup. A file whose shape matches no known source
  is an **Unrecognized import** — a warning result with zero Items; nothing
  is guessed.

- **Sources** — the catalog of origin password managers Import accepts
  (`IMPORT_SOURCES` in `src/lib/import/sources.ts`: id, display label, icon,
  file hint). UI renders the manager list from the catalog; no surface
  hardcodes it.
- **Export** — producing a file from the current items: a plain CSV
  (`exportToCsv`) or an encrypted **Backup**. `src/lib/import/` owns the
  parsers and exporters.

- **Backup** — the LCKED encrypted export envelope (`lcked-encrypted-v1`), the
  only safe round-trip format. Produced by `exportEncrypted`: the export
  password derives an export Master Key that wraps a fresh export Vault Key,
  which encrypts the `{ items, vaults }` payload. Importing anything else
  (Bitwarden/Proton/1Password/KeePass) is an _import_, not a Backup.

- **Restore** — the setup-time path that brings a Backup (or a plain import)
  into a freshly created vault. Implemented by the store-free `restoreVault`
  in `src/lib/vault/vault-restore.ts`: for a Backup it decrypts _before_ creating
  anything (a wrong password returns `{ ok: false, reason: "wrong-password" }`
  and never leaves an empty vault), re-creates custom vaults, remaps item
  vault memberships by name+color+icon (unmatched ids are dropped), and saves
  items best-effort. The plain-import and no-file paths flow through the same
  entry point.

- **Untrash** — what "restore" means for a single trashed item
  (`restoreItem`/`restoreItems`/`restoreAllTrash`): clearing `trashed` and
  `trashedAt`. Do not call this _Restore_ — that word is reserved for Backup
  restore above.

- **Trash** — soft-delete. Trashing marks an item `trashed` + `trashedAt`
  (record stays encrypted in IndexedDB, so it can be untrashed). The Item
  loader purges items trashed more than 30 days ago (TTL) at the next
  unlock. Permanent delete removes the ciphertext outright.

- **Favorites** — a per-item `favorite` flag with a bulk `clearFavorites`
  action.
- **Type filter** — the secondary list filter narrowing by Item kind
  (login/note/card/identity, or all), shown in the list header. Distinct from
  the Active view, which filters by container.
- **Multi-select** — list mode that gathers several Items as bulk-action
  targets; it ends when an action completes or the Active view changes.

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
  item all live in `src/lib/items/item-crud.ts`; use them rather than re-implementing
  the shape.
- **Item mutations** (single or bulk — trash, restore, move, favorite/pin
  toggles, duplicate, copy-to-vault, permanent delete, empty trash) live on
  the store, filter no-ops, and resolve to one uniform
  `BulkResult { done, failed }` — never rejecting for row-level failures;
  a throw is reserved for invariant violations ("Vault is locked").
  Optimistic delete rolls back only the rows whose IndexedDB write failed,
  via one shared batch-delete path in the item module. Reporting is
  per-surface: the UI toasts from those counts through a single reporting
  helper where a report is wanted; instant-feedback toggles consume the
  same result silently. No call site owns its own result ladder.
- **One channel** — anything one component commands of another travels through
  the vault store as typed state and actions. Sanctioned exceptions: the
  Generator bridge (a closure handoff into a focused field) and the
  diamond-spin animation event (per-frame pointer coordinates — deliberately
  not app state). See ADR 0004.
