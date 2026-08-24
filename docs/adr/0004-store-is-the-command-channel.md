# The vault store is the single channel for cross-component commands

Cross-component UI commands (type-filter changes, multi-select exit, the
editor-open handoff) used to travel over three competing channels: window
CustomEvents, mutable module-global stashes, and a backwards-compat prop kept
alongside its own store subscription. Each had already caused a regression —
events fired before listeners mounted, and the stash could be consumed late,
twice, or not at all. Everything now rides the store as typed state and plain
transitions, with two documented exceptions that genuinely cannot be store
state.

## Considered options

- **Window CustomEvents**: rejected; stringly-typed payloads, delivery depends
  on listener mount timing, invisible to typechecking.
- **Mutable module-global stash**: rejected; out-of-order consume/stash calls
  corrupted the editor handoff — exactly the bug class this removes. The
  replacement (`editorNewType`) is overwritten by every `setEditorOpen` call,
  so a stale pick can never leak into a later session.
- **Props as a parallel source of truth**: rejected; two owners for one value.
  Props stay purely presentational.
- **Generator bridge module-global**: kept deliberately — it hands a callback
  closure to whichever password field opened the dialog; that is input to a
  focused field, not a command between views.
- **Diamond-spin CustomEvent**: kept deliberately — 60fps pointer coordinates
  are animation data; routing them through app state would re-render the tree
  per frame.

## Consequences

- New cross-component commands get a store field + action, never an event or
  global (see CONTEXT.md, "One channel").
- Commands are exercised as store transitions in tests; no component mounts or
  `window` stubs are needed to assert command delivery.
