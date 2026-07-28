# REMODEL-INDICATORS-EDITOR-CARDS — UI/UX Specialist

## Task summary
1. Remodel `.lcked-active-glow` (used by both vaults-sidebar `VaultActiveHighlight` and item-list `ActiveRowHighlight`) to be more premium, minimal, and theme-sensitive.
2. Add visual variation to the item editor — labelled secondary clusters + cleaner custom-field rows.

## What changed

### Task 1 — Active-row indicator
- File: `src/app/globals.css`
- Old `.lcked-active-glow`: `var(--accent)` bg + a triple-layer box-shadow (inset 1px top highlight + 1px violet ring + 20px blur glow). Heavy and visually loud.
- New `.lcked-active-glow`:
  - `background-color: var(--accent)` (kept — theme-aware)
  - `border-left: 2px solid var(--primary)` (NEW — thin primary bar on the leading edge; premium + minimal)
  - `box-shadow: 0 0 0 1px color-mix(in oklab, var(--primary) 20%, transparent)` (subtle 1px outer ring; replaces the heavy glow)
  - No gradients. Pure CSS-variable-based, so it adapts to every theme (Latte / Mocha / Nord / Proton) automatically.
- Both `ActiveRowHighlight` (item-list.tsx) and `VaultActiveHighlight` (vaults-sidebar.tsx) render their sliding div with `className="lcked-active-glow ..."`. No code changes needed in either component — the rAF spring mechanism is preserved; only the CSS class was remodelled.

### Task 2 — Editor card variation
- File: `src/components/lcked/item-editor.tsx`
- Added new `FieldClusterWithLabel` component — wraps `FieldCluster` with a small section header above the card. Header: `text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 px-1 mb-1.5`, optional `action` slot on the right.
- Made `FieldRowInput.label` optional (so single-row labelled clusters don't show a redundant inner label).
- Login editor:
  - Primary cluster (Username + Password): kept as bare `FieldCluster`.
  - TOTP cluster → `FieldClusterWithLabel label="Verification"`.
  - URLs cluster → `FieldClusterWithLabel label="Websites"`.
  - Notes cluster → `FieldClusterWithLabel label="Notes"`.
- Card editor: Notes cluster → `FieldClusterWithLabel label="Notes"`. Primary card-credentials cluster kept bare.
- Identity editor: Notes cluster → `FieldClusterWithLabel label="Notes"`. (Per spec, only TOTP/URLs/Notes/Custom fields get labels — identity's other clusters stay bare.)
- Custom fields redesigned:
  - Empty state lives INSIDE a `FieldClusterWithLabel` (with "Add" button as header action) so the empty hint reads as a real card slot.
  - Populated rows use a two-line layout:
    - Top: small "Field name" input (`h-7 text-xs`, borderless) + type Select as a small pill-shaped badge (`h-6 w-fit rounded-full bg-secondary/40 text-[10px] uppercase tracking-wider`).
    - Bottom: larger "Value" input (`h-9 text-sm`, font-secret for hidden) + subtle ghost-icon Trash2 button (`h-7 w-7 text-muted-foreground/60 hover:text-red-400`).
  - Proper dividers between rows.
  - Added explicit `aria-label`s on the name/value/remove controls.

## Lint / build status
- `bun run lint` — exit code 0, no errors.
- Dev server compiled cleanly after each edit (verified via `dev.log`).

## Files touched
- `src/app/globals.css`
- `src/components/lcked/item-editor.tsx`
