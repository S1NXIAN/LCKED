# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Privacy-conscious individuals who distrust cloud password managers. They reach
for LCKED when choosing where their credentials live, and use it daily to
store, find, and fill logins, notes, cards, and identities. They want proof,
not reassurance, that nothing ever leaves their device.

## Product Purpose

LCKED is a zero-knowledge, local-first password manager. All encryption
(Argon2id + AES-256-GCM) and all storage (browser IndexedDB) happen entirely
in the browser; there is no backend. Success: a user runs their whole
credential workflow — create, organize, retrieve, rotate, back up — inside one
page, certain that no plaintext and no ciphertext ever leaves the device.

## Positioning

No accounts, no servers, no sync, no telemetry, no recovery. The vault is a
client-side object sealed under a Master Password the service never sees. A
cloud-sync competitor cannot truthfully claim "nothing plaintext ever leaves
your device"; that sentence is LCKED's literal architecture, not marketing.

## Operating Context

- Single-page browser app (Next.js); everything happens on one route behind
  setup/unlock states.
- Migration path in: one-way, best-effort CSV import from other managers
  (catalog-driven; per-row failures reported, never fatal).
- Migration path out: plain CSV export or the encrypted Backup envelope
  (`lcked-encrypted-v1`) with Restore into a fresh vault.
- Browser storage is the user's responsibility: clearing site data destroys
  the vault; there is no server-side copy to fall back on.
- Strict CSP via nonce middleware (ADR-0003); GitHub Issues tracks work
  (`gh` CLI).

## Capabilities and Constraints

- Item types: login, note, card, identity; shared fields include favorites,
  pins, folders, custom fields, multi-vault membership, trash.
- Organization: custom vaults (colored, iconed), Active view filtering, type
  filter, multi-select bulk actions, Trash with 30-day purge TTL.
- Tools: TOTP codes, password generator, clipboard auto-clear, auto-lock,
  password strength meter.
- Themes: dark (default), light, nord, proton.
- Hard constraint: the Master Password has no recovery, reset, or backdoor;
  forgetting it loses the data permanently. This is a design commitment.
- Binding commitments (user-confirmed): local-only forever (no accounts/sync/
  cloud/telemetry may be added); the zero-knowledge wording stays literal and
  provable.

## Brand Commitments

- Name: **LCKED**; current mark: rotated-diamond keyhole (`public/logo.svg`,
  inline favicon). Present identity, not user-pinned as unchangeable.
- Voice (from metadata): plain declarative security claims — "Nothing
  plaintext ever leaves your device."

## Evidence on Hand

- `public/logo.svg`, inline SVG favicon, favicon icon set for import sources.
- Working v0.3.0 app with real domain docs (`CONTEXT.md`, ADRs 0001–0005).
- Absences future work must not fabricate: no testimonials, press, customer
  logos, benchmarks, or pricing. None exist yet.

## Product Principles

1. **The device is the boundary.** Every feature must keep all data local;
   anything requiring a server is out of scope by definition.
2. **Honesty about permanence.** No-recovery and destructive consequences are
   stated plainly, never hidden behind fine print or optimistic defaults.
3. **Trust lives in visible details.** Security behaviors users can see
   (auto-lock, clipboard clearing, strength feedback) are part of the product,
   not settings buried in a menu.
4. **Portability is a right.** Import in and export out stay first-class;
   lock-in would betray the positioning.

## Accessibility & Inclusion

WCAG 2.1 AA is the standing target: contrast ratios, visible focus states,
and fully keyboard-operable flows are requirements, not aspirations.
