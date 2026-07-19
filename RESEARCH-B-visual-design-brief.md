# LCKED — Visual Design Research Brief (RESEARCH-B)

**Agent:** Visual/UX Design Research Specialist
**Date:** July 2025
**Scope:** Make LCKED the most distinctive, premium, trustworthy password manager visually — beyond "clean & modern violet".

This brief synthesises ~30 fetched articles, design-system docs, and product analyses from 2022–2026. Every section ends with concrete, opinionated moves LCKED can adopt. Citations are inline with URLs.

---

## 0. TL;DR — The Five Bets

1. **Don't ship a violet theme — ship a *materials* system.** Proton's purple succeeds because it is part of a *material* story (depth, gradient, sunset accent), not just an accent color. LCKED should build a "violet as light, not violet as paint" system using OKLCH surface lightness ramps, not flat fills.
2. **Own the monospace.** Secrets deserve their own typographic register. LCKED should adopt a single premium mono (Berkeley Mono or Geist Mono) for *all* secret data — passwords, OTPs, card numbers, URIs — paired with a humanist sans (Inter or Geist Sans). This is the single highest-impact "feels different" move.
3. **Calm by default, expressive on intent.** Default to Linear-style restraint (dim sidebar, softened borders, reduced iconography). Reserve motion and color for *intent moments*: copy-confirmation, TOTP refresh tick, unlock success. Calm Tech principles + Linear's "don't compete for attention you haven't earned".
4. **A signature surface treatment, not a signature color.** A subtle **engineering-grid background** (Vercel's "blueprint aesthetic") behind the lock screen + a single grain-textured vault surface would give LCKED a recognizable fingerprint without leaning harder on violet.
5. **Large-Type reveal as a branded interaction.** 1Password's "Show in Large Type" with character index is universally cited as underappreciated and uniquely premium. LCKED should ship its own — bigger, animated, with a character ruler and improved TOTP arc.

---

## 1. Competitor Visual Audit

A dense synthesis of how each major password manager actually *looks and feels* today, with the specific craft moves LCKED should borrow (or explicitly reject).

### Visual Audit Table

| Product | Palette | Typography | Density | Iconography | Motion | Signature |
|---|---|---|---|---|---|---|
| **1Password** | Cool blue accent (#0572EC-ish), generous whitespace, soft grays | Inter (UI) + custom "Knox" type family for brand; monospace for secrets | Spacious — list rows ~64–72px, detail view is *enormous* and type-led | Bespoke category icons (vault, watchtower, travel mode); padlock metaphor recurs | Restrained; subtle spring on row selection; "Show in Large Type" opens a separate window with character index | **Large Type view w/ char index** + Watchtower color-coded risk + travel-mode concept |
| **Proton Pass** | Proton purple (deeper than Pass's marketing gradient) + yellow-orange "sunset" accent; dark mode by default in app | ABC Arizona (Sans + Flare) for brand/marketing; in-app uses system stack | Medium-dense, leans minimal; sidebar nav with section grouping | Diamond-as-keyhole logo concept (preciousness + portal); family-resemblance product icons | Gradient depth on icons; sunset fade conveys "comfort, well-being" | **Diamond/keyhole logo** + sunset gradient + portal metaphor |
| **Bitwarden** | Generic Material-y blue/gray; minimal brand color | System sans, no mono for secrets | Dense, utilitarian, web 1.0-ish | Stock iconography | Almost none | None — "trusted but not loved" |
| **Dashlane** | Dark navy + green accent; modern material feel | Inter or similar; tighter tracking | Medium; "polished, cohesive UI … no visual clutter, no unnecessary animations" (Reddit r/PasswordManagers) | Refined line icons | Subtle, intentional — "mature and intentional" | Premium feel via *restraint* and consistency |
| **Apple Passwords (iOS 18 / macOS Sequoia)** | System materials; San Francisco; subtle blur; sectioned list with red badge for warnings | SF Pro / SF Mono | Apple-list density (~48–56px rows); sectioned (All / Passkeys / Codes / Wi-Fi / Warnings / Deleted) | SF Symbols | Native iOS transitions; swipe-to-delete | **Sectioned taxonomy** + 30-day Deleted retention + native OS material |
| **KeePassXC** | Native Qt (gray, blue accents); toolbars galore | System font; no mono emphasis | Very dense — 4-quadrant layout (groups / entries / preview / details), power-user oriented | Crystal-style tiled icons (legacy) | None | Power — at the cost of approachability |

### Per-competitor findings

**1Password — the quality-of-life leader.**
- The "Show in Large Type" feature is universally cited as underappreciated and uniquely premium: "its REALLY useful to put it up in the large type as you get a character index beneath the actual password. Their UX is at different level" (r/1Password, https://www.reddit.com/r/1Password/comments/1crhl6c/the_one_underappreciated_1p_exclusive_feature).
- Watchtower was completely redesigned for 1Password 7 for Mac and uses a *color-coded risk taxonomy* (red = compromised, orange = weak, yellow = reused) sourced from haveibeenpwned (https://1password.com/blog/1password-x-1-10-large-type-watchtower-and-easy-two-factor-authentication).
- Concept-first design philosophy: "Every digital product starts out as a problem to be solved. The idea, or concept, is the way we meet that problem – the premise of our solution." Padlock is the recurring metaphor that "brings the abstractions of software closer to life, making interfaces feel real." (https://1password.com/blog/concept-first-design)
- Knox typography: 1Password built an additional typography style system to support the whole design org (https://ri.works/knox-typography).

**Proton Pass — the inspiration.**
- "Proton Pass starts with the Proton purple, a call back to the purple used in the Proton Mail beta from 2014. It then fades into a secondary yellow-orange color unique to Pass … Proton Pass's color universe references a sunset to convey the well-being, comfort, and security that we hope will accompany Proton Pass users through their journey online." (https://proton.me/blog/pass-logo-story)
- Logo concept: a diamond (hardened cryptography + preciousness) that is also a keyhole (access/portal to a private universe).
- Brand typography choice is anti-tech-default: ABC Arizona (Sans + Flare) by Elias Hanzer / Dinamo Typefaces. "We are building an internet that puts people first, so we felt our font should have a more human touch … a font with empathy and warmth that reflects how Proton is different." Headlines use *Flare* (a "nearly-but-not-quite sans"), body uses Sans. (https://proton.me/blog/new-visual-universe)
- Icons have "depth and dimensionality" via warm gradient.

**Bitwarden — what to avoid.**
- "Bitwarden's interface is more polished and visually refined than Bitwarden's" — wait, reverse that: Dashlane's interface is "more polished and visually refined than Bitwarden's" (panicvault.org, https://www.panicvault.org/compare/dashlane-vs-bitwarden).
- Bitwarden's UX is described as "user-friendly" but visually generic. LCKED should borrow its *information architecture* (folders, collections, org-style grouping) but never its visual treatment.
- The community actively wants a redesign — "UI Redesign" is a perennial Bitwarden forum thread (https://community.bitwarden.com/t/ui-redesign/15249).

**Dashlane — premium feel via restraint.**
- Reddit user verdict: "Polished, cohesive UI. The design feels mature and intentional. No visual clutter, no unnecessary animations, no constant micro-…" (https://www.reddit.com/r/PasswordManagers/comments/1q0hx6p/dashlane_vs_bitwarden_and_why_im_staying_with).
- Dashlane leans on *automation* and onboarding polish rather than visual flourish.
- Lesson for LCKED: a premium feel is mostly *removal* — fewer, slower, more meaningful animations and surfaces.

**Apple Passwords — the new native aesthetic.**
- Layout: simple search-bar-at-top, then sectioned list: All / Passkeys / Codes / Wi-Fi / Warnings / Deleted. "Each entry has fields for site or app name, username, login, verification code, websites where the login is used, and notes." (https://www.macrumors.com/guide/ios-18-passwords)
- Deleted items retained 30 days (an interesting trust-building default).
- Authentication Codes are a *first-class section*, not buried inside a Login item.
- The sectioned taxonomy is itself a signature — LCKED should consider an analogous sidebar taxonomy.
- Uses SwiftUI materials (glassmorphic) per NN/g: "Glassmorphic UI elements stand out when placed in front of gradients or complex backgrounds to accentuate depth … prominent in Apple and Microsoft's design systems." (https://www.nngroup.com/articles/glassmorphism)

**KeePassXC — power-user density reference.**
- "The KeePassXC interface is designed for simplicity and easy access to your information. The main database view is split into four main partitions" (https://keepassxc.org/docs/KeePassXC_UserGuide).
- Issues: high minimum window size, no responsive UI (https://github.com/keepassxreboot/keepassxc/issues/5952), feature-burden hides daily-use actions (https://github.com/keepassxreboot/keepassxc/issues/3779).
- Lesson: density without hierarchy becomes claustrophobia. Power features must be *progressively disclosed*.

---

## 2. Security/Privacy App Visual Language — Building Trust Visually

### Principles from the calm-tech and quiet-security literature

**Calm Technology® principles (Calm Tech Institute, https://www.calmtech.institute/calm-tech-principles):**
1. Require the smallest possible amount of attention.
2. Inform and create calm.
3. Make use of the periphery.
4. Amplify the best of technology and the best of humanity.
5. Communicate without speaking.
6. Still work when it fails.
7. The minimum tech needed to solve the problem.
8. Respect social norms.

**"Quiet Security" patterns (ezpa.ge, https://blog.ezpa.ge/quiet-security-subtle-ux-patterns-that-signal-safety-without-killing-trust):**
- "Use Calm, Consistent Visual Language. Color: Reserve aggressive reds for actual errors or fraud warnings. For reassurance, use softer blues or…" (snippet).
- The thesis: signal safety *through restraint*, not through alarm. Security apps that flash warnings constantly train users to ignore them ("alarm fatigue").

**Signal — the canonical reference (typenorm analysis, https://typenorm.com/apps/signal):**
> "Signal's interface argument is restraint. It looks like an ordinary chat app on purpose, because its whole thesis is that strong encryption should require no user effort and surface no jargon. The signature touches are quiet ones: disappearing-message timers set per conversation, a safety-number screen for verifying a contact's keys, and registration locks that live where most apps put nothing."

Translation for LCKED: **encryption is a default, not a feature.** Don't badge "ENCRYPTED" on every screen — make it ambient (one tiny lock glyph in the status area, never animated, never red).

### Color psychology for security apps
- **Reserve red exclusively** for actual breaches / compromised credentials (Watchtower-style). Yellow/orange for "weak but not breached." Green only for "strong / freshly generated."
- **Soft accent colors for reassurance** (Proton's sunset, Mullvad's yellow-orange accents, Signal's blue).
- **Avoid pure black backgrounds** for trust surfaces — they read as "hacker terminal," not "premium vault." Use elevated dark surfaces with subtle blue tint.

### Avoiding alarm fatigue
- Watchtower-style risk lists should be *opt-in surface*, not a homepage counter ("you have 7 weak passwords!" is anxiety-inducing).
- TOTP countdown rings should never feel frantic — use a smooth arc, not a ticking bomb.
- Auto-lock countdowns should be invisible until < 30s remain, then a single calm toast.

---

## 3. Dark Mode Craft — Premium Dark UI Best Practices

Synthesised from Eleken's "Dark Mode UI Design" guide (https://www.eleken.co/blog-posts/dark-mode-ui), Linear's design refresh (https://linear.app/now/behind-the-latest-design-refresh), and Material Design guidance.

### Surface hierarchy
- **Avoid pure black.** Material recommends `#121212` as primary dark surface — pure black creates harsh contrast and eye fatigue (Eleken).
- **Build depth via surface lightness, not shadows.** Dark shadows blend into the background and become ineffective (Eleken).
- **Define 4–5 gray steps** from deepest surface to elevated component:
  - Deepest bg → cards (1 step lighter) → modals/popovers (1 step lighter) → tooltips (lightest).
  - Even small lightness increments create clear depth.
- **Add a subtle dark blue tint** to grays for branded depth — Material, Linear, and Vercel all do this.
- **Linear specifically**: refreshed from "cool, blue-ish hue" toward "warmer gray that still feels crisp, but less saturated." Warning: "Go too warm, though, and the interface risks looking muddy." (Linear blog)

### Linear's two design principles for the refresh (https://linear.app/now/behind-the-latest-design-refresh)
1. **"Don't compete for attention you haven't earned."** Sidebar dimmed a few notches so the main content takes precedence. Tabs made more compact, smaller icon/text sizing, rounded corners.
2. **"Structure should be felt not seen."** Borders and separators were "quietly proliferating." Linear rounded edges and softened contrast to give structure without clutter. Reduced icon usage, scaled sizes down, removed unnecessary treatments like colored team icon backgrounds.

### Contrast and color
- **Desaturate ~20 points** in dark mode. Same palette as light mode = visual vibration (Eleken).
- **Off-white at ~87% opacity** instead of pure white — softens halation around letterforms.
- **Test against WCAG AA (4.5:1) AND consider APCA** (Advanced Perceptual Contrast Algorithm), which measures contrast as humans actually perceive it. (Eleken lists APCA, WebAIM, Stark as tools.)
- **Halation effect** for users with astigmatism: white text on dark background glows. Solution: offer both modes; default dark during evening hours.

### Typography in dark mode
- **Thin and light font weights disappear** in dark mode — prefer Regular/Medium/SemiBold.
- **Very bold headings can tip into feeling too heavy** — find a balanced Medium/SemiBold.
- **Increase line spacing slightly** and add a touch of letter-spacing for small text to prevent letterforms blending (Eleken).

### Reference: Linear's tokens (https://oh-my-design.kr/design-systems/linear.app, https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1)
- Primary color: `#5e6ad2` (indigo)
- Typography: Inter Variable + **Berkeley Mono** for code
- Corner radius: `9999px` (pill-shaped emphasis elements)
- Surface: `#08090a` (near-black, slightly warm)
- Accent (in some themes): `#e4f222` (acid lime) — single high-contrast signature

### Linear GitHub DESIGN.md (https://github.com/voltagent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md)
- "Near-black product-focused marketing canvas built around `#010102` (the deepest dark surface of any tool in this collection)."

### Recommendations for LCKED
- Use **`oklch(0.14 0.012 280)`**-ish (~`#13111A`-ish violet-black) as deepest surface, NOT pure `#000000`. The 0.012 chroma gives the branded violet tint without making it look "purple."
- Define 5 surface tokens: `bg-base`, `bg-raised`, `bg-overlay`, `bg-popover`, `bg-tooltip` — each ~3–4% lighter in L.
- Text default: `oklch(0.92 0.005 280)` (off-white with violet tint), not `#FFFFFF`.
- One single accent (violet) at full saturation, plus muted semantic colors (red/orange/green) desaturated ~20% from light mode.

---

## 4. Typography for Secrets — Monospace Craft

### Why monospace for secrets
- Character-aligned readability when scanning/transcribing a password character-by-character.
- Tabular numerals (`tnum`) prevent digit jitter in TOTP countdowns.
- A slashed zero (`zero`) prevents O/0 confusion.
- A premium mono is the single biggest signal that "this app takes secrets seriously."

### Mono font candidates (synthesised from https://madegooddesigns.com/monospace-font, https://fontalternatives.com/compare/geist-mono-vs-jetbrains-mono, https://rockstardeveloperuniversity.com/best-coding-fonts, https://www.wwebcustomizer.com/blog/best-monospace-fonts-for-whatsapp-web-developer-setup-2026)

| Font | Style | Vibe | Cost | For LCKED? |
|---|---|---|---|---|
| **Berkeley Mono** | Designer-favorite, restrained, slightly narrow | Premium, "if Linear uses it" feel | Paid | ★★★★★ — strongest "premium" signal |
| **Geist Mono** | Compressed proportions, sharp terminals | Modern, dev-tool aesthetic | Free (Vercel) | ★★★★★ — pairs perfectly with Geist Sans, free |
| **JetBrains Mono** | Taller x-height, very readable | Solid workhorse, slightly "IDE" | Free (OFL) | ★★★★ — safe, but slightly "developer tool" coded |
| **Commit Mono** | Customizable, very tight | Modern, custom-feel | Free | ★★★ — strong but less recognizable |
| **Monaspace** (GitHub) | Variable across 5 sub-styles | Modern, novel | Free | ★★★ — interesting but busy |
| **Fira Code** | Ligatures | Old-school dev | Free | ★ — too "programmer" coded |

### Recommended LCKED type system
- **UI sans**: Inter (variable, 100–900) or **Geist Sans** (Vercel, https://vercel.com/font). Geist has 5 pixel shapes shipped as one variable family selected through the ELSH axis — distinctively modern.
- **Brand/display**: A humanist serif or flare sans (à la ABC Arizona Flare) for the lock screen and brand moments only. **Recommendation: Fraunces** (variable, optical sizing, free) for a humanist warmth that defies tech expectations — same logic as Proton's choice of ABC Arizona.
- **Mono for secrets**: **Geist Mono** (free, pairs with Geist Sans) or **Berkeley Mono** (paid, premium signal). Both avoid the "IDE" aesthetic.
- **Numeric features**: enable `font-feature-settings: "tnum" 1, "zero" 1, "ss01" 1` on TOTP/password displays. `tnum` = tabular numerals (no jitter), `zero` = slashed zero, `ss01` varies by font but often enables alternate forms.

### Variable font weight for hierarchy
- Inter and Geist both ship as variable fonts: "single file delivers every weight from 100 to 900 with smooth interpolation" (https://www.pravinkumar.co/blog/inter-geist-plus-jakarta-sans-webflow-b2b-2026).
- Use weight, NOT size, for subtle hierarchy: 450 (light-ish regular) for body, 550 for emphasis, 650 for headings. This avoids the "5 different font sizes" anti-pattern.

---

## 5. Micro-Interactions & Motion Design

### Framer Motion craft (from Maxime Heckel's deep dive, https://blog.maximeheckel.com/posts/framer-motion-layout-animations/)

**The three primitives:**
1. **`layout` prop** — smoothly animates position/size when a component re-renders. Use on list items, cards, expandable rows.
2. **`layout="position"`** — when only position should animate (prevents "squished content" when list items are removed). Critical for password list reordering.
3. **`layoutId`** (shared layout animations) — animates between multiple instances of a component. The Vercel/Linear-style tab indicator that slides between tabs uses this. Also used for hover highlights.

**Key tricks:**
- **Set `borderRadius` and `boxShadow` as inline styles** when using `layout` to prevent distortion during the transition. CSS variables will NOT fix this.
- **`AnimatePresence`** for exit animations — combine with `layout` for graceful list add/remove.
- **`LayoutGroup`** to namespace `layoutId`s when a component is reused multiple times on a page.

### Rauno Freiberg's craft reference (Devouring Details, https://devouringdetails.com)
23 chapters on interaction craft. The Principles unit covers:
- Inferring intent
- Interaction metaphors
- Ergonomic interactions
- Simulating physics
- Motion choreography
- Responsive interfaces
- Contained gestures
- Drawing inspiration

Rauno's mantra (from rauno.me): *"Make it fast. Make it beautiful. Make it consistent. Make it carefully. Make it timeless. Make it soulful. Make it."*

### Signature motion patterns for LCKED

1. **Shared-layout selection indicator** (Framer Motion `layoutId="vault-item-active"`): the active vault item's selection bar *slides* between items rather than fading. Same pattern Vercel uses on tabs.
2. **List enter/exit with `layout` + `AnimatePresence`**: new items spring in from the bottom, removed items fade and shrink. Linear, Vercel, and Arc all use this.
3. **Copy-confirmation micro-animation**: on copy, the icon morphs (clipboard → checkmark via shared `layoutId`), the row briefly highlights with a violet wash that fades over 600ms. Avoid bouncy spring — use a slow ease-out.
4. **TOTP refresh arc**: a circular SVG progress ring that *smoothly* drains over 30s, never ticking. On rollover, the new code fades in with a 100ms opacity crossfade. No "flash."
5. **The LCKED "Large Type" reveal** (homage to 1Password): clicking reveal opens a *shared-layout* transition that expands the password field into a centered modal with a character ruler beneath. Each character group (4-char chunks) is a separate `motion.span` with `layoutId` so they smoothly rearrange from inline → large display.
6. **Unlock success**: the lock screen's violet glow *pulses once* (a single 1.2s ease-out breath, not infinite pulse), then the whole vault crossfades in over 400ms.
7. **Auto-lock countdown**: invisible until 30s remaining, then a single thin progress bar at the top of the screen, no countdown number. Calm, not anxious.

### Performance budgets
- Target 60fps (16.6ms/frame). All animations should be GPU-composited: `transform` and `opacity` only, never `width/height/top/left`.
- Use `will-change: transform` sparingly — only on the actively animating element, removed after.
- Framer Motion's `useReducedMotion()` hook + global CSS `@media (prefers-reduced-motion: reduce)` to disable all non-essential motion. Per WCAG 2.2 SC 2.3.3 / Technique C39 (https://www.w3.org/WAI/WCAG22/Techniques/css/C39). web.dev: "Some other ways you can adapt animations for the prefers-reduced-motion media query include removing the animation, disabling transitions" (https://web.dev/articles/prefers-reduced-motion).

---

## 6. Information Density & Whitespace

### Linear's density philosophy (https://linear.app/now/behind-the-latest-design-refresh)
> "The challenge was preserving that rich density of information without letting the interface feel overwhelming."

Three concrete moves:
1. **Reduce icon usage.** "Linear relies on [icons] to make projects, issues, initiatives, and statuses recognizable at a glance, but in some views their presence had grown excessive. The refresh reduces icon usage, scales their sizes down, and removes unnecessary visual treatments like colored team icon backgrounds."
2. **Compact tabs.** "Tabs at the top of the desktop app similarly, making them more compact rather than spanning the full width of the screen, with rounded corners and smaller icon and text sizing."
3. **Soften borders.** "Borders and separators help clarify the relationship between elements … While these dividing lines are intended to help users orient themselves, they had quietly proliferated across the platform."

### List-item anatomy recommendations for LCKED
- Row height: 56–64px desktop, 64–72px mobile (larger touch target).
- Per row: 28px item-type icon (custom), 14px gap, primary label (15px/500), secondary label (12px/400 muted — username or domain), right-aligned TOTP/live-code in mono.
- Hover: 8% violet wash, no border.
- Active: 1px violet left-border (3px wide), subtle inner glow.
- Never use underlines for selection — they read as links.

### Detail panel rhythm
- Section spacing: 32px between major sections, 16px between rows.
- Each copyable row: label (12px uppercase tracked +0.06em) + value (15px regular, mono for secrets) + copy button (right-aligned, 32px).
- Large-Type affordance: chevron next to secret fields, à la 1Password.

### Density without claustrophobia
- **Progressive disclosure**: advanced fields (custom fields, URLs, notes) collapse by default.
- **Power-user keyboard nav**: J/K to move, Enter to open, Cmd+\ to autofill — but never visible in UI, only in command palette.
- **Empty states are branding moments** — see §7.

---

## 7. Distinctive Visual Signatures — What Makes LCKED Look Unique

The goal: avoid the "shadcn/ui + violet = every other SaaS" trap. Five signature ideas LCKED could own:

### Signature 1: "Vault Materials" — a violet-as-light surface system
Instead of flat violet accents, treat violet as **light emanating from beneath surfaces**. Practically:
- Surfaces use a near-black violet base (`oklch(0.14 0.012 280)`).
- "Active" surfaces get a `box-shadow: inset 0 1px 0 0 oklch(0.25 0.04 280 / 0.6)` (top edge catch-light).
- Selection glow: `0 0 0 1px oklch(0.55 0.2 290 / 0.4), 0 0 20px -4px oklch(0.55 0.2 290 / 0.3)`.
This mimics how Proton's icons have "depth and dimensionality" — but applied to *every surface*, not just icons.

**Risk:** Inexpert implementation looks like a bloom filter. **Mitigation:** keep chroma low (0.04–0.08) and test on actual OLED displays.

### Signature 2: Engineering grid background (Vercel "blueprint aesthetic")
A subtle dot or line grid behind the lock screen and empty states only — NOT the whole app (that becomes tiring).
- Setproduct analysis: "The Vercel aesthetic refers to a web design style characterized by subtle grid patterns (lines or dots) behind content, monospaced-influenced [typography]" (https://www.setproduct.com/blog/complete-guide-to-blueprint-grid-design).
- Psychology: "technical, precise, almost like a blueprint" — builds trust for a security product.
- Implementation: a single CSS `background-image` with two `radial-gradient` layers at 24px intervals, 1px dots at 6% white opacity.

**Risk:** Overused in 2024–2025 dev tooling. **Mitigation:** use ONLY on lock screen + empty states + setup view, never on the main vault list.

### Signature 3: Large-Type reveal with character ruler (1Password homage, evolved)
Click any secret → it expands via shared layout animation into a centered Large-Type view:
- Each character rendered at 48px in Geist Mono.
- Beneath: a *character ruler* (1, 5, 9, 13… markers) — 1Password's underappreciated feature.
- Chunk every 4 chars with a slightly wider gap.
- Optional "phonic" mode for verbal sharing (alpha/bravo/charlie under each char).

**Risk:** Could feel gimmicky if used by default. **Mitigation:** make it a deliberate affordance (chevron icon, keyboard shortcut `Shift+R`), not the default reveal.

### Signature 4: Branded empty states
The "no items yet" state is the most-seen screen for new users. Make it a *branding moment*:
- A custom illustration of the LCKED diamond/keyhole mark (Proton-inspired) glowing softly.
- A single sentence of copy that conveys the product philosophy ("Your secrets, encrypted on this device. Nothing leaves. Ever.")
- A primary CTA ("Add your first item") and a secondary ("Import from Bitwarden / 1Password / Proton Pass").

**Risk:** Generic illustrations look like a stock library. **Mitigation:** commission 1–2 custom marks, never reuse.

### Signature 5: TOTP as a first-class surface
Borrow from Apple Passwords (iOS 18 makes Codes a top-level section, https://www.macrumors.com/guide/ios-18-passwords):
- A dedicated "Codes" filter chip in the vault view.
- A live-updating "Codes" widget on the lock-screen-adjacent state showing your top 3 most-used OTPs.
- Each TOTP card shows: service name, current 6-digit code (tabular-nums mono, 24px), and a 30s arc.

**Risk:** Live OTPs on a "rest" screen could leak via screenshot. **Mitigation:** blur on blur event, hide on `visibilitychange`, mask digits until hover/focus.

### On custom iconography vs Lucide
- Lucide is fine for utility icons (copy, eye, chevron) — consistent, scalable, free.
- BUT for **item-type icons** (login/note/card/identity) and **brand icons** (Github, Google, etc.), use a *custom set* with consistent stroke weight and a distinctive treatment (e.g., 1.5px stroke + 4px corner radius + subtle inner gradient).
- 1Password's competitive audit guidelines (https://1password.com/blog/concept-first-design) emphasize consistent concept/metadata for icons across the product.

---

## 8. Color Systems — Building a Distinctive, Accessible Violet

### Why OKLCH (Evil Martians, https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)
- `oklch(L C H / a)`: **L** = perceived lightness (0–1, consistent across hues), **C** = chroma (gray → saturated), **H** = hue angle (0–360).
- **HSL is bad for design systems** because HSL's L is not perceptually consistent: "Adding 10% lightness will have different results for blue and purple colors. Hue changes could lead to accessibility issues from low contrast." (Evil Martians)
- **OKLCH supports P3 wide-gamut** colors (30% more colors than sRGB, all modern Apple devices + OLED).
- **Human-readable**: you can identify a color by looking at the numbers.
- Tailwind v4 defaults to OKLCH (https://tailwindcolor.tools/blog/tailwind-css-v4-color-system-complete-guide).

### Making violet feel fresh (not generic SaaS)
The trap: every privacy app uses Tailwind `violet-500` (#8b5cf6). To make LCKED's violet distinctive:

1. **Shift the hue slightly toward magenta** (H ≈ 295–305 instead of 280). This is the "sunset" direction Proton uses — feels warmer, less generic.
2. **Lower the chroma** for surface tints (C ≈ 0.02–0.04) so the violet reads as "atmosphere," not "brand paint."
3. **Reserve high chroma** (C ≈ 0.18–0.22) for ONE moment per screen: the active selection, the primary CTA, the TOTP arc. Everywhere else, violet is a whisper.
4. **Add a complementary accent** (Proton's yellow-orange sunset, or a desaturated mint green for "freshly generated" feedback). One accent only, used ≤5% of any screen.
5. **Avoid gradient buttons.** Linear, Vercel, Apple all use flat fills + subtle inner highlight. Gradient buttons scream "2018 SaaS."

### Semantic token recommendations (LCKED)
```css
/* Base surfaces — perceptually uniform L ramp with violet tint */
--bg-base:      oklch(0.14 0.012 280);  /* deepest, never pure black */
--bg-raised:    oklch(0.18 0.014 280);  /* cards */
--bg-overlay:   oklch(0.22 0.016 280);  /* modals */
--bg-popover:   oklch(0.26 0.018 280);  /* tooltips, menus */
--bg-tooltip:   oklch(0.30 0.020 280);  /* highest elevation */

/* Text — off-white with violet tint, NOT pure white */
--text-primary:   oklch(0.92 0.005 280);
--text-secondary: oklch(0.68 0.010 280);
--text-tertiary:  oklch(0.50 0.012 280);
--text-disabled:  oklch(0.38 0.010 280);

/* Accent — single violet, magenta-shifted */
--accent:       oklch(0.62 0.20 295);   /* primary CTA */
--accent-hover: oklch(0.66 0.22 295);
--accent-soft:  oklch(0.40 0.08 295);   /* selection bg */

/* Semantic — desaturated for dark mode */
--danger:  oklch(0.62 0.18 25);   /* breach */
--warning: oklch(0.70 0.15 75);   /* weak */
--success: oklch(0.70 0.14 145);  /* strong / fresh */
--info:    oklch(0.70 0.13 230);  /* tip */

/* Border — felt, not seen (Linear principle) */
--border-subtle: oklch(0.30 0.012 280 / 0.5);
--border-default: oklch(0.34 0.014 280 / 0.7);
```

### Light mode
Mirror the structure with inverted L values. Keep the SAME H and C for accent — OKLCH makes this trivial. Use `oklch(0.98 0.005 280)` as base, `oklch(0.45 0.20 295)` for accent.

---

## 9. References & Inspiration Sources

### Curated inspiration galleries
- **Mobbin** — https://mobbin.com — "the biggest mobile app screen library." Best for real-app UI patterns (1Password, Apple Passwords, etc.). Has a dedicated Awards section: https://mobbin.com/awards.
- **Godly** — https://godly.website — "curates ultra-modern and unique web design examples." Best for finding distinctive aesthetic moves.
- **Awwwards** — https://www.awwwards.com — curated dark mode collection. Use sparingly; trends toward over-designed.
- **Dribbble** — https://dribbble.com — search `password-manager dark` for concept work.
- **Behance** — https://www.behance.net — full case studies (e.g., https://www.behance.net/gallery/74594901/Redesigning-Mullvad-VPN).
- **Pageflows** — https://pageflows.com — recorded user flow videos (paid, but excellent for understanding motion).
- **Refero** — https://refero.design — design system references (e.g., https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1 for Linear).
- **typenorm** — https://typenorm.com/apps — app-level UX analysis (e.g., their Signal teardown: https://typenorm.com/apps/signal).

### Design system docs to study
- **Geist (Vercel)** — https://vercel.com/geist/introduction — "Made for building consistent and delightful web experiences. Specifically designed for developers and designers." Includes Colors, Typography, Materials, Brands.
- **Linear Design System (Figma replica)** — https://www.figma.com/community/file/1222872653732371433/linear-design-system
- **shadcn/ui Theming** — https://ui.shadcn.com/docs/theming — LCKED's current system. Use https://tweakcn.com for live theme preview.
- **Linear DESIGN.md** (community doc) — https://github.com/voltagent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md

### Key articles & deep dives
- **Proton's visual universe** — https://proton.me/blog/new-visual-universe — Proton purple + ABC Arizona typography rationale.
- **Proton Pass logo story** — https://proton.me/blog/pass-logo-story — Diamond/keyhole concept + sunset gradient.
- **Linear's design refresh (2026)** — https://linear.app/now/behind-the-latest-design-refresh — "calmer interface for a product in motion." Two principles: don't compete for attention you haven't earned; structure should be felt not seen.
- **OKLCH in CSS (Evil Martians)** — https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl — the canonical OKLCH explainer.
- **Framer Motion layout animations (Maxime Heckel)** — https://blog.maximeheckel.com/posts/framer-motion-layout-animations/ — complete deep dive on `layout`, `layoutId`, `LayoutGroup`, distortions.
- **Dark Mode UI Design (Eleken)** — https://www.eleken.co/blog-posts/dark-mode-ui — practical dark mode principles with real case studies.
- **Calm Tech Institute principles** — https://www.calmtech.institute/calm-tech-principles — 8 principles for non-intrusive design.
- **NN/g glassmorphism** — https://www.nngroup.com/articles/glassmorphism — when and how to use frosted glass correctly. "More blur is better, especially with intricate backgrounds."
- **Vercel blueprint grid aesthetic** — https://www.setproduct.com/blog/complete-guide-to-blueprint-grid-design — technical grid design trend.
- **1Password concept-first design** — https://1password.com/blog/concept-first-design — using metaphor and narrative to drive design.
- **1Password Large Type & Watchtower** — https://1password.com/blog/1password-x-1-10-large-type-watchtower-and-easy-two-factor-authentication
- **Rauno Freiberg (rauno.me)** — https://rauno.me — minimalist portfolio of Vercel's staff design engineer. Mantra: "Make it fast. Make it beautiful. Make it consistent. Make it carefully. Make it timeless. Make it soulful."
- **Devouring Details (Rauno)** — https://devouringdetails.com — 23-chapter interactive reference on interaction craft ($249, paid).
- **Apple Passwords guide (MacRumors)** — https://www.macrumors.com/guide/ios-18-passwords — sectioned taxonomy, deleted retention, native UX.
- **Signal app UX analysis (typenorm)** — https://typenorm.com/apps/signal — "encryption made invisible — security as the default, not a setting."
- **prefers-reduced-motion (web.dev)** — https://web.dev/articles/prefers-reduced-motion — implementing accessible motion.
- **WCAG 2.2 Technique C39** — https://www.w3.org/WAI/WCAG22/Techniques/css/C39 — official reduced-motion technique.

---

## 10. Named Design Principles for LCKED

Each principle is a one-line decision rule the team can apply in code review.

1. **"Calm confidence."** Default to restraint; reserve expression for intent. Security apps that shout train users to ignore them.
2. **"Secrets deserve monospace."** Every password, OTP, card number, URI, key — always in a premium mono with `tnum` + `zero` features. No exceptions.
3. **"Density without claustrophobia."** Use Linear-style hierarchy (dimmed sidebar, softened borders, reduced iconography) to preserve density without overwhelming.
4. **"Structure should be felt, not seen."** Borders at 50% opacity. Separators as tonal shifts, not lines. (Direct from Linear.)
5. **"Don't compete for attention you haven't earned."** Navigation recedes; the current task takes precedence. (Direct from Linear.)
6. **"Violet as light, not violet as paint."** Surfaces have a violet *tint*, never a violet *fill*. High-chroma violet appears once per screen, max.
7. **"Encryption is the default, not a feature."** No "ENCRYPTED" badges. One tiny lock glyph, ambient, never animated, never red.
8. **"Motion serves intent."** Every animation answers "what is the user learning from this?" If the answer is "nothing," delete it.
9. **"Respect the OS."** Honor `prefers-reduced-motion`, `prefers-color-scheme`, `prefers-contrast`. Default to system theme.
10. **"One signature, not five."** Pick ONE distinctive surface treatment and apply it consistently (recommendation: violet-as-light materials + engineering grid on lock screen only).

---

## 11. The 10 Highest-Impact Visual Improvements for LCKED (Ranked)

Each item is sized as a discrete engineering task. Ranked by impact-to-effort ratio for a single design engineer.

### #1. Adopt Geist Mono for ALL secret fields (impact: 🔥🔥🔥🔥🔥, effort: 🕐)
- Replace any system mono in `password-field`, `totp-display`, `item-detail` copyable rows, `password-generator-dialog`.
- Enable `font-feature-settings: "tnum" 1, "zero" 1` on TOTP and password displays.
- Pairs with existing Inter/Geist Sans UI font.

### #2. Migrate color tokens to OKLCH with a 5-step violet-tinted surface ramp (impact: 🔥🔥🔥🔥🔥, effort: 🕐🕐)
- Replace hex/HSL in `globals.css` with the token set from §8.
- This single change transforms the "depth" feel of the entire app.

### #3. Implement shared-layout selection indicator with Framer Motion `layoutId` (impact: 🔥🔥🔥🔥, effort: 🕐)
- The active vault item's selection bar slides between items rather than fading.
- ~30 lines of code, instantly makes the app feel "Linear-grade."

### #4. Add the LCKED "Large Type" reveal modal (impact: 🔥🔥🔥🔥, effort: 🕐🕐🕐)
- Chevron next to every secret field opens a shared-layout modal.
- 48px Geist Mono, character ruler beneath, 4-char chunking.
- Direct homage to 1Password's most-loved feature.

### #5. Apply Linear's "calmer interface" principles: dim sidebar, soften borders, reduce icons (impact: 🔥🔥🔥🔥, effort: 🕐)
- Reduce sidebar background opacity by 1–2 L steps.
- Drop border opacity to ~50%, increase corner radius slightly.
- Remove colored icon backgrounds; reduce icon sizes by 2px.

### #6. Replace the generic TOTP countdown with a calm arc + crossfade (impact: 🔥🔥🔥, effort: 🕐)
- Smooth SVG arc (no ticking), 30s sweep.
- On rollover, new code fades in over 100ms.
- Hide countdown number; show only the arc.

### #7. Add a "Codes" first-class filter chip + lock-screen-adjacent widget (impact: 🔥🔥🔥, effort: 🕐🕐)
- Apple Passwords-inspired: TOTP is a top-level concept, not buried in Login items.
- Widget shows top 3 most-used codes, masked until hover.

### #8. Build a branded empty state with the diamond/keyhole mark + philosophy copy (impact: 🔥🔥🔥, effort: 🕐🕐)
- Custom illustration (commission or hand-draw 1 mark).
- One sentence: "Your secrets, encrypted on this device. Nothing leaves. Ever."

### #9. Add an engineering-grid background to lock screen + setup + empty states only (impact: 🔥🔥, effort: 🕐)
- Single CSS `background-image` with two `radial-gradient` layers.
- 6% white opacity dots at 24px intervals.
- Builds "technical, precise, trustworthy" feel without overusing the technique.

### #10. Implement copy-confirmation micro-animation with shared layoutId (impact: 🔥🔥, effort: 🕐)
- On copy: icon morphs (clipboard → checkmark) via `layoutId="copy-icon-{id}"`.
- Row briefly highlights with a violet wash that fades over 600ms.
- No bouncy spring — slow ease-out.

---

## 12. Distinctive Visual Directions for LCKED (5–8 options, with rationale + risk)

### Direction A: "Vault Materials" (Linear × Proton)
Premium dark with violet-as-light surfaces, Geist Mono secrets, shared-layout motion. THE recommended direction.
- **Rationale**: Combines Linear's restraint with Proton's warm depth. Maximizes "feels premium."
- **Risk**: Could feel too restrained / "boring" to casual users.
- **Mitigation**: Use Direction C (Large Type) and Direction E (TOTP widget) as expressive moments within the calm frame.

### Direction B: "Engineering Vault" (Vercel × 1Password)
Blueprint-grid backgrounds on every surface, character ruler reveals, watchtower-style risk color-coding.
- **Rationale**: Distinctly technical/precise; builds trust for a security product.
- **Risk**: Grid backgrounds tire the eye over long sessions; risk of "Vercel clone."
- **Mitigation**: Restrict grid to lock + empty states only.

### Direction C: "Large-Type Cinematic" (1Password homage, evolved)
Make the Large-Type reveal the *hero* interaction. Every secret can explode into a 48px+ character ruler view.
- **Rationale**: 1Password users universally love this feature; LCKED could *own* it for the web.
- **Risk**: If overused, feels gimmicky.
- **Mitigation**: Deliberate affordance (chevron + `Shift+R`), not default.

### Direction D: "Sunset Accent" (Proton-inspired)
Add a secondary yellow-orange accent (like Proton Pass's sunset) used ONLY for "freshly generated" feedback and the unlock success glow.
- **Rationale**: Adds warmth; differentiates from generic violet-only SaaS.
- **Risk**: Could clash with violet if mistuned.
- **Mitigation**: Use at ≤5% of any screen; OKLCH hue 75, chroma 0.15.

### Direction E: "Codes as First-Class" (Apple Passwords-inspired)
TOTP codes get their own section, widget, and live-updating lock-screen surface.
- **Rationale**: Apple validated this pattern in iOS 18; users love it.
- **Risk**: Live OTPs on a "rest" screen could leak.
- **Mitigation**: Mask until hover; blur on blur event; hide on `visibilitychange`.

### Direction F: "Humanist Brand" (Proton ABC Arizona-inspired)
Pair Inter/Geist with a humanist display face (Fraunces) for brand moments only — lock screen, setup, empty states.
- **Rationale**: Defies tech-default sans; signals "we care about humans, not just security."
- **Risk**: Fraunces is trendy; could feel dated in 3 years.
- **Mitigation**: Use only on static brand surfaces, never in the active app.

### Direction G: "Quiet Lock" (Calm Tech maximalist)
Aggressively minimal: no badges, no counters, no risk scores on the homepage. Everything security-related is opt-in via Settings → Security Review.
- **Rationale**: Calm Tech principle #1 ("smallest possible amount of attention"). Best for users with anxiety around security.
- **Risk**: Power users may miss features; could feel under-featured.
- **Mitigation**: A single, calm "Review" CTA in settings that surfaces all risks on demand.

### Direction H: "Diamond Mark" (Proton Pass logo homage)
Commission a custom LCKED diamond/keyhole mark. Use it as the lock-screen centerpiece, the empty-state illustration, and the FAVICON.
- **Rationale**: Proton's diamond concept (preciousness + portal) is universally praised. LCKED could adopt a similar metaphor with its own twist.
- **Risk**: Could feel derivative.
- **Mitigation**: Make the LCKED mark a *faceted* diamond (not flat), with the violet light emanating from within.

**Recommended combination: A + C + D + E + H** — "Vault Materials" as the base system, "Large-Type Cinematic" as the hero interaction, "Sunset Accent" for warmth, "Codes as First-Class" for daily utility, "Diamond Mark" as the brand anchor. This combination is distinctive, premium, and uniquely suited to a local-first password manager.

---

## 13. Appendix — Quick Reference Cards

### A. The LCKED Motion Cheat Sheet
| Interaction | Pattern | Duration | Easing | Reduced-motion fallback |
|---|---|---|---|---|
| Item selection | shared `layoutId` slide | 280ms | `[0.32, 0.72, 0, 1]` | instant |
| List enter | spring in from bottom | 320ms | spring (stiffness 300, damping 30) | fade 150ms |
| List exit | fade + shrink | 200ms | ease-out | instant |
| Copy confirm | icon morph + row wash | 600ms wash, 200ms icon | ease-out | instant |
| TOTP rollover | opacity crossfade | 100ms | linear | instant |
| Unlock success | single breath + crossfade | 1200ms breath, 400ms crossfade | ease-out | crossfade only |
| Large Type reveal | shared layout expand | 380ms | `[0.32, 0.72, 0, 1]` | instant |
| Modal open | scale 0.96→1 + opacity | 200ms | ease-out | fade only |

### B. Token application map
- `--bg-base` → body, full-bleed backgrounds
- `--bg-raised` → list items, cards, sidebar
- `--bg-overlay` → modals, dialogs (cmdk palette)
- `--bg-popover` → menus, dropdowns
- `--bg-tooltip` → tooltips, hover info
- `--accent` → primary CTA, active selection border, TOTP arc, focused input border
- `--accent-soft` → active row background, hover wash, selected chip bg
- `--danger` → breach alerts, destructive confirm
- `--warning` → weak password, expiring item
- `--success` → freshly generated password, copy success wash
- `--info` → tips, onboarding

### C. Font application map
- **Geist Sans (variable)** → all UI text. Default weight 450, emphasis 550, headings 650.
- **Geist Mono** (or Berkeley Mono if licensed) → all secret data: passwords, OTPs, card numbers, CVVs, URIs, key fingerprints. Default weight 450.
- **Fraunces (variable)** → brand moments only: lock screen title, setup heading, empty state copy.
- Enable `font-feature-settings: "tnum" 1, "zero" 1` on all numeric secrets.
- Enable `font-feature-settings: "ss01" 1` on Geist Mono if it enables slashed zero (verify).

### D. Spacing system (8pt grid)
```
4  = hairline (icon-text gap)
8  = tight (within a row)
12 = comfortable (between fields)
16 = section internal
24 = section separator
32 = major section
48 = page rhythm
64 = page-level breathing room
```
Use Tailwind's default scale (`space-1` = 4px, `space-2` = 8px, etc.) — already 8pt-aligned.

---

## End of Brief

This document is the deliverable for Task RESEARCH-B. Implementation of any specific recommendation is the responsibility of the engineering agent (no code was modified by this research task).
