# REWRITE-ITEM-EDITOR-SIDEBAR — fullstack-react-engineer

## Task
Convert `src/components/lcked/item-editor.tsx` from a modal `<Dialog>` to a right-side `<Sheet>` sidebar matching the item-detail panel design.

## What changed

### item-editor.tsx (full rewrite)
- **Dialog → Sheet**: `import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"`. Root `<Sheet open={open} onOpenChange={...}>` + `<SheetContent side="right" className="w-full gap-0 overflow-hidden border-l border-border bg-background p-0 sm:max-w-[480px] [&>button:last-child]:hidden">`. The `[&>button:last-child]:hidden` hides the radix auto-injected Close button (same trick as create-vault-dialog + password-generator-dialog).
- **Header** (`flex-row items-center justify-between gap-2 border-b border-border px-4 py-3`):
  - Left: `<SheetTitle>` with `<ItemTypeIcon type={form.type} size="sm" />` + "Edit item" / "New item".
  - Right: compact vault-selector `DropdownMenu` (VaultIcon swatch + name + ChevronsUpDown) + Save/Create `Button` (size sm, Loader2 spinner when busy).
  - Vault dropdown writes to `form.vaultId` (string | null). "No vault" option clears it. Reads `vaults` from `useVault((s) => s.vaults)`.
  - Removed the manual `<X>` close button.
- **Body** (`lcked-scroll flex-1 overflow-y-auto p-4`):
  - Type-selector grid (4 cols, create-only) preserved.
  - Name field → flat borderless input (create-vault-dialog pattern: `border-0 bg-transparent px-0 py-0.5 text-lg font-medium`).
  - Added local `FieldCluster` + `FieldRowInput` helpers mirroring item-detail's FieldCluster/FieldRow look (rounded bordered card, rows divided by `border-t border-border/50`, uppercase tracked label + flat `Input` with `focus-visible:ring-0`). Applied to login username as a demo of the pattern.
  - ALL other fields preserved verbatim: PasswordField (strength + generate), TOTP, login URLs (add/remove), notes, card fields (with `detectCardBrand`), identity grid, folder, custom fields (add/update/remove + text/hidden select).
- **Footer** (`border-t border-border px-4 py-3`): single full-width ghost Cancel button. Save/Create lives in the header per spec.
- **Functionality preserved**: `blankItem`, `itemToInput`, `useEffect` form init (hydrate-from-existing or `consumeNewItemType() ?? "login"`), `handleSave`, custom-field helpers, URL helpers, favorite toggle, folder, card-brand detection. `isEditing = Boolean(editorItemId)`.

### Pre-existing lint fixes (required for "0 errors")
Both were pre-existing breakages from a prior agent's uncommitted edits — NOT introduced by this task, but blocking the lint requirement.

- **item-detail.tsx** line 248: `<VaultIcon ... bare />` referenced an undefined component + invalid `bare` prop. Fixed: added `import { VaultIcon } from "./vaults-sidebar";` and removed `bare`.
- **vault-view.tsx** line 332: JSX parse error `')' expected`. A prior agent wrapped the search-header + list/detail region in an outer `{settingsOpen ? <SettingsView/> : <>...</>}` ternary but left the OLD inner settingsOpen ternary in place without its closing `)}`. Fixed by removing the redundant inner ternary entirely (the outer one already handles the settingsOpen branch). Structure now: `{settingsOpen ? <SettingsView/> : (<> <header/> <div>list+detail</div> </>)}`.

## Verification
- `bun run lint` → exit 0, 0 errors, 0 warnings.
- Dev server: `✓ Compiled`, `GET / 200`.
- No console errors.

## Notes for next agents
- item-editor Sheet width `sm:max-w-[480px]` (wider than create-vault's `sm:max-w-md` / generator's `sm:max-w-[420px]`) to fit identity grid + custom-field rows.
- `form.vaultId` (string | null) now has UI: `null` = "No vault". Round-trips through `saveItem`.
- `FieldCluster`/`FieldRowInput` are local to item-editor.tsx (NOT shared with item-detail's read-only `FieldCluster`/`FieldRow`). Extract only if a 3rd consumer appears.
- `[&>button:last-child]:hidden` is the canonical radix-Sheet close-hiding trick — now in 3 sheets.
