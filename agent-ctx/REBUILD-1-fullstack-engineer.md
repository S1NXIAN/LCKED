# Task REBUILD-1 — Full-Stack Engineer

**Task:** Recreate/update 5 critical LCKED files after partial project reset (types.ts, vault.ts, vault-assets.ts, favicon-icon.tsx, globals.css).

## Context discovered
- LCKED is a local-first, zero-knowledge password manager (Next.js 16 + Zustand + Dexie + Web Crypto).
- The codebase had components that already referenced new APIs (`vaults`, `trashItem`, `restoreItem`, `permanentlyDeleteItem`, `FaviconIcon`, `item.trashed`, `item.vaultId`) that didn't exist in the foundation files. The reset removed the foundation types/store but left the components intact.
- Worklog shows prior tasks LCKED-1, RESEARCH-A/B, PLAN-SYNTH, IMPL-PHASES-ABCD had already built the full app + design plan.

## What I did

### 1. `src/lib/types.ts`
- Added to `BaseItem` (after `updatedAt`): `vaultId: string | null`, `trashed: boolean`, `trashedAt: number | null`.
- Added new `VaultDef` interface (id/name/color/icon/createdAt).
- Added `vaults: VaultDef[]` field to `VaultMeta`.
- Updated `FilterType` to `"all" | "trash" | ItemType | "favorites" | { vault: string }`.

### 2. `src/store/vault.ts`
- Imported `VaultDef` type.
- Added state: `vaults: VaultDef[]`, `activeVault: string` (default `"all"`), `vaultEditorOpen: boolean`, `editingVaultId: string | null`, `createVaultDialogOpen: boolean`.
- Replaced `deleteItem` with `trashItem` (soft-delete, stamps `trashedAt`).
- Added: `restoreItem`, `permanentlyDeleteItem`, `emptyTrash`, `moveItemToVault`, `createVault`, `deleteVault`, `renameVault`, `updateVault`, `setActiveVault`, `setVaultEditorOpen`, `setCreateVaultDialogOpen`.
- Added `updateItemFlags` helper at the bottom of the file — single fault-tolerant code path that patches vaultId/trashed/trashedAt/updatedAt on an item, re-encrypts, persists, and updates the store. Used by `trashItem`/`restoreItem`/`moveItemToVault`.
- `saveItem` now preserves `vaultId`/`trashed`/`trashedAt` from the existing item when editing (and from the input's `vaultId` when creating new).
- `duplicateItem` strips `trashed`/`trashedAt` from the duplicate so it lands in the active view, not Trash.
- `unlock` now:
  - **Migration:** adds `vaultId=null`, `trashed=false`, `trashedAt=null` to old items missing these fields, then re-encrypts + persists them in a single batch (`toReencrypt`).
  - **30-day auto-delete:** drops trashed items whose `trashedAt` is older than 30 days (`TRASH_TTL_MS`).
  - **Vaults hydration:** reads `meta.vaults` (defensive `Array.isArray` check) and persists an empty array if missing.
- `setupVault` writes `vaults: []` to the new meta.
- `lock` and `resetVault` clear vault-related UI state.
- `exportEncrypted` now includes `vaults` in the encrypted payload.
- Generator callback registry (already at the bottom of the file) preserved unchanged.
- Updated `use-vault-keybinds.tsx` to call `trashItem` instead of the removed `deleteItem`.
- Updated `item-editor.tsx` `blankItem` to include the 3 new BaseItem fields so NewItemInput typechecks.

### 3. `src/lib/vault-assets.ts` (new)
- `VAULT_COLORS` array of 10 Proton Pass colors (heliotrope #A779FF, mauvelous #F29292, marigold #F7D775, de-york #91C799, jordy-blue #92B3F2, lavender-magenta #EB8DD6, chestnut-rose #CD5A6F, porsche #E4A367, mercury #E6E6E6, water-leaf #9EE2E6).
- `VAULT_ICONS` array of 30 Lucide icon names (home, briefcase, gift, shopping-cart, heart, star, shield, lock, key, eye, user, users, building, bank (Banknote), credit-card, wallet, plane, car, fuel, globe, mail, phone, smartphone, laptop, server, cloud, database, hard-drive, cpu, network).
- Resolvers: `vaultColorHex(id)`, `vaultColorLabel(id)`, `vaultIconName(id)`, `vaultIconLabel(id)` — all fall back to defaults so a stale id from an older LCKED version never crashes.
- Exported `DEFAULT_VAULT_COLOR` and `DEFAULT_VAULT_ICON` constants.

### 4. `src/components/lcked/favicon-icon.tsx` (new)
- `FaviconIcon` component with props `url`, `size` (default 32), `className`.
- Parses the URL (adds `https://` if missing) and strips leading `www.` for cleaner letter avatars + better favicon cache hit rate.
- Fetches `https://www.google.com/s2/favicons?domain=DOMAIN&sz=SIZE` via a plain `<img>` (lazy, `referrerPolicy="no-referrer"`).
- Falls back to a colored letter-avatar on (a) parse failure, (b) `<img>` onError. The hue is a deterministic djb2 hash of the hostname, so the same site always gets the same color. Letter text is dark for yellow/green hues, white otherwise — basic perceptual contrast.
- Resets the failure flag when `url` changes (new site deserves a fresh fetch).

### 5. `src/app/globals.css`
- Updated the `.dark` block to the exact Proton Pass hex palette:
  - `--background: #1F1F31`, `--card: #282839`, `--sidebar: #191926`
  - `--primary: #7777F8`, `--border: #38384C`, `--input: #7A7AAD`
  - `--muted-foreground: #BFB9D8`, `--destructive: #F08FA4`
  - `--popover`, `--ring`, `--chart-1`, `--sidebar-*` also aligned to the new palette.
- Aligned the 5-step `--surface-*` ramp to the new hex values (base=#1F1F31, raised=#282839, overlay=#2F2F44, popover=#282839, tooltip=#38384C).
- Added signal colors to `:root` (so they're identical in light + dark):
  - `--signal-success: #4AB89A`, `--signal-warning: #FFB84D`, `--signal-danger: #F08FA4`, `--signal-info: #4AC0FF`.
- Added `--pass-sidebar-size: 22.5rem` (360px) to `@theme inline`.
- Added 10 vault color CSS vars to `:root` (`--vault-heliotrope` … `--vault-water-leaf`) with the matching `--color-vault-*` aliases in `@theme inline` so Tailwind can consume them.
- Light mode untouched (only `.dark` was in scope).
- Preserved all existing helper classes: `.lcked-active-glow`, `.lcked-grid`, `.lcked-glow`, `.lcked-scroll`, `.lcked-pulse`, `.lcked-sunset-flash`.
- Preserved `.font-secret` with `font-feature-settings: "tnum" 1, "zero" 1`.
- Preserved `prefers-reduced-motion` guard.

## Verification
- `bun run lint` after every file → 0 errors, 0 warnings (final state).
- `bunx tsc --noEmit` shows only pre-existing errors in `command-palette.tsx` (Dialog `shouldFilter` prop) and `item-editor.tsx` (TS can't narrow `form.details` based on `form.type` because `Omit` doesn't distribute over the discriminated union). Verified these existed BEFORE my changes by `git stash` + `tsc` + `git stash pop`.
- Dev server (`bun run dev`) — confirmed in `dev.log`: the previous "Module not found: Can't resolve './favicon-icon'" errors are gone, server now reports `✓ Compiled in …` and `GET / 200`. Manually verified `curl http://localhost:3000/` returns 200.
- All required vault store methods present and exported; old `deleteItem` is gone.

## Files touched
- `src/lib/types.ts` (edited)
- `src/store/vault.ts` (edited)
- `src/lib/vault-assets.ts` (new)
- `src/components/lcked/favicon-icon.tsx` (new)
- `src/app/globals.css` (edited)
- `src/components/lcked/use-vault-keybinds.tsx` (small fix: `deleteItem` → `trashItem`)
- `src/components/lcked/item-editor.tsx` (small fix: added new BaseItem fields to `blankItem`)

## Notes for next agent
- The `vaults` array lives in `VaultMeta` (plaintext-side persistence, stored in IndexedDB alongside the salt/verifier). It contains no secrets (just names/colors/icons) but is also bundled inside the encrypted export envelope for self-contained backups.
- `activeVault` is intentionally NOT in the `partialize` list — users start at "All" on each unlock.
- `deleteVault` orphan-rescue: items in the deleted vault get `vaultId=null` and are re-encrypted. This is the safest UX (no accidental item loss).
- `trashItem` keeps the item in IndexedDB (still encrypted) so restore is instant. Auto-purge happens on the next `unlock` after the 30-day TTL.
- Components already reference `setActiveVault`, `setVaultEditorOpen`, `setCreateVaultDialogOpen`, `createVault`, etc. — UI wiring is the next agent's job.
- Favicon fetch goes through Google's S2 service (external). The fallback letter-avatar is fully offline-capable. No PII leak beyond the hostname (which is already in the user's vault).
