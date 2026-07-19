# SPIN-CONTEXTMENU-TOOLTIP — UI Specialist

## Scope
Three UI polish tasks for the LCKED password manager:
1. **DiamondMark hover spin** — switch from single 1.5s play-once to continuous infinite loop on hover, with smooth "complete current loop" on mouse-leave (no abrupt stop, no visible jump). Coordinate with DotField so the spinning icon pushes background dots away from its on-screen position via a custom `lcked:diamond-spin` window event.
2. **Theme-aware context menu + dropdown menu** — perfect theme elevation: `--popover` bg, `--border` (50% opacity separator), `--accent` hover, `--destructive` variants, custom `0 4px 12px rgba(0,0,0,0.15)` shadow, `var(--radius)` border-radius, `transition-colors duration-75` on items, muted-foreground icons that inherit on hover.
3. **Custom tooltip** — popover-background tooltip with `1px solid var(--border)`, `var(--radius-sm)` corners, `px-2.5 py-1.5`, `text-xs`, `0 2px 8px rgba(0,0,0,0.12)` shadow, opacity-only 100ms fade (no zoom, no slide), max-width 200px with text wrapping.

## Approach
- DiamondMark: keep existing `@keyframes lcked-spin-3x { from: rotate(45deg); to: rotate(1125deg); }` (1080° = 3 full turns, ends at 45° mod 360° so loops are seamless). Drive spin via a three-state machine: `idle → spinning → completing → idle`. `spinning` and `completing` both apply the same `lcked-spin-3x 1.5s linear infinite` string (React sees no style delta → animation never restarts mid-loop). On mouseleave we flip to `completing` and listen for the next `animationiteration` event on the SVG; when it fires (loop boundary, transform is back at rotate(45deg)) we set state to `idle` which removes the animation and applies `transform: rotate(45deg)` — visually identical, no jump.
- DotField: add a `window` listener for `lcked:diamond-spin` CustomEvent. Detail = `{ x, y }` viewport coords of the icon center. Subtract canvas rect → canvas-local coords → push dots within `scatterRadius` outward with the same `(1 - dist/r) * force` falloff as the existing click handler. DiamondMark dispatches this event on `mouseenter` and again on each `animationiteration` while spinning, so dots are continuously repelled.
- ContextMenu / DropdownMenu: replace `shadow-md`/`shadow-lg` with arbitrary `shadow-[0_4px_12px_rgba(0,0,0,0.15)]`; replace `rounded-md` with `rounded-[var(--radius)]`; change separator `bg-border` → `bg-border/50`; add `transition-colors duration-75` to items; add `data-[highlighted]` (radix keyboard nav) variants alongside `focus:` (mouse hover) for bg/text/svg inheritance; add `focus:text-current` / `data-[highlighted]:text-current` on `[&_svg:not([class*='text-'])]` so icons inherit hover color.
- Tooltip: rewrite TooltipContent to use `bg-popover text-popover-foreground border border-border`, `rounded-[var(--radius-sm)]`, `px-2.5 py-1.5 text-xs`, `max-w-[200px] break-words text-balance`, `shadow-[0_2px_8px_rgba(0,0,0,0.12)]`. Drop `animate-in` zoom/slide entirely; add CSS keyframes `lcked-tooltip-fade-in`/`lcked-tooltip-fade-out` (opacity-only, 0.1s) bound via `.lcked-tooltip-content[data-state="delayed-open"|"instant-open"]` and `[data-state="closed"]`. Arrow uses `bg-popover fill-popover`.

## Files touched
- `src/components/lcked/diamond-mark.tsx` — full rewrite
- `src/components/lcked/dot-field.tsx` — add spin listener + cleanup
- `src/components/ui/context-menu.tsx` — theme elevation pass
- `src/components/ui/dropdown-menu.tsx` — theme elevation pass
- `src/components/ui/tooltip.tsx` — full redesign
- `src/app/globals.css` — add `lcked-tooltip-fade-in` / `lcked-tooltip-fade-out` keyframes + reduced-motion guard
- `worklog.md` — append work record

## Verification
- `bun run lint` must pass with 0 errors.
