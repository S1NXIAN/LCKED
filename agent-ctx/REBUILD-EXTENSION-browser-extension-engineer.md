# REBUILD-EXTENSION — Browser Extension Engineer

**Task ID:** REBUILD-EXTENSION
**Agent:** Browser Extension Engineer (sub-agent)
**Task:** Recreate the LCKED browser extension at `/home/z/my-project/lcked-extension/` from scratch (lost in a sandbox reset).

## Context

Read `/home/z/my-project/worklog.md` for the LCKED project history. The web
app is a Next.js 16 local-first password manager using PBKDF2-SHA256
(600k iterations) + AES-256-GCM, IndexedDB (Dexie), Proton Pass-inspired
Mocha theme. The extension is the companion browser add-on that talks to a
Supabase backend (PostgREST, no SDK) and reuses the same crypto parameters
+ Mocha palette.

## Files created (all from scratch)

```
lcked-extension/
├── manifest.json          (68 lines)  MV3, ES-module SW, popup, content_scripts, commands
├── README.md              (348 lines) setup, architecture, security model
├── src/
│   ├── background.js      (455 lines) service worker: router + cache + menus + commands
│   ├── content.js         (776 lines) form detection, badge, modals, toasts, MutationObserver
│   ├── popup.html         (787 lines) 360px popup, Mocha theme, 4 states
│   └── popup.js           (498 lines) popup state machine, copy-to-clipboard, rendering
├── lib/
│   ├── supabase.js        (266 lines) minimal PostgREST client (no SDK)
│   └── crypto.js          (253 lines) PBKDF2-SHA256 600k + AES-256-GCM + session key
└── icons/
    ├── _gen.py            (80 lines)  Pillow icon generator
    ├── icon-16.png        (646 B)
    ├── icon-32.png        (1.2 KB)
    ├── icon-48.png        (1.6 KB)
    └── icon-128.png       (3.1 KB)
```

Total: 3,531 lines across 11 files (excluding the icon generator).

## Implementation details

### manifest.json (MV3)

- `manifest_version: 3`, `minimum_chrome_version: "102"` (ES-module SW).
- Permissions: `activeTab`, `storage`, `scripting`, `contextMenus`,
  `clipboardWrite`.
- Host permissions: `http://*/*` + `https://*/*` (so the content script can
  run on any page and the context menu works everywhere).
- Background: `service_worker: "src/background.js"` with `"type": "module"`.
- Content script: matches `<all_urls>`, runs at `document_idle`, classic
  script (NOT a module — MV3 content scripts can't be ES modules).
- Action: popup at `src/popup.html`, all 4 icon sizes.
- Commands:
  - `_execute_action` → `Ctrl+Shift+L` (open popup).
  - `autofill-active-tab` → `Ctrl+Shift+F` (auto-fill active tab).
- `web_accessible_resources`: exposes `icons/*.png` to all URLs (for future
  use by the content script if it needs to inline the brand mark).

### lib/supabase.js — minimal PostgREST client

No Supabase SDK — direct `fetch` to the PostgREST `/rest/v1/<table>`
endpoint with both `apikey` and `Authorization: Bearer` headers (required
when RLS is on). Config (URL, anon key, JWT, user id) lives in
`chrome.storage.local` under `lcked_supabase_*` keys.

Exported methods:
- `isConfigured()` — true when all 4 config keys are present.
- `getAuthToken()` — returns the JWT (or null).
- `getUserId()` — returns the user id (or null).
- `getBaseUrl()` — returns the Supabase URL (trailing slash trimmed).
- `fetchEntries()` — `GET /rest/v1/vault_entries?user_id=eq.<uid>&order=updated_at.desc&select=*`.
- `upsertEntry(entry)` — `PATCH` if `entry.id`, else `POST`. Adds
  `Prefer: return=representation` so the persisted row comes back.
- `deleteEntry(id)` — `DELETE /rest/v1/vault_entries?id=eq.<id>&user_id=eq.<uid>`.
- `loginWithEmail(email, password)` — `POST /auth/v1/token?grant_type=password`
  → persists JWT + user id to local storage.
- `setConfig(patch)` / `clearConfig()` — chrome.storage.local helpers.

### lib/crypto.js — PBKDF2 + AES-256-GCM

Web Crypto only (`crypto.subtle`). No external deps.

- `PBKDF2_ITERATIONS = 600_000`, `SALT_BYTES = 32`, `IV_BYTES = 12`, `KEY_BITS = 256`.
- `deriveMasterKey(password, salt)` → `importKey("raw", …, PBKDF2)` then
  `deriveKey(... AES-GCM 256 ...)`. Key is **extractable** so it can be
  exported to raw bytes for `chrome.storage.session` (which only accepts
  JSON-serialisable values).
- `buildVerifier(key)` / `verifyMasterKey(key)` — encrypts the constant
  string `"lcked-verifier-v1"` with AES-GCM and stores the envelope in
  `chrome.storage.local`. On unlock, decrypting this constant confirms the
  password is correct without keeping plaintext around. First-run (no
  verifier yet) returns `true`.
- `storeSessionKey(cryptoKey)` → `exportKey("raw", …)` → base64 →
  `chrome.storage.session.lcked_session_key`.
- `getSessionKey()` → reads raw bytes → `importKey("raw", …, AES-GCM, …)`.
- `clearSessionKey()` → `chrome.storage.session.remove([...])`.
- `hasSessionKey()` — cheap check.
- `encryptJson(obj, key)` → fresh random 96-bit IV → `AES-GCM encrypt` →
  returns `{ cipher, iv }` both base64.
- `decryptJson(cipherB64, ivB64, key)` → `AES-GCM decrypt` → `JSON.parse`.
  GCM's auth tag throws on tampering or wrong key.
- `bytesToB64` / `b64ToBytes` — binary-safe base64 helpers (no `atob` UTF-8
  issues since we only encode raw bytes).
- `clearVaultCrypto()` — wipes salt + verifier + session key (for Reset).

### src/background.js — service worker (ES module)

Imports `../lib/supabase.js` and `../lib/crypto.js`.

**In-memory state:**
- `decryptedCache` — array of decrypted items (or null until first UNLOCK).
  Cleared on LOCK.
- `lastSyncedAt` — Date.now() of last successful `loadAndDecryptAll`.

**Context menus** (created in `chrome.runtime.onInstalled`):
- `lcked-autofill` — "LCKED: Auto-fill login" — queries items for the
  active tab's domain; if any, sends `AUTOFILL` with the most-recently-
  updated match; otherwise sends `NOTIFY` info.
- `lcked-save` — "LCKED: Save/update this login" — sends `DETECT_SAVE` to
  the content script, which extracts the visible form's credentials and
  shows the save/update modal.

**Keyboard commands** (`chrome.commands.onCommand`):
- `autofill-active-tab` (Ctrl+Shift+F) — same logic as the auto-fill menu.

**Domain matching** (`domainMatches(stored, current)`):
- Lowercase + strip leading `www.`
- Exact match → true
- `current` ends with `"." + stored` (current is a subdomain of stored) → true
- `stored` ends with `"." + current` (symmetric) → true
- Suffix-only match without a dot boundary (`evilexample.com` vs
  `example.com`) → **false**.

**Update detection** (`checkUpdate({domain, username, password})`):
- Same domain + same username + same password → `noop` (no prompt).
- Same domain + same username + different password → `update` (with `itemId`).
- Same domain + new username, or no match → `save_new`.

**Message router** (`chrome.runtime.onMessage`): handles all 11 message
types from the spec plus `DELETE_CREDENTIAL`, `REFRESH`, `LOGIN_EMAIL`,
`CONFIGURE_SUPABASE`, `LOGOUT_SUPABASE`, `RESET_VAULT`, `PING`. Every
handler is wrapped in `try/catch` and returns `{ ok, … }` or `{ ok: false,
error }`. The listener returns `true` so the response can be async.

**Session sync:** `chrome.storage.onChanged` listener mirrors session-key
clears to the in-memory cache (so if the popup calls `clearSessionKey`
directly, the SW also drops its cache).

### src/content.js — form detection + autofill + modals + toasts

IIFE in the page's isolated world. Guards against double-init via
`window.__lckedContentInit`.

**Mocha palette** (Catppuccin) inlined as CSS constants. All DOM elements
use `data-lcked-ext-*` attributes as namespacing to avoid collisions with
the host page's CSS.

**CSS injection:** a single `<style id="lcked-ext-style">` block with:
- Badge: `position: fixed`, 22×22px mauve button with key icon, opacity
  transition + hover scale.
- Modal overlay: `position: fixed; inset: 0`, dark backdrop with blur,
  centered modal card (360px, Mocha base/mantle/surface palette).
- Toast wrap: bottom-right column, 240–360px wide, dot indicator coloured
  by level (info=blue, success=green, error=red, warn=yellow).
- Keyframes: `lcked-fade-in`, `lcked-toast-in`, `lcked-toast-out`.

**Form detection:**
- `findPasswordFields()` — all `input[type=password]` that are visible
  (rect > 0, not `display:none`/`visibility:hidden`/`opacity:0`, within
  viewport + 200px margin).
- `findUsernameField(pw)` — walks the form (or previous siblings + ancestor
  siblings if no `<form>`) and scores each candidate input by:
  `autocomplete=username` (+50), `autocomplete=email` (+40), hint regex
  match on name/id/placeholder/aria-label (+20), `type=email` (+15).
  Highest score wins.
- `detectLoginForms()` — returns `[{passwordField, usernameField}]`
  candidates (deduped by password field).

**Filling** (`setNativeValue`): uses the prototype's `value` setter
(`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set`)
to bypass React's instance-property override, then dispatches `input`,
`change`, and `blur` events with `bubbles: true`. This works for React,
Vue, and Svelte.

**Autofill badge:**
- One badge per password field, tracked in a `WeakMap(field → badge)`.
- Positioned at the field's right edge with `position: fixed` using
  viewport coords from `getBoundingClientRect()`.
- `repositionAllBadges()` is called on scroll (rAF-throttled), resize, and
  MutationObserver callbacks.
- Click handler: sends `GET_ITEMS_FOR_DOMAIN` to the background; if 1
  match, fills; if many, fills the most-recently-updated and toasts the
  count; if 0, toasts "No credentials saved".

**Submit detection:**
- `<form>` submit — `addEventListener("submit", …, true)` (capture phase)
  on every form containing a password field. Captures credentials, defers
  `offerSaveOrUpdate` by 250ms so the framework's own submit handler runs
  first.
- SPA button click — `findSubmitButtonNear(pw)` walks the form (or up to 4
  ancestor levels) for buttons whose text matches
  `/^(sign in|log in|login|continue|submit|next|sign-in|log-in|get started|verify|go)$/i`
  or has `type="submit"`. Hooks `click` (capture) → defer 400ms →
  `offerSaveOrUpdate`.
- Enter key on password field — also triggers `offerSaveOrUpdate` (deferred).

**Modals:**
- `showSaveModal(creds)` — title "Save login?", rows for Website/Username/
  Password (masked), Skip + Save buttons.
- `showUpdateModal(creds, itemId)` — title "Update password?", explanatory
  text + masked new-password row, Skip + Update buttons. Update calls
  `SAVE_CREDENTIAL` with the existing `itemId`.
- Both use `buildModal({title, bodyHtml, footerHtml})` which creates a
  centered overlay (click-outside-to-dismiss) with the Mocha-themed card.
- `escapeHtml` for all user-supplied strings.

**Toasts** (`notify(level, message)`): appended to a bottom-right wrapper,
auto-dismissed after 3s with a 180ms leave animation.

**Message listener** (`chrome.runtime.onMessage`):
- `AUTOFILL` — calls `fillForm(msg.credentials)`.
- `DETECT_SAVE` — finds the candidate with a non-empty password (or falls
  back to the first), captures credentials, calls `offerSaveOrUpdate`. If
  no form or no password, toasts an info message.
- `NOTIFY` — `notify(msg.level, msg.message)`.

**MutationObserver:** observes `document.documentElement` for
`childList` subtree changes. Debounced (300ms) `scheduleScan()` re-runs
`scanForForms()` + `scanForBadges()` + `repositionAllBadges()`. Also a
2-second `setInterval` as a fallback for late-rendered SPAs.

**Badge lifecycle:** `scanForBadges()` adds badges for new password fields
and removes badges for fields that disappeared from the DOM or became
hidden.

### src/popup.html — 360px Mocha-themed popup

- 4 `<section class="lcked-state">` blocks (only one `.active` at a time):
  - `state-setup` — connect form (Supabase URL, anon key, email, password,
    master password) with eye-toggle visibility buttons.
  - `state-unlock` — master password input + Unlock button + Sign out link.
  - `state-vault` — search input + "This site" section + "All items" section.
  - `state-settings` — account info (status, UID, item count), Refresh +
    Reset buttons, shortcuts reference, security info, sign-out button.
- Header with diamond mark + "LCK**ED**" wordmark + "LOCAL VAULT" subtitle
  (subtitle becomes the active tab's hostname when unlocked).
- Header buttons: Settings (gear icon, hidden in setup state) + Lock (lock
  icon, hidden except in vault state).
- Footer: sync status + "v1.0.0".
- All CSS is inlined in `<style>` (no external requests). Mocha palette as
  CSS variables (`--base`, `--mantle`, `--crust`, `--surface0/1/2`,
  `--text`, `--subtext`, `--overlay0`, `--mauve`, `--lavender`, `--green`,
  `--yellow`, `--red`, `--peach`, `--blue`).
- Custom scrollbar styling (8px wide, surface1 thumb).
- Touch-friendly: 30px+ button heights, 24px+ icon buttons.

### src/popup.js — popup state machine

- Inline SVG icon strings for user/key/copy/check/fill/globe/empty.
- `bg(type, payload)` — promise wrapper around `chrome.runtime.sendMessage`.
- `showState(name)` — toggles `.active` on the right `<section>`, shows/hides
  the Lock + Settings header buttons, updates the footer status text.
- `showError(id, msg)` — toggles the `.show` class on error containers.
- `copyWithFeedback(btn, value)` — `navigator.clipboard.writeText` with a
  hidden-textarea + `execCommand("copy")` fallback. Shows a green check
  icon for 20 seconds, then clears the clipboard (auto-clear to mitigate
  clipboard sniffers).
- `renderItem(item, {onFill})` — builds an item row with favicon letter,
  name + username, and copy-username / copy-password / fill action buttons
  (buttons fade in on row hover). Meta div is keyboard-accessible
  (`tabindex="0"`, Enter/Space activates).
- `renderVault(query)` — filters `allItems` by query (case-insensitive
  substring on name+username+domain), renders the "This site" section
  (filtered by `domainMatches(item.domain, activeDomain)`) and the "All
  items" section. Empty states per section.
- `loadVault()` — gets the active tab's hostname via `chrome.tabs.query`,
  sends `GET_ALL_ITEMS`, sorts by `updatedAt` desc, renders.
- `autofill(item)` — sends `AUTOFILL_REQUEST {itemId}` to the background,
  closes the popup on success.
- `handleSetup()` — validates all 5 fields, sends `CONFIGURE_SUPABASE` →
  `LOGIN_EMAIL` → `UNLOCK` in sequence. On success, transitions to vault
  state and calls `loadVault()`.
- `handleUnlock()` — sends `UNLOCK {masterPassword}`, clears the input on
  success, transitions to vault.
- `openSettings()` / `closeSettings()` — toggles between vault and settings
  sections, populates account info from `GET_VAULT_STATUS`.
- `handleRefresh()` — sends `REFRESH`, re-loads vault.
- `handleReset()` — confirms, sends `RESET_VAULT`, returns to setup.
- `handleSignout()` — confirms, sends `LOGOUT_SUPABASE`, returns to setup.
- `boot()` — runs on `DOMContentLoaded`: binds all event listeners, then
  calls `GET_VAULT_STATUS` to decide which state to show
  (setup / unlock / vault).

### icons/_gen.py — Pillow icon generator

- Diamond (rotated square) with a keyhole cutout (circle + trapezoid slot).
- Mauve fill `#cba6f7` with a slightly darker edge `#8960b0` (mauve
  darkened ~25%).
- Keyhole in `#1e1e2e` (Mocha base) for visibility on light backgrounds.
- 4× supersampling then LANCZOS downsample for crisp edges at 16/32/48/128.
- Outputs `icon-{16,32,48,128}.png` (RGBA PNGs).

## Verification

- **`manifest.json`** — validated as well-formed JSON (`python3 -c "import
  json; json.load(open('manifest.json'))"`) ✓.
- **All 5 JS files** — syntax-checked with `node --input-type=module
  --check` (for ES modules) and `node --check` (for IIFEs) → all pass ✓.
- **All 28 IDs referenced in popup.js** — verified present in popup.html ✓.
- **Icons** — verified as RGBA PNGs at the correct sizes via PIL ✓.
- **Line counts** — manifest 68, README 348, background 455, content 776,
  popup.html 787, popup.js 498, supabase 266, crypto 253, _gen.py 80 →
  3,531 total.
- **No lint needed** — the extension is vanilla JS outside the Next.js
  project, so `bun run lint` does not apply.

## Files touched

- `lcked-extension/manifest.json` (new)
- `lcked-extension/README.md` (new)
- `lcked-extension/src/background.js` (new)
- `lcked-extension/src/content.js` (new)
- `lcked-extension/src/popup.html` (new)
- `lcked-extension/src/popup.js` (new)
- `lcked-extension/lib/supabase.js` (new)
- `lcked-extension/lib/crypto.js` (new)
- `lcked-extension/icons/_gen.py` (new — icon generator)
- `lcked-extension/icons/icon-16.png` (new — generated)
- `lcked-extension/icons/icon-32.png` (new — generated)
- `lcked-extension/icons/icon-48.png` (new — generated)
- `lcked-extension/icons/icon-128.png` (new — generated)
- `worklog.md` (this entry appended)

## Notes for next agents

- **Per-device salt** — the PBKDF2 salt is generated locally on first setup
  and stored in `chrome.storage.local.lcked_vault_salt`. It is **not**
  synced via Supabase. Installing the extension on a new device produces a
  different key, so entries encrypted on device A cannot be decrypted on
  device B. This is a deliberate v1 trade-off for simplicity. To support
  cross-device sync, store the salt (and verifier envelope) as an encrypted
  blob in a `vault_meta` table keyed by `user_id`. The crypto layer already
  has `buildVerifier` / `verifyMasterKey` plumbing — just relocate the
  storage from `chrome.storage.local` to a Supabase row.
- **JWT expiry** — `fetchEntries` will get a 401 when the JWT expires. The
  popup currently shows "Could not load vault." A follow-up should detect
  401s and prompt the user to re-login (re-run `LOGIN_EMAIL`).
- **TOTP / custom fields / notes / cards / identities** — the extension
  only supports login items (name + username + password + domain). The
  Next.js web app supports all 4 item types; syncing them would require
  extending the `vault_entries` schema (e.g., a `kind` column) and the
  popup/content rendering.
- **Auto-lock on tab visibility change** — the web app has this; the
  extension relies on the simpler `chrome.storage.session` auto-clear
  (browser close). Adding a `chrome.tabs.onActivated` + visibilitychange
  listener in the SW that calls `clearSessionKey` after N minutes of
  inactivity would match the web app's behaviour.
- **Content script in Shadow DOM** — `findPasswordFields` only scans
  `document.querySelectorAll`. Some sites put login forms inside a closed
  Shadow DOM; for those, the user can still use the context-menu auto-fill.
  A future enhancement could walk `element.shadowRoot` recursively.
- **React 19 + autofill** — the native-setter trick
  (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set`)
  is the standard workaround for React's controlled inputs. If a site uses
  a custom element that overrides `value` at the instance level, this may
  not work; the content script would need to fall back to dispatching a
  `keydown` sequence (rare — most sites use plain `<input>`).
- **Icon regeneration** — `python3 lcked-extension/icons/_gen.py` regenerates
  all 4 PNGs. Pillow is the only dependency (`pip install pillow`).
- **Loading the extension** — `chrome://extensions/` → Developer mode →
  Load unpacked → select `lcked-extension/`. No build step required.
