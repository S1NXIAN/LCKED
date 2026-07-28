---
Task ID: CATPPUCCIN-SEED-DND
Agent: Lead Engineer (catppuccin + seed + dnd)
Task: Three independent changes to LCKED password manager:
  1. Replace the dark/light theme in src/app/globals.css with the exact Catppuccin Mocha (dark) + Latte (light) palettes; keep all existing CSS classes + reduced-motion guard; keep --pass-sidebar-size: 20.25rem; map vault + signal colors to Catppuccin equivalents.
  2. Create src/lib/seed-data.ts exporting getSeedItems() (~15 diverse items) + getSeedVaults() helper. Wire into setupVault in src/store/vault.ts so a freshly-created vault is seeded with demo content (TESTING ONLY).
  3. Replace the up/down chevron reorder buttons in the Organize Vaults dialog (src/components/lcked/vaults-sidebar.tsx) with @dnd-kit drag-and-drop. Order is LOCAL state, only persisted via reorderVaults() when the user clicks Done.

Context loaded:
- /home/z/my-project/worklog.md (full history, prior agents)
- /home/z/my-project/src/app/globals.css (Proton Pass-inspired theme)
- /home/z/my-project/src/store/vault.ts (Zustand store with setupVault)
- /home/z/my-project/src/lib/types.ts (NewItemInput discriminated union)
- /home/z/my-project/src/lib/vault-assets.ts (VAULT_COLORS / VAULT_ICONS catalogs)
- /home/z/my-project/src/components/lcked/vaults-sidebar.tsx (sidebar with Organize dialog using ChevronUp/ChevronDown)
- /home/z/my-project/package.json (verified @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities all installed)

Work Log:

1. CATPPUCCIN THEME — src/app/globals.css
   - Replaced :root (Latte) block with the exact hexes specified:
     • --background: #eff1f5, --foreground: #4c4f69
     • --card: #e6e9ef, --popover: #e6e9ef, --sidebar: #e6e9ef
     • --primary: #8839ef (Mauve), --primary-foreground: #eff1f5
     • --secondary: #ccd0da, --muted: #ccd0da, --muted-foreground: #6c6f85
     • --accent: #ccd0da, --destructive: #d20f39
     • --border: #bcc0cc, --input: #bcc0cc, --ring: #8839ef
   - Replaced .dark (Mocha) block with the exact hexes specified:
     • --background: #1e1e2e (Base), --foreground: #cdd6f4 (Text)
     • --card: #313244 (Surface0), --popover: #313244
     • --sidebar: #181825 (Mantle)
     • --primary: #cba6f7 (Mauve), --primary-foreground: #1e1e2e
     • --secondary: #45475a (Surface1), --secondary-foreground: #cdd6f4
     • --muted: #45475a, --muted-foreground: #a6adc8 (Subtext2)
     • --accent: #313244 (Surface0), --accent-foreground: #cdd6f4
     • --destructive: #f38ba8 (Red)
     • --border: #45475a (Surface1), --input: #45475a
     • --ring: #cba6f7
   - Filled in the secondary theme vars (sidebar-*, chart-1..5, surface-base/raised/overlay/popover/tooltip) with the matching Catppuccin hexes so the whole ramp is consistent.
   - Added a --catppuccin-* accent palette block in both :root and .dark exposing all 13 Mocha/Latte accents (Blue, Lavender, Sapphire, Mauve, Pink, Red, Maroon, Peach, Yellow, Green, Teal, Flamingo, Rosewater) — registered in @theme inline as --color-catppuccin-* so they're usable as Tailwind classes if needed.
   - Mapped vault colors to Catppuccin equivalents (kept the 10 Proton Pass ids stable so existing vaults don't break):
     • heliotrope → Mauve, mauvelous → Pink, marigold → Yellow, de-york → Green,
       jordy-blue → Blue, lavender-magenta → Flamingo, chestnut-rose → Red,
       porsche → Peach, mercury → Surface2 (grey), water-leaf → Teal
     • Same hex changes in :root (Latte) and .dark (Mocha) so vault identities are stable across themes.
   - Mapped signal colors to Catppuccin:
     • Dark: success=#a6e3a1 (Green), warning=#f9e2af (Yellow), danger=#f38ba8 (Red), info=#89b4fa (Blue)
     • Light: success=#40a02b, warning=#df8e1d, danger=#d20f39, info=#1e66f5
   - Rewrote .lcked-active-glow + .lcked-glow + .lcked-grid + .lcked-sunset-flash to use color-mix(in oklab, var(--primary|...), transparent) instead of hardcoded oklch — so the glows pick up whatever the current theme's mauve/sunset/foreground are. Removed the now-redundant :root:not(.dark) .lcked-grid override (the new color-mix already adapts to light/dark).
   - --sunset mapped to Catppuccin Peach (#fab387 dark / #fe640b light).
   - Kept --pass-sidebar-size: 20.25rem in both :root and @theme inline.
   - Preserved every existing CSS class: .lcked-scroll, .lcked-glow, .lcked-grid, .lcked-pulse, .font-secret, .lcked-active-glow, .lcked-sunset-flash, and the prefers-reduced-motion guard.

2. SEED DATA — src/lib/seed-data.ts (NEW FILE)
   - getSeedVaults(): VaultDef[] returns 3 fixed-id demo vaults (Personal/Work/Finance) so seed items can reference them. IDs: "seed-vault-personal", "seed-vault-work", "seed-vault-finance" — deterministic so a re-seed always produces the same vault ids (no randomId drift).
   - getSeedItems(now = Date.now()): NewItemInput[] returns exactly 15 items:
     • 8 logins: GitHub (favorite+pinned, TOTP, custom fields), Google (favorite, no TOTP), Twitter/X (trashed, ~1 day ago), Netflix (favorite, custom field "Plan"), Spotify (pinned), AWS Root (pinned, TOTP, 2 custom fields), Discord (plain), Figma (1 custom field)
     • 3 notes: Home WiFi password (pinned), Recovery codes (favorite, multi-line content with formatted codes), JetBrains license key (trashed, ~1 hour ago, custom field "Renewal date")
     • 2 cards: Visa — Personal (Stripe test card 4242…4242), Mastercard — Business (favorite, Stripe test card 5555…4444)
     • 2 identities: Personal identity (custom field "Birthplace"), Work identity (2 custom fields)
   - Mix of: favorites (4), pinned (4), 4 different vaults (null/Personal/Work/Finance), 2 trashed items (Twitter + License key) so the Trash view has content immediately after setup.
   - All credentials are public demo values (Stripe test cards, RFC 6238 demo TOTP secret "JBSWY3DPEHPK3PXP", fake passwords with realistic patterns). A TESTING ONLY warning header is at the top of the file.
   - getSeedItems(now) signature lets the store pass Date.now() so createdAt/updatedAt are deterministic per setup.

3. SEED WIRING — src/store/vault.ts setupVault
   - Imported { getSeedItems, getSeedVaults } from "@/lib/seed-data".
   - In setupVault, after deriving masterKey + vaultKey + verifier, build seedVaults + seedInputs.
   - Each seed input is hydrated to a full VaultItem via `randomId()` for id + spread createdAt/updatedAt timestamps (createdAt spread across last ~30 hours, updatedAt staggered by minutes) so the list shows varied timestamps immediately.
   - The VaultMeta written to IndexedDB includes `vaults: seedVaults` (was `[]`), so the demo vaults persist across lock/unlock.
   - Each seed item is encrypted with the freshly-derived vaultKey + persisted via putStoredItem. Failures are non-fatal — logged via console.warn, the vault still unlocks with whatever items did persist.
   - The final set() call hydrates items + vaults into the Zustand state.
   - Added a clear "TESTING-ONLY SEED" comment block above the seeding code so the next agent knows this branch exists and how to disable it.

4. ORGANIZE VAULTS DRAG & DROP — src/components/lcked/vaults-sidebar.tsx
   - Imports: removed ChevronUp/ChevronDown, added GripVertical (Lucide). Added @dnd-kit/core (DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent), @dnd-kit/sortable (SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy), @dnd-kit/utilities (CSS).
   - New SortableVaultRow component (defined just above VaultsSidebar): renders a single row using useSortable({ id: vault.id }). The drag handle is a GripVertical button — the ONLY activator. attributes + listeners spread on the handle button. `touch-none` class so touch scroll doesn't hijack drag. The rest of the row (Checkbox + VaultIcon + label + count + Hidden badge) is unchanged from before — checkboxes still work for hide/show without triggering drag.
   - VaultsSidebar local state: added `localOrder: string[]` initialized to `[]`. A `useEffect` syncs localOrder from `vaults.map(v => v.id)` whenever organizeOpen becomes true (so opening the dialog always reflects the current store order, even if it was changed elsewhere).
   - Sensors: PointerSensor with `activationConstraint: { distance: 5 }` (so a click on the handle doesn't accidentally start a drag — needs 5px movement), KeyboardSensor with `sortableKeyboardCoordinates` (so keyboard users can reorder with arrow keys via the handle).
   - handleOrganizeDragEnd: standard arrayMove logic on localOrder.
   - handleOrganizeDone: only calls reorderVaults(localOrder) if the local order actually differs from the store's current order. Avoids unnecessary IndexedDB writes when the user opened the dialog, didn't reorder, and clicked Done.
   - Dialog body: replaced the `<ul>…<li>…ChevronUp/ChevronDown…</li></ul>` block with `<DndContext sensors collisionDetection={closestCenter} onDragEnd><SortableContext items={localOrder} strategy={verticalListSortingStrategy}><ul>…SortableVaultRow…</ul></SortableContext></DndContext>`.
   - The Done button now has `onClick={handleOrganizeDone}` — AlertDialogAction auto-closes by default, so the order saves then the dialog dismisses. Closing via Escape (or any non-Action path) discards local order, matching the spec "The order should NOT save instantly — only save when the user clicks Done".
   - Updated the dialog description copy to "Toggle visibility and drag to reorder vaults. Changes are saved only when you click Done." to set expectations.

Verification:
- `bun run lint` → 0 errors, 0 warnings (clean).
- `bunx tsc --noEmit` → no NEW errors in any file I touched (vaults-sidebar.tsx, seed-data.ts, store/vault.ts). The one pre-existing error at src/store/vault.ts(46,8) (`ImportResult` not exported from import-export) was there before my changes — verified via `git stash` + tsc — same set the prior agents documented.
- Dev server: `GET / 200 in 352ms` after final compile. No runtime errors.

Files touched:
- src/app/globals.css (full theme rewrite — Catppuccin Mocha + Latte)
- src/lib/seed-data.ts (NEW — 15 demo items + 3 demo vaults)
- src/store/vault.ts (setupVault now seeds; +1 import)
- src/components/lcked/vaults-sidebar.tsx (Organize dialog: chevrons → @dnd-kit sortable; new SortableVaultRow component)

Notes for next agents:
- The seed runs ONLY on setupVault (first-time vault creation). To re-seed after a reset, the user does Settings → Reset vault → setup again. Unlocking an existing vault never re-seeds.
- The seed vaults use FIXED ids ("seed-vault-personal" / "seed-vault-work" / "seed-vault-finance") so seed items can reference them. If a user later deletes one of these vaults, the orphaned items fall back to the default vault (vaultId = null) — same orphan-rescue semantics as any other vault.
- The dnd-kit drag handle is the ONLY activator in the Organize dialog row. The Checkbox + label are siblings, not children of the handle, so toggling visibility never starts a drag.
- The Catppuccin accent palette is exposed as --catppuccin-* / --color-catppuccin-* in both themes. If you want to use a specific accent (e.g. Teal for an info chip), use `bg-[var(--color-catppuccin-teal)]` or `text-[var(--color-catppuccin-teal)]` directly.
- The .lcked-active-glow / .lcked-glow / .lcked-grid / .lcked-sunset-flash classes now use `color-mix(in oklab, …)` instead of hardcoded oklch. They automatically adapt to whatever the active theme's mauve/sunset/foreground are. If you change the primary color again, the glows follow.
- Pre-existing TS errors (item-editor.tsx discriminated-union narrowing, command-palette.tsx shouldFilter prop, src/lib/import-export.ts ImportResult export, src/lib/totp.ts) are NOT introduced by this task and were documented by prior agents. ESLint (the lint check the spec requires) is clean.
