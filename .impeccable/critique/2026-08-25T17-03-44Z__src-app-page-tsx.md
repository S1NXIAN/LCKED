---
target: LCKED vault app (src/app/page.tsx)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-25T17-03-44Z
slug: src-app-page-tsx
---
# LCKED Vault App — Design Critique

**Method: dual-agent (A: CritiqueA · B: CritiqueB)**

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Spinner through ~6s Argon2 unlock, toasts on every mutation, KDF params surfaced verbatim |
| 2 | Match System / Real World | 3 | Right vocabulary, dinged by "PGP-encrypted" vs "AES-256-GCM" contradiction and "1 items" grammar bug |
| 3 | User Control and Freedom | 2 | Trash→Restore good; but permanent row deletion is instant and unrecoverable |
| 4 | Consistency and Standards | 2 | Same delete confirms in detail pane, doesn't in list row; pluralization differs across surfaces |
| 5 | Error Prevention | 2 | Friction gradient inverted: reversible move-to-trash gets a dialog, irreversible purges get none |
| 6 | Recognition Rather Than Recall | 3 | Type icons, sort bar, MicroLabels all visible; row actions hover-only by default |
| 7 | Flexibility and Efficiency | 3 | Multi-select drag, context menus, favorites, generator reachable from two places |
| 8 | Aesthetic and Minimalist Design | 4 | Strongest dimension: tokenized four-theme palette, restrained motion, honest density |
| 9 | Error Recovery | 3 | Textbook wrong-password state; wrong empty state shows "No matches" with no active search |
| 10 | Help and Documentation | 1 | Tooltips and sr-only strings only; import help omits 1Password while its card sits adjacent |
| **Total** | | **26/40** | **Acceptable** |

Applicable maximum: 40 (all ten heuristics scored; none n/a).

## Design Specificity Verdict

**LLM assessment:** DESIGN.md is unusually specific — One Violet Rule, Sunset ≤5%, Secrets-in-Mono, flat inputs, shadow-xs ceiling — and the shipped UI honors it roughly 85% of the time. The three-pane vault reads as one coherent machined object; violet genuinely appears about once per screen; secrets render in mono with tabular figures. Drift concentrates where trust is decided: auth screens ship `shadow-2xl backdrop-blur-xl` cards against the shadow ceiling (`unlock-view.tsx`, `setup-view.tsx`), Security-tab danger zones hardcode Tailwind `text-red-400` instead of themed `--signal-danger` (`security-tab.tsx:227,246`), and Export copy names two cryptosystems for one file ("PGP-encrypted JSON" button vs "AES-256-GCM envelope" caption, `export-tab.tsx:36-44,165-198`). Verdict: specific system, ~85% obeyed; violations concentrate on auth screens, danger zones, and copywriting.

**Deterministic scan:** 13 CLI findings across 12 files — `design-system-font-size` ×12 (all 11px, absent from the DESIGN.md ramp): `item-detail.tsx:756`, `settings/export-tab.tsx:146,244`, `settings/general-tab.tsx:76,98,112,126,181`, `settings/security-tab.tsx:129`, `setup-view.tsx:241,528`, `unlock-view.tsx:200`; `ai-color-palette` ×1 warning at `item-icons.tsx:31`. Browser overlay scans (five views, injection succeeded despite CSP via strict-dynamic): FAB dark-glow (`shadow-primary/40`) violating no-shadow rule; One Violet Rule pressure on item detail (wordmark + link + glow); two nested-card violations in generator dialog; unlock card 1px-border + ~50px-blur shadow. Grounded false positives: Sonner toast transition misattributed to `<body>`; sanctioned violet wordmark/unlock glows; lucide SVG-internals inflation (settings' 15 palette hits ≈ 4 visual elements); functional item-type color coding at `item-icons.tsx:31` (category color-coding, not decoration); unwrapped-text line-length artifact (~123 chars measured pre-wrap). Partially real: hand-rolled 10px field labels bypassing the `MicroLabel` primitive; 10px type chip is a styled *button* (micro sizes forbidden on interactive text).

Overlays were stripped after each scan; nothing remains flagged in the user's browser.

## Overall Impression

A beautiful instrument shell around unfinished safety engineering. The aesthetic system is genuinely excellent. But the product's core promise is "your data is safe here," and its most destructive actions have less friction than its least destructive ones. The reviewer permanently destroyed their own test item with one hover-slip click in Trash view. Biggest opportunity: make the friction gradient match the destruction gradient.

## What's Working

1. **Coherent visual system** — tokenized four-theme palette, One Violet Rule observable in practice, borders felt-not-seen. The long detector false-positive list exists precisely because the real spec is followed closely.
2. **Security UX woven into the fabric** — clipboard auto-clear countdown on the copy toast, optional email blurring, secrets-in-mono, reveal toggles with aria-label flips, raw KDF parameters displayed honestly.
3. **Exemplary recovery copy where it exists** — wrong-password state preserves input and explains precisely (`unlock-view.tsx:128`); destructive dialogs name the 30-day recovery window; dirty-editor Esc guard works (`item-editor/discard-dialog.tsx`).

## Priority Issues

**[P0] Irreversible actions lack confirmation while reversible ones have it.**
Row-level "Delete permanently", multi-select permanent delete, and Empty Trash execute instantly with no dialog (`item-row.tsx:256-260`, `multi-select-bar.tsx:75-79`, `vaults-sidebar/index.tsx:96,411`) — while recoverable move-to-trash gets a full AlertDialog. Friction gradient points the wrong way in a no-recovery product.
Fix: route every permanent-delete path through the same AlertDialog; state count and irreversibility.
Suggested command: /impeccable harden

**[P1] Keyboard and screen-reader users cannot open any item.**
`ul[role="listbox"]` has no tabIndex, no keydown handling; `role="option"` rows are unfocusable onClick-only DIVs (`item-list/index.tsx:209-214`, `item-row.tsx:119-137`). Sidebar vault rows carry explicit `focus:outline-none` ("No focus-visible ring" comment, `vault-row.tsx:99-101`); editor inputs suppress their own rings with no wrapper rescue (`field-cluster.tsx:107-118`). WCAG 2.1.1 failure on the core task.
Fix: roving tabindex or real buttons on rows; restore focus-visible rings everywhere interactive.
Suggested command: /impeccable audit

**[P1] Browser refresh silently destroys unsaved editor work.**
Verified live: typed a draft, reloaded — vault locked correctly, draft vanished without warning. Only `beforeunload` handler locks the vault; never warns about unsaved edits (`auto-lock-manager.tsx:67-69`).
Fix: when editor is dirty, add beforeunload warning alongside the lock.
Suggested command: /impeccable harden

**[P2] Trust-copy contradictions.**
"PGP-encrypted JSON" vs "AES-256-GCM envelope" describing the same export (`export-tab.tsx:36-44,165-198`); "1 items" hardcoded toolbar count vs correct sidebar pluralization (`vault-view.tsx:276`). Crypto-copy sloppiness costs more in a zero-knowledge product.
Fix: pick the true cryptosystem name; pluralize.
Suggested command: /impeccable clarify

**[P2] Edge-surface drift from DESIGN.md.**
Auth cards break the shadow-xs ceiling; hardcoded Tailwind reds bypass themed signal-danger; 11px ×12 off the type ramp (detector-confirmed); FAB violet glow the spec forbids; generator nests two boxed cards against flush field-cluster vocabulary; Latte `--muted-foreground` #6c6f85 on base #eff1f5 = 4.37:1, below AA (dark themes pass comfortably).
Fix: one token-compliance pass over auth screens, settings tabs, generator, Latte muted value.
Suggested command: /impeccable polish

## Persona Red Flags

**Alex (keyboard + screen-reader user):** Cannot open any vault item from the keyboard — listbox announced but not operable. Focus ring stripped from vault rows and editor fields. Hover-revealed row actions invisible until hover.

**Sam (switcher importing from 1Password/Bitwarden):** Import helper text omits 1Password while a 1Password card sits adjacent. Contradictory encryption claims on Export pause a careful migrator mid-audit. No in-app help anywhere (help score 1/4).

**Riley (busy, fat-fingers, ten tabs open):** One stray click on a hover icon in Trash = permanent loss. Refresh mid-edit loses the draft. Default `lockOnVisibility: true` plus ~6s re-unlock taxes every alt-tab. Positives: emoji/long-name truncation holds up; toasts keep Riley oriented.

## Minor Observations

- 9px "Local Vault" micro-caption beneath comfortable legibility though contrast passes.
- Hand-rolled 10px field labels bypass the MicroLabel primitive; 10px detail-header type chip is a button (forbidden).
- "Custom fields" header renders with zero visible rows when custom field value empty (`item-detail.tsx:737-753`).
- URL field accepts arbitrary strings; no format validation at the trust boundary.
- Setup lets Enter advance past the agreement checkbox (`setup-view.tsx:161-166`).
- After deleting last item, list shows "No matches / Try a different search" with no active search (`item-list/index.tsx:202-207`).
- Editor has two "Add" buttons (custom-field Add vs footer submit) — mis-click trap.
- Item rows use `content-visibility: auto`; row innerText invisible to naive DOM queries (synthetic-driving fragility note).

## Questions to Consider

- Why does your most destructive action require less confirmation than your least destructive one?
- If a keyboard-only user cannot open a single item, is the vault really local-first for everyone?
- Is `lockOnVisibility: true` protecting a journalist, or punishing everyone who alt-tabs?
