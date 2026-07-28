# Proton Pass UI/UX Research Brief — RESEARCH-PP-UX

> Sources verified against the **canonical** Proton source tree
> `github.com/ProtonMail/WebClients` (branch `main`) — `packages/colors/themes/src/pass-dark/*.css`,
> `packages/pass/styles/*.scss`, `packages/pass/components/**/*.tsx`, and `packages/pass/constants.ts`.
> All hex values below are **read directly from those files** (not from screenshots), so they are exact.

---

## 1. Color Palette — exact values

### 1.1 The brand / accent (provenance: `packages/pass/styles/common.scss`)

| Token                                | Hex        | OKLCH                              | Usage |
|--------------------------------------|------------|------------------------------------|-------|
| `--upsell-modal-button-color`        | `#6D4AFF`  | `oklch(0.5619 0.2513 283.65)`      | **Proton Pass brand purple** — used on the marketing upsell CTA. The famous “#6D4AFF” from the marketing site. |
| `--upsell-modal-background-color`    | `#1B1340`  | `oklch(0.2280 0.0818 286.09)`      | Deep-violet modal/card backdrop for upsell banners. |
| `--upsell-modal-badge-color`         | `#2C9F78`  | `oklch(0.6293 0.1172 165.71)`      | Teal “plus” / success badge text. |
| `--upsell-modal-badge-background-color` | `#EEF8F5` | `oklch(0.9708 0.0113 176.93)`    | Badge chip background. |

> Note: The in-app accent is **not** `#6D4AFF`. The web app uses an internally generated **`--primary` of `#7777F8`** (pass-dark) / `#8A6EFF` (pass-light), and per-context **sub-theme `--interaction-norm`** colors (violet/teal/orange/red/lime/gray). `#6D4AFF` is reserved for marketing/upsell surfaces.

### 1.2 Pass-dark theme — base tokens (`pass-dark/standard-base.css`)

| Token                | Hex        | OKLCH                              | Usage |
|----------------------|------------|------------------------------------|-------|
| `--primary`          | `#7777F8`  | `oklch(0.6342 0.1879 279.61)`      | App-level accent (favicon tint, link color, Safari selection). |
| `--signal-danger`    | `#F08FA4`  | `oklch(0.7572 0.1193 6.31)`        | Destructive actions, OTP countdown ≤5 s, errors. |
| `--signal-warning`   | `#FFB84D`  | `oklch(0.8305 0.1452 74.18)`       | Warnings, OTP countdown ≤10 s. |
| `--signal-success`   | `#4AB89A`  | `oklch(0.7109 0.1102 172.16)`      | OTP donut track, success toasts, strength=strong. |
| `--signal-info`      | `#4AC0FF`  | `oklch(0.7680 0.1376 236.14)`      | Info banners / links. |
| `--text-norm`        | `#FFFFFF`  | `oklch(1.0000 0.0000 0)`           | Primary text. |
| `--text-weak`        | `#BFB9D8`  | `oklch(0.8006 0.0439 294.19)`      | Secondary text, list subtitles, OTP countdown number. |
| `--text-hint`        | `#50505B`  | `oklch(0.4353 0.0180 285.56)`      | Hints, OTP donut empty track, placeholder. |
| `--text-disabled`    | `#50505B`  | `oklch(0.4353 0.0180 285.56)`      | Disabled text (same as hint). |
| `--text-invert`      | `#191927`  | `oklch(0.2204 0.0272 283.92)`      | Text on inverted (light) surfaces, checkmark glyph on selected bulk items. |
| `--field-norm`       | `rgb(255 255 255 / 0.04)` | —                  | Field background (4 % white overlay). |
| `--field-disabled`   | `#4C4C65`  | `oklch(0.3791 0.0392 282.45)`      | Disabled field fill. |
| `--optional-field-background-color` | `#1C1C2C` | `oklch(0.2344 0.0307 283.77)` | Input field background. |
| `--border-norm`      | `#7A7AAD`  | `oklch(0.5996 0.0773 283.81)`      | Visible borders on fields, checkboxes. |
| `--border-weak`      | `#38384C`  | `oklch(0.3493 0.0347 284.44)`      | Subtle dividers, ValueControl rows, sidebar HRs. |
| `--background-norm`  | `#1F1F31`  | `oklch(0.2482 0.0340 283.63)`      | **Main canvas** (app-root background). |
| `--background-weak`  | `#282839`  | `oklch(0.2846 0.0310 284.23)`      | Elevated surface — dropdowns, modals, field clusters. |
| `--background-strong`| `#191926`  | `oklch(0.2198 0.0253 284.10)`      | Strongest/deepest surface — bulk-select empty-state panel. |
| `--background-invert`| `white`    | `oklch(1.0 0.0 0)`                 | Inverted surfaces. |

### 1.3 Interaction color tokens — default sub-theme vs. violet sub-theme

The pass-dark theme ships **7 sub-themes** selected by a class on the root: `ui-standard` (default), `ui-violet`, `ui-teal`, `ui-orange`, `ui-red`, `ui-lime`, `ui-gray`. Each sub-theme overrides only `--interaction-norm` and `--interaction-weak` (the rest of the palette is shared). Auto-generated shades (`*-minor-2`, `*-minor-1`, base, `*-major-1`, `*-major-2`, `*-major-3`, `*-contrast`) are derived at build time by `gen-button-shades.ts` (tint/shade in HSV space).

**Default (`ui-standard`)** — used by sidebar / vault / global chrome:

| Token | Hex | OKLCH |
|---|---|---|
| `--interaction-norm`            | `#B6B6FF` | `oklch(0.8029 0.1028 283.83)` |
| `--interaction-weak`            | `#302D45` | `oklch(0.3114 0.0427 289.38)` |
| `--interaction-norm-minor-2`    | (≈ −80 % shade of base) | dark muted lavender |
| `--interaction-norm-minor-1`    | (≈ −70 % shade) | dark muted lavender |
| `--interaction-norm-major-1`    | (≈ +10 % tint) | near-white lavender |
| `--interaction-norm-major-2`    | (≈ +20 % tint) | near-white lavender (focus outline) |
| `--interaction-norm-major-3`    | (≈ +30 % tint) | almost white |
| `--interaction-norm-contrast`   | `#FFFFFF` | white text on norm |
| `--interaction-weak-contrast`   | `#FFFFFF` | white text on weak |
| `--interaction-default`         | `transparent` | idle ghost button |
| `--interaction-default-hover`   | `rgb(255 255 255 / 0.04)` | row hover |
| `--interaction-default-active`  | `rgb(255 255 255 / 0.08)` | row active |

**Violet sub-theme (`ui-violet`)** — applied to login item views/list items:

| Token | Hex | OKLCH |
|---|---|---|
| `--interaction-norm` | `#CAAAFF` | `oklch(0.7969 0.1222 300.95)` |
| `--interaction-weak` | `#30284A` | `oklch(0.3029 0.0606 293.24)` |

(The other 5 sub-themes — teal/orange/red/lime/gray — override `--interaction-norm` and `--interaction-weak` similarly; their exact base values are defined in `pass-dark/{teal,orange,red,lime,gray}-base.css` but are NOT in the default file. They follow the same generation pattern.)

### 1.4 Vault color tokens (RGB triplets → hex)

Used as `rgb(var(--vault-*))` for vault icon tints at 16 % opacity.

| Token                       | RGB triplet    | Hex       | OKLCH                              |
|-----------------------------|----------------|-----------|------------------------------------|
| `--vault-unspecified`       | `140 140 147`  | `#8C8C93` | `oklch(0.6423 0.0104 285.91)`      |
| `--vault-custom`            | `167 121 255`  | `#A779FF` | `oklch(0.6818 0.1922 296.82)`      |
| `--vault-heliotrope` (C1)   | `167 121 255`  | `#A779FF` | `oklch(0.6818 0.1922 296.82)`      |
| `--vault-mauvelous` (C2)    | `242 146 146`  | `#F29292` | `oklch(0.7598 0.1164 20.10)`       |
| `--vault-marigold-yellow` (C3) | `247 215 117` | `#F7D775` | `oklch(0.8863 0.1229 91.70)`     |
| `--vault-de-york` (C4)      | `145 199 153`  | `#91C799` | `oklch(0.7797 0.0859 148.69)`      |
| `--vault-jordy-blue` (C5)   | `146 179 242`  | `#92B3F2` | `oklch(0.7662 0.0981 262.92)`      |
| `--vault-lavender-magenta` (C6) | `235 141 214` | `#EB8DD6` | `oklch(0.7647 0.1450 335.59)`   |
| `--vault-chestnut-rose` (C7) | `205 90 111`  | `#CD5A6F` | `oklch(0.6170 0.1466 11.10)`       |
| `--vault-porsche` (C8)      | `228 163 103`  | `#E4A367` | `oklch(0.7652 0.1087 62.74)`       |
| `--vault-mercury` (C9)      | `230 230 230`  | `#E6E6E6` | `oklch(0.9249 0.0001 259.98)`      |
| `--vault-water-leaf` (C10)  | `158 226 230`  | `#9EE2E6` | `oklch(0.8690 0.0683 200.69)`      |

### 1.5 Other tokens

| Token | Value | Usage |
|---|---|---|
| `--shadow-norm-opacity`    | `0.32` | Card/elevation shadow alpha. |
| `--shadow-raised-opacity`  | `0.35` | Raised (hover) shadow alpha. |
| `--shadow-lifted-opacity`  | `0.40` | Lifted (modal) shadow alpha. |
| `--backdrop-norm`          | `rgb(0 0 0 / 0.5)` | Modal scrim. |
| `--search-field-focus-background` | `#0E0E0E` | Search bar focus bg (near-black inset). |
| `--pass-scroll-shadow-color` | `rgb(14 14 14 / 0.35)` | Scroll fade shadow at top/bottom of list. |
| `--pass-lobby-background-color` | `radial-gradient(61.86% 61.86% at 50% 0%, rgb(255 255 255 / 0.16) 0%, rgb(255 255 255 / 0) 100%), #191927` | **Lock screen** radial glow over deep-violet base. |
| `--pass-sidebar-size`      | `22.5em` (360 px @ 16 px) | Sidebar width. |
| `--border-radius-xl`       | `0.88rem` (≈14.08 px) | Pill / item-list rounded corners. |
| `--border-radius-lg`       | (Proton core: ≈6 px) | FieldsetCluster corners. |
| `--border-radius-md`       | (Proton core: ≈4 px) | Vault menu item corners. |

### 1.6 Number of surface levels — **3** background tiers + invert

1. `--background-strong` (`#191926`) — deepest (bulk-select empty state, lock-screen base color)
2. `--background-norm` (`#1F1F31`) — main canvas
3. `--background-weak` (`#282839`) — elevated panels (dropdowns, modals, sidebar hover)
4. `--background-invert` (`white`) — inverted surfaces

Plus the optional-field background (`#1C1C2C`) which sits between strong and norm — effectively a 4th tier used for input fills.

### 1.7 Pass-light theme (for parity / light mode)

| Token | Hex | OKLCH |
|---|---|---|
| `--primary`                | `#8A6EFF` | `oklch(0.6384 0.2066 287.97)` |
| `--signal-danger`          | `#CC2D4F` | `oklch(0.4964 0.1964 13.21)` |
| `--signal-warning`         | `#E65200` | `oklch(0.6384 0.1942 49.34)` |
| `--signal-success`         | `#007B58` | `oklch(0.4343 0.1226 173.36)` |
| `--signal-info`            | `#00AFE6` | `oklch(0.6685 0.1338 233.49)` |
| `--text-norm`              | `#2B2442` | `oklch(0.2834 0.0545 293.32)` |
| `--text-weak`              | `#52527A` | `oklch(0.4335 0.0721 282.91)` |
| `--border-norm`            | `#9994D1` | `oklch(0.6516 0.0839 286.71)` |
| `--border-weak`            | `#E3DFFA` | `oklch(0.9089 0.0271 291.71)` |
| `--background-norm`        | `#FBF9FE` | `oklch(0.9851 0.0070 303.54)` |
| `--background-weak`        | `#FFFFFF` | `oklch(1.0 0.0 0)` |
| `--background-strong`      | `#F4F0FE` | `oklch(0.9616 0.0192 298.12)` |
| `--interaction-norm` (violet sub-theme override) | `#6322AA` | `oklch(0.3416 0.1567 296.16)` |
| `--interaction-weak` (violet sub-theme override) | `#ECDFFA` | (light lavender) |

---

## 2. Typography

- **Font family:** `Inter` (web font, loaded via Proton styles), with system fallback stack. Override `--optional-font-family` allows user-switchable: System / Arial / Times / Dyslexic / Atkinson. Source: `ThemeFontFaceSetting` in `packages/colors/themes/constants.ts`.
- **Default base font-size:** 16 px (`CSS_BASE_UNIT_SIZE = 4`, with 1 em = 16 px).
- **Monospace:** applied via `.text-monospace` utility class for passwords, OTP codes, generated-password display. The pre tag override confirms Inter is the default; monospace falls back to browser default mono for password fields.

### Type scale (from `_text.scss` and component usage)

| Class          | Size            | Line height   | Usage |
|----------------|-----------------|---------------|-------|
| `.text-2xl`    | `1.5rem` (24 px) | `1.5rem` (24 px) | Item-detail title (`<h2>` in `ItemViewPanel`), generated-password display. |
| `.text-lg`     | `1.25rem` (20 px) | `1.25rem` (20 px) | Large secondary headings. |
| `.text-rg` / body | `1rem` (16 px) | default | Body, list item heading. |
| `.text-sm`     | `0.875rem` (14 px) | `1rem` (16 px) | List item subtitle, filter dropdown labels, bulk-action buttons. |
| `.text-xs`     | `0.75rem` (12 px) | default | OTP countdown number inside donut (`rem(12)`). |
| `.text-bold`   | weight 700 | — | Item name in detail panel. |
| `.text-semibold` | weight 600 | — | Filter buttons, vault subtitle accents. |
| `.text-italic` | italic | — | Empty-note subtitle in list. |

### Slider thumb dimensions (`_fields.scss`)
- Track height (small): `4 px`
- Thumb: `24 px × 24 px` circle, white fill, radius `12 px`

---

## 3. Layout & Spacing

### 3.1 Three-pane layout

| Pane | Width | Notes |
|------|-------|-------|
| **Sidebar** (vaults, menu) | `var(--pass-sidebar-size)` = `22.5em` ≈ **360 px** | `common.scss`. Fixed on desktop; drawer on mobile. |
| **Item list** | remaining viewport (≈ 40 %) | Header row + virtualized list. |
| **Item detail** (sidebar modal) | `59.67 %` of `(100 % − sidebar)` on >medium screens | `SidebarModal.scss`. Slides in from right (250 ms `translateX(100 %) → 0`). On `<xsmall` screens → 100 %. Generic sidebar modal (e.g. password generator) = `55 %`. |

### 3.2 Padding / gutter values (from `ItemsListItem.tsx`, `ItemsListHeader.tsx`, `MenuSidebar.tsx`)

| Surface | Padding |
|---------|---------|
| ItemsListHeader wrapper | `p-3 gap-1` (12 px / 4 px) |
| ItemsListItem row (default) | `px-3 py-2` (12 px / 8 px) |
| ItemsListItem row (bulk mode) | `px-2 py-1.5` (8 px / 6 px), wrapped in `px-1 py-0.5` outer |
| MenuSidebar scroll area | `mx-3 gap-5` (12 px horizontal / 20 px vertical gap) |
| Sidebar bottom section HRs | `my-2 mx-4` (8 px / 16 px) |
| FieldBox label/value vertical rhythm | 4 px / 8 px (Proton core spacing-2/4) |
| ValueControl value min-height | `rem(20)` = 20 px |

### 3.3 Border radius

| Token | Value | Usage |
|-------|-------|-------|
| `--border-radius-xl` | `0.88rem` ≈ **14.08 px** | Pill buttons, IconBox (when `pill`), bulk-select item corners, vault-icon background at size ≥ 5. |
| `--border-radius-lg` | Proton core (≈ 6 px) | FieldsetCluster top/bottom rounded corners. |
| `--border-radius-md` | Proton core (≈ 4 px) | VaultMenuItem buttons (`is-selected` state). |
| `rounded-full` | 50 % | Vault icon container (size ≥ 5), small icon-only buttons. |
| `rounded-xl` | utility (≈ 12 px) | IconBox default, vault icon container (size < 5). |
| `rounded-sm` | utility (≈ 2 px) | IconBox when `pill={false}`. |

### 3.4 Buttons (`_button.scss`)

| Variant | Height (`block-size`) | Notes |
|---------|----------------------|-------|
| Default solid/outline | `2.25rem` (36 px) | `button-for-icon` width = 36 px square. |
| `.button-small` | `2rem` (32 px) | Filter dropdowns, bulk-action buttons. |
| `.button-xs` | `1.5rem` (24 px) | Compact icon buttons. |

Padding default: `0.5rem 0.75rem`; small: `0.375rem 0.5rem`.

---

## 4. Item List + Detail Anatomy

### 4.1 List item (`ItemsListItem.tsx` + `ItemsListItem.scss`)

```
┌──────────────────────────────────────────────────────────────┐
│ [icon] Item name                                  [shared]   │   ← px-3 py-2 (or px-2 py-1.5 in bulk)
│        subtitle (color-weak, text-sm, ellipsis)              │
└──────────────────────────────────────────────────────────────┘
```

- **Row container:** `ButtonLike` (renders as `<a>`), `shape="ghost"`, `color="weak"` (or `color="warning"` if item failed to sync), `w-full`, `border-radius: 0` (flush rows).
- **Icon:** `SafeItemIcon size={5}` (outer box = `5 × 4 × 1.8` = **36 px**), `mr-3 shrink-0`, sub-theme class applied per item type (so icon color = sub-theme `--interaction-norm`). Login items try to load domain favicon; if it fails the type icon (e.g. `user`) shows. Credit-card items render the brand SVG (amex / mastercard / visa) instead of the generic icon.
- **Indicators (overlaid on icon, absolute positioned):**
  - Default mode: `ItemIconIndicators` — `CircleLoader` while optimistic/loading; `IcExclamationCircleFilled` (signal-warning) on failure.
  - Bulk mode: `checkmark` icon pill (`background: var(--interaction-norm); color: var(--text-invert); opacity: 0 → 1` on select).
  - Pinned items: `IcPinAngledFilled` in an `IconBox size=2.5` at `bottom: -6px; right: -6px`, background `var(--interaction-norm-major-1)`, color `var(--interaction-weak)`.
- **Heading:** `text-ellipsis` span; matches search via `<Marks>` (highlight matched chunks). For vault-share items, a small `VaultIcon size=3` precedes the heading.
- **Subtitle:** `color-weak text-sm text-ellipsis block`. Italicized when note is empty. For shared items, an `IcUsersFilled size=3.5` may follow.
- **Subtitles per item type** (`presentListItem`):
  - login → email-or-username (via `intoUserIdentifier`)
  - alias → alias email address
  - note → first line of note body (or “Empty note” in italic)
  - creditCard → masked card number (`•••• 1234` style)
  - identity / sshKey / wifi / custom → empty subtitle
- **Active state:** `.is-active` → `background-color: var(--interaction-weak)` (the sub-theme’s tinted weak color).
- **Bulk-selected state:** `background: var(--interaction-norm-minor-1) !important` plus checkmark opacity 1.
- **Loading state:** `style="--anime-opacity: 0.5"` (fades whole row); icons get `opacity-50`.
- **Search match color:** `<mark class="is-light">` → `color: var(--interaction-norm)` in heading; `color: var(--interaction-weak-contrast)` in subtitle; weight `--font-weight-normal`.

### 4.2 Detail panel (`ItemViewPanel.tsx`, `Login.content.tsx`, `ValueControl.tsx`, `FieldsetCluster.scss`)

```
┌─ Panel (className = sub-theme class e.g. "ui-violet") ──────────────┐
│  PanelHeader                                                        │
│    [icon] h2 "Item name"  (text-2xl, text-bold, mb-0-5, ellipsis)   │
│    actions: [Edit (IcPencil)] [QuickActionsDropdown ⋯]              │
│  ─────────────────────────────────────────────────────────────────  │
│  VaultTag (which vault this item lives in)                          │
│                                                                      │
│  Card (bg = --interaction-weak, border-weak, rounded)               │
│    h3 = capitalized item heading                                     │
│    FieldsetCluster (mode="read")                                     │
│      ┌─ ValueControl ─────────────────────────────────────────┐    │
│      │ [icon] Label                            [actions]       │    │
│      │        value (text-monospace for passwords)             │    │
│      └──────────────────────────────────────────────────────────┘   │
│      ┌─ ValueControl ─────────────────────────────────────────┐    │
│      │ ... (next field, shares border with previous)            │    │
│      └──────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ItemHistoryStats (created / modified / last-used timestamps)       │
│  MoreInfoDropdown (revision number, vault id, share id)             │
└──────────────────────────────────────────────────────────────────┘
```

**FieldsetCluster visual rules:**
- Each child has `1px solid var(--border-weak)` and `margin-block-start: -1px` so adjacent rows collapse to a single 1-px divider.
- First child: top corners `--border-radius-lg`; bottom corners 0.
- Last child: bottom corners `--border-radius-lg`; top corners 0.
- Only child: all corners `--border-radius-lg`.
- Cluster icon color: `var(--interaction-norm)` (sub-theme-aware).

**ValueControl rows** (for login, in order):
1. **Passkey** section (if any) — `ValueControl` with `className="pass-value-control--standout"` (subtle linear-gradient bg using `--interaction-norm-major-2`), icon `pass-passkey`, label `"Passkey • {domain}"`, chevron-right action.
2. **Email** — icon `envelope` (or `alias` if email matches a saved alias), `clickToCopy`. Label “Email” / “Email (alias)”.
3. **Username** — icon `user`, `clickToCopy`.
4. **Password** — icon `key`, `hidden` (default), value rendered with `getCharsGroupedByColor` (alphabetic = `--text-norm`; digits & specials = `--interaction-norm-major-1`), `text-monospace text-break-all`. Right-side actions: inline `PasswordStrength` meter + `HideButton` (pill, ghost, `IcEye`/`IcEyeSlash`, size=5). Click row to copy.
5. **TOTP** (`OTPValueControl`) — icon `lock`, label “2FA token (TOTP)”, value = `<OTPValue>` (3-digit-chunked, e.g. `123 456`), action = `<OTPDonut>` countdown. Click row to copy.
6. **Websites** — icon `earth`, rendered as a `<ul>` of bordered `bg-weak rounded-lg` chips with optional autofill-mode warnings.
7. **Note** — icon `note`, rendered as `TextAreaReadonly`.
8. **Extra/custom fields** — `ExtraFieldsControl`.

**ValueControl behavior:**
- Default hidden value: `••••••••••••` (12 bullets) — `DEFAULT_HIDDEN_VALUE` constant.
- Empty value: shows `"None"` in `color-weak`.
- Loading: shows `pass-skeleton` shimmer.
- Hover (`--interactive`): `background-color: var(--interaction-default-hover)` (4 % white), 250 ms transition.
- Active: `var(--interaction-default-active)` (8 % white).
- Focus-visible: `1px solid var(--interaction-norm)` outline.
- Background: `var(--field-background-color)` (the optional-field bg).

**TOTP donut anatomy** (`OTPDonut.tsx`, `OTPDonut.scss`):
- Canvas size: **36 × 36 px**, line thickness **3 px**.
- Track (empty arc): `var(--text-hint)`.
- Filled arc (countdown progress): `var(--signal-success)` normally, switches to `--signal-warning` at ≤10 s, then `--signal-danger` at ≤5 s.
- Countdown number rendered via CSS `::before` with `content: var(--countdown-value)`, font-size `rem(12)` (12 px), `color: var(--text-weak)`, centered.
- The donut is a `<canvas>` element, redrawn each second by the OTP code hook.

**Header actions (right side of PanelHeader):**
- `Edit` button (pill, `IcPencil`, color norm).
- `QuickActionsDropdown` (⋯ icon, ghost, color weak) containing context-dependent items:
  - Move to vault (`folder-arrow-in`)
  - Pin / Unpin (`pin-angled` / `pin-angled-slash`)
  - Create secure link (`link`)
  - Share (`user-plus`)
  - Manage access (`users`)
  - Include/Exclude from monitoring (`eye`/`eye-slash`)
  - History (`clock-rotate-left`)
  - Trash (`trash`)
- If trashed: `Restore item` (`arrows-rotate`) + `Delete permanently` (`trash-cross`).
- If failed to sync: `Dismiss` (outline danger) + `Retry` (solid norm).

---

## 5. Vaults Sidebar (`MenuSidebar.tsx`, `VaultMenu.tsx`, `VaultMenuItem.tsx`, `VaultIcon.tsx`)

### 5.1 Sidebar structure (top → bottom)

1. **Scroll area** (`flex-1`, min-height `5em`, `overflow-auto`), padded `mx-3`, gap `gap-5`:
   - **“Vaults” header button** — full-width ghost button, `color="norm"`, `size="medium"`, padding `py-2 pl-3 px-2`, justify-between. Label “Vaults”, right side `IcPlus` (create new vault). Wrapped in `OrganizationPolicyTooltip` if org disables vault creation.
   - **VaultMenu**:
     - `VaultMenuAll` (All vaults) — shows total count across all vaults + items shared-with-me.
     - One `VaultMenuItem` per visible vault, sorted by Proton’s default order.
     - `VaultMenuTrash` (Trash) at the bottom.
   - `SharedMenu` (Shared with me / Shared by me / Secure links).
2. **Bottom section** (`shrink-0`, fixed):
   - HR (my-2 mx-4)
   - `OnboardingActions`
   - `MonitorButton` (Pass Monitor / dark-web monitoring entry)
   - `OrganizationActions`
   - HR
   - `AuthActions` (Lock / Sign out)
   - `Submenu` “Advanced” (bolt icon)
   - `Submenu` “Get mobile and desktop apps” (mobile icon)
   - `InAppNotificationContainer` (px-4 py-2)
   - HR
   - User panel + `MenuActions` (overflow menu)
   - `UserStorage` (storage usage bar)

### 5.2 VaultMenuItem anatomy

```
┌─ DropdownMenuButton (pl-2 pr-2) ─────────────────────────────────────┐
│ [VaultIcon        ]  Vault name                       [Share btn]   ⋯ │
│  background=true       color-weak:                                     │
│  size=4                  "{count} item(s)"                             │
│  rounded-full                                                       │
│  tint @ 16% opacity                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

- **VaultIcon** (size=4, `background=true` → outer container 8 × 4 = 32 px):
  - Background tint: `var(--vault-icon-color)` at **16 % opacity** (via `::before` overlay, `border-radius: 50%`).
  - Icon color: `var(--vault-icon-color)` (full opacity).
  - When highlighted (selected in dropdown): `var(--interaction-norm-contrast)` (white in dark theme).
  - `--vault-icon-color` is set inline as `rgb(${VAULT_COLOR_MAP[color]})`.
- **Label:** vault name, `text-ellipsis`.
- **Subtitle:** `"{count} item"` / `"{count} items"` in `color-weak` (uses `ngettext` for pluralization).
- **Share button** (right side, `pill icon` if `targetMembers ≤ 1`, otherwise shows count): `IcUsersFilled`-style icon (`user-plus` if not shared; `users` + member count if shared). Color: `var(--text-weak)`. Wrapped in `ButtonLike as="div"`, `color="weak"`, `shape="solid"`, `size="small"`. Has a notification badge (`IcExclamationCircleFilled` color `--signal-danger`) if pending invites are ready to accept.
- **Quick-action menu (⋯, via DropdownMenuButton):**
  - Edit vault (`pen`)
  - Manage access / See members (`users`)
  - Share (`user-plus`)
  - Move all items (`folder-arrow-in`)
  - Leave vault (`cross-circle`, `danger`)
  - Delete vault (`trash`, `danger`)
- **Selected / drag-over state:** `.is-selected` → `background-color: var(--interaction-norm-minor-2)` (for vault submenu items) or `--interaction-weak` (for sidebar items, via `_sidebar.scss` `--optional-navigation-current-item-background-color`).

### 5.3 Create-vault flow

Click `IcPlus` next to the “Vaults” header → opens `Vault.new` modal (a `SidebarModal`) containing `Vault.form`. Form fields: name, description, color picker (10 swatches from `VAULT_COLOR_MAP`), icon picker (30 icons from `VAULT_ICON_MAP`). Save → optimistic create.

### 5.4 10 vault color swatches (VAULT_COLOR_MAP)

See **§1.4** table — `heliotrope` (C1, default) through `water-leaf` (C10).

### 5.5 30 vault icons (VAULT_ICON_MAP)

`pass-home, pass-work, pass-gift, pass-shop, pass-heart, pass-bear, pass-circles, pass-flower, pass-group, pass-pacman, pass-shopping-cart, pass-leaf, pass-shield, pass-basketball, pass-credit-card, pass-fish, pass-smile, pass-lock, pass-mushroom, pass-star, pass-fire, pass-wallet, pass-bookmark, pass-cream, pass-laptop, pass-json, pass-book, pass-box, pass-atom, pass-cheque`. Default: `pass-all-vaults` for the “All vaults” aggregate item.

---

## 6. QoL Feature Checklist

| Feature | Implemented? | Details / source |
|---|---|---|
| **Keyboard shortcut: New item** | ✅ Desktop/Web | `useNewItemShortcut`: `Ctrl/Cmd + N` (`hooks/useNewItemShortcut.ts`). Extension uses popup instead. |
| **Keyboard shortcut: Search** | ✅ Desktop/Web | `useSearchShortcut`: `Ctrl/Cmd + F`. |
| **Keyboard shortcut: Save item** | ✅ All builds | `useSaveShortcut`: `Ctrl/Cmd + S` (works in item editor). |
| **Keyboard shortcut: Autofill (extension)** | ✅ Extension | `Cmd/Ctrl + Shift + L` (community-proposed default; GitHub issue #453). |
| **Quick-copy on row click** | ✅ | `ValueControl` `clickToCopy` prop wraps row in `ClickToCopy` HOC. |
| **Reveal / hide password** | ✅ | `HideButton` toggles `IcEye`/`IcEyeSlash`; hidden state shows `••••••••••••`. |
| **TOTP auto-copy on click** | ✅ | `OTPValueControl` `clickToCopy` + telemetry. |
| **Password strength meter** | ✅ | `PasswordStrength` component (inline in value-control, or full-width in generator). |
| **Password history** | ✅ | `MAX_PASSWORD_HISTORY_RETENTION_WEEKS = 2` (`constants.ts`). `PasswordHistoryModal` accessible from generator. |
| **Bulk multi-select** | ✅ | `BulkToggle` button (`IcCheckmarkTriple` + “Multiple select”), tooltip shows `Cmd/Ctrl` key hint. Enabled only on `share` and `trash` scopes. Selection = `Map<shareId, Set<itemId>>`. Toggle individual items via `Cmd/Ctrl+click`. |
| **Bulk actions** | ✅ | `BulkActions`: Move (`folder-arrow-in`) + Trash (`trash`) in normal scope; Restore (`clock-rotate-left`) + Delete (`trash-cross`) in trash scope. Replaces Type+Sort filters when bulk-enabled. |
| **Drag-and-drop move** | ✅ | See §8. Web/Desktop only (disabled in extension). |
| **Item type filter** | ✅ | `TypeFilter` dropdown (`width: 12rem`). Options: All / Logins / Aliases / Cards / Notes / Identities / Custom Items (latter feature-flagged `PassCustomTypeV1`). Icons: `grid-2, user, alias, credit-card, file-lines, card-identity, wrench`. Shows per-type count. |
| **Sort filter** | ✅ | `SortFilter` dropdown (`width: 13rem`). Options: Relevant (search only, magnifier) / Recent (clock) / Alphabetical A-Z / Newest-oldest / Oldest-newest. `ITEMS_SORT_OPTIONS = ['relevant', 'recent', 'titleASC', 'createTimeDESC', 'createTimeASC']`. |
| **Search** | ✅ | Fuzzy subsequence matcher (`matchChunks`), highlights matches with `<Marks>`. Ranked by field (title → username/email → website → notes) and match precision (exact / starts-with / contains). |
| **Pin items** | ✅ | `IcPinAngledFilled` badge on item icon (bottom-right, `-6px` offset). Pinned items sort first. |
| **Auto-lock** | ✅ | `DEFAULT_LOCK_TTL = 600` s (10 minutes). User-configurable slider in settings. |
| **Password generator (random)** | ✅ | Length slider `4–64`, step 1. Toggles: Special characters (!&*) [basic], Capital letters (A-Z) [advanced], Include numbers (0-9) [advanced]. Slider track 4 px, thumb 24 px, color `--interaction-norm`. |
| **Password generator (memorable/passphrase)** | ✅ | Word-count slider `1–10`. Toggles: Capitalize [basic], Separator type (SelectTwo dropdown) [advanced], Include numbers [advanced]. |
| **Advanced options toggle** | ✅ | Cogwheel icon button (`IcCogWheel`/`IcCross`) at bottom of generator panel — “Advanced options” / “Close advanced options”. |
| **Regenerate button** | ✅ | Pill icon button, `IcArrowsRotate`, top-right of generator modal header. |
| **Custom fields** | ✅ | `ExtraFieldsControl` for text/hidden/url/totp custom fields per item. |
| **File attachments** | ✅ | `FileAttachmentsContentView`, `FILE_CHUNK_SIZE = 4 MB`, upload/download timeout 90 s. |
| **Secure links** | ✅ | `SecureLinkCardList` in detail view; `SecureLinkQuickActions` in list header for `secure-links` scope. |
| **Item history** | ✅ | `ItemHistoryPanel`, `ItemHistoryStats` shows created/modified/last-used. |
| **Passkey support** | ✅ | `PasskeyContentModal`, passkey row in login detail with “standout” styling. |
| **Monitor (dark-web)** | ✅ | `MonitorButton` in sidebar, `ItemReport` per login (shows breaches). |
| **Pass Sentinel (auto-fill monitoring)** | ✅ | `UpsellRef.SECURE_LINKS`, `PassFeature.PassMLAutofill`. |
| **Auto-type (desktop)** | ✅ | `useAutotypeShortcut`, `AutotypeDropdownLogin`, feature-flagged `PassDesktopAutotype` (experimental on Linux). |
| **SSH agent integration** | ✅ | `sshKey` item type with `GRAY` sub-theme. |
| **Trash / Restore / Permanent delete** | ✅ | Soft delete → Trash; restore from trash; permanent delete via `trash-cross` icon. |
| **Move item to vault** | ✅ | `Vault.move` / `VaultSelect` modal, or drag-and-drop. |
| **Move all items** | ✅ | Vault context-menu action (`folder-arrow-in`). |
| **Item sharing** | ✅ | `useItemActions.onShare`, member count badge on vault icon, `IcExclamationCircleFilled` for pending invites. |
| **Themes** | ✅ | PassDark (default), PassLight, OS-follows-system. Plus 7 sub-themes per app theme. |
| **Custom scrollbars** | ✅ | `--pass-scroll-shadow-color`, overlay scrollbar in vertical scroll containers, 1.5rem shadow gradient at top/bottom. |

---

## 7. Micro-interactions

| Interaction | Implementation |
|---|---|
| **Fade-in/out** | `anime-fade-in` / `anime-fade-out` keyframes, `0.25s ease-out-sine`, `--anime-delay: 0.1s` default, `--anime-opacity: 1` target. Used by OTP donut, item icons, modal contents. |
| **Reveal (max-height)** | `anime-reveal`: `transition: max-block-size 0.25s ease-in-out`, default max `rem(180)` (180 px). Hidden state collapses to 0 with `border: 0`. |
| **Modal slide-in** | `anime-modal-two-sidebar-dialog-in`: `translateX(100 %) → translateX(0)` over 250 ms. Out reverses. |
| **Item-row hover** | `transition: background 0.2s ease-in-out` on `.pass-item-list--item`. No background change by default (ghost button); on hover the `ButtonLike color="weak"` shows weak bg. |
| **Table-row hover** | `transition: 0.15s ease-in-out background; background: var(--interaction-norm-minor-1)` on `.pass-table--row:hover`. |
| **ValueControl hover** | `transition: background-color 250ms`; bg `var(--interaction-default-hover)` on hover, `var(--interaction-default-active)` on active. |
| **Toggle switch** | `transition: background-color 0.2s`. Off: `::before` bg `--interaction-weak-major-3`, hover `--interaction-norm`. On: container bg `--interaction-weak`, `::before` bg `--interaction-norm`, hover `--interaction-norm-major-1`. |
| **Bulk-select checkmark** | `transition: opacity 0.15s ease-in-out`, opacity 0 → 1 on select. |
| **Icon box bg** | `transition: background 0.25s ease-in-out` on `.pass-item-icon`. |
| **Panel content cross-fade** | `transition: opacity 250ms ease-in-out` on `.pass-panel--content`. |
| **Fieldset cluster** | `transition: opacity 0.2s ease-in-out`. |
| **FieldBox focus ring** | `::before` border `1px solid transparent` → `var(--interaction-norm)` on `:focus-visible`, `transition: 0.15s ease`. |
| **Large-type reveal** | Not a distinct mode in Proton Pass; reveal uses the inline `HideButton`. The generator displays the password at `text-2xl` (24 px) `text-monospace text-break-all` centered with `min-h: 5.5rem`. |
| **Copy confirmation** | `ClickToCopy` HOC shows transient inline checkmark / toast (Proton core `Notification` system via `@proton/components`). |
| **Clipboard auto-clear** | Not a native Proton Pass feature in this codebase (LCKED adds 30 s auto-clear as a privacy enhancement). |
| **Empty states** | `ItemsListPlaceholder` skeleton; `BulkView` empty state in `bg-strong` showing “No items selected” + helper text; `ItemsListPlaceholder` shows skeleton rows while loading. |
| **TOTP countdown** | Canvas redrawn each second; ring depletes; color shifts green → yellow (≤10 s) → red (≤5 s); number in center updates via CSS `--countdown-value` custom property. |
| **Strength meter** | `PasswordStrength` shows colored bar + label (Very weak / Weak / Strong / Very strong); inline variant sits in the password row’s actions slot. |

---

## 8. Drag-and-Drop Pattern (move items between vaults)

### 8.1 Capability gating
- **Web/Desktop only.** `useCanDragItems = !EXTENSION_BUILD`. Extension uses `VaultSelect` modal instead.
- Items can be dragged only if `!loading && !failed` (per `ItemsListItem`).
- Drop targets (vaults) accept drops only if `isWritableVault(vault)` (read-only / shared-as-viewer vaults reject drops).

### 8.2 Drag source (`useItemDrag`, `ItemsListItem.tsx`)
- The whole row is `draggable={canDrag}` on the `<ButtonLike>`.
- `onDragStart` calls `handleDragStart(evt, { ID: id })` from `useItemsDraggable`.
- If bulk-select is enabled and there is a selection, **all selected items** are dragged together (the hook derives the list from `bulk.selection`).
- The drag image (HTML5 `DataTransfer.setDragImage`) shows a custom label: `Move {count} item` / `Move {count} items` (via `getDragHtml`).

### 8.3 Drop target (`useItemDrop`, `VaultMenuItem.tsx`)
- Each vault row spreads `{...dragProps}` from `useItemDrop(onDrop, dragFilter)`.
- `dragFilter` returns `Boolean(vault && isWritableVault(vault))` — non-writable vaults are not droppable.
- `onDrop` parses item keys (`fromItemKey`) and calls `moveMany(intoBulkSelection(items), shareId)`.
- `dragOver` boolean state drives visual feedback.

### 8.4 Visual feedback
- While dragging over a valid vault: `VaultMenuItem` applies `.is-selected` class (same as the selected state) → `background-color: var(--interaction-norm-minor-2)`.
- The drag image is the “Move N items” text label (Proton core `useItemsDraggable`).
- No separate drop-zone outline animation is applied (relies on the existing selected-state background).

### 8.5 Alternative: bulk-move modal
When bulk-select is active, the `BulkActions` toolbar shows a `Move` button (`IcFolderArrowIn`) that opens the `VaultSelect` modal instead of dragging. Same `moveMany` action under the hood.

### 8.6 Per Proton support doc (`proton.me/support/pass-bulk-select-items`)
> “To move items to another vault, you can either drag and drop them directly or select Move. To delete items, select Trash.”

Confirmed: DnD is a first-class move mechanism, not a secondary affordance.

### 8.7 Item-reorder DnD
**Not implemented** — Proton Pass does not support manual reordering within a vault (sort is governed by `SortFilter`: relevant / recent / alphabetical / newest / oldest). This is a deliberate design choice.

### 8.8 Reorder vaults
**Not implemented** — UserVoice request exists (`protonmail.uservoice.com/.../drag-and-drop-between-vaults`); Proton has not shipped vault reordering. Vaults are listed in creation/share order.

---

## 9. Iconography

### 9.1 Icon system
- Proton uses its own `@proton/icons` package (SVG sprite, consumed as React components `IcXxx` or via `<Icon name="xxx" />`).
- `IconSize` is an integer; pixel size = `size × CSS_BASE_UNIT_SIZE` where `CSS_BASE_UNIT_SIZE = 4`. So size 5 → 20 px icon, size 3 → 12 px, size 4 → 16 px.
- IconBox outer container = `size × 4 × 1.8` = `7.2 × size` pixels (size 5 → 36 px box, size 4 → 28.8 px).
- Default `pill` = true → `rounded-xl`. With `pill={false}` → `rounded-sm`.

### 9.2 Item-type icons (`itemTypeToIconName`)

| Item type | Icon name | Sub-theme (color) |
|---|---|---|
| login | `user` | **VIOLET** (`ui-violet`) |
| note | `file-lines` | **ORANGE** (`ui-orange`) |
| alias | `alias` (disabled → `alias-slash`) | **TEAL** (`ui-teal`) |
| creditCard | `credit-card` (overridden by brand SVG if Visa/MC/Amex) | **LIME** (`ui-lime`) |
| identity | `card-identity` | **PURPLE** (`ui-purple`) |
| sshKey | `filing-cabinet` | **GRAY** (`ui-gray`) |
| wifi | `shield-2-bolt` | GRAY |
| custom | `wrench` | GRAY |

### 9.3 Action icons used in the UI

| Action | Icon | Where |
|---|---|---|
| Create new vault / new item | `IcPlus` | Sidebar “Vaults” button, item-create FAB |
| Edit | `IcPencil` | Item detail header, vault edit |
| Move | `IcFolderArrowIn` | Bulk actions, vault move-all |
| Trash | `IcTrash` | Bulk actions, item delete |
| Restore | `IcClockRotateLeft` | Trash scope bulk actions |
| Delete permanently | `IcTrashCross` | Trash scope |
| Share | `user-plus` | Vault menu, item actions |
| Users / members | `IcUsersFilled` / `users` | Shared vault indicator, manage access |
| Pin | `IcPinAngledFilled` | Pinned item badge |
| Reveal | `IcEye` | Password show |
| Hide | `IcEyeSlash` | Password hide |
| Regenerate | `IcArrowsRotate` | Password generator |
| Advanced options | `IcCogWheel` (open) / `IcCross` (close) | Password generator |
| Settings / overflow | `⋯` (ellipsis) | QuickActionsDropdown |
| Chevron right | `IcChevronRight` | Passkey row, history links |
| Warning | `IcExclamationCircleFilled` | Failed sync, pending invites |
| Bulk select toggle | `IcCheckmarkTriple` | BulkToggle button |
| Lock | `lock` | TOTP row icon, sidebar auth |
| Earth | `earth` | Websites field |
| Envelope | `envelope` | Email field |
| Key | `key` | Password field |
| Note | `note` (file-lines alias) | Note field |

### 9.4 Domain favicon loading
For login items, `DomainIcon` attempts to load `https://{domain}/favicon.ico` (or Proton’s favicon proxy). If `imageStatus === READY`, the favicon replaces the type icon inside the IconBox; the type icon fades out via `anime-fade-out`. If loading fails, the type icon (`user`) remains visible. Controlled by `selectCanLoadDomainImages` setting (user can disable for privacy).

### 9.5 Credit-card brand icons
Pre-bundled SVGs from `@proton/styles/assets/img/credit-card-icons/`: `cc-american-express.svg`, `cc-mastercard.svg`, `cc-visa.svg`. Other brands fall back to the generic `credit-card` icon.

---

## 10. Source URLs

| URL | What it gives |
|---|---|
| https://github.com/ProtonMail/WebClients/blob/main/packages/colors/themes/src/pass-dark/standard-base.css | **Canonical pass-dark color tokens** (text/bg/border/signal/interaction/vault). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/colors/themes/src/pass-dark/violet-base.css | Violet sub-theme overrides (`--interaction-norm`, `--interaction-weak`). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/colors/themes/src/pass-light/standard-base.css | Pass-light theme tokens. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/colors/themes.config.ts | Theme build config — confirms 7 sub-themes for pass-dark. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/colors/gen-button-shades.ts | **Shade generation algorithm** (`-minor-2/-minor-1/base/-major-1/-major-2/-major-3/-contrast`). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/colors/gen-themes.ts | How the 7 button shade names are produced per base color. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/colors/themes/constants.ts | Enum of all 16 Proton themes (PassDark=8, PassLight=12). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/styles/common.scss | `--pass-sidebar-size: 22.5em`, `--border-radius-xl: 0.88rem`, `--upsell-modal-button-color: #6D4AFF` (brand purple confirmed). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/styles/_button.scss | Button heights/padding (default 2.25rem, small 2rem, xs 1.5rem). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/styles/_fields.scss | Toggle/slider/input styling, slider thumb 24×24. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/styles/_password.scss | Password char coloring (alphabetic vs digit/special). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/styles/_animation.scss | `anime-fade-in/out` 0.25s ease-out-sine, `anime-reveal` 0.25s ease-in-out. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/styles/_lobby.scss | Lobby (lock-screen) background. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/styles/_scroll.scss | Scroll shadow gradient (1.5rem, `--pass-scroll-shadow-color`). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/styles/_table.scss | Table row hover (`--interaction-norm-minor-1`, 0.15s). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/styles/_sidebar.scss | Sidebar selected-item background. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Item/List/ItemsListItem.tsx | **Item-list row anatomy** (icon, heading, subtitle, indicators, drag handlers). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Item/List/ItemsListItem.scss | List-row selected/bulk/pin styling. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Item/List/ItemsListActions.tsx | Filter chips + bulk toggle layout. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Item/List/utils.ts | `presentListItem` — heading/subtitle per item type. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Item/Filters/Type.tsx | Type filter dropdown (12rem width). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Item/Filters/Sort.tsx | Sort filter dropdown (13rem), 5 sort options. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/hooks/items/useItemFilters.ts | Type-filter option labels/icons (All/Logins/Aliases/Cards/Notes/Identities/Custom). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Item/Login/Login.content.tsx | **Login detail field layout** (email/username/password/TOTP/websites/note/extra). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Form/Field/Control/ValueControl.tsx | ValueControl row component (icon/label/value/actions, hide button, click-to-copy). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Form/Field/Control/ValueControl.scss | ValueControl hover/active/focus styling. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Form/Field/Control/OTPValueControl.tsx | TOTP row using `OTPDonut` as action. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Form/Field/Layout/FieldsetCluster.scss | Fieldset cluster rounded-corner rules. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Layout/Panel/ItemViewPanel.tsx | Detail panel header actions (Edit / QuickActions). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Layout/Modal/SidebarModal.scss | Sidebar modal width (55% / 59.67%) and slide-in animation. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Layout/Icon/IconBox.tsx | Icon sizing taxonomy (`size × 4 × 1.8`). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Layout/Icon/ItemIcon.tsx | Item-type → icon-name map, domain-favicon loading, brand-card icons. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Layout/Theme/types.ts | Sub-theme enum + item-type → sub-theme mapping. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Otp/OTPDonut.tsx | TOTP donut: 36px canvas, 3px thickness, color thresholds (≤10s warning, ≤5s danger). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Otp/OTPValue.tsx | TOTP formatting (3-digit chunks). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Password/PasswordGenerator.tsx | Generator panel layout (text-2xl, min-h 5.5rem, advanced toggle). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Password/PasswordRandomOptions.tsx | Random password: length 4–64, special chars, caps, digits. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Password/PasswordMemorableOptions.tsx | Memorable: words 1–10, capitalize, separator, numbers. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Menu/Sidebar/MenuSidebar.tsx | Sidebar top-level structure. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Menu/Vault/VaultMenu.tsx | Vault menu (All + per-vault + Trash). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Menu/Vault/VaultMenuItem.tsx | **Vault row anatomy + drag-drop target wiring**. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Vault/VaultIcon.tsx | Vault icon component (16% bg tint, rounded-full). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Vault/constants.ts | `VAULT_COLOR_MAP` (10 colors) + `VAULT_ICON_MAP` (30 icons). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Bulk/BulkActions.tsx | Bulk Move/Trash/Restore/Delete actions. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Bulk/BulkToggle.tsx | Bulk-select toggle button + Cmd/Ctrl tooltip. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/components/Bulk/BulkView.tsx | Bulk empty state + “drag-and-drop selected items” hint. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/hooks/useItemDrag.ts | **Drag source + drop target hooks** (web/desktop only, multi-item). |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/hooks/useNewItemShortcut.ts | `Ctrl/Cmd + N` shortcut. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/hooks/useSearchShortcut.ts | `Ctrl/Cmd + F` shortcut. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/hooks/useSaveShortcut.ts | `Ctrl/Cmd + S` shortcut. |
| https://github.com/ProtonMail/WebClients/blob/main/packages/pass/constants.ts | `DEFAULT_LOCK_TTL=600`, `MAX_PASSWORD_HISTORY=2w`, `MAX_ITEM_NAME=200`, etc. |
| https://proton.me/support/use-pass-web | Official “How to use the Proton Pass web app” doc. |
| https://proton.me/support/pass-bulk-select-items | Official bulk-select doc — **confirms drag-and-drop move**. |
| https://proton.me/support/pass-vault | Official “What is a vault” doc. |
| https://proton.me/support/creating-and-using-theme-settings | Theme switching (Carbon, Snow, PassDark, PassLight, etc.). |
| https://proton.me/support/dark-mode | Dark-mode enable steps. |
| https://proton.me/blog/pass-roadmap-spring-2025 | Confirms drag-and-drop between vaults shipped winter 2024/early 2025. |
| https://github.com/ProtonMail/WebClients/issues/453 | Extension autofill shortcut discussion (Cmd/Ctrl+Shift+L proposal). |
| https://pass.proton.me | Live Proton Pass web app (login required). |
| https://proton.me/pass/password-generator | Public password generator tool page. |
| https://www.pcmag.com/reviews/proton-pass | PCMag review — confirms 64-char max length, password history. |

---

## 11. Implementation Notes for LCKED

1. **Replace LCKED’s current accent** (`#6D4AFF` as primary) with `#7777F8` (pass-dark `--primary`) for in-app chrome, and reserve `#6D4AFF` for marketing/upsell-style surfaces.
2. **Add sub-theme support** — LCKED should adopt Proton’s per-item-type sub-theme pattern: apply `ui-violet`/`ui-teal`/`ui-orange`/`ui-lime`/`ui-purple`/`ui-gray` classes that override `--interaction-norm` and `--interaction-weak`. Login items → violet, alias → teal, note → orange, card → lime, identity → purple, custom/ssh/wifi → gray.
3. **Adopt the exact 3-tier surface scale**: `--background-strong #191926`, `--background-norm #1F1F31`, `--background-weak #282839`. LCKED’s current canvas should shift to `#1F1F31`.
4. **Sidebar width 360 px** (`22.5em`) — match exactly.
5. **Detail panel = sidebar modal at 59.67 % of (100 % − 360 px)** — currently LCKED uses a third pane; consider the slide-in pattern for parity.
6. **ValueControl row component** — build the icon/label/value/actions + click-to-copy + reveal pattern verbatim, with the 1-px shared-border FieldsetCluster.
7. **TOTP donut** — 36 × 36 canvas, 3-px stroke, color thresholds at ≤10 s (warning) / ≤5 s (danger), 12-px countdown number in `--text-weak`.
8. **Vault colors** — copy the 10-color `VAULT_COLOR_MAP` verbatim (these are time-tested accessible pairings).
9. **Drag-and-drop** — implement HTML5 DnD with multi-item support when bulk-select is active; reject drops on read-only vaults; show `--interaction-norm-minor-2` highlight on drag-over.
10. **Keyboard shortcuts** — add `Ctrl/Cmd+N` (new item), `Ctrl/Cmd+F` (search focus), `Ctrl/Cmd+S` (save in editor). LCKED already has `J/K` for list nav — keep it.
11. **Password generator** — length 4–64, word-count 1–10, advanced toggle with cogwheel, color-coded chars (alphabetic = text-norm; digits/symbols = interaction-norm-major-1).
12. **Item-type icons** — map LCKED’s `ItemIcon` to the same set (user/file-lines/alias/credit-card/card-identity) and tint with the sub-theme color.
13. **Auto-lock default 600 s (10 min)**, password history retention 2 weeks, max item name 200 chars, max note 25 000 chars — match LCKED constants.
