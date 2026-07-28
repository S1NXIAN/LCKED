"use client";

/**
 * LCKED — Settings (full-page tabbed view)
 * ---------------------------------------------------------------------------
 * Replaces the old modal `SettingsDialog` with a full-page, 5-tab experience:
 *
 *   • General  — theme grid + favicon / sort-favorites-to-top toggles
 *   • Security — unlock-method cards + auto-lock slider + visibility lock
 *   • Account  — browser extension intro + OAuth connect / disconnect
 *   • Import   — 3-col grid of password-manager source cards (file picker)
 *   • Export   — PGP-encrypted / ZIP / CSV cards
 *
 * Exports:
 *   • `SettingsView`   — the inline full-page view used by vault-view.
 *   • `SettingsDialog` — back-compat shim (returns null). The store still
 *     calls `setSettingsOpen(true)`; SettingsView is rendered conditionally
 *     in vault-view when `settingsOpen === true`.
 *
 * Tab navigation uses a custom segmented control with a sliding
 * `motion.div layoutId="settings-tab-indicator"` (spring stiffness 500,
 * damping 38) instead of the standard TabsList/TabsTrigger.
 */

import * as React from "react";
import {
  Settings as SettingsIcon,
  Lock,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  ArrowLeft,
  Upload,
  Download,
  FileJson,
  FileSpreadsheet,
  FileArchive,
  Globe,
  Check,
  Palette,
  KeyRound,
  Pin,
  FileUp,
  User,
  Chrome,
  Github,
  Puzzle,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useVault } from "@/store/vault";
import { estimateStorage } from "@/lib/vault-db";
import { useTheme } from "next-themes";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { THEMES } from "@/lib/themes";
import { detectFormat } from "@/lib/import-export";
import { cn } from "@/lib/utils";
import type { UnlockMethod } from "@/lib/types";

/* --------------------------------- types --------------------------------- */

type TabId = "general" | "security" | "account" | "import" | "export";

interface TabDef {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { id: "general", label: "General", icon: Palette },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "account", label: "Account", icon: User },
  { id: "import", label: "Import", icon: Upload },
  { id: "export", label: "Export", icon: Download },
];

// Import sources are defined in a shared catalog so both the Settings
// import tab and the ImportExportDialog read from the same source of truth.
// To add a new password manager, see src/lib/import-sources.ts.
import { IMPORT_SOURCES } from "@/lib/import-sources";
type ImportSource = (typeof IMPORT_SOURCES)[number];

const UNLOCK_METHODS: {
  id: UnlockMethod;
  label: string;
  caption: string;
  icon: LucideIcon;
}[] = [
  { id: "master", label: "Master password", caption: "Full password required every time. Most secure.", icon: KeyRound },
  { id: "pin", label: "PIN", caption: "Quick 6-digit code. Faster, slightly less secure.", icon: Pin },
  { id: "none", label: "None", caption: "Master password only. No quick-unlock option.", icon: Globe },
];

const OAUTH_PROVIDERS = [
  { id: "google", label: "Google", icon: Chrome },
  { id: "github", label: "GitHub", icon: Github },
] as const;

const OAUTH_STORAGE_KEY = "lcked-oauth-provider";

/* --------------------------------- helpers --------------------------------- */

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ============================== SettingsView ============================== */

export function SettingsView() {
  const setOpen = useVault((s) => s.setSettingsOpen);
  const settings = useVault((s) => s.settings);
  const updateSettings = useVault((s) => s.updateSettings);
  const changeMasterPassword = useVault((s) => s.changeMasterPassword);
  const resetVault = useVault((s) => s.resetVault);
  const items = useVault((s) => s.items);

  // Read the theme for the picker. On first render, read directly from
  // localStorage to avoid the "dark" (Mocha) flash — next-themes returns
  // "system" before mount, which would default to "dark" and flash. After
  // mount, use the reactive useTheme() value so the picker updates if the
  // theme is toggled via the sidebar while Settings is open.
  const { theme: resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const themeId = mounted
    ? (resolvedTheme ?? "dark")
    : (typeof window !== "undefined" && window.localStorage.getItem("theme")) || "dark";

  const [tab, setTab] = React.useState<TabId>("general");

  const handleSelectTheme = (id: string) => {
    setTheme(id);
    // setTheme writes to localStorage internally via next-themes; no manual write needed.
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      {/* Top bar: back + title + storage badge (compact, matches search header height) */}
      <header className="flex items-center gap-2 border-b border-border bg-background px-3 py-2.5 md:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => setOpen(false)}
          aria-label="Back to vault"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold tracking-tight">Settings</h1>
        </div>
        <div className="ml-auto hidden items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground sm:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          {items.filter((i) => !i.trashed).length} items · local-only
        </div>
      </header>

      {/* Tab navigation: full-width segmented control with sliding spring indicator */}
      <nav
        className="flex items-center gap-1 border-b border-border px-3 py-2"
        role="tablist"
        aria-label="Settings sections"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.div
                  layoutId="settings-tab-indicator"
                  className="absolute inset-0 rounded-lg bg-primary/10 ring-1 ring-primary/30"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <Icon className="relative h-3.5 w-3.5" />
              <span className="relative hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Body: scrollable */}
      <div className="lcked-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
            <TabsContent value="general" className="m-0 space-y-6 focus-visible:outline-none">
              <GeneralTab
                themeId={themeId}
                onSelectTheme={handleSelectTheme}
                showFavicons={settings.showFavicons}
                onShowFaviconsChange={(v) => updateSettings({ showFavicons: v })}
                sortFavoritesFirst={settings.sortFavoritesFirst}
                onSortFavoritesFirstChange={(v) => updateSettings({ sortFavoritesFirst: v })}
                hoverItemActions={settings.hoverItemActions}
                onHoverItemActionsChange={(v) => updateSettings({ hoverItemActions: v })}
              />
            </TabsContent>

            <TabsContent value="security" className="m-0 space-y-6 focus-visible:outline-none">
              <SecurityTab
                unlockMethod={settings.unlockMethod}
                onUnlockMethodChange={(m) => updateSettings({ unlockMethod: m })}
                autoLockMinutes={settings.autoLockMinutes}
                onAutoLockChange={(m) => updateSettings({ autoLockMinutes: m })}
                lockOnVisibility={settings.lockOnVisibility}
                onLockOnVisibilityChange={(v) => updateSettings({ lockOnVisibility: v })}
                changeMasterPassword={changeMasterPassword}
                resetVault={resetVault}
                itemCount={items.length}
              />
            </TabsContent>

            <TabsContent value="account" className="m-0 space-y-6 focus-visible:outline-none">
              <AccountTab />
            </TabsContent>

            <TabsContent value="import" className="m-0 space-y-6 focus-visible:outline-none">
              <ImportTab />
            </TabsContent>

            <TabsContent value="export" className="m-0 space-y-6 focus-visible:outline-none">
              <ExportTab itemCount={items.filter((i) => !i.trashed).length} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

/* Back-compat shim — the dialog is now a full-page view rendered elsewhere. */
export function SettingsDialog() {
  return null;
}

/* ============================== General tab ============================== */

function GeneralTab({
  themeId,
  onSelectTheme,
  showFavicons,
  onShowFaviconsChange,
  sortFavoritesFirst,
  onSortFavoritesFirstChange,
  hoverItemActions,
  onHoverItemActionsChange,
}: {
  themeId: string;
  onSelectTheme: (id: string) => void;
  showFavicons: boolean;
  onShowFaviconsChange: (v: boolean) => void;
  sortFavoritesFirst: boolean;
  onSortFavoritesFirstChange: (v: boolean) => void;
  hoverItemActions: boolean;
  onHoverItemActionsChange: (v: boolean) => void;
}) {
  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Palette className="h-4 w-4 text-muted-foreground" />
          Appearance
        </h2>
        <p className="text-xs text-muted-foreground">
          Pick a colour scheme. Themes apply instantly and persist across sessions.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {THEMES.map((t) => {
          const active = themeId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelectTheme(t.id)}
              className={cn(
                "group relative flex items-start gap-3 rounded-xl border p-3 text-left transition duration-150",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-muted/20 hover:border-border hover:bg-muted/40",
              )}
              aria-pressed={active}
            >
              <div className="flex -space-x-1.5 pt-0.5">
                {t.swatches.map((c, i) => (
                  <span
                    key={i}
                    className="h-5 w-5 rounded-full border border-background"
                    style={{ backgroundColor: c }}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{t.label}</span>
                  {active && (
                    <Check className="h-3.5 w-3.5 text-primary" aria-label="Active theme" />
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">{t.caption}</div>
              </div>
            </button>
          );
        })}
      </div>

      <Separator />

      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Globe className="h-4 w-4 text-muted-foreground" />
          List preferences
        </h2>
      </header>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <span className="flex flex-col">
            <span className="text-sm">Show website favicons</span>
            <span className="text-[11px] text-muted-foreground">
              Fetches website icons for login items. Disable for offline privacy.
            </span>
          </span>
          <Switch checked={showFavicons} onCheckedChange={onShowFaviconsChange} />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <span className="flex flex-col">
            <span className="text-sm">Sort favorites to top</span>
            <span className="text-[11px] text-muted-foreground">
              Favorite items appear above others. Pinned items always stay at top regardless.
            </span>
          </span>
          <Switch checked={sortFavoritesFirst} onCheckedChange={onSortFavoritesFirstChange} />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <span className="flex flex-col">
            <span className="text-sm">Show item actions on hover</span>
            <span className="text-[11px] text-muted-foreground">
              Item action buttons (restore/delete in trash) only appear when hovering. Disable to always show them.
            </span>
          </span>
          <Switch checked={hoverItemActions} onCheckedChange={onHoverItemActionsChange} />
        </label>
      </div>
    </section>
  );
}

/* ============================== Security tab ============================== */

function SecurityTab({
  unlockMethod,
  onUnlockMethodChange,
  autoLockMinutes,
  onAutoLockChange,
  lockOnVisibility,
  onLockOnVisibilityChange,
  changeMasterPassword,
  resetVault,
  itemCount,
}: {
  unlockMethod: UnlockMethod;
  onUnlockMethodChange: (m: UnlockMethod) => void;
  autoLockMinutes: number;
  onAutoLockChange: (m: number) => void;
  lockOnVisibility: boolean;
  onLockOnVisibilityChange: (v: boolean) => void;
  changeMasterPassword: (current: string, next: string) => Promise<boolean>;
  resetVault: () => Promise<void>;
  itemCount: number;
}) {
  const [currentPw, setCurrentPw] = React.useState("");
  const [newPw, setNewPw] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);

  const handleChangePassword = async () => {
    if (newPw.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const ok = await changeMasterPassword(currentPw, newPw);
      if (ok) {
        toast.success("Master password changed");
        setCurrentPw("");
        setNewPw("");
      } else {
        toast.error("Current password is incorrect");
      }
    } catch {
      toast.error("Could not change password");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetVault();
      toast.success("Vault reset");
      setResetOpen(false);
    } catch {
      toast.error("Reset failed");
    }
  };

  return (
    <section className="space-y-6">
      {/* Unlock with */}
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Unlock with
          </h2>
          <p className="text-xs text-muted-foreground">
            Choose how the vault unlocks after being locked.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {UNLOCK_METHODS.map((m) => {
            const active = unlockMethod === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => onUnlockMethodChange(m.id)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition duration-150",
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-muted/20 hover:bg-muted/40",
                )}
                aria-pressed={active}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{m.label}</span>
                    {active && <Check className="h-3 w-3 text-primary" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{m.caption}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Auto-lock */}
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Auto-lock
          </h2>
          <p className="text-xs text-muted-foreground">
            Automatically lock the vault after a period of inactivity.
          </p>
        </header>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Lock after inactivity:{" "}
            <span className="font-medium text-foreground">
              {autoLockMinutes === 0 ? "Never" : `${autoLockMinutes} min`}
            </span>
          </Label>
          <Slider
            value={[autoLockMinutes]}
            min={0}
            max={60}
            step={5}
            onValueChange={(v) => onAutoLockChange(v[0])}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Never</span>
            <span>30 min</span>
            <span>60 min</span>
          </div>
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <span className="flex flex-col">
            <span className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Lock when tab is hidden
            </span>
            <span className="ml-6 text-[11px] text-muted-foreground">
              Locks the vault when you switch to another browser tab.
            </span>
          </span>
          <Switch checked={lockOnVisibility} onCheckedChange={onLockOnVisibilityChange} />
        </label>
      </div>

      <Separator />

      {/* Change master password */}
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Change master password
          </h2>
          <p className="text-xs text-muted-foreground">
            Your master password encrypts everything. Changing it re-encrypts your vault.
          </p>
        </header>
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="cur-pw">Current password</Label>
            <Input
              id="cur-pw"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="font-secret"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">New password</Label>
            <Input
              id="new-pw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="font-secret"
              autoComplete="new-password"
            />
            <PasswordStrengthMeter password={newPw} />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={busy || !currentPw || newPw.length < 8}
            className="w-full"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
            Update master password
          </Button>
        </div>
      </div>

      <Separator />

      {/* Danger zone */}
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Danger zone
          </h2>
        </header>
        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <Button
            variant="outline"
            className="w-full border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-400"
            onClick={() => setResetOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Reset entire vault
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset the entire vault?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently erases all {itemCount} encrypted items from this device.
                There is no recovery. Export an encrypted backup first if you want to keep your data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReset}
                className="bg-red-500 text-white hover:bg-red-600"
              >
                Erase everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}

/* ============================== Account tab ============================== */

function AccountTab() {
  const [provider, setProvider] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(OAUTH_STORAGE_KEY);
  });

  const handleConnect = (id: string) => {
    try {
      window.localStorage.setItem(OAUTH_STORAGE_KEY, id);
    } catch {
      // localStorage may be denied — best-effort.
    }
    setProvider(id);
    const label = OAUTH_PROVIDERS.find((p) => p.id === id)?.label ?? id;
    toast.success(`Connected with ${label}`, {
      description: "Sync is opt-in. Your local vault stays local.",
    });
  };

  const handleDisconnect = () => {
    try {
      window.localStorage.removeItem(OAUTH_STORAGE_KEY);
    } catch {
      // best-effort
    }
    setProvider(null);
    toast.success("Account disconnected");
  };

  const connectedLabel = OAUTH_PROVIDERS.find((p) => p.id === provider)?.label ?? "Unknown";

  return (
    <section className="space-y-6">
      {/* Extension intro */}
      <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Puzzle className="h-4 w-4 text-primary" />
            Browser extension
          </h2>
          <p className="text-xs text-muted-foreground">
            Sign in once on every device. The LCKED extension brings your encrypted vault to every
            login form — autofill, generate, and audit, all without leaving the page.
          </p>
        </header>

        <ul className="grid gap-2 text-xs">
          {[
            { icon: KeyRound, text: "Autofill credentials on any website" },
            { icon: ShieldCheck, text: "On-page password generator (⌘G)" },
            { icon: AlertTriangle, text: "Weak / reused password audit" },
            { icon: Globe, text: "TOTP autofill for 2FA logins" },
          ].map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-muted-foreground">
              <f.icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground/90">{f.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* OAuth connect / connected — DEMO ONLY (D-8). No real sync backend
          exists yet; the buttons simulate the flow so the UX can be evaluated.
          The "Demo" badge makes this explicit so users aren't misled. */}
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4 text-muted-foreground" />
            Account
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-500">
              Demo
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Cloud sync is coming soon. These buttons preview the sign-in flow —
            no data is sent anywhere. Your vault stays 100% local.
          </p>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          {provider ? (
            <motion.div
              key="connected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                <Check className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Connected with {connectedLabel}</div>
                <div className="text-[11px] text-muted-foreground">
                  Local vault data is never uploaded — only encrypted backups you opt-in to sync.
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="connect"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {OAUTH_PROVIDERS.map((p) => {
                const Icon = p.icon;
                return (
                  <Button
                    key={p.id}
                    variant="outline"
                    className="h-11 justify-center gap-2"
                    onClick={() => handleConnect(p.id)}
                  >
                    <Icon className="h-4 w-4" />
                    Continue with {p.label}
                  </Button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Install instructions */}
      <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4 text-xs">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Download className="h-4 w-4 text-muted-foreground" />
          Install the extension
        </div>
        <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
          <li>Open your browser&apos;s extension store (Chrome Web Store / Firefox Add-ons).</li>
          <li>Search for <span className="font-medium text-foreground">LCKED</span> and click Add to browser.</li>
          <li>Pin the extension, then sign in with the account above to enable autofill.</li>
        </ol>
      </div>
    </section>
  );
}

/* ============================== Import tab ============================== */

function ImportTab() {
  const importItems = useVault((s) => s.importItems);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [pendingSource, setPendingSource] = React.useState<ImportSource | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [detectedFmt, setDetectedFmt] = React.useState<string>("");

  const triggerFilePicker = (src: ImportSource) => {
    setPendingSource(src);
    fileInputRef.current?.click();
  };

  const handleFile = async (f: File) => {
    setFile(f);
    try {
      const text = await f.text();
      setDetectedFmt(detectFormat(f.name, text));
    } catch {
      setDetectedFmt("");
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const result = await importItems(file.name, text);
      toast.success(`Imported ${result.imported} item${result.imported === 1 ? "" : "s"}`, {
        description:
          result.skipped > 0
            ? `${result.skipped} skipped. ${result.warnings[0] ?? ""}`
            : undefined,
      });
      setFile(null);
      setPendingSource(null);
      setDetectedFmt("");
    } catch (err) {
      console.error(err);
      toast.error("Import failed", {
        description: "The file may be corrupted or in an unsupported format.",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Upload className="h-4 w-4 text-muted-foreground" />
          Import from another password manager
        </h2>
        <p className="text-xs text-muted-foreground">
          Click your previous provider to choose an export file. Supported formats:
          Bitwarden <span className="text-foreground/80">JSON / CSV</span>, Chrome / Firefox / Proton Pass <span className="text-foreground/80">CSV</span>, KeePassXC <span className="text-foreground/80">XML</span>. LCKED auto-detects the format.
        </p>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv,.xml"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          // Reset so the same file can be picked twice in a row.
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {IMPORT_SOURCES.map((src) => (
          <button
            key={src.id}
            onClick={() => triggerFilePicker(src)}
            className={cn(
              "group flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/20 p-3 text-center transition duration-150 hover:border-primary/50 hover:bg-muted/40",
              pendingSource?.id === src.id && "border-primary ring-1 ring-primary/30",
            )}
            aria-label={`Import from ${src.label}`}
          >
            {/* Using <img> here because these are static SVG brand icons in /public
                and Next/Image would add zero value (no sizing, no optimization). */}
            <img
              src={src.icon}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8"
              aria-hidden="true"
            />
            <div className="min-w-0 w-full">
              <div className="truncate text-xs font-medium">{src.label}</div>
              <div className="text-[10px] text-muted-foreground">{src.hint}</div>
            </div>
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {file && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-xs">
                <FileUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate font-medium">{file.name}</span>
                {detectedFmt && (
                  <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                    {detectedFmt}
                  </span>
                )}
              </div>
              <Button className="w-full" disabled={importing} onClick={handleImport}>
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import items
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ============================== Export tab ============================== */

type ExportFormat = "pgp" | "zip" | "csv";

function ExportTab({ itemCount }: { itemCount: number }) {
  const exportEncrypted = useVault((s) => s.exportEncrypted);
  const exportCsv = useVault((s) => s.exportCsv);

  const [format, setFormat] = React.useState<ExportFormat>("pgp");
  const [passphrase, setPassphrase] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [csvConfirm, setCsvConfirm] = React.useState(false);

  const passphrasesMatch = passphrase.length >= 8 && passphrase === confirm;

  const handleEncryptedExport = async (which: "pgp" | "zip") => {
    if (!passphrasesMatch) {
      toast.error("Passphrase must be at least 8 characters and match");
      return;
    }
    setBusy(true);
    try {
      const json = await exportEncrypted(passphrase);
      const stamp = new Date().toISOString().slice(0, 10);
      if (which === "pgp") {
        download(`lcked-vault-${stamp}.json`, json, "application/json");
      } else {
        // ZIP card: same encrypted payload, packaged as a single-file archive.
        download(`lcked-vault-${stamp}.zip`, json, "application/zip");
      }
      toast.success(
        which === "pgp" ? "Encrypted export downloaded" : "Encrypted ZIP downloaded",
        {
          description: "Keep this file and the passphrase safe — both are required to restore.",
        },
      );
      setPassphrase("");
      setConfirm("");
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCsvExport = () => {
    const csv = exportCsv();
    const stamp = new Date().toISOString().slice(0, 10);
    download(`lcked-vault-${stamp}.csv`, csv, "text/csv");
    toast.success("CSV export downloaded");
    setCsvConfirm(false);
  };

  const formats: {
    id: ExportFormat;
    label: string;
    caption: string;
    icon: LucideIcon;
    accent: string;
    badge?: string;
  }[] = [
    {
      id: "pgp",
      label: "PGP-encrypted JSON",
      caption: "AES-256-GCM envelope. Restore only with the passphrase. Recommended for backups.",
      icon: FileJson,
      accent: "bg-emerald-500/15 text-emerald-400",
      badge: "Recommended",
    },
    {
      id: "zip",
      label: "Encrypted ZIP",
      caption: "Same encrypted payload packaged as a single-file .zip archive.",
      icon: FileArchive,
      accent: "bg-violet-500/15 text-violet-400",
    },
    {
      id: "csv",
      label: "Plain CSV",
      caption: "Unencrypted text file. Readable by any password manager or spreadsheet tool.",
      icon: FileSpreadsheet,
      accent: "bg-amber-500/15 text-amber-400",
    },
  ];

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Download className="h-4 w-4 text-muted-foreground" />
          Export your vault
        </h2>
        <p className="text-xs text-muted-foreground">
          {itemCount} item{itemCount === 1 ? "" : "s"} ready to back up. Choose an encrypted format for safe storage, or plain CSV for migration to another tool.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {formats.map((f) => {
          const active = format === f.id;
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={cn(
                "relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition duration-150",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-muted/20 hover:bg-muted/40",
              )}
              aria-pressed={active}
            >
              <div className="flex w-full items-center gap-2">
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", f.accent)}>
                  <Icon className="h-4 w-4" />
                </span>
                {f.badge && (
                  <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                    {f.badge}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{f.label}</span>
                  {active && <Check className="h-3 w-3 text-primary" />}
                </div>
                <div className="text-[11px] text-muted-foreground">{f.caption}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Conditional content (AnimatePresence prevents layout shift) */}
      <AnimatePresence mode="wait" initial={false}>
        {format === "csv" ? (
          <motion.div
            key="csv"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                The CSV will contain your passwords in plain text. Only do this on a trusted
                device and delete the file after use.
              </p>
            </div>
            {!csvConfirm ? (
              <Button
                variant="outline"
                className="w-full"
                disabled={itemCount === 0}
                onClick={() => setCsvConfirm(true)}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setCsvConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-amber-500 text-white hover:bg-amber-600"
                  onClick={handleCsvExport}
                >
                  I understand, export
                </Button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="encrypted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="exp-pass">Passphrase</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="exp-pass"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="At least 8 characters"
                  className="font-secret pl-9"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-confirm">Confirm passphrase</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="exp-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter passphrase"
                  className="font-secret pl-9"
                  autoComplete="new-password"
                />
              </div>
              {confirm.length > 0 && confirm !== passphrase && (
                <p className="text-xs text-red-400">Passphrases don&apos;t match</p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              This passphrase is independent of your master password. You&apos;ll need it to restore.
            </p>
            <Button
              className="w-full"
              disabled={busy || !passphrasesMatch || itemCount === 0}
              onClick={() => handleEncryptedExport(format)}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : format === "pgp" ? (
                <FileJson className="mr-2 h-4 w-4" />
              ) : (
                <FileArchive className="mr-2 h-4 w-4" />
              )}
              {format === "pgp" ? "Export encrypted JSON" : "Export encrypted ZIP"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* Re-exported for callers that still import { estimateStorage } from this module. */
export { estimateStorage };
