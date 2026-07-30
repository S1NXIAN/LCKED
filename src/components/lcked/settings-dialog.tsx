"use client";

/**
 * LCKED — Settings (full-page tabbed view)
 * ---------------------------------------------------------------------------
 * Replaces the old modal `SettingsDialog` with a full-page, 5-tab experience:
 *
 *   • General  — theme grid + favicon / sort-favorites-to-top toggles
 *   • Security — auto-lock slider + visibility lock + change password + reset
 *   • Account  — browser extension intro + OAuth connect / disconnect
 *   • Import   — 3-col grid of password-manager source cards (file picker)
 *   • Export   — PGP-encrypted / ZIP / CSV cards
 *
 * Exports:
 *   • `SettingsView` — the full-page view used by vault-view.
 *
 * Tab navigation uses a custom segmented control with a sliding
 * `motion.div layoutId="settings-tab-indicator"` (spring stiffness 500,
 * damping 38) instead of the standard TabsList/TabsTrigger.
 *
 * Each tab component lives in its own file under ./settings/:
 *   general-tab.tsx  security-tab.tsx  account-tab.tsx
 *   import-tab.tsx   export-tab.tsx
 */

import * as React from "react";
import {
  Settings as SettingsIcon,
  ArrowLeft,
  Palette,
  ShieldCheck,
  User,
  Upload,
  Download,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useVault } from "@/store/vault";
import { cn } from "@/lib/utils";

import { GeneralTab } from "./settings/general-tab";
import { SecurityTab } from "./settings/security-tab";
import { AccountTab } from "./settings/account-tab";
import { ImportTab } from "./settings/import-tab";
import { ExportTab } from "./settings/export-tab";

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

/* ============================== SettingsView ============================== */

export function SettingsView() {
  const setOpen = useVault((s) => s.setSettingsOpen);
  const items = useVault((s) => s.items);
  const [tab, setTab] = React.useState<TabId>("general");

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      {/* Top bar: back + title + item count */}
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
              <GeneralTab />
            </TabsContent>

            <TabsContent value="security" className="m-0 space-y-6 focus-visible:outline-none">
              <SecurityTab />
            </TabsContent>

            <TabsContent value="account" className="m-0 space-y-6 focus-visible:outline-none">
              <AccountTab />
            </TabsContent>

            <TabsContent value="import" className="m-0 space-y-6 focus-visible:outline-none">
              <ImportTab />
            </TabsContent>

            <TabsContent value="export" className="m-0 space-y-6 focus-visible:outline-none">
              <ExportTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
