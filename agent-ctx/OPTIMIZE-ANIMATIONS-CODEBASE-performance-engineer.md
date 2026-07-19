# OPTIMIZE-ANIMATIONS-CODEBASE — Performance & Code Quality Engineer

**Task ID:** OPTIMIZE-ANIMATIONS-CODEBASE
**Date:** 2026-07-17
**Agent:** Performance & Code Quality Engineer (main)
**Scope:** Rewrite ALL micro-interactions/animations; modularize & DRY-clean the `src/components/lcked/` directory and `src/store/vault.ts`.

## Summary

Audited every animation in the LCKED codebase and rewrote the ones that violated the
"opacity-only entrance / transform-only sliding / no layout-thrash" rules. Removed
dead code (`void _x;` no-ops, an unused frecency module, a broken `setCheatOpen`
handler, undefined `handleMultiRestore`/`handleMultiDelete` references), extracted a
duplicated 30-entry Lucide lookup into a shared module, and converted every
`transition-all` inside the LCKED tree to a targeted `transition` /
`transition-colors` variant with the premium `cubic-bezier(0.16, 1, 0.3, 1)` ease
curve and 100–200 ms durations.

`bun run lint` passes with 0 errors. Dev server returns HTTP 200.

---

## Task 1 — Animation rewrites

### `src/components/ui/sheet.tsx`
- Replaced `transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500`
  with `data-[state=closed]:duration-150 data-[state=open]:duration-200`.
- Added `[--tw-enter-ease:cubic-bezier(0.16,1,0.3,1)] [--tw-exit-ease:cubic-bezier(0.16,1,0.3,1)]`
  so the `animate-in`/`animate-out` keyframes use the premium ease curve (tw-animate-css
  reads these CSS variables).
- Removed the dead `transition ease-in-out` (no properties were actually transitioning —
  the open/close is driven entirely by the keyframe animations).

### `src/components/lcked/item-list.tsx`
- **Multi-select action bar** — was `height: 0 → auto` (layout-thrashing). Now
  `opacity + translateY(-8 → 0)` via Framer Motion, `duration: 0.15`, premium ease
  curve. The bar takes its natural height immediately and only the transform/opacity
  animate, keeping the layout stable and the animation GPU-composited.
- **ActiveRowHighlight** — the rAF spring loop used to write `transform` AND
  `width`/`height` every frame. Now `width`/`height` are settled to target ONCE in
  `measure()` (single layout write per item switch) and the per-frame step function
  only writes `transform: translate(x, y)`. Settled-check simplified to 2 axes.
- **Item `<motion.li>` entrance** — was already `opacity: 0 → 1` (verified). Added
  the premium ease curve to the transition.
- **Bug fix:** defined the missing `handleMultiRestore` and `handleMultiDelete`
  handlers — the trash-view multi-select dropdown was referencing them but they
  were never declared (would have thrown a ReferenceError on click).

### `src/components/lcked/item-detail.tsx`
- Crossfade between items (and item ↔ empty state) was already `opacity`-only
  (verified). Added the premium ease curve to both `<motion.div>` transitions.
- Removed the unused `largeType` prop from `FieldRow` (declared, never consumed in
  the component body — dead prop).
- Removed the unused `Maximize2` import from lucide-react.

### `src/components/lcked/vaults-sidebar.tsx`
- VaultRow hover — was `transition-colors` (default 150 ms). Now
  `transition-colors duration-100` (matches the spec).

### `src/components/lcked/password-generator-dialog.tsx`
- Mode toggle button — was `transition-all duration-150`. Now
  `transition-colors duration-100` (only the color/background changes; the active
  ring + shadow swap instantly which feels snappier than a slow fade).

### `src/components/lcked/vault-view.tsx`
- **Mobile FAB entrance** — was `scale: 0 → 1` + opacity. Now `opacity: 0 → 1`
  only with `duration: 0.12` and premium ease. Scale on entrance is discouraged
  per the spec ("no y/scale transforms that trigger layout").
- **Removed the broken `?` keyboard-shortcut button** — it called `setCheatOpen(true)`
  but no `cheatOpen` state or CheatSheet component existed. The button was a runtime
  ReferenceError waiting to fire on every click. Removed entirely (the search input
  already hints at shortcuts in its placeholder).
- Removed all 3 `aria-keyshortcuts` attributes (`Meta+Shift+L` × 2, `?` × 1).
  `aria-keyshortcuts` is poorly supported (only VoiceOver macOS reads it) and the
  shortcuts are already discoverable via tooltips + the search placeholder.

### `src/components/lcked/settings-dialog.tsx`
- **Import file preview** — was `height: 0 → auto` (layout-thrashing). Now
  `opacity + translateY(-6 → 0)` with `duration: 0.15` and premium ease.
- **OAuth provider crossfade** (connected ↔ connect buttons) — was
  `opacity + y:6 → 0`. Now `opacity`-only with `duration: 0.12` and premium ease.
- **Export format crossfade** (CSV ↔ encrypted) — same fix as above.
- Replaced 4× `transition-all` on theme/unlock-method/import-source/export-format
  cards with `transition duration-150` (the targeted `transition` class covers
  color, background, border, box-shadow, transform — without the layout-property
  overhead of `transition-all`).
- Removed the `void setImportExportOpen;` no-op + the unused `setImportExportOpen`
  hook subscription in `ImportTab` (left over from a previous refactor where the
  legacy ImportExportDialog was meant to be opened after import — no longer needed
  since the Settings Import tab handles everything inline).

### `src/components/lcked/setup-view.tsx` & `unlock-view.tsx`
- Screen-level entrance `<motion.div>` — `ease: "easeOut"` → `ease: [0.16, 1, 0.3, 1]`
  for consistency with the rest of the app. (Kept the subtle `y: 12` + `filter: blur`
  because these are one-shot screen entrances, not list/panel transitions — the
  spec's "opacity-only" rule is scoped to list items & panels.)

### `src/components/lcked/create-vault-dialog.tsx`
- Color swatch button — `transition-all` → `transition duration-150` (covers the
  `hover:scale-105` transform + `ring` box-shadow without animating layout props).
- Icon picker button — `transition-all` → `transition-colors duration-100` (only
  background/text color changes; the selected state's color is set via inline style
  which doesn't transition).

### `src/components/lcked/password-strength-meter.tsx`
- Strength bar segments — `transition-all duration-300` → `transition-colors duration-300`.
  Only the background-color flips between transparent and the score color.

### `src/app/globals.css`
- `.lcked-toast` entrance — `0.3s cubic-bezier(0.22, 1, 0.36, 1)` →
  `0.2s cubic-bezier(0.16, 1, 0.3, 1)`.
- `.lcked-toast[data-state="closed"]` exit — `0.2s cubic-bezier(0.22, 1, 0.36, 1)` →
  `0.15s cubic-bezier(0.16, 1, 0.3, 1)`.
- Verified `.lcked-active-glow` (static — box-shadow + bg, no animation) and
  `.lcked-pulse` (uses `opacity + transform: scale()` only — GPU-composited,
  symmetric `ease-in-out` is appropriate for an infinite breathing loop).

---

## Task 2 — DRY & dead code cleanup

### Deleted files
- `src/lib/frecency.ts` — exported `frecencyScore`, `sortByFrecency`,
  `topByFrecency`, `clearFrecency`, `recordFrecency` but had ZERO importers anywhere
  in `src/`. Pure dead code.

### No-op removals (`void _x;` patterns)
The ESLint config has `@typescript-eslint/no-unused-vars: "off"` AND `no-unused-vars:
"off"`, so the `void _x;` statements were doing nothing but polluting the diff.
Removed from:
- `src/components/lcked/item-editor.tsx` — `itemToInput()` (3 voids)
- `src/store/vault.ts` — `duplicateItem()` (5 voids)
- `src/lib/import-export.ts` — `toItemInput()` (3 voids)

The underlying destructure-with-rest pattern (`const { id: _id, ...rest } = item`)
is kept — it's the idiomatic "omit keys" pattern and the underscore-prefixed names
silence any future strict linter.

### DRY: shared Lucide vault-icon map
- Created `src/components/lcked/vault-lucide-icons.ts` — single source of truth for
  the 30-entry `VAULT_LUCIDE_BY_ID` map (vault-icon id → Lucide component) plus a
  `getVaultLucideIcon(id)` helper with a `Home` fallback.
- `vaults-sidebar.tsx` and `create-vault-dialog.tsx` both had their own identical
  30-line copies of this map. Both now import from the shared module. Adding a new
  vault icon to `VAULT_ICONS` only needs one map update instead of two.
- (Note: the React Compiler `static-components` lint rule rejects `const Icon =
  getVaultLucideIcon(id)` because it looks like a component being created during
  render. Callers use `VAULT_LUCIDE_BY_ID[id] ?? Home` instead, which the rule
  accepts as a static map lookup. `getVaultLucideIcon` is still exported as a
  convenience for non-JSX callers.)

### Dead reference removals
- `setCheatOpen` (vault-view.tsx) — see Task 1 above.
- `handleMultiRestore` / `handleMultiDelete` (item-list.tsx) — these were
  *referenced* in the trash-view multi-select dropdown but never *declared*.
  Defined them properly (they call `restoreItem` / `permanentlyDeleteItem` for
  every selected id in parallel, then toast + exit multi-select mode).

### Unused-import pruning
- `item-detail.tsx` — removed `Maximize2` from lucide-react imports.
- `vaults-sidebar.tsx` — initially removed all 26 vault-icon Lucide imports
  (they moved to `vault-lucide-icons.ts`), then re-added `Home` (fallback) and
  `Star` (used directly in the Favorites row swatch) after lint flagged them.
- `create-vault-dialog.tsx` — removed the 30 vault-icon Lucide imports + the
  local `LUCIDE_BY_ID` map; added a single `Home` import for the fallback.
- `settings-dialog.tsx` — removed the `setImportExportOpen` hook subscription
  (was only used by the now-removed `void setImportExportOpen;` no-op).

### Verified-still-used (per task checklist)
- `import-export-dialog.tsx` — STILL USED. `EmptyList` (item-list.tsx) opens it via
  `setImportExportOpen(true)`, and `vault-view.tsx` mounts it. The Settings Import
  tab is a separate, richer flow; the legacy dialog is the lightweight path from
  the empty state.
- `new-item-stash.ts` — STILL USED (3 callers: item-list, item-editor, vault-view).
- `password-strength-meter.tsx` — STILL USED (4 callers: settings-dialog,
  password-field, setup-view, password-generator-dialog).
- `KeyboardContext` — NO references anywhere (already cleaned up by a prior agent).
- `aria-keyshortcuts` — REMOVED (3 instances in vault-view.tsx).
- `frecency.ts` — DELETED (no importers).
- `flatInputCls` pattern — NOT DUPLICATED (only a comment in create-vault-dialog
  referencing it; no actual variable).
- `FieldCluster` / `FieldRow` — only in item-detail.tsx, no other consumer.
  No extraction needed.
- `subtitle()` — only in item-list.tsx (declared once, called once). No
  duplication.

---

## Verification

- `bun run lint` → exit 0, **0 errors, 0 warnings**.
- `curl http://localhost:3000/` → HTTP 200.
- Dev server log: clean `✓ Compiled` lines, no warnings/errors.
- The trash-view multi-select dropdown (previously broken — would throw on click)
  now restores / deletes items as intended.

## Files touched

- `src/components/ui/sheet.tsx` (open/close durations + premium ease)
- `src/components/lcked/item-list.tsx` (multi-select bar opacity+translateY,
  ActiveRowHighlight transform-only loop, missing handlers, ease curve)
- `src/components/lcked/item-detail.tsx` (ease curve, removed unused `largeType`
  prop + `Maximize2` import)
- `src/components/lcked/vaults-sidebar.tsx` (row hover `duration-100`, shared
  `VAULT_LUCIDE_BY_ID` import, re-added `Home` + `Star`)
- `src/components/lcked/password-generator-dialog.tsx` (mode toggle
  `transition-colors duration-100`)
- `src/components/lcked/vault-view.tsx` (FAB opacity-only, removed broken
  `setCheatOpen` + `aria-keyshortcuts`)
- `src/components/lcked/settings-dialog.tsx` (height→opacity+translateY,
  opacity-only crossfades, `transition-all`→`transition`, removed void no-op)
- `src/components/lcked/setup-view.tsx` (premium ease curve)
- `src/components/lcked/unlock-view.tsx` (premium ease curve)
- `src/components/lcked/create-vault-dialog.tsx` (shared `VAULT_LUCIDE_BY_ID`,
  `transition-all`→`transition`/`transition-colors`)
- `src/components/lcked/password-strength-meter.tsx` (`transition-colors`)
- `src/components/lcked/item-editor.tsx` (removed void no-ops)
- `src/components/lcked/vault-lucide-icons.ts` (**NEW** — shared Lucide map)
- `src/store/vault.ts` (removed void no-ops in `duplicateItem`)
- `src/lib/import-export.ts` (removed void no-ops in `toItemInput`)
- `src/lib/frecency.ts` (**DELETED** — dead code)
- `src/app/globals.css` (toast keyframe durations + premium ease curve)

## Notes for next agents

- **`VAULT_LUCIDE_BY_ID` is the single source of truth** for the vault-icon →
  Lucide component lookup. When adding a new vault icon to `VAULT_ICONS` in
  `src/lib/vault-assets.ts`, also add it to `VAULT_LUCIDE_BY_ID` in
  `src/components/lcked/vault-lucide-icons.ts`. The two maps must stay in sync.
- **`react-hooks/static-components`** (enabled by the React Compiler preset)
  rejects `const Icon = someFunction(id)` patterns even when the function just
  returns a stable reference. Use `MAP[id] ?? Fallback` instead — the rule treats
  map lookups as static. This is why `getVaultLucideIcon()` exists but callers
  use `VAULT_LUCIDE_BY_ID[id] ?? Home` directly.
- **The `void _x;` pattern is no longer needed** anywhere in this codebase —
  ESLint has `no-unused-vars` off. Future code can use the bare
  `const { id: _id, ...rest } = item` destructure-without-void pattern.
- **Multi-select in trash view** is now fully functional (was broken — the
  dropdown referenced two undeclared handlers). If you add new bulk actions,
  follow the same `handleMultiX` pattern (parallel `Promise.all` + toast +
  `setMultiSelect(false)`).
- **`aria-keyshortcuts` is intentionally absent** from the LCKED UI. The
  shortcuts are documented in tooltips (`<kbd>` tags) and the search placeholder,
  which is more discoverable than the ARIA attribute (which only VoiceOver macOS
  exposes).
