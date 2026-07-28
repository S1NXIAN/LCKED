# Task ID: VAULTSIDEBAR-REWRITE
**Agent:** Frontend Engineer
**Task:** Rewrite `src/components/lcked/vaults-sidebar.tsx` — two-line row layout, always-visible ⋮ menus, Edit (was Rename), Organize vaults dialog, Trash restore/empty menu, Move-all-items submenu, Hide/Unhide + hidden-vault filtering.

## Context
The LCKED password manager store (`src/store/vault.ts`) was extended with vault-hide + bulk-move + trash-bulk APIs:
- `hiddenVaultIds: string[]`
- `toggleVaultHidden(vaultId: string): void`
- `moveAllItems(fromVaultId, toVaultId): Promise<void>`
- `emptyTrash(): Promise<void>`
- `restoreItem(id): Promise<void>` (existing, now driven from a "Restore all items" action)

The previous sidebar (`vaults-sidebar.tsx`, written by REBUILD-2) had a single-line layout, hover-gated ⋮ menu, and only Rename / Delete on custom vaults. This task rewrites it to surface the new store capabilities and to give the fixed rows (All Items / Trash) their own ⋮ menus.

## What I did

### `src/components/lcked/vaults-sidebar.tsx` (full rewrite)
- **`VaultRow` primitive — two-line layout.** Label on top (`text-sm font-medium leading-tight`), "N items" beneath (`text-xs text-muted-foreground tabular-nums`). The right-aligned count number is gone — count now lives under the label. The reserved `data-menu-slot` (7×7) is preserved on every row so right edges align. Drag-and-drop behavior unchanged.
- **Always-visible ⋮ trigger.** New `MenuButton` (forwardRef — required for `DropdownMenuTrigger asChild` to forward a ref). Subtle `text-muted-foreground` tint with `hover:bg-muted hover:text-foreground`. `onClick` calls `stopPropagation` so opening the menu doesn't also select the row.
- **All Items ⋮ → Organize vaults.** Single-item menu. Opens an AlertDialog that lists every custom vault (visible OR hidden) with a Checkbox (checked = visible). Toggling calls `toggleVaultHidden(vaultId)`. Hidden vaults render at 60% opacity with an `EyeOff + Hidden` badge. Empty-state copy when `vaults.length === 0`. Single "Done" action closes.
- **Trash ⋮ → Restore all items / Empty trash.** "Restore all items" calls `restoreItem` for every trashed item via `Promise.all` and toasts the count. "Empty trash" opens a destructive AlertDialog that calls `emptyTrash()` on confirm. Both items are `disabled` when `trashCount === 0`.
- **Custom vault ⋮ → Edit / Move all items / Hide vault / Delete vault.**
  - "Edit" (was "Rename") → `setVaultEditorOpen(true, vault.id)`.
  - "Move all items" — only rendered when `count > 1`. Uses `DropdownMenuSub` to list "All Items" (`vaultId = null`) + every OTHER custom vault (hidden ones included — they're valid move targets) rendered with their `VaultIcon`. Selecting a target calls `moveAllItems`, toasts "Moved all items from X to Y", and switches `activeVault` to the destination.
  - "Hide vault" → `toggleVaultHidden(vault.id)`. If the active vault is the one just hidden, jumps back to "all" so the user doesn't end up looking at an empty filter.
  - "Delete vault" — destructive AlertDialog confirm → `deleteVault(vault.id)` (existing orphan-rescue semantics).
- **Hidden-vault filtering.** `visibleVaults = vaults.filter((v) => !hiddenVaultIds.includes(v.id))`. The sidebar renders `visibleVaults`; the Organize dialog iterates over the full `vaults` list so hidden ones can be unhidden.
- **Favorites** intentionally has no menu (per spec only All Items, Trash, and custom vaults get menus). Still uses the two-line layout; its menu slot is empty so the right edge lines up.
- **Preserved patterns.** Parent-div drop handlers on All Items / Favorites / Trash (their drop semantics differ from custom-vault rows). `overKey` ring-highlight state. `data-menu-slot` click-guard. `<div role="button">` wrapper when a menu is present (avoids invalid nested-button HTML).
- **Kept exports.** `VaultIcon` and the `LUCIDE_BY_ID` 1:1 mirror of `VAULT_ICONS` (including the `eye: Eye` mapping) — `create-vault-dialog.tsx` imports both.

## Verification
- `bun run lint` → **0 errors, 0 warnings**.
- `bunx tsc --noEmit` → no errors in `vaults-sidebar.tsx`. Pre-existing errors remain in `src/lib/import-export.ts`, `src/lib/totp.ts`, `src/store/vault.ts` (untouched; same set the prior agents documented).
- Dev server (`bun run dev`): `dev.log` shows `✓ Compiled in 577ms / 240ms / 268ms` after each save and `GET / 200 in 310ms`. No runtime errors.

## Files touched
- `src/components/lcked/vaults-sidebar.tsx` (full rewrite)

## Notes for next agents
- The "Move all items" submenu lists hidden vaults too — they're valid move targets even though they don't appear in the sidebar. If you want to hide them from the submenu as well, filter `otherVaults` by `hiddenVaultIds` in `renderCustomVault` before passing it down.
- The "Hide vault" action in the custom-vault menu always says "Hide vault" — it never says "Unhide" — because hidden vaults aren't rendered in the sidebar so the menu can only be opened on a visible vault. Unhiding is exclusively done via the Organize vaults dialog.
- The `MenuButton` is a `forwardRef` component — keep it that way; `DropdownMenuTrigger asChild` clones its child and needs a ref.
- The destructive-menu pattern (`e.preventDefault()` on Radix `onSelect` + local `confirmOpen` state + AlertDialog) is reused three times now (delete vault, empty trash). If a fourth destructive confirmation is needed, consider factoring this into a small `useDestructiveConfirm` hook.
- `hiddenVaultIds` is persisted by the store (it lives in the `persist` middleware scope). Toggling hide/unhide survives reloads — no extra work needed.
