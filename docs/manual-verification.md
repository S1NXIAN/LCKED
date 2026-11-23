# Manual verification

Checks that need a real browser and more than one tab.

## Cross-tab lock and reset (#49)

1. Run `bun run dev` and open <http://localhost:3000> in two tabs. Create or
   unlock the same Vault in both.
2. Lock in tab A. Tab B shows the unlock screen; neither tab keeps usable keys.
3. Unlock both, then permanently delete an Item in tab A. In tab B, which still
   lists it, click its favorite star. The Item disappears from tab B and is not
   re-created.
4. Unlock both, then reset the Vault in tab A. Tab B lands on first-time setup.
5. Enable "Lock when tab is hidden", unlock both, then switch from tab A to
   tab B. Only tab A locks; tab B stays unlocked.
