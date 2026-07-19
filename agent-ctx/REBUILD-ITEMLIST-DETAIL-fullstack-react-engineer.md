# Task ID: REBUILD-ITEMLIST-DETAIL
**Agent:** Full-Stack React Engineer
**Date:** 2026-07-18
**Task:** Rebuild `src/components/lcked/item-list.tsx` (12 features) and `src/components/lcked/item-detail.tsx` (4 features) after sandbox reset.

## Context
Both target files existed but were older versions missing the signature interactions called out in the task spec. Adjacent foundation files (`src/lib/types.ts`, `src/store/vault.ts`) also needed minimal support edits because two of the new features reference settings (`showFavicons`, `sortFavoritesFirst`) that didn't exist on `VaultSettings` yet.

This agent did NOT need to read prior agents' work in `/agent-ctx` because the task was self-contained (rebuild 2 files + minimal support edits). However, the prior REBUILD-1 and REBUILD-2 worklogs were consulted to understand the `BaseItem` schema (which already had `vaultId/trashed/trashedAt` from REBUILD-1) and the existing component structure.

## Files touched
1. `src/lib/types.ts` — added `showFavicons: boolean` and `sortFavoritesFirst: boolean` to `VaultSettings`; defaulted both to `true` in `DEFAULT_VAULT_SETTINGS`.
2. `src/store/vault.ts` — `unlock()` now merges loaded settings with `DEFAULT_VAULT_SETTINGS` (`{ ...DEFAULT_VAULT_SETTINGS, ...meta.settings }`) so existing vaults persisted before these fields existed get sane defaults.
3. `src/components/lcked/item-list.tsx` — full rewrite with 12 new features.
4. `src/components/lcked/item-detail.tsx` — full rewrite with 4 new features.

## item-list.tsx — 12 features

### 1. ActiveRowHighlight (signature motion)
- Single persistent highlight rendered ONCE as the first child of the `<ul>` (replaces the per-item `<motion.div layoutId="active-row">`).
- rAF spring with exponential lerp (factor 0.22) on x/y/w/h.
- Uses the `animateRef` pattern: latest `step` function stashed in a ref inside `useEffect` so external listeners (scroll, MutationObserver) can `kick()` the loop without re-binding.
- On `activeId` change: measure + start animation. If item not found in DOM, `setVisible(false)`.
- First activation snaps to target (via `wasVisibleRef`) so the highlight doesn't slide in from (0,0); subsequent activations animate from current position.
- MutationObserver re-checks when list DOM changes (childList/subtree/`data-item-id` attribute).
- Scroll listener on both the closest `[data-radix-scroll-area-viewport]` (or `parentElement`) and `window`.
- `<ul>` has `ref={listRef}` and `className="relative …"`. LIs get `className="relative"` so they paint on top of the highlight (tree-order within the same stacking level).

### 2. Sort persistence
- `useState<SortKey>(() => localStorage.getItem("lcked-sort") as SortKey || "newest")` (SSR-safe via `typeof window` check).
- `setSort` callback writes to `localStorage` inside a try/catch (private mode tolerant).
- Validates the stored value is one of the three known SortKeys; falls back to `"newest"` otherwise.

### 3. LayoutGrid icon on type Select trigger
- `LayoutGrid` imported from lucide-react.
- Rendered inside the `SelectTrigger` before the `SelectValue`.

### 4. Sort dropdown visibility fix
- Sort button changed from `variant="secondary"` to `variant="outline" bg-muted/40 border-border` (matches the type Select trigger).
- Harmonizes the filter bar — both dropdowns now have the same visual weight.

### 5. Sort logic fix
- Sort comparator now handles three layers:
  1. **Pin** always pins to top (placeholder `false` until a `pinned` field is added to `BaseItem`).
  2. **Favorite** only sorts to top when `sortFavoritesFirst` is on.
  3. **Favorite takes priority over pin** when both are active.
- Then the primary sort (newest/oldest/A–Z) runs within each tier.

### 6. 3-dots Select dropdown
- Replaced the plain "Select" toggle button with a `DropdownMenu` triggered by a `MoreVertical` icon button.
- Contents:
  - "Multi-select" / "Exit multi-select" (toggles `multiSelect`)
  - `DropdownMenuSeparator`
  - "Select all" (selects all `filtered` ids)
  - "Deselect all" (clears `selectedIds`)
- Both select-all/deselect-all are disabled when there's nothing to act on.

### 7. Multi-select bar
- Removed the old "Select" toggle button (now in the 3-dots menu).
- Replaced the bare `{selectedIds.size} selected` number with `"N Item(s) selected"` text styled with `minWidth: 130px` (inline style to guarantee the width regardless of Tailwind purge).
- Singular/plural handled: `"1 Item selected"` vs `"N Items selected"`.

### 8. Empty-field context menu
- Wrapped the list `ScrollArea` in a `ContextMenu`.
- Contents: "New Login", "New Note", "New Card", "New Identity" (color-coded with `KeyRound`/`StickyNote`/`CreditCard`/`UserRound`).
- Added a `createItem(type)` helper that calls `stashNewItemType(type)` from `./new-item-stash` then `setEditorOpen(true)`.
- The `EmptyList` `onCreate` callback now uses `createItem("login")` too.

### 9. useDeferredValue on search query
- `const deferredSearch = React.useDeferredValue(searchQuery)`.
- `searchItems(list, deferredSearch)` replaces the direct query.
- Keeps typing responsive on large vaults by letting the filter/sort work happen at lower priority.

### 10. Item entrance animation
- `motion.li` now uses `initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}`.
- Removed the `y: 4 → 0` transform.
- No per-item delay (was none before, still none).
- `AnimatePresence initial={false}` preserved so the initial mount doesn't flash.

### 11. isEmail in per-item context menu
- Imported `isEmail` from `@/lib/utils`.
- Added a per-item `ContextMenu` (wrapping each item button via `ContextMenuTrigger asChild`).
- First login menu item is "Copy email" or "Copy username" depending on `isEmail(item.details.username)`.
- Also includes "Copy password" / "Copy URL" (when present), separator, "Favorite"/"Unfavorite", "Edit", separator, "Move to trash" (destructive variant).
- A `copyField(value, label)` helper calls `copyWithAutoClear` + `toast.success`.
- The per-item row was extracted to an `ItemRow` sub-component so the parent map doesn't re-render every row when one is right-clicked.

### 12. New lucide-react imports
- `LayoutGrid, MoreVertical, KeyRound, StickyNote, CreditCard, UserRound` added.
- `Inbox` removed (was imported but unused).

## item-detail.tsx — 4 features

### 1. Click-to-copy on FieldRow
- The row `<div>` now has `onClick={copyable && value ? handleCopy : undefined}`.
- `cursor-pointer` added to className (conditional on `rowClickable = copyable && !!value`).
- All action buttons (reveal, large-type, copy) wrap their onClick in `(e) => { e.stopPropagation(); … }` so they don't double-fire `handleCopy` via bubbling.

### 2. Email/username detection
- Imported `isEmail` from `@/lib/utils` and `User` from `lucide-react` (Mail was already imported).
- The login credentials cluster's username `FieldRow` now uses:
  - `label={isEmail(item.details.username) ? "Email" : "Username"}`
  - `icon={isEmail(item.details.username) ? Mail : User}`

### 3. Detail entrance animation
- Outer container is now a stable `<div className="flex h-full flex-col">` that never unmounts across item switches.
- Inside it, `<AnimatePresence mode="wait">` wraps a `<motion.div key={item.id}>` with `initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}` (opacity-only, 0.12s — no y/scale).
- The empty state ("Select an item") is a sibling `<motion.div key="empty">` with the same transition so AnimatePresence crossfades between empty ↔ item and between item ↔ item.
- The old `if (!item) return …` early return was removed so the outer div stays mounted.
- Handlers (`handleTrash`/`handleRestore`/`handlePermanentDelete`/`handleDuplicate`) guard with `if (!item) return` and are only invoked from inside the `item ?` branch.

### 4. Show favicons
- Added `const showFavicons = useVault((s) => s.settings.showFavicons)`.
- The header icon condition is now `showFavicons && item.type === "login" && item.details.urls[0]` (was just `item.type === "login" && item.details.urls[0]`).
- When the setting is off, logins fall back to `ItemTypeIcon` like every other type — fully offline, no Google S2 favicon fetches.

## Verification
- `bun run lint` → **0 errors, 0 warnings** (exit 0). ✓
- `bunx tsc --noEmit` → 0 errors in `item-list.tsx` and `item-detail.tsx`. (Pre-existing errors in `crypto.ts`, `import-export.ts`, `totp.ts`, `vault.ts` are unrelated — they trace back to TypeScript 5's stricter `Uint8Array<ArrayBufferLike>` vs `BufferSource` and to `BaseItem` field additions from REBUILD-1.)
- Dev server (`bun run dev`) — `dev.log` shows `✓ Compiled in …` repeatedly; `curl http://localhost:3000/` returns `200`. No runtime errors.
- Both target files compile cleanly under Turbopack.

## Notes for next agents
- **`ActiveRowHighlight` is the new signature motion** — it replaces the per-item `<motion.div layoutId="active-row">` that RESEARCH-A/IMPL-PHASES-ABCD originally specified. The rAF spring (factor 0.22) is intentionally NOT Framer-driven so it can re-measure on scroll and on MutationObserver callbacks without fighting Framer's own layout animations. If you add `layout` animations to the `<li>` (already present), the highlight will track the animated position frame-by-frame via `getBoundingClientRect()`.
- **`wasVisibleRef` snap-on-first-show** — when the highlight transitions from invisible→visible (first activation, or returning from multi-select mode), it snaps to the target instead of sliding from (0,0). Subsequent activations (item→item) animate smoothly. If you want a different behavior, tweak the `wasVisibleRef` logic in `ActiveRowHighlight`.
- **`sortFavoritesFirst` + `showFavicons`** are now on `VaultSettings` and default to `true`. The settings dialog (`settings-dialog.tsx`) does NOT yet expose toggles for them — adding two `Switch` rows is a 10-line change. The store already persists them via the existing `updateSettings` flow.
- **Per-item context menu** wraps each item button in its own `ContextMenu`. Radix ContextMenu doesn't interfere with the button's left-click (`onClick` still fires) or with HTML5 drag-and-drop (`draggable` is preserved). Right-click opens the menu.
- **`ItemRow` sub-component** was extracted so the parent map stays lean. If you need to add more per-item actions (e.g. "Move to vault…"), add them to `ItemRow`'s `ContextMenuContent` and thread any new store actions through props.
- **Click-to-copy** on `FieldRow` works for every copyable row (login username/password, card number/CVV/PIN, identity fields, custom fields). Masked rows still require reveal first — clicking the row copies the masked value's underlying string (NOT the `•••` display). Reveal/large-type/copy buttons all `stopPropagation` so they don't double-fire.
- **`AnimatePresence mode="wait"`** in the detail means switching items has a brief exit→enter gap (~0.12s). If you want a crossfade instead (both items visible briefly), change to `mode="popLayout"` or remove `mode` entirely.
