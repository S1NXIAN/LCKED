# REWRITE-VAULT-SETTINGS — fullstack-react-engineer

## Task ID
REWRITE-VAULT-SETTINGS

## Scope
Three tightly-coupled UI cleanups for the LCKED password manager:
1. Rewrite `create-vault-dialog.tsx` as a clean Sheet sidebar matching the item-list aesthetic.
2. Switch settings from a `fixed inset-0 z-50` overlay to inline (replaces list+detail area only; sidebar stays visible).
3. Rewrite ALL setting descriptions to be accurate.

## Files modified
- `src/components/lcked/create-vault-dialog.tsx` — full rewrite
- `src/components/lcked/vault-view.tsx` — inline settings rendering, removed `fixed inset-0 z-50` AnimatePresence overlay
- `src/components/lcked/settings-dialog.tsx` — `SettingsView` root changed to `flex h-full min-h-0 w-full flex-col` (no `fixed`/`z-50`); updated every section description and the UNLOCK_METHODS captions

## Task 1 — create-vault-dialog.tsx rewrite

### Header
- Layout: `[VaultIcon swatch 28px] [title] [Save/Create button]`
- Title is `New vault` in create mode, `Edit vault` in edit mode
- Save button label is `Create` in create mode, `Save` in edit mode, switches to `<Loader2 spin/>` while busy
- NO close X button — radix's built-in Close (always last child of SheetContent) is hidden via `[&>button:last-child]:hidden` on `SheetContent`
- Sheet styling: `border-l border-border bg-background` (matches item-editor surface)

### Body (flat, spacious)
- **Live preview at top**: centered 64px `VaultIcon` + the trimmed name (falls back to `Untitled vault` / existing vault name). Generous `pt-8 pb-2 px-6` padding.
- **Name field**: flat borderless `<input>` (no Input component border), styled like the item-editor's flat input pattern — `border-0 bg-transparent px-0 py-1.5 text-lg font-medium`. Label is an uppercase `text-[11px]` micro-label above. Enter triggers Save.
- **Divider** (`mx-6 my-5 h-px bg-border`) separates the name from pickers.
- **Color picker**: 10 swatches in a 5×2 grid. Each tile uses `vaultColorHex(c.id)` for both the tinted background (`${hex}29`) and the inner circle. Selected tile shows a colored ring (`boxShadow: 0 0 0 2px ${hex}`) + a tiny Check badge in the top-right.
- **Icon picker**: 30 raw Lucide glyphs in a 6-col grid. Redeclared `LUCIDE_BY_ID` locally (mirrors vaults-sidebar's map 1:1) so each tile shows the raw icon shape, tinted with the currently selected color when active. Selected tile gets `bg-muted` + colored glyph; unselected tiles are `text-muted-foreground hover:bg-muted/60`.

### Footer
- Sticky bottom bar with `border-t border-border px-4 py-3`
- **Cancel** (left, `flex-1` ghost variant) — closes sheet
- **Delete vault** (right, `flex-1` outline variant with `border-destructive/40 text-destructive`) — only rendered in edit mode, wrapped in `<AlertDialog>` for confirm. AlertDialogContent lists vault name and warns that items inside will be moved to default vault.

### Preserved behaviour
- All existing store hooks kept: `createVaultDialogOpen`, `vaultEditorOpen`, `editingVaultId`, `setCreateVaultDialogOpen`, `setVaultEditorOpen`, `createVault`, `updateVault`, `deleteVault`
- Form-hydration effect unchanged: hydrates from `editingVault` in edit mode, resets to defaults in create mode
- Enter-to-save, toast feedback, busy state all preserved
- `VaultIcon` imported from `./vaults-sidebar`; `VAULT_COLORS`, `VAULT_ICONS`, `DEFAULT_VAULT_COLOR`, `DEFAULT_VAULT_ICON`, `vaultColorHex` imported from `@/lib/vault-assets`

## Task 2 — settings inline in vault-view.tsx

### Change
Replaced:
```tsx
<div className="flex min-h-0 flex-1">
  {/* List column + Detail column */}
</div>
...
<AnimatePresence>
  {settingsOpen && <motion.div className="fixed inset-0 z-50"><SettingsView/></motion.div>}
</AnimatePresence>
```
with:
```tsx
{settingsOpen ? (
  <div className="flex min-h-0 flex-1">
    <SettingsView />
  </div>
) : (
  <div className="flex min-h-0 flex-1">
    {/* List column + Detail column — unchanged */}
  </div>
)}
```

### What stayed
- The outer `<aside>` sidebar (vaults + Generator/Settings/Theme/Lock buttons) stays visible at all times — settings only replaces the right-hand list+detail area.
- The search header above the list+detail also stays (still shows the New dropdown, search, item count).
- Mobile FAB, dialogs (ItemEditor, PasswordGeneratorDialog, ImportExportDialog, CreateVaultDialog) unchanged.
- `motion` / `AnimatePresence` imports still used by the mobile FAB.

## Task 3 — settings-dialog.tsx descriptions

### SettingsView root
Was: `<div className="fixed inset-0 z-50 flex flex-col bg-background">`
Now: `<div className="flex h-full min-h-0 w-full flex-col bg-background">`

The minimal header (back arrow + Settings icon + title + storage badge) is preserved so the user can close settings — that's the only way back since it's now inline.

### UNLOCK_METHODS captions (all 3 rewritten)
| Method  | Old caption                          | New caption                                            |
|---------|--------------------------------------|--------------------------------------------------------|
| master  | Strongest · recommended              | Full password required every time. Most secure.        |
| pin     | Quick access · 6 digits              | Quick 6-digit code. Faster, slightly less secure.      |
| none    | No lock screen · least secure        | Master password only. No quick-unlock option.          |

Labels also normalized: `Master Password` → `Master password` (sentence case).

### General tab
- Show website favicons: `Fetches login icons from Google's favicon service. Off = fully offline.` → **`Fetches website icons for login items. Disable for offline privacy.`**
- Sort favorites to top: `Favorite items always appear above the rest, regardless of sort key.` → **`Favorite items appear above others. Pinned items always stay at top regardless.`**

### Security tab
- Unlock with header description: `Choose what to prompt for when the vault locks.` → **`Choose how the vault unlocks after being locked.`**
- Auto-lock section — added description that was previously missing: **`Automatically lock the vault after a period of inactivity.`**
- Lock when tab is hidden — was a single-line label; now a two-line label + description: **`Locks the vault when you switch to another browser tab.`** (description indented under the label to align with the icon)
- Change master password — added description that was previously missing: **`Your master password encrypts everything. Changing it re-encrypts your vault.`**

### Import tab
Subtitle rewritten to enumerate supported formats explicitly:
> Click your previous provider to choose an export file. Supported formats: Bitwarden **JSON / CSV**, 1Password / Chrome / Firefox / Safari / Edge / LastPass / Keeper / Proton Pass **CSV**, KeePassXC **XML**. LCKED auto-detects the format.

### Export tab
- Subtitle: `Choose a format below.` → **`Choose an encrypted format for safe storage, or plain CSV for migration to another tool.`**
- Format card captions rewritten:
  - PGP-encrypted: `AES-256-GCM envelope · fully secure` → **`AES-256-GCM envelope. Restore only with the passphrase. Recommended for backups.`** (label also clarified to `PGP-encrypted JSON`)
  - ZIP archive: `Encrypted payload inside a .zip wrapper` → **`Same encrypted payload packaged as a single-file .zip archive.`** (label `ZIP archive` → `Encrypted ZIP`)
  - Plain CSV: `Unencrypted · readable by any tool` → **`Unencrypted text file. Readable by any password manager or spreadsheet tool.`**

## Verification

- `bun run lint` → exit 0, no errors.
- `curl http://localhost:3000/` → HTTP 200.
- Dev server log: clean `✓ Compiled` lines, no warnings/errors.

## Notes for next agents
- The inline SettingsView now lives inside `<div className="flex min-h-0 flex-1">` — that parent is a row flex container with one child. `w-full h-full` on SettingsView makes it fill both axes correctly.
- The radix Sheet's built-in close button is reliably the last child of `SheetContent`, so `[&>button:last-child]:hidden` is a stable selector for hiding it.
- `LUCIDE_BY_ID` is currently declared twice (in vaults-sidebar.tsx and in create-vault-dialog.tsx). If a new vault icon is added to `VAULT_ICONS`, **both maps must be updated**. Consider exporting from one location in a future cleanup.
- The `setImportExportOpen` reference in `ImportTab` is kept as `void setImportExportOpen;` to avoid an unused-var lint error — it's a placeholder for future "open the legacy dialog after import" wiring.
