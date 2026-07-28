"use client";

import * as React from "react";
import {
  Plus,
  Lock,
  Settings,
  Dice5,
  ChevronLeft,
  ShieldCheck,
  ChevronDown,
  KeyRound,
  StickyNote,
  CreditCard,
  UserRound,
  Palette,
  Search,
} from "lucide-react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useVault } from "@/store/vault";
import { ItemList } from "./item-list";
import { ItemDetail } from "./item-detail";
import { ImportExportDialog } from "./import-export-dialog";
import { AutoLockManager } from "./auto-lock-manager";
import { ThemeToggle } from "./theme-toggle";
import { DiamondMark } from "./diamond-mark";
import { VaultsSidebar } from "./vaults-sidebar";

// Dynamic imports — these are large components shown only on user action, so
// split them out of the main bundle. SSR is off because they touch browser
// APIs (IndexedDB, localStorage, Framer layout animations) on mount.
const ItemEditor = dynamic(() => import("./item-editor").then((m) => ({ default: m.ItemEditor })), { ssr: false });
const PasswordGeneratorDialog = dynamic(() => import("./password-generator-dialog").then((m) => ({ default: m.PasswordGeneratorDialog })), { ssr: false });
const SettingsView = dynamic(() => import("./settings-dialog").then((m) => ({ default: m.SettingsView })), { ssr: false });
const CreateVaultDialog = dynamic(() => import("./create-vault-dialog").then((m) => ({ default: m.CreateVaultDialog })), { ssr: false });
import { stashNewItemType } from "./new-item-stash";
import type { FilterType, ItemType } from "@/lib/types";
import { useTheme } from "next-themes";

/* New-dropdown type metadata — color-coded icons for the 4 item kinds. */
const NEW_ITEM_OPTIONS: {
  type: ItemType;
  label: string;
  icon: typeof KeyRound;
  color: string;
}[] = [
  { type: "login", label: "Login", icon: KeyRound, color: "text-violet-400" },
  { type: "note", label: "Secure Note", icon: StickyNote, color: "text-amber-400" },
  { type: "card", label: "Card", icon: CreditCard, color: "text-emerald-400" },
  { type: "identity", label: "Identity", icon: UserRound, color: "text-sky-400" },
];

export function VaultView() {
  const items = useVault((s) => s.items);
  const selectedId = useVault((s) => s.selectedId);
  const setSelected = useVault((s) => s.setSelected);
  const setEditorOpen = useVault((s) => s.setEditorOpen);
  const setGeneratorOpen = useVault((s) => s.setGeneratorOpen);
  const setSettingsOpen = useVault((s) => s.setSettingsOpen);
  const settingsOpen = useVault((s) => s.settingsOpen);
  const searchQuery = useVault((s) => s.searchQuery);
  const setSearch = useVault((s) => s.setSearch);
  const activeVault = useVault((s) => s.activeVault);
  const setActiveVault = useVault((s) => s.setActiveVault);
  const lock = useVault((s) => s.lock);

  // Local type-filter (login/note/card/identity/all). The vault filter
  // (all/favorites/trash/<vaultId>) lives in the store; this is the secondary
  // filter shown in the list header.
  const [typeFilter, setTypeFilter] = React.useState<FilterType>("all");

  // Mobile list/detail swap. Resets to "list" when the selected item is
  // cleared (deleted, restored, moved) so the user isn't stuck on an empty
  // detail pane (VV-1).
  const [mobileView, setMobileView] = React.useState<"list" | "detail">("list");
  React.useEffect(() => {
    if (!selectedId) {
      setMobileView("list");
    } else if (window.innerWidth < 768) {
      setMobileView("detail");
    }
  }, [selectedId]);

  // Listen for "lcked:set-type-filter" events so the item-detail's type chip
  // can change the list filter (the filter lives here in vault-view, not the
  // store, so we use a window event to bridge the component gap).
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as FilterType | undefined;
      if (detail) setTypeFilter(detail);
    };
    window.addEventListener("lcked:set-type-filter", handler as EventListener);
    return () => window.removeEventListener("lcked:set-type-filter", handler as EventListener);
  }, []);

  const createItem = (type: ItemType) => {
    stashNewItemType(type);
    setEditorOpen(true);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <AutoLockManager />
        <div className="flex h-screen w-full overflow-hidden bg-background">
          {/* ---------- Sidebar (3 responsive stages) ---------- */}
          {/* xl+ : full sidebar with VaultsSidebar (360px) */}
          {/* lg   : icon rail (64px) */}
          {/* < lg : hidden (mobile uses the list view directly) */}
          <aside
            className="hidden w-16 shrink-0 flex-col items-center border-r border-border bg-sidebar py-3 lg:flex xl:w-[var(--pass-sidebar-size)] xl:items-stretch xl:px-2"
            aria-label="Primary"
          >
            {/* Brand mark — diamond mark in icon rail, full lockup at xl */}
            <div className="flex items-center justify-center xl:justify-start xl:gap-2.5 xl:px-2.5 xl:pb-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 shadow-inner">
                <DiamondMark size={26} />
              </div>
              <div className="hidden xl:block leading-none">
                <div className="text-base font-bold tracking-tight">
                  LCK<span className="text-primary">ED</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Local vault
                </div>
              </div>
            </div>

            {/* Vault list — only at xl+ */}
            <div className="hidden xl:mt-1 xl:block xl:min-h-0 xl:flex-1">
              <VaultsSidebar />
            </div>

            {/* Spacer for lg (no vault list shown) */}
            <div className="flex-1 xl:hidden" />

            {/* Bottom actions — left-aligned, icon rail at lg, labels at xl */}
            <div className="mt-auto flex flex-col items-center gap-1 xl:items-stretch xl:px-2 xl:pb-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 justify-start text-muted-foreground xl:hidden"
                    onClick={() => setGeneratorOpen(true)}
                    aria-label="Password generator"
                  >
                    <Dice5 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Generator <kbd className="ml-1 opacity-60">⌘G</kbd></TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                className="hidden h-9 items-center justify-start gap-2.5 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground xl:flex"
                onClick={() => setGeneratorOpen(true)}
                aria-label="Password generator"
              >
                <Dice5 className="h-4 w-4" />
                Generator
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 justify-start text-muted-foreground xl:hidden"
                    onClick={() => setSettingsOpen(true)}
                    aria-label="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                className="hidden h-9 items-center justify-start gap-2.5 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground xl:flex"
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>

              <div className="xl:hidden">
                <ThemeToggle />
              </div>
              <LabeledThemeToggle className="hidden h-9 items-center justify-start gap-2.5 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground xl:flex" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 justify-start text-muted-foreground hover:text-red-400 xl:hidden"
                    onClick={lock}
                    aria-label="Lock vault"
                  >
                    <Lock className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Lock vault <kbd className="ml-1 opacity-60">⌘⇧L</kbd></TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                className="hidden h-9 items-center justify-start gap-2.5 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-red-400 xl:flex"
                onClick={lock}
                aria-label="Lock vault"
              >
                <Lock className="h-4 w-4" />
                Lock
              </Button>
            </div>
          </aside>

          {/* ---------- Right area: settings (covers search+list+detail) OR search header + list/detail ---------- */}
          <div className="flex min-w-0 flex-1 flex-col">
            {settingsOpen ? (
              <SettingsView />
            ) : (
            <>
            {/* Search header — spans full width of list+detail */}
            <header className="flex items-center gap-2 border-b border-border bg-background px-3 py-2.5 md:px-4">
              {/* Mobile: brand + lock */}
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <DiamondMark size={20} />
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground lg:hidden"
                onClick={lock}
                aria-label="Lock"
              >
                <Lock className="h-4 w-4" />
              </Button>

              {/* Search input */}
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search vault…"
                  aria-label="Search vault items"
                  className="h-9 border-border bg-muted/40 pl-9 pr-3"
                />
              </div>

              {/* Item count badge */}
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                {items.filter((i) => !i.trashed).length} items
              </span>

              {/* New dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-9 gap-1.5">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">New</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-90" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {NEW_ITEM_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.type}
                      onSelect={() => createItem(opt.type)}
                    >
                      <opt.icon className={`h-4 w-4 ${opt.color}`} />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </header>

            {/* List + detail row — the settingsOpen branch is handled by the
                outer ternary above, so here we always render the list+detail. */}
            <div className="flex min-h-0 flex-1">
                {/* List column */}
                <section
                  className={`flex w-full shrink-0 flex-col border-r border-border bg-background md:w-[22rem] lg:w-[25.2rem] ${
                    mobileView === "detail" ? "hidden md:flex" : "flex"
                  }`}
                  data-vault-list
                  tabIndex={-1}
                >
                  <div className="min-h-0 flex-1">
                    <ItemList
                      filter={typeFilter}
                      setFilter={(f: FilterType) => setTypeFilter(f)}
                      activeVault={activeVault}
                      onMobileBack={() => setMobileView("list")}
                    />
                  </div>
                </section>

                {/* Detail column */}
                <section
                  className={`flex min-w-0 flex-1 flex-col bg-background ${
                    mobileView === "detail" ? "flex" : "hidden md:flex"
                  }`}
                  data-vault-detail
                  tabIndex={-1}
                >
                  {mobileView === "detail" && (
                    <div className="flex items-center gap-2 border-b border-border p-2 md:hidden">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setMobileView("list");
                          setSelected(null);
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Back
                      </Button>
                    </div>
                  )}
                  <div className="min-h-0 flex-1">
                    <ItemDetail />
                  </div>
                </section>
              </div>
            </>
            )}
          </div>
        </div>

        {/* Floating action button (mobile) — opacity-only entrance */}
        <AnimatePresence>
          {mobileView === "list" && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setEditorOpen(true)}
              className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/40 md:hidden"
              aria-label="New item"
            >
              <Plus className="h-6 w-6" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Dialogs & overlays */}
        <ItemEditor />
        <PasswordGeneratorDialog />
        <ImportExportDialog />
        <CreateVaultDialog />
    </TooltipProvider>
  );
}

/**
 * Labeled theme toggle — used in the xl sidebar so the row matches the
 * Generator/Settings/Lock rows which all show a label. The icon-only
 * ThemeToggle is used in the lg icon rail.
 */
const THEME_CYCLE: string[] = ["dark", "light", "nord", "proton"];
const THEME_LABELS: Record<string, string> = {
  dark: "Mocha",
  light: "Latte",
  nord: "Nord",
  proton: "Proton",
};

function LabeledThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const currentTheme = theme ?? "dark";
  const nextTheme = THEME_CYCLE[(THEME_CYCLE.indexOf(currentTheme) + 1) % THEME_CYCLE.length];
  const label = mounted ? THEME_LABELS[currentTheme] ?? "Theme" : "Theme";
  return (
    <Button
      variant="ghost"
      className={className}
      aria-label={`Switch theme (current: ${label})`}
      onClick={() => setTheme(nextTheme)}
    >
      <Palette className="h-4 w-4" />
      {label}
    </Button>
  );
}
