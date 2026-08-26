# Puppeteer guide — driving LCKED's UI via the browser harness

All UI automation runs through the omp browser device: write a strict-JSON args
object to `xd://browser` (`action` `"open"` / `"run"` / `"close"`). There is no
puppeteer/playwright dependency in this repo; the harness wraps Chromium.

Read this before the first `open` of a session. Sections through **Efficiency
playbook** distill upstream oh-my-pi docs (`docs/tools/browser.md` + the tool
prompt); everything from **Failure recipes** on came from a real failed call in
this repo.

Novel failure missing from the tables? Solve it once, then append its
verbatim error string + recovery recipe here. The table only grows: every
session that hits an unknown wound immunizes the next one.

**Vault data in the tool browser is always disposable.** The user never
runs LCKED day-to-day inside the harness's Chromium, so resetting a vault
there ("Forgot password? Reset vault") needs no confirmation — just do it.

## Scripts

`scripts/` follows unix principles: one script = one job, done well. Chain
jobs by pasting scripts across successive `run` calls — never grow one script
into a workflow. Each script's header states its single job and usage;
bodies are canonical `run` code (`tab` exists only in harness scope, so they
are not node-runnable).

- [`scripts/bootstrap-vault.js`](scripts/bootstrap-vault.js) — land on the
  unlocked app home (fresh setup or already open). Run it once after the
  first `open`; then open the editor with a same-cell snapshot-ref click on
  `Add your first item`.

## Session start

1. Open with a generous timeout — a cold `next dev` compile blows the 30s
   default: `{"action": "open", "url": "http://localhost:3000", "timeout": 90}`.
2. Reuse the tab (`open` once, then `run`). After a failed `open`, the tab is
   dead: `open` again before any `run`.
3. Reads go through one `tab.evaluate` with attribute selectors; clicks go
   through a ref taken from a same-cell `tab.ariaSnapshot()`.

## Calling convention

Args are one strict-JSON object; `code` is one JSON string with `\n` escapes —
no backticks, template literals break the parse.

| Field         | Action | Notes                                                                                                              |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `action`      | all    | `"open"` \| `"close"` \| `"run"`                                                                                   |
| `name`        | all    | Tab id, default `"main"`. Tabs persist across calls _and subagents_ until closed.                                  |
| `timeout`     | all    | Seconds. Default 30, clamped 1–300.                                                                                |
| `url`         | open   | Navigate after ready; re-supplying `url` on an existing tab navigates it.                                          |
| `viewport`    | open   | `{width, height, scale?}` (`scale` = deviceScaleFactor). Headless default: 1365×768 @ 1.25.                        |
| `wait_until`  | open   | `load` (default) \| `domcontentloaded` \| `networkidle0` \| `networkidle2`. Also the default for later `tab.goto`. |
| `dialogs`     | open   | `accept` \| `dismiss` auto-handler. Omitted = none. Changing it recreates the tab.                                 |
| `app`         | open   | `{path?, cdp_url?, relay?, args?, target?}` — picks browser kind (below).                                          |
| `code`        | run    | Async-function body (scope below).                                                                                 |
| `all`, `kill` | close  | Release every managed tab; terminate a spawned browser's process tree.                                             |

## What `run` code gets

An async body in a dedicated worker thread. In scope: raw puppeteer `page`,
`browser`, the `tab` helper (next section), `assert(cond, msg?)`, `wait(ms)`,
plus the eval-runtime helpers (`display`, `read`, `write`, `env`, `tool`, …)
and Bun globals. Full Node access — not sandboxed.

Output rules that matter:

- Only `display(<object|array|image>)` and the final `return` value become
  tool content. `display("a string")` and `console.*` go to debug logs —
  invisible in output. Return your data:
  `return {toast, listHasItem, fieldValues}`.
- Output past the inline byte cap is spilled to a session artifact.
- Raw `page.on("request")` interception is run-scoped: run end removes your
  handlers, disables interception, releases held requests.
- One `run` at a time per tab — a second fails `Tab "…" is busy`.

## `tab` API

**Handles vs selectors.** `tab.ref("e5")` / `tab.id(n)` return an element
handle you call methods on directly (`(await tab.id(n)).click()`). Handles are
NOT selectors — `tab.click`/`type`/`fill`/`waitFor*` take string selectors
only. Snapshot refs work in any selector slot: `tab.click("e5")` ≡
`tab.click("aria-ref=e5")`; accepted spellings: `e5`, `aria-ref=e5`,
`aria-ref/e5`, `ariaref/e5`, `@e5`.

- State: `url()`, `title()`, `goto(url, {waitUntil?})`.
- Snapshots: `observe({includeAll?, viewportOnly?})` — accessibility tree of
  interactive elements, handles cached under numeric ids; `ariaSnapshot(
selector?, {depth?, boxes?})` — Playwright YAML, every node tagged
  `[ref=eN]`. Ids renumber from `e1` on every snapshot call and stay valid
  only until the next one.
- Actions: `click(sel)`, `type(sel, text)`, `fill(sel, val)`,
  `press(key, {selector?})`, `scroll(dx, dy)`, `drag(from, to)`,
  `scrollIntoView(sel)`, `select(sel, ...values)` — for `<select>` ONLY,
  `tab.fill` never works there — `uploadFile(sel, ...paths)` (file inputs
  only; paths resolve against session cwd).
- Waits: `waitForSelector(sel, {timeout?, visible?, hidden?})`,
  `waitFor(sel, {timeout?})`, `waitForUrl(pattern, {timeout?})` (polls every
  200 ms), `waitForResponse(pattern, {timeout?})`, `waitForNavigation(
{waitUntil?, timeout?})` — arm it BEFORE the click that triggers it. An
  explicit `timeout` is clamped to the remaining cell budget.
- Reads: `evaluate(fn, ...args)`, `extract(format = "markdown")` (Readability,
  falling back to `[data-pagefind-body]`/`article`/`main`/body),
  `screenshot({selector?, fullPage?, silent?})` — saves a PNG under
  `browser.screenshotDir` (or OS temp) and returns the path; it NEVER accepts
  a path; `silent: true` skips emitting the image.

Stalled helpers fail fast with a named error — quick reads cap ≈20 s,
interactive actions ≈15 s (`min(cellBudget − 1s, ceiling)`); `goto` /
`evaluate` are uncapped and will eat the whole cell.

## Selectors

Plain CSS plus Puppeteer query handlers: `text/…`, `xpath/…`, `aria/…`,
`pierce/…` (legacy `p-text/…` spellings are rewritten). Playwright-only
pseudos — `:has-text()`, `:visible`, `:text()`, `:nth-match()`, `:near()` —
throw a named ToolError pointing at the `text/`/`aria/` equivalent instead of
stalling the action timeout. Text engines substring-match: never aim them
near icon-toggle buttons (`Hide` vs `Show` — recipe below).

## Efficiency playbook

1. Static content? `read` the URL — no browser at all. Browser is for JS,
   auth, interaction.
2. One `open`, many `run`s. Tabs survive calls and subagents; don't reopen.
3. Snapshot → act in the SAME cell. Refs die on navigation, SPA re-render,
   virtualized-list scroll.
4. `wait(fn)` polls until truthy — use it instead of sleep-polling loops
   inside `evaluate`.
5. Batch assertions into ONE `evaluate` returning an object — one round trip
   beats five.
6. Returned values are proof; screenshots are appearance. Screenshot only
   when looks are the question.
7. Prefer a `waitFor*` helper over hand retries: it fails fast naming the op
   (`tab.waitForSelector(...) timed out`) instead of burning the cell.

## Browser kinds (`app`)

- **Headless** (default): project-shared Chromium behind a broker daemon;
  the only kind that gets stealth patches. First-use Chromium download can
  fail on this machine — recipe below.
- **`app.path`**: spawn (or reuse a CDP-enabled instance of) that executable
  with remote debugging. No stealth patches — never point this at a real
  desktop app you care about. `close` leaves it running; `kill: true` ends
  the process tree when the last managed tab releases.
- **`app.cdp_url`**: attach to a running CDP endpoint. Must be the HTTP
  discovery URL (`http://127.0.0.1:9222`), never `ws://`. Close only
  disconnects — the browser's pages stay open.
- **`app.relay: true`**: drive the user's own Chrome via the OMP Browser
  Relay extension. `app.target` picks a tab by URL/title substring; without
  it the visible tab is adopted without stealing focus. No stealth patches.
- A tab NAME is bound to its browser kind — switching kind on `"main"` fails
  with `Tab "…" is bound to a different browser (…). Close it first.`

## Failure recipes

Keyed by the error string as it appears in tool output. Match your failure,
apply the recovery, move on.

**`Browser open timed out after 30000ms`**
Cold Next.js compile exceeds the default timeout, and a follow-up `run` then
dies with `Tab "main" is not alive`. Recovery: re-issue `action: "open"` with
`timeout: 90`; only then `run`.

**`Tab "main" is busy`**
A previous `run` is still executing (or wedged). If truly hung, the harness
escalates itself: `Browser code execution hung past grace; tab killed` — then
`open` again. Don't stack a second `run` on a busy tab.

**`Browser code execution timed out after <ms>ms (stalled on <op>)`**
The whole cell budget elapsed while `<op>` was still running; the tab worker
is killed and the orphaned page closed. Recovery: split the work across
cells, or precede the slow step with a `waitFor*` condition.

**`browser app.cdp_url must be the HTTP CDP discovery endpoint`**
Pass `http://127.0.0.1:<port>` — a `ws://` URL is always rejected.

**Clicked the wrong button (no error — wrong element focused/toggled)**
Text-engine selectors (`::-p-text`, `text/…`) substring-match and frequently
hit a neighbouring toggle (`Hide`, `Show`, `Copy`) instead of the target.
Recovery: take an `ariaSnapshot()`, click the exact `[ref=eN]` of the labelled
button. Never aim text engines near icon-toggle buttons.

**`Unknown ARIA ref "eN". Run tab.ariaSnapshot() to refresh refs`**
Refs renumber on every snapshot and die on any re-render. Recovery — extract
and act inside one `run` cell:

```js
const snap = await tab.ariaSnapshot();
const m = snap.match(/button "Continue" \[ref=(e\d+)\]/);
if (!m) throw new Error("no Continue in snapshot");
await tab.click(m[1]);
```

**`Unknown element id eN`**
A handle from an earlier snapshot outlived a re-render. Stop chasing handles;
read state in one evaluate with attribute selectors instead:

```js
return await tab.evaluate(() =>
  Array.from(document.querySelectorAll('input[placeholder="example.com"]')).map(
    (el) => el.value,
  ),
);
```

**Field reads come back `null` while the field is visibly filled**
Accessible name ≠ placeholder. Some inputs expose `aria-label`, others only
`placeholder`. Recovery: query by `[placeholder="…"]` first (most fields here),
fall back to `[aria-label="…"]`. To see what exists, dump once:
`Array.from(document.querySelectorAll('input,textarea')).map(i => i.placeholder)`.

**`xd://browser expects a JSON args object … (JSON Parse error`**
Args are strict JSON: the `code` value is one JSON string with `\n` escapes.
Template literals / bare backticks in the args object fail parsing — build the
JS body as a plain quoted string.

**`Failed to install Chromium for puppeteer: … too large to extract in memory`**
The harness can't unpack its own Chromium build. Recovery: pass the system
binary in the `open` args — `{"action": "open", …, "app": {"path":
"/usr/bin/chromium"}}` (switches the tab to a spawned system Chromium; no
stealth patches, fine for localhost testing).

**`tab.fill('input[type="password"]') timed out … element may be hidden or covered`**
The password field is the custom dot-field; puppeteer's fill never sees it
as fillable. Recovery: set the value through evaluate with React's native
setter and dispatch an `input` event, then click Unlock via DOM:

```js
await tab.evaluate(() => {
  const el = document.querySelector('input[type="password"]');
  const set = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  ).set;
  set.call(el, "password");
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
```

## Harness gotchas (LCKED-specific)

- `tab.ariaSnapshot()` returns WITHOUT refs while a Radix dropdown menu is
  mounted or the page is mid-animation — every subsequent
  `Unknown ARIA ref "eN"` is this in disguise. Recovery: press Escape via
  `tab.evaluate(() => document.body.dispatchEvent(new KeyboardEvent("keydown",
{ key: "Escape", bubbles: true })))`, re-snapshot, only then click.
- Trusted ref clicks stall (`tab.click("eN") timed out after 8000ms`) when a
  closed-but-mounted Radix menu portal covers the page. Same recovery as
  above; if the editor sheet is already filled, clicking its submit button
  via `tab.evaluate` DOM `.click()` still saves reliably.
- Radix row menus (⋮ "… options") won't open via `btn.click()` or stale refs.
  Dropdown triggers open on `pointerdown`; a plain DOM `.click()` is ignored.
  Recovery: Escape first, then dispatch the full pointer cascade
  (`pointerdown`/`mousedown`/`pointerup`/`mouseup`/`click`) on the trigger
  via evaluate, confirm `[role=menu]` exists, then DOM-click the menuitem.
- After Create, the detail view auto-opens with the saved item selected — no
  list-row click needed to verify it.

## Asserting results

Return values from `tab.evaluate` (`{toast, listHasItem, fieldValues}`), never
screenshots. A screenshot shows appearance; a returned value is proof.
