---
name: LCKED
description: Zero-knowledge local-first password manager — dark instrument-panel precision, one violet per screen.
colors:
  background: "#1e1e2e"
  foreground: "#cdd6f4"
  secondary: "#181825"
  card: "#313244"
  popover: "#45475a"
  accent: "#585b70"
  border: "#45475a"
  input: "#313244"
  primary: "#cba6f7"
  primary-foreground: "#1e1e2e"
  destructive: "#f38ba8"
  ring: "#cba6f7"
  sunset: "#fab387"
  signal-success: "#4ab89a"
  signal-warning: "#ffb84d"
  signal-danger: "#f08fa4"
  signal-info: "#4ac0ff"
typography:
  display:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "normal"
  micro:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.3em"
  micro-field:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.05em"
  secret:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input-field:
    backgroundColor: "{colors.input}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
---

# Design System: LCKED

## Overview

**Creative North Star: "Machined Dusk"**

LCKED looks like a precision instrument photographed at dusk: a dark,
dense, calm panel where every pixel earns its place and nothing decorative
survives unless it signals state. The palette is Catppuccin Mocha at rest —
deep blue-black canvas, slate surfaces — with a single soft violet as the
power LED and a warm peach reserved for warning-lamp moments. Depth is never
drawn; it is machined from five tonal steps of the same material, so the UI
reads as one solid object with milled layers rather than stacked cards.

The aesthetic philosophy is the precision instrument: zero ornament beyond
function, compact 36px controls, monospaced secrets with tabular figures,
and interaction feedback that whispers (a hairline border, a 60%-opacity
tint) instead of shouting. Warmth exists only in two sanctioned places — the
sunset accent on freshly generated secrets and the glow behind the lock
screen — because a password manager must feel safe before it feels friendly.

**Key Characteristics:**

- One violet moment per screen; scarcity is the point.
- Five-step tonal elevation ramp replaces shadows entirely.
- Flat inputs that blend seamlessly into their field clusters.
- Borders felt, not seen — one step removed from their surface.
- Secrets always monospaced, tabular, slashed-zero.
- Read-only chrome: copy happens through dedicated buttons, never selection.

## Colors

A cool, near-neutral dark scheme where saturation is rationed: slates carry
the structure, one violet carries identity, one peach carries warmth.

Values below are the default **Mocha** (dark) theme — the normative resting
state. Every theme is built from its own official palette, not a re-tint of
Mocha: Catppuccin Mocha and Latte from the upstream `catppuccin/palette`
release, Nord from `nordtheme.com` (nord0–nord15), Proton Pass from the
`pass-dark` tokens in Proton's own WebClients design system. Semantic roles
never change across themes — only the material they are poured into.

### Primary

- **Dusk Violet** (#cba6f7): THE signature. Focus rings, primary buttons, the
  active-item indicator, the diamond mark, the "ED" in the wordmark. Appears
  at most once per screen.

Per-theme signatures: Mocha **Dusk Violet** (#cba6f7), Latte **Mauve**
(#8839ef), Nord **Frost** (nord8 #88c0d0), Proton **Interaction Norm**
(#b6b6ff) — Pass's real control color, always paired with ink text
(#191927); Pass's brand violet (#7777f8) is reserved for charts and brand
moments, never buttons.

### Secondary (functional signals)

- **Verdant Signal** (#4ab89a): success toasts, healthy TOTP countdowns.
- **Amber Signal** (#ffb84d): warnings, Proton-theme sunset stand-in.
- **Rose Signal** (#f08fa4): danger actions, destructive confirmation.
- **Cyan Signal** (#4ac0ff): informational highlights.
- These four are identical in every theme so meaning stays stable.

### Neutral

- **Deep Dusk** (#1e1e2e): app canvas — the deepest layer, also text-on-violet.
- **Mantle Shadow** (#181825): recessed fills — chips, inactive buttons, sidebar.
- **Raised Slate** (#313244): cards, editors, inputs (inputs match card exactly).
- **Float Slate** (#45475a): popovers, menus, borders — the floating layer must
  be visibly distinct from card.
- **Hover Haze** (#585b70): hover/active highlight — always lighter than popover.
- **Moonlit Text** (#cdd6f4): foreground text; secondary text fades to #a6adc8.
- **Last Light** (#fab387): the sunset accent — freshly generated passwords and
  the unlock-screen glow. Never structural.

### Named Rules

**The One Violet Rule.** Dusk Violet appears at most once per screen. If a
second element needs emphasis, it gets tonal weight, not more violet.

**The Sunset Ration.** Last Light covers ≤5% of any screen: generated-password
celebration and unlock glow only. It is a candle, not a lamp.

## Typography

**Display Font:** Geist Sans (system-ui fallback) — wordmarks and headings only
**Body Font:** Geist Sans (system-ui fallback)
**Label/Mono Font:** Geist Mono (ui-monospace fallback) — every secret, every OTP

**Character:** One geometric sans family doing all structural work, with mono
reserved exclusively for things that must not be misread: passwords, codes,
card numbers. The pairing says "instrument readout", not "document".

### Hierarchy

- **Display** (700, 24px/1.2, -2% tracking): the LCKED wordmark only; "ED" tinted violet.
- **Body** (400, 14px/1.4): item names, detail values, dialog copy.
- **Label** (500, 12px/1.3): field labels, metadata, strength labels, timestamps.
- **Micro-field label** (500, 10px, +5% tracking, uppercase, muted at 70%):
  section headers above field clusters and groups — the `MicroLabel`
  primitive (`field-cluster.tsx`) is the only sanctioned source; never
  hand-roll the class string.
- **Micro-caption** (500, 9px, +30% tracking, uppercase): "LOCAL VAULT"-style
  captions under the wordmark; use sparingly, never for interactive text.
- **Secret mono** (400, 14px, +2% tracking, `tnum` + `zero` features): all
  passwords/TOTP/card numbers via `.font-secret` — alignment and 0/O disambiguation are requirements.

### Named Rules

**The Secrets-in-Mono Rule.** Anything secret or typeable-wrong renders in
Geist Mono with tabular figures and slashed zeros. Proportional type never
touches a secret.

## Layout

Three-pane Operate layout on desktop: vault sidebar (fixed 360px /
`--pass-sidebar-size`) → item list (flexible) → item detail. The whole app is
one route; setup/unlock/loading are centered single-column stages over an
animated dot-field backdrop with a three-point radial glow (violet top,
peach bottom-right, magenta bottom-left).

- Controls are compact: 36px default height (32px small, 40px large).
- List rows reserve a stable 56px (`contain-intrinsic-size`) and render lazily
  via `content-visibility: auto` — thousands of items stay smooth.
- Scrollbars are thin (8px), transparent-tracked, slate-thumbed, with
  `scrollbar-gutter: stable` so panels never shift when content appears.
- Density is high but breathing: 8px inner gaps, 16px cluster padding.

## Elevation & Depth

No shadow vocabulary beyond a whisper (`shadow-xs`, 1px ambient under buttons
and inputs). All depth is tonal layering on the five-step ramp:

background (#1e1e2e) → secondary (#181825 recessed) → card (#313244 raised)
→ popover (#45475a floating) → accent (#585b70 hover).

Three inviolable pairings hold in every theme: **inputs match card exactly**
(fields read as milled into their cluster); **popover differs from card**
(floating layers must read as separate objects); **accent is lighter than
popover** (hover must be visible without color).

### Shadow Vocabulary

- **shadow-xs** (`0 1px 2px rgb(0 0 0 / 0.05)`): buttons and inputs only. Never a structural depth cue.

### Named Rules

**The Milled-Layers Rule.** Surfaces step through the tonal ramp; they never
float on shadows. If two surfaces need separation, change their material step,
not their elevation.

**The Flat Inputs Rule.** An input's background equals its card's background.
A visible input fill inside a field cluster is a bug.

## Shapes

One radius root governs everything: 10px (`--radius: 0.625rem`), stepped to
6px (sm) / 8px (md, all controls) / 14px (xl) / full pill (meters, scrollbar,
chips). Corners are consistent within a component class — controls are md,
containers lg. The brand silhouette is a square rotated 45°: the diamond mark
is a rounded-corner diamond with keyhole, echoed by the spin animation on
unlock. Borders are 1px, one tonal step away from their surface, often at 50%
opacity — present enough to separate, quiet enough to ignore.

## Components

### Buttons

Compact, confident, quiet.

- **Shape:** 8px radius, 36px height, 16px inline padding, 4px icon gap.
- **Primary:** Dusk Violet fill, Deep Dusk text; hover deepens to 90% opacity.
- **Outline:** canvas fill, hairline border; hover lifts to Hover Haze.
- **Ghost:** invisible until needed; hover paints Hover Haze (50% in dark).
- **Focus:** 3px ring at 50% violet + border shift to violet. Destructive
  swaps rose into both ring and border.

### Inputs / Fields

- **Style:** flat — fill matches card exactly, 1px hairline border, 8px radius.
- **Focus:** border shifts to violet, 3px 50%-violet ring. No glow, no lift.
- **Error:** rose ring/border via `aria-invalid`; disabled dims to 50%.

### Cards / Field Clusters

- **Corner Style:** 10px radius.
- **Background:** Raised Slate on Deep Dusk canvas.
- **Shadow Strategy:** none — tonal step is the elevation (see Elevation).
- **Internal Padding:** 16px; fields sit flush on card fill.

### Navigation (vault sidebar + lists)

360px sidebar on Mantle Shadow. Rows are ghost-quiet; hover tints Hover Haze;
the active row carries a spring-animated highlight div — a thin violet bar on
the left edge plus a soft outer ring at 20% violet — deliberately an accent,
never a glow. Structural containers suppress focus outlines; only real
controls ring.

### Item List Row

56px rows, name + blurred email subtitle. The privacy blur (4px, GPU-composited)
lifts on row hover (200ms ease-out) or permanently on the active row; in "full"
privacy mode the list never reveals — only the detail pane does.

### Password Strength Meter (signature)

Five pill segments on a muted track filling red → orange → amber → lime →
emerald with a 300ms color transition, paired with a right-aligned live
crack-time label in the same signal color. Hidden until there is input.

### Diamond Mark (signature)

The rotated-diamond keyhole logo. Idle it sits locked at 45°; on unlock it
spins three full turns (1.5s linear loop) and settles seamlessly on a loop
boundary, driving a particle dot-field repulsion event per revolution. On the
splash it pulses (2.4s) inside a violet ping halo. This is the brand's single
moment of theater.

### Toasts & Tooltips

Toasts enter at 200ms / exit 150ms on the premium curve
(`cubic-bezier(0.16, 1, 0.3, 1)`), scale+translate, bottom-right. Tooltips
fade opacity-only at 100ms. Everything honors `prefers-reduced-motion`.

## Do's and Don'ts

### Do:

- **Do** reach for surface-ramp tokens (`--surface-*`, semantic bg/card/popover/accent) — never raw hexes in components.
- **Do** put every secret in `.font-secret` (mono, tabular, slashed zero).
- **Do** route copying through dedicated copy buttons; the clipboard auto-clears.
- **Do** keep interactions at whisper volume: tonal shifts and hairlines first.
- **Do** keep all four signal colors theme-stable — meaning must survive a theme switch.

### Don't:

- **Don't** add a second violet-dominant element to any screen.
- **Don't** make popover and card share a surface value, in any theme.
- **Don't** use shadows as depth structure — step the tonal ramp instead.
- **Don't** enable `cursor: pointer` on non-link controls (Raycast discipline: native feel).
- **Don't** allow text selection outside inputs/links — this is read-only chrome; copy has buttons.
- **Don't** spend Last Light (sunset) anywhere outside generation celebration and unlock glow.
