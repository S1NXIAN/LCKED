# LCKED — Front-End Design Plan
### The most unique, visually appealing, and seamless keyboard-driven password manager

*Synthesized from RESEARCH-A (keyboard UX) + RESEARCH-B (visual design) + an audit of the existing codebase. Every recommendation is grounded in a cited source and sized as a discrete engineering task.*

---

## 0. The Thesis

> **LCKED should feel like a quiet instrument, not a loud app.**
> Calm by default, expressive on intent. Every secret wears monospace. Every keystroke paints in under 100 ms. The keyboard is the primary interface; the mouse is a courtesy. Violet is light beneath surfaces, never paint on top. One signature motion — the sliding selection — carries the whole personality.

This is the intersection of **Linear's restraint**, **1Password's keyboard craft**, **Proton Pass's warm depth**, **Raycast's command-palette mastery**, and **Apple Passwords' TOTP-as-first-class** thinking — distilled into a single, ownable identity for LCKED.

---

## 1. Named Principles (the decision rules)

Carry these into every code review. Each is sourced.

| # | Principle | Source |
|---|---|---|
| P1 | **100 ms or it's broken** — every keystroke paints in <100 ms | Nielsen, *Response Time Limits* |
| P2 | **No dead-ends** — every surface has `Esc`, `Enter`, and a forward action | Linear Method |
| P3 | **Zero state-loss** — lock/unlock, modal open/close never lose your place | UX Patterns |
| P4 | **Spatial consistency** — `J`/`K` always down/up, everywhere, no exceptions | Linear, Superhuman, GitHub |
| P5 | **Frecency over recency** — lists & palettes rank by frequency × recency | Raycast, Spotlight |
| P6 | **Modifier-tiered verbs** — `⌘C`/`⇧⌘C`/`⌥⌘C` for the three copy targets | 1Password |
| P7 | **Quasimodes over toggles** — hold to reveal, release to hide | 1Password, Sasha Maximova |
| P8 | **Calm confidence** — default to restraint; reserve expression for intent | Calm Tech Institute, Linear |
| P9 | **Secrets deserve monospace** — every secret in premium mono, `tnum` + `zero` | RESEARCH-B §4 |
| P10 | **Violet as light, not paint** — surfaces have a violet *tint*, never a violet *fill*; high-chroma violet appears once per screen, max | RESEARCH-B §8 |
| P11 | **Structure is felt, not seen** — borders at 50% opacity; separators are tonal shifts | Linear refresh |
| P12 | **Motion serves intent** — every animation answers "what is the user learning?" Delete it if nothing | RESEARCH-B §5 |
| P13 | **Power-user ≠ inaccessible** — single-key shortcuts disabled in inputs, remappable, with ARIA live announcements | WCAG 2.1.4 |
| P14 | **One signature, not five** — pick one distinctive surface treatment and apply it consistently | RESEARCH-B §10 |

---

## 2. The Chosen Direction: "Vault Materials"

From RESEARCH-B's eight candidate directions, LCKED commits to a **stacked combination** rather than picking one:

| Layer | Direction | Role |
|---|---|---|
| **Foundation** | *Vault Materials* (A) | The base aesthetic — violet-as-light surfaces, OKLCH ramp, Geist Mono secrets |
| **Hero interaction** | *Large-Type Cinematic* (C) | The signature reveal — every secret can explode into a 48px character-ruler view |
| **Accent** | *Sunset Accent* (D) | A single warm yellow-orange (H≈75) used ≤5% per screen for "freshly generated" + unlock success |
| **Feature elevation** | *Codes as First-Class* (E) | TOTP gets its own filter, its own widget, its own live surface |
| **Brand mark** | *Diamond Mark* (H) | A custom keyhole-diamond mark on lock screen, empty state, favicon |

**What we deliberately reject:** grid backgrounds on the main vault (Direction B — tiring), Fraunces display face (Direction F — trendy), Quiet Lock maximalism (Direction G — hides value). The engineering grid appears **only** on lock/setup/empty states.

---

## 3. Keyboard UX System

### 3.1 The full keymap

Legend: ⌘ = Meta/Ctrl · ⇧ = Shift · ⌥ = Alt/Option · `[list]` = only when list has focus · `[input]` = only outside text inputs

#### Global
| Key | Action | Notes |
|---|---|---|
| `⌘K` | Open command palette | Existing; keep |
| `⌘⇧L` | **Lock vault** | **REBIND from ⌘L** (browser URL-bar collision) — matches 1Password |
| `⌘G` | Open password generator | Existing; keep |
| `⌘N` | New login (default) | Existing; keep |
| `⌘E` | Edit active item | 1Password convention |
| `⌘1`–`⌘9` | Open Nth most-used item (frecency) | **NEW** — Raycast/1Password pattern |
| `?` `[input]` | Cheat sheet (context-aware dialog) | **NEW** — Superhuman/GitHub/Vimium |
| `/` `[input]` | Focus search | **NEW** — universal search-focus convention |

#### List navigation
| Key | Action |
|---|---|
| `J` / `↓` | Next item |
| `K` / `↑` | Previous item |
| `Enter` | Open active item (or open website + copy password for logins) |
| `→` | Move focus to detail pane (spatial routing) |
| `←` | Return focus to list (from detail) |
| `G` then letter | Leader-key filters: `ga`=All, `gl`=Logins, `gc`=Cards, `gn`=Notes, `gi`=Identities |
| `E` | Edit active item |
| `D` | Duplicate active item |
| `C` | Copy primary field (username) — 1-key alias |
| `⌫` | Archive (soft delete) |
| `⌘⌫` | Permanent delete (with confirm) |
| `F` | Toggle favorite |
| `⌥` (hold) | Reveal all secret fields in active item (quasimode) |
| `⇧R` | Large-Type reveal of active item's primary secret |

#### Detail pane
| Key | Action |
|---|---|
| `⌘C` | Copy username (primary field) |
| `⇧⌘C` | Copy password |
| `⌥⌘C` | Copy TOTP code |
| `⌘⇧C` | Copy card number (when active item is a card) |
| `⌥` (hold) | Reveal all secrets (quasimode, same as list) |
| `⇧R` | Large-Type reveal |
| `Esc` | Return to list |

#### Command palette (cmdk)
| Key | Action |
|---|---|
| `↑` / `↓` or `⌘P`/`⌘N` | Move selection (cmdk default) |
| `Enter` | Run selected command |
| `⌘Enter` | Run in "secondary mode" (e.g. edit instead of view) |
| `Esc` | Close |
| `#` prefix | Filter to items only |
| `>` prefix | Filter to commands only |
| `/` prefix | Filter to navigation |

### 3.2 The spatial model (roving tabindex)

The vault is **two composites + a palette**:

```
┌─────────┐   ┌──────────────┐   ┌──────────────────────┐
│  Rail   │   │     List     │←→│       Detail          │
│ (icons) │   │ (composite)  │   │     (composite)       │
└─────────┘   └──────────────┘   └──────────────────────┘
                     ↑ ↓ J/K              ← → 
```

- `J`/`K` move within the list composite (roving tabindex).
- `→` hands focus to the detail composite; `←` hands it back.
- The palette is a modal combobox (WAI Combobox pattern) — focus is trapped, `aria-activedescendant` tracks the active option without moving DOM focus (cmdk handles this).
- A single `role="status"` live region announces: *"Selected: GitHub, login, 2 of 47."*

### 3.3 WCAG 2.1.4 compliance (single-key shortcuts)

Three layers of compliance (the gold standard — all three):

1. **Disabled in text inputs** — single-key verbs check `e.target.tagName` and bail on `INPUT`/`TEXTAREA`/`[contenteditable]`. *(already implemented)*
2. **Remappable** — Settings → Keyboard → every single-key shortcut has a rebind field. Persisted to `localStorage`.
3. **Globally disable-able** — a single toggle "Disable single-key shortcuts" for AT users.

Every shortcut-bearing element gets `aria-keyshortcuts="Meta+K"` etc. (MDN format).

### 3.4 Command palette upgrade (frecency + favorites)

Current state: fuzzy-only. Upgrade to four-tier ranking:

```
1. Pinned favorites (⌘1–⌘9)     — user-pinned, always top
2. Exact alias matches           — "lock" → Lock vault
3. Frecency-ranked history       — frequency × recency-decay
4. Fuzzy matches                  — current behavior
```

Track `{ commandId, hits, lastUsed }` in `localStorage`. Decay: `score = hits × 0.95^daysSinceLastUse`.

### 3.5 Zero state-loss contract

On any lock (manual, auto, visibility, beforeunload), persist to `sessionStorage` (cleared on tab close — never to disk):

- `selectedId` — active item
- `searchQuery` — current search
- `scrollTop` — list scroll position
- `editorDraft` — unsaved editor form (encrypted with a transient session key, never the master password)
- `openDialogs` — which dialogs were open

On unlock, restore all of it. The user returns to the exact pixel they left.

### 3.6 Cheat sheet (`?`)

A real focusable Dialog (not a visual overlay) listing **only the shortcuts relevant to the current view**. Each row: key cap, action, `aria-keyshortcuts`. Screen-reader navigable.

---

## 4. Visual System

### 4.1 Color tokens (OKLCH, violet-as-light)

Replace the current `globals.css` token block. Key moves vs. current:
- Shift hue from 285→**295** (magenta-shift, warmer, less generic — RESEARCH-B §8)
- 5-step perceptually-uniform lightness ramp for surfaces (not flat `card`/`popover`)
- Borders at **50% opacity** (Linear principle P11)
- One high-chroma violet reserved for selection + primary CTA only
- Add **sunset accent** (H≈75) for "freshly generated" + unlock glow

```css
/* Base surfaces — violet-tinted, never pure black */
--bg-base:      oklch(0.14 0.012 295);
--bg-raised:    oklch(0.18 0.014 295);
--bg-overlay:   oklch(0.22 0.016 295);
--bg-popover:   oklch(0.26 0.018 295);
--bg-tooltip:   oklch(0.30 0.020 295);

/* Text — off-white with violet tint */
--text-primary:   oklch(0.92 0.005 295);
--text-secondary: oklch(0.68 0.010 295);
--text-tertiary:  oklch(0.50 0.012 295);

/* Accent — single violet, magenta-shifted, high chroma */
--accent:       oklch(0.62 0.20 295);
--accent-hover: oklch(0.66 0.22 295);
--accent-soft:  oklch(0.40 0.08 295);  /* selection bg */

/* Sunset — "freshly generated" + unlock glow, ≤5% per screen */
--sunset:       oklch(0.78 0.15 75);

/* Semantic — desaturated for dark mode */
--danger:  oklch(0.62 0.18 25);
--warning: oklch(0.70 0.15 75);
--success: oklch(0.70 0.14 145);

/* Borders — felt, not seen */
--border-subtle:  oklch(0.30 0.012 295 / 0.5);
--border-default: oklch(0.34 0.014 295 / 0.7);
```

### 4.2 Typography

| Role | Font | Features |
|---|---|---|
| UI | Geist Sans (existing) | default |
| **Secrets** | **Geist Mono** (existing) | `font-feature-settings: "tnum" 1, "zero" 1` |
| Brand (lock/setup/empty only) | Fraunces (variable) — *optional, deferred* | — |

The single highest-impact move: **apply `font-secret` + the `tnum zero` features to every secret field** — passwords, OTPs, card numbers, URIs. Currently `.font-secret` exists but lacks the OpenType features.

### 4.3 Motion system (Framer Motion)

One signature motion + a small vocabulary. **No bouncy springs** (Linear discipline).

| Motion | Spec | When |
|---|---|---|
| **Selection slide** (THE signature) | `layoutId="active-row"`, spring `stiffness: 500, damping: 40`, 150ms | Active list item changes |
| Modal enter | `opacity 0→1, y 8→0`, ease-out 150ms | Dialogs |
| Large-Type reveal | shared `layoutId` from field → modal, 220ms ease-out | Secret reveal |
| Copy confirmation | icon morph `layoutId="copy-{id}"` clipboard→check, 150ms | Copy action |
| List enter | stagger 20ms/item, opacity+4px y, cap at 8 items | List mount/filter change |
| Unlock transition | blur(8px)→blur(0), 200ms | Unlock success |
| TOTP rollover | old code fade out 80ms → new code fade in 100ms | Every 30s |

**Reduced motion:** `prefers-reduced-motion: reduce` → all durations → `0ms`, layout animations → instant opacity. (Tatiana Mac — no-motion-first.)

**Performance budget:** all motion <16ms/frame; `will-change` only on the animating element; never animate `width`/`height`/`top`/`left`.

### 4.4 The four signature surfaces

1. **Violet-as-light selection** — the active row glows with `box-shadow: inset 0 1px 0 0 oklch(0.25 0.04 295 / 0.6), 0 0 0 1px oklch(0.55 0.20 295 / 0.4)`. Not a flat fill.

2. **Large-Type reveal modal** — the hero. Chevron (`⇧R`) on every secret → shared-layout expansion to a centered 48px Geist Mono view with a character ruler (1, 5, 9 markers) and 4-char chunking. *1Password's most-loved feature, owned for the web.*

3. **Engineering grid (lock/setup/empty only)** — two `radial-gradient` layers, 1px dots at 24px, 6% white. Signals "precise, technical, trustworthy" without tiring the eye in the main vault.

4. **Diamond mark** — a custom SVG keyhole-diamond. Lock-screen centerpiece, empty-state illustration, favicon. Generated once, reused everywhere.

### 4.5 Density & rhythm

- **List items:** 44px tall (touch target), 12px internal padding, icon 28px, name 14px medium, subtitle 12px tertiary.
- **Detail rows:** 40px, group with 8px gaps, separators as 1px tonal shifts (not borders).
- **Sidebar:** dimmed 1 L-step below base, borders at 50% opacity, icon-only rail (existing) + the option to expand on hover (deferred).
- **Detail panel:** max-width 640px for readability, centered content, generous 24px padding.

---

## 5. Implementation Roadmap

Sequenced for maximum impact-per-effort. Each phase is independently shippable.

### Phase A — Keyboard craft (highest impact, ~1 day)
*Files: `command-palette.tsx`, new `use-keybinds.ts`, new `cheat-sheet.tsx`, `vault-view.tsx`, `item-list.tsx`, `item-detail.tsx`*

1. **Rebind lock `⌘L` → `⌘⇧L`** (5 min) — fixes the browser collision bug.
2. **Modifier-tiered copy** — `⌘C`/`⇧⌘C`/`⌥⌘C` on the active item (1Password's signature pattern).
3. **Spatial arrow routing** — `→`/`←` between list & detail via roving tabindex.
4. **Single-key verbs** — `e` edit, `d` duplicate, `c` copy-username, `f` favorite, `⌫` archive, `⌘⌫` delete.
5. **Hold-`⌥` quasimode reveal** — reveal all secrets while held; re-mask on release.
6. **`?` cheat sheet** — context-aware, accessible Dialog.
7. **`/` focus search**, `⌘1`–`⌘9` frecency favorites.
8. **Leader-key `g` filters** — `ga`/`gl`/`gc`/`gn`/`gi` with a visible hint chip.
9. **ARIA live region** — "Selected: X, N of M" on J/K.
10. **WCAG compliance** — Settings → Keyboard: remap + disable single-key toggle; `aria-keyshortcuts` on all shortcut elements.

### Phase B — Visual foundation (~1 day)
*Files: `globals.css`, `password-field.tsx`, `totp-display.tsx`, `item-detail.tsx`, `item-list.tsx`*

1. **OKLCH token migration** — the §4.1 token set; shift hue to 295; 5-step surface ramp; 50%-opacity borders; sunset accent.
2. **Geist Mono + OpenType features** — `font-feature-settings: "tnum" 1, "zero" 1` on `.font-secret`; apply to every secret field.
3. **Linear "calmer interface"** — dim sidebar 1 L-step; soften borders; remove colored icon backgrounds; shrink icons 2px.
4. **Selection slide** — Framer Motion `layoutId="active-row"` (the signature motion).
5. **Reduced-motion guard** — `useReducedMotion` hook, 0ms fallbacks.

### Phase C — Signature interactions (~1.5 days)
*Files: new `large-type-reveal.tsx`, `totp-display.tsx`, `item-detail.tsx`, new `codes-widget.tsx`*

1. **Large-Type reveal modal** — `⇧R` or chevron; shared `layoutId`; 48px Geist Mono; character ruler; 4-char chunking; optional phonetic mode (alpha/bravo).
2. **TOTP redesign** — smooth SVG arc (no ticking number); crossfade on rollover; "Codes" filter chip; lock-screen-adjacent widget (top-3, masked until hover, blurred on `visibilitychange`).
3. **Copy-confirmation micro-animation** — icon morph via `layoutId="copy-{id}"`; violet wash fade 600ms.
4. **Branded empty state** — diamond mark + philosophy copy ("Your secrets, encrypted on this device. Nothing leaves. Ever.") + primary/secondary CTAs.
5. **Engineering grid** — lock/setup/empty states only.

### Phase D — Polish & depth (~1 day)
*Files: `command-palette.tsx`, `vault-store.ts`, new `frecency.ts`, `diamond-mark.tsx`*

1. **Frecency ranking** in palette + `⌘1`–`⌘9` favorites.
2. **Palette prefixes** — `#` items, `>` commands, `/` navigation.
3. **Zero state-loss** — `sessionStorage` persistence of selection/search/scroll/draft across lock.
4. **Custom diamond mark** — SVG, lock-screen centerpiece, favicon, empty-state.
5. **Unlock transition** — blur(8px)→blur(0) on unlock success.

---

## 6. The "Seamless" Acceptance Checklist

Before declaring done, every box must be checked (RESEARCH-A §7.2):

- [ ] Every keypress paints in <100 ms
- [ ] Every surface has `Esc`, `Enter`, and a forward action
- [ ] No state lost across modal/palette/lock transitions
- [ ] Active list item preserved across re-renders
- [ ] Optimistic UI for all mutations (copy, edit, delete, lock)
- [ ] No flicker on view transitions
- [ ] Reduced-motion users get the same information without motion
- [ ] Single-key shortcuts disabled in inputs and remappable
- [ ] `?` cheat sheet, context-aware, screen-reader accessible
- [ ] `⌘K` palette with frecency ranking + `⌘1`–`⌘9` favorites
- [ ] Roving tabindex between list and detail; arrow keys route spatially
- [ ] Focus rings ≥2px, ≥3:1 contrast, `:focus-visible` only
- [ ] ARIA live regions announce selection and result counts
- [ ] Scroll-into-view on every active-item change
- [ ] Every secret in Geist Mono with `tnum` + `zero`
- [ ] High-chroma violet appears at most once per screen
- [ ] Borders at 50% opacity (felt, not seen)
- [ ] No `cursor: pointer` on non-link controls (native-feel)

---

## 7. Source Bibliography (high-signal only)

**Keyboard UX:** Nielsen (response times) · UX Tigers (time scales) · Linear Method · Raycast Technical Deep Dive · UX Patterns (command palette) · Sam Solomon (palette design) · Destiner (palette checklist) · Sasha Maximova (J/K) · Mathias Polligkeit (shortcut pitfalls) · WCAG 2.1.4 · MDN (aria-keyshortcuts, live regions) · W3C APG (combobox, dialog, roving tabindex) · Sara Soueidan (live regions) · Tatiana Mac (reduced motion) · 1Password keyboard shortcuts.

**Visual design:** Proton Visual Universe + Pass logo story · Linear 2026 design refresh + DESIGN.md · Evil Martians (OKLCH) · Maxime Heckel (Framer Motion layout) · Rauno / Devouring Details · 1Password (concept-first design, Large Type, Watchtower) · Apple Passwords (iOS 18) · Vercel Geist + blueprint grid · Calm Tech Institute · NN/g (glassmorphism, dark mode) · Eleken (dark mode guide).

Full annotated bibliographies in `/home/z/RESEARCH-A-keyboard-UX-brief.md` and `/home/z/my-project/RESEARCH-B-visual-design-brief.md`.
