# Puppeteer guide — driving LCKED's UI via the browser harness

All UI automation runs through the omp browser device: write a strict-JSON args
object to `xd://browser` (`action` `"open"` / `"run"` …). There is no
puppeteer/playwright dependency in this repo; the harness wraps Chromium.

Read this before the first `open` of a session. Every recipe below came from a
real failed call in this repo.

Novel failure missing from the tables? Solve it once, then append its
verbatim error string + recovery recipe here. The table only grows: every
session that hits an unknown wound immunizes the next one.

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

## Failure recipes

Keyed by the error string as it appears in tool output. Match your failure,
apply the recovery, move on.

**`Browser open timed out after 30000ms`**
Cold Next.js compile exceeds the default timeout, and a follow-up `run` then
dies with `Tab "main" is not alive`. Recovery: re-issue `action: "open"` with
`timeout: 90`; only then `run`.

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

## Harness gotchas (verified against live device docs)

- `tab.fill` never works on `<select>` — use `tab.select`.
- Arm `tab.waitForNavigation` BEFORE the click that triggers it; prefer
  `waitForUrl` / `waitForResponse` with a condition.
- SPA re-renders and virtualized lists invalidate ids/refs mid-flight —
  re-snapshot and act in the same cell (pattern above).
- Stalled actions fail fast with a named error rather than eating the whole
  cell timeout — treat the name as the recipe key.
- `tab.ariaSnapshot()` returns WITHOUT refs while a Radix dropdown menu is
  mounted or the page is mid-animation — every subsequent
  `Unknown ARIA ref "eN"` is this in disguise. Recovery: press Escape via
  `tab.evaluate(() => document.body.dispatchEvent(new KeyboardEvent("keydown",
{ key: "Escape", bubbles: true })))`, re-snapshot, only then click.
- Trusted ref clicks stall (`tab.click("eN") timed out after 8000ms`) when a
  closed-but-mounted Radix menu portal covers the page. Same recovery as
  above; if the editor sheet is already filled, clicking its submit button
  via `tab.evaluate` DOM `.click()` still saves reliably.
- **`Failed to install Chromium for puppeteer: … too large to extract in memory`**
  The harness can't unpack its own Chromium build. Recovery: pass the system
  binary in the `open` args — `{"action": "open", …, "app": {"path":
"/usr/bin/chromium"}}`.

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

**Radix row menus (⋮ "… options") won't open via `btn.click()` or stale refs**
Dropdown triggers open on `pointerdown`; a plain DOM `.click()` is ignored,
and trusted `tab.click(ref)` stalls when a closed-but-mounted portal covers
the page. Recovery: Escape first, then dispatch the full pointer cascade
(`pointerdown`/`mousedown`/`pointerup`/`mouseup`/`click`) on the trigger
via evaluate, confirm `[role=menu]` exists, then DOM-click the menuitem.

- After Create, the detail view auto-opens with the saved item selected — no
  list-row click needed to verify it.

## Asserting results

Return values from `tab.evaluate` (`{toast, listHasItem, fieldValues}`), never
screenshots. A screenshot shows appearance; a returned value is proof.
