# Task ID: REBUILD-SETTINGS-VAULTS-LOGIN — Full-Stack React Engineer

## Context
The LCKED password manager lost many features in a sandbox reset. This task rebuilds 10 files: settings-dialog (5-tab full-page view), vaults-sidebar (sliding highlight + context menu), setup-view + unlock-view + vault-app (DotField lock screens), password-generator-dialog (tab indicator visibility), ui/sonner (toast theme matching), next.config (React Compiler), vault-view (dynamic imports), and layout.tsx (favicon — already correct).

## Files touched
- `src/lib/types.ts` — added `UnlockMethod = "master" | "pin" | "none"` + `unlockMethod` field to `VaultSettings`
- `src/components/lcked/settings-dialog.tsx` — full rewrite (~900 lines, 5 tabs)
- `src/components/lcked/vaults-sidebar.tsx` — VaultActiveHighlight + data-vault-key + ContextMenu
- `src/components/lcked/setup-view.tsx` — full rewrite (DotField + centered brand header)
- `src/components/lcked/unlock-view.tsx` — full rewrite (DotField + centered brand header)
- `src/components/lcked/vault-app.tsx` — DotField loading screen with pulsing diamond
- `src/components/lcked/password-generator-dialog.tsx` — mode-toggle styling
- `src/components/lcked/vault-view.tsx` — dynamic imports + SettingsView overlay
- `src/components/ui/sonner.tsx` — toastOptions with CSS vars
- `next.config.ts` — reactCompiler: true
- `public/icons/pm/*.svg` — 9 brand SVG icons (bitwarden, 1password, chrome, firefox, proton-pass, safari, microsoft-edge, lastpass, keeper-security)
- `package.json` — added babel-plugin-react-compiler devDep

## Key implementation choices
1. **SettingsView is a full-page overlay** rendered in vault-view via `<AnimatePresence>` + `motion.div className="fixed inset-0 z-50"`. SettingsDialog returns null as a back-compat shim. Anywhere that called `setSettingsOpen(true)` still works.
2. **VaultActiveHighlight uses the `lcked-active-glow` class** (same as item-list) — already sets `background-color: var(--accent)` and the violet glow shadow.
3. **Custom tab nav** (not TabsList/TabsTrigger) — uses `motion.div layoutId="settings-tab-indicator"` with spring stiffness 500, damping 38. Active = `text-primary`, inactive = `text-muted-foreground hover:text-foreground`.
4. **Theme flash fix** in SettingsView: `useState(() => localStorage.getItem("theme") || "dark")` initializer so the active theme card matches whatever next-themes already applied to `<html>`.
5. **OAuth is purely client-side** — clicking "Continue with Google/GitHub" just sets `localStorage["lcked-oauth-provider"]` and shows a connected state. No actual OAuth flow (intentional — LCKED is local-first).
6. **ZIP export reuses encrypted-JSON payload** with a `.zip` filename (no real zip lib).
7. **Hide vault** writes the vault id to `localStorage["lcked-hidden-vaults"]` (array). VaultsSidebar doesn't yet filter against it.

## Verification
- `bun run lint` → 0 errors, 0 warnings (exit 0)
- `bunx tsc --noEmit` → 0 errors in any file I touched. Pre-existing errors in crypto.ts, import-export.ts, totp.ts, vault.ts are unrelated (documented in REBUILD-1/2).
- Dev server: `dev.log` shows `✓ Ready in 902ms` after next.config change auto-restart, `GET / 200` responses, no runtime errors. All 9 PM icons serve 200 (sizes 286–721 bytes).

## Notes for next agents
- **`unlockMethod` is on `VaultSettings` but not yet wired into the unlock view** — the unlock screen still always asks for the master password. To honor PIN/None, branch on `settings.unlockMethod` (PIN → 6-digit input; None → silent unlock on `init()`).
- **React Compiler is on** — watch for any new memoization regressions, especially in Framer Motion `layoutId` animations.
- **PM icons** are hand-crafted simplified SVGs. If higher-fidelity brand marks are needed, replace the files in `/public/icons/pm/` with official brand SVGs (same filenames).
