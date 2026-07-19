# Task ID: REBUILD-2
**Agent:** Full-Stack Engineer
**Task:** Recreate/update 4 critical LCKED vault UI files (vaults-sidebar, create-vault-dialog, vault-view, item-list) plus a small Settings side-fix.

## Context
The LCKED password manager foundation (types, store, vault-assets, favicon-icon) was rebuilt in REBUILD-1. Several components already referenced the new vaults/trash/favicon APIs but the UI panels that surface them did not yet exist. This task recreates those panels and rewrites the two outdated layout components.

## What I did

### 1. `src/components/lcked/vaults-sidebar.tsx` (NEW)
- Exports `VaultsSidebar` and a reusable `VaultIcon` component (used by the picker too).
- `VaultIcon({ icon, color, size })` resolves a `VAULT_ICONS` id → Lucide component via a static `LUCIDE_BY_ID` map (30 entries, mirrors `VAULT_ICONS` 1:1). Falls back to `Home` so a stale id never crashes. Renders a colored rounded swatch (vault color at ~16% opacity) with the glyph in full hex.
- Rows: `VaultRow` — the shared row primitive. When a `menu` is present it renders as `<div role="button">` (NOT a `<button>`) so the menu trigger button doesn't nest inside another button. A `data-menu-slot` div reserves a fixed 7×7 slot on EVERY row so counts align.
- Fixed rows: All Items (ShieldCheck, `#7777F8`), Favorites (Star, `#FFB84D`), Trash (Trash2, amber when non-empty, `mt-auto`).
- Custom vaults: each via `CustomVaultRow` (separate component) with a `⋮` DropdownMenu containing Rename + Delete vault. Delete opens an AlertDialog; managed via local `confirmOpen` state so the dropdown closes cleanly before the alert appears (nesting AlertDialogTrigger inside DropdownMenuItem leaves the dropdown visually stuck).
- Header: "Vaults" label + `+` button → `setCreateVaultDialogOpen(true)`.
- Drag-and-drop targets: every row. The VaultRow's own drop handler covers the simple "move to vault" case (`dropVaultId={v.id}` → `moveItemToVault`). The fixed rows (All/Favorites/Trash) use parent-div drop handlers because their semantics differ:
  - All Items drop → `moveItemToVault(id, null)` (default vault)
  - Favorites drop → `toggleFavorite(id)` if not already a favorite
  - Trash drop → `trashItem(id)` (soft-delete)
  - `dragOver` ring-highlight is driven by a local `overKey` state.
- Counts are live (re-computed each render from `items`).

### 2. `src/components/lcked/create-vault-dialog.tsx` (NEW)
- Right-side **Sheet** (not Dialog). Handles BOTH create and edit modes via two store flags:
  - `createVaultDialogOpen` → blank form, "Create vault" title, no delete button
  - `vaultEditorOpen + editingVaultId` → pre-fills from the existing VaultDef, "Edit vault" title, delete button at the bottom
- `open = createOpen || editorOpen`. Edit mode is only active when `editingVaultId` resolves to a real vault.
- Form state: `name`, `color` (defaults `heliotrope`), `icon` (defaults `home`). Re-hydrated via `useEffect` whenever the sheet opens or the target vault changes.
- Header layout: close (X, LEFT) + centered title + Save button (RIGHT). The built-in SheetPrimitive.Close (top-right) is hidden via `[&>button:last-child]:hidden` so it doesn't conflict with the custom header.
- Body: live preview (VaultIcon + name), name input (Enter to save), 10-color grid (with check on selected), 30-icon grid (uses VaultIcon with the live color so the picker shows the icon in the chosen color).
- Save → `createVault(name, color, icon)` or `updateVault(id, {name, color, icon})` depending on mode.
- Edit mode footer: a "Delete vault" button → AlertDialog → `deleteVault(id)`. Uses the same orphan-rescue semantics from REBUILD-1.
- Styling: `bg-background` + `border-border` to match the item editor.

### 3. `src/components/lcked/vault-view.tsx` (UPDATE — full rewrite)
- New responsive 3-stage sidebar:
  - **< lg**: sidebar hidden. Mobile shows a compact brand + lock in the search header.
  - **lg**: 64px icon rail (DiamondMark brand, icon-only Generator/Settings/ThemeToggle/Lock buttons with tooltips on hover).
  - **xl+**: expanded to `w-[var(--pass-sidebar-size)]` (360px) with the full brand lockup, VaultsSidebar, and labeled action rows (Generator/Settings/Theme/Lock).
- Right area: full-width **search header** above the list+detail row. Contains: mobile brand+lock, search input, `?` cheat-sheet hint, item-count badge, New dropdown (DropdownMenu with 4 color-coded item types: violet Login, amber Note, emerald Card, sky Identity).
- `createItem(type)` calls `stashNewItemType(type)` + `setEditorOpen(true)`.
- List column (`md:w-80 lg:w-96`) + Detail column (`flex-1`) row below the header. Both use `bg-background` (same as sidebar) so the surface language is unified — only the `border-r` separates them.
- LabeledThemeToggle: a small inline component (since ThemeToggle ships icon-only). Same `next-themes` pattern.
- `setFilterUnified` is a `useCallback` declared BEFORE `useVaultKeybinds` to satisfy the `react-hooks/immutability` rule (function declarations are hoisted in JS but the linter is stricter). It dispatches FilterType values to either `setActiveVault` ("all"/"favorites"/"trash") or `setTypeFilter` (ItemType).
- Kept everything from the old version: AutoLockManager, AriaLiveRegion, KeyboardContext, leader-key hint chip, reveal-all indicator, mobile FAB, CheatSheet, LargeTypeReveal, CommandPalette, all dialogs.
- **Removed** Import/Export from the sidebar — it's in Settings now (see #5).
- Command-palette hint badge still shows `⌘\` (not `⌘K`) — kept the existing visual hint unchanged.

### 4. `src/components/lcked/item-list.tsx` (UPDATE — full rewrite)
- Reads `activeVault` from the store (also accepts it as a prop for explicit re-render). Filters accordingly:
  - `trash` → only trashed items
  - `favorites` → favorited, not trashed
  - `<vaultId>` → items in that vault
  - `all` (default) → all non-trashed items
- Combined with the secondary Type filter (`all` / `login` / `note` / `card` / `identity`) from the local state. Type filter is now a `Select` dropdown (defaults "All") — the old horizontal chip row is gone.
- Sort dropdown: Newest / Oldest / A–Z.
- Multi-select button toggles a mode where each row shows a checkbox instead of the favicon/type-icon. A collapsible action bar appears with Cancel + count + Move (vault dropdown) + Trash. Move uses a sub-DropdownMenu listing All Items + each custom vault.
- **Draggable items**: `draggable=true` on the inner `<button>` (NOT on the motion.li — Framer Motion's `onDragStart` prop type conflicts with native HTML5 drag). `onDragStart` sets `text/lcked-item` data. Drag image is the button itself.
- **Favicons for logins**: `FaviconIcon` for login items with a URL, otherwise the `ItemTypeIcon`.
- **DiamondMark** in the empty state (kept from prior implementation). Trash empty state has its own copy + "Back to All Items" CTA.
- `lcked-active-glow` sliding selection via `layoutId="active-row"` (preserved).
- Trash view shows inline Restore + Delete-permanently buttons on hover (right side, where the type badge normally goes).
- Trashed items render with line-through + reduced opacity for clear visual differentiation.
- Reads `searchQuery` from the store (search input is in the header, not in the list).

### 5. `src/components/lcked/settings-dialog.tsx` (small side-fix)
- Added an Import/Export section between Change master password and Storage. Button opens the dedicated `ImportExportDialog` via `setImportExportOpen(true)` after a 50ms delay so this dialog's close transition doesn't fight the import/export dialog's open transition.
- Added `Upload` to the lucide-react imports.

## Verification
- `bun run lint` → **0 errors, 0 warnings**.
- `bunx tsc --noEmit` shows only pre-existing errors (verified — same set REBUILD-1 documented): `command-palette.tsx` (`shouldFilter` prop) and `item-editor.tsx` (TS can't narrow `form.details` after `form.type` check because `Omit` doesn't distribute over discriminated unions). None caused by this task.
- Initial lint failure: `react-hooks/immutability` flagged `setFilterUnified` for being "accessed before declaration" even though function declarations are hoisted. Fixed by converting to `useCallback` declared before `useVaultKeybinds`.
- Initial TS failure: `motion.li`'s `onDragStart` prop is typed as Framer's drag handler (MouseEvent | TouchEvent | PointerEvent), not native HTML5 drag. Fixed by moving `draggable` + `onDragStart` to the inner `<button>` (a plain DOM element).
- Dev server (`bun run dev`): `dev.log` shows `✓ Compiled in …` and `GET / 200 in …ms` repeatedly. `curl http://localhost:3000/` returns 200. No runtime errors.

## Files touched
- `src/components/lcked/vaults-sidebar.tsx` (NEW)
- `src/components/lcked/create-vault-dialog.tsx` (NEW)
- `src/components/lcked/vault-view.tsx` (full rewrite)
- `src/components/lcked/item-list.tsx` (full rewrite)
- `src/components/lcked/settings-dialog.tsx` (small addition: Import/Export section + Upload import)

## Notes for next agents
- `VaultIcon` is exported from `vaults-sidebar.tsx` and is the single source of truth for rendering a vault's icon. The `LUCIDE_BY_ID` map is keyed by the VAULT_ICONS id (e.g. "home", "briefcase") — if you add a new icon to `VAULT_ICONS` you MUST add the matching entry to `LUCIDE_BY_ID` here.
- The vault filter (`activeVault`) and the type filter (`typeFilter` local to vault-view) are intentionally separate concerns. Leader-key `g a/l/c/n/i` switches between them via `setFilterUnified`.
- Drag-and-drop semantics are deliberate:
  - Drag onto a custom vault = move to that vault
  - Drag onto All Items = move to default vault (vaultId = null)
  - Drag onto Favorites = toggle favorite on (no-op if already favorite)
  - Drag onto Trash = soft-delete
- The Sidebar's "Rename" menu opens the same `CreateVaultDialog` Sheet in edit mode (via `setVaultEditorOpen(true, id)`). The "+" header button opens it in create mode (via `setCreateVaultDialogOpen(true)`). One Sheet handles both.
- Item-list's multi-select state is local (not in the store) since it's a transient UI mode. If you need to programmatically trigger multi-select from elsewhere, you'd need to lift it into the store first.
