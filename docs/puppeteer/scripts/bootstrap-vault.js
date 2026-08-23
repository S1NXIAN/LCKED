// bootstrap-vault.js — ONE job: land on the unlocked LCKED app home.
//
// Usage: paste this body into {"action": "run", "name": "main", "code": <this
// file's contents, JSON-escaped>} after opening http://localhost:3000.
// `tab` exists only inside the harness run scope — this is not node-runnable.
//
// Verified screens handled:
//   • fresh setup   : master password → confirm → risk checkbox → created
//   • already open  : returns immediately
// Anything else (locked vault, import flow): throws so you extend this file
// per GUIDE.md's growth rule. Password needs ≥8 characters.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = "smoke-test-pass-1";

let snap = await tab.ariaSnapshot();
// "All Items" (sidebar) covers unlocked homes with items; the other two
// markers exist only on the empty-vault home. Pre-auth screens match none.
if (/Add your first item|Select an item|All Items/.test(snap))
  return "already unlocked";
if (!/Create your vault/.test(snap)) {
  throw new Error("unknown screen — extend bootstrap-vault.js (see GUIDE.md)");
}

await tab.fill('input[type="password"]', pass);
snap = await tab.ariaSnapshot();
await tab.click(snap.match(/button "Continue" \[ref=(e\d+)\]/)[1]);
await sleep(400);

snap = await tab.ariaSnapshot();
await tab.fill(snap.match(/Confirm master password" \[ref=(e\d+)\]/)[1], pass);
snap = await tab.ariaSnapshot();
await tab.click(snap.match(/Create encrypted vault"[^\n]*\[ref=(e\d+)\]/)[1]);
await sleep(500);

snap = await tab.ariaSnapshot();
await tab.click(snap.match(/checkbox "I understand[^"]*" \[ref=(e\d+)\]/)[1]);
snap = await tab.ariaSnapshot();
await tab.click(snap.match(/Confirm & create"[^\n]*\[ref=(e\d+)\]/)[1]);
await sleep(2500);

return "vault created — app home";
