"use client";

import {
  ChevronDown,
  ChevronLeft,
  CreditCard,
  Dice5,
  KeyRound,
  LayoutGrid,
  Lock,
  Palette,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  StickyNote,
  UserRound,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVault } from "@/store/vault";

import { AutoLockManager } from "./auto-lock-manager";
import { DiamondMark } from "./diamond-mark";
import { ItemDetail } from "./item-detail";
import { ItemList } from "./item-list";
import { ThemeToggle } from "./theme-toggle";
import { VaultsSidebar } from "./vaults-sidebar";

// Dynamic imports — these are large components shown only on user action, so
// split them out of the main bundle. SSR is off because they touch browser
// APIs (IndexedDB, localStorage, Framer layout animations) on mount.
const ItemEditor = dynamic(
  () => import("./item-editor").then((m) => ({ default: m.ItemEditor })),
  { ssr: false },
);
const PasswordGeneratorDialog = dynamic(
  () =>
    import("./password-generator-dialog").then((m) => ({
      default: m.PasswordGeneratorDialog,
    })),
  { ssr: false },
);
const SettingsView = dynamic(
  () => import("./settings-dialog").then((m) => ({ default: m.SettingsView })),
  { ssr: false },
);
const CreateVaultDialog = dynamic(
  () =>
    import("./create-vault-dialog").then((m) => ({
      default: m.CreateVaultDialog,
    })),
  { ssr: false },
);
import { useTheme } from "next-themes";

import type { ItemType } from "@/lib/types";

/* New-dropdown type metadata — color-coded icons for the 4 item kinds. */
const NEW_ITEM_OPTIONS: {
  type: ItemType;
  label: string;
  icon: typeof KeyRound;
  color: string;
}[] = [
  { type: "login", label: "Login", icon: KeyRound, color: "text-violet-400" },
  {
    type: "note",
    label: "Secure Note",
    icon: StickyNote,
    color: "text-amber-400",
  },
  { type: "card", label: "Card", icon: CreditCard, color: "text-emerald-400" },
  {
    type: "identity",
    label: "Identity",
    icon: UserRound,
    color: "text-sky-400",
  },
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
  const lock = useVault((s) => s.lock);

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

  // Mobile/tablet nav drawer (<xl has no vault sidebar; <lg loses every
  // other sidebar action too). One sheet re-hosts VaultsSidebar plus the
  // Generator/Settings/Theme/Lock rows so all entry points survive.
  const [navOpen, setNavOpen] = React.useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <AutoLockManager />
      <div className="bg-background flex h-screen w-full overflow-hidden">
        {/* ---------- Sidebar (3 responsive stages) ---------- */}
        {/* xl+ : full sidebar with VaultsSidebar (360px) */}
        {/* lg   : icon rail (64px) */}
        {/* < lg : hidden (mobile uses the list view directly) */}
        <aside
          className="border-border bg-sidebar hidden w-16 shrink-0 flex-col items-center border-r py-3 lg:flex xl:w-[var(--pass-sidebar-size)] xl:items-stretch xl:px-2"
          aria-label="Primary"
        >
          {/* Brand mark — diamond mark in icon rail, full lockup at xl */}
          <div className="flex items-center justify-center xl:justify-start xl:gap-2.5 xl:px-2.5 xl:pb-2">
            <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner">
              <DiamondMark size={26} />
            </div>
            <div className="hidden leading-none xl:block">
              <div className="text-base font-bold tracking-tight">
                LCK<span className="text-primary">ED</span>
              </div>
              <div className="text-muted-foreground text-[10px] tracking-[0.2em] uppercase">
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
                  className="text-muted-foreground h-9 w-9 justify-start xl:hidden"
                  onClick={() => setGeneratorOpen(true)}
                  aria-label="Password generator"
                >
                  <Dice5 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Generator</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:bg-muted/40 hover:text-foreground hidden h-9 items-center justify-start gap-2.5 px-2.5 text-sm transition-colors xl:flex"
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
                  className="text-muted-foreground h-9 w-9 justify-start xl:hidden"
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
              className="text-muted-foreground hover:bg-muted/40 hover:text-foreground hidden h-9 items-center justify-start gap-2.5 px-2.5 text-sm transition-colors xl:flex"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>

            <div className="xl:hidden">
              <ThemeToggle />
            </div>
            <LabeledThemeToggle className="text-muted-foreground hover:bg-muted/40 hover:text-foreground hidden h-9 items-center justify-start gap-2.5 px-2.5 text-sm transition-colors xl:flex" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground h-9 w-9 justify-start hover:text-signal-danger xl:hidden"
                  onClick={lock}
                  aria-label="Lock vault"
                >
                  <Lock className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Lock vault</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:bg-muted/40 hidden h-9 items-center justify-start gap-2.5 px-2.5 text-sm transition-colors hover:text-signal-danger xl:flex"
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
              <header className="border-border bg-background flex items-center gap-2 border-b px-3 py-2.5 md:px-4">
                {/* Nav drawer trigger — <xl has no vault sidebar */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground h-8 w-8 xl:hidden"
                  onClick={() => setNavOpen(true)}
                  aria-label="Open navigation"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 lg:hidden">
                {/* Mobile: brand + lock */}
                  <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                    <DiamondMark size={20} />
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground h-8 w-8 lg:hidden"
                  onClick={lock}
                  aria-label="Lock"
                >
                  <Lock className="h-4 w-4" />
                </Button>

                {/* Search input */}
                <div className="relative min-w-0 flex-1">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search vault…"
                    aria-label="Search vault items"
                    className="border-border bg-muted/40 h-9 pr-3 pl-9"
                  />
                </div>

                {/* Item count badge */}
                <span className="text-muted-foreground hidden items-center gap-1.5 text-xs md:flex">
                  <ShieldCheck className="h-3.5 w-3.5 text-signal-success" />
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
                        onSelect={() => setEditorOpen(true, null, opt.type)}
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
                  className={`border-border bg-background flex w-full shrink-0 flex-col border-r md:w-[22rem] lg:w-[25.2rem] ${
                    mobileView === "detail" ? "hidden md:flex" : "flex"
                  }`}
                  data-vault-list
                  tabIndex={-1}
                >
                  <div className="min-h-0 flex-1">
                    <ItemList onMobileBack={() => setMobileView("list")} />
                  </div>
                </section>

                {/* Detail column */}
                <section
                  className={`bg-background flex min-w-0 flex-1 flex-col ${
                    mobileView === "detail" ? "flex" : "hidden md:flex"
                  }`}
                  data-vault-detail
                  tabIndex={-1}
                >
                  {mobileView === "detail" && (
                    <div className="border-border flex items-center gap-2 border-b p-2 md:hidden">
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
            className="bg-primary text-primary-foreground shadow-primary/40 fixed right-6 bottom-6 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-xl md:hidden"
            aria-label="New item"
          >
            <Plus className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile nav drawer — vault switching + the sidebar actions that
        only exist in the desktop rail. <xl shows no vault list at all and
        <lg hides Generator/Settings/Theme/Lock, so this is their only
        entry point on phones and tablets. */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="left"
          className="bg-sidebar flex w-72 flex-col gap-1 p-3 sm:w-80"
        >
          <SheetTitle className="flex items-center gap-2.5 px-2 pb-2">
            <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner">
              <DiamondMark size={26} />
            </div>
            <div className="leading-none">
              <div className="text-base font-bold tracking-tight">
                LCK<span className="text-primary">ED</span>
              </div>
              <div className="text-muted-foreground text-[10px] tracking-[0.2em] uppercase">
                Local vault
              </div>
            </div>
          </SheetTitle>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <VaultsSidebar />
          </div>
          <div className="flex flex-col gap-1 pb-1">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:bg-muted/40 hover:text-foreground h-9 justify-start gap-2.5 px-2.5 text-sm"
              onClick={() => {
                setNavOpen(false);
                setGeneratorOpen(true);
              }}
            >
              <Dice5 className="h-4 w-4" />
              Generator
            </Button>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:bg-muted/40 hover:text-foreground h-9 justify-start gap-2.5 px-2.5 text-sm"
              onClick={() => {
                setNavOpen(false);
                setSettingsOpen(true);
              }}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <LabeledThemeToggle className="text-muted-foreground hover:bg-muted/40 hover:text-foreground h-9 justify-start gap-2.5 px-2.5 text-sm" />
            <Button
              variant="ghost"
              className="text-muted-foreground hover:bg-muted/40 h-9 justify-start gap-2.5 px-2.5 text-sm hover:text-signal-danger"
              onClick={lock}
            >
              <Lock className="h-4 w-4" />
              Lock
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialogs & overlays */}
      <ItemEditor />
      <PasswordGeneratorDialog />
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
  const nextTheme =
    THEME_CYCLE[(THEME_CYCLE.indexOf(currentTheme) + 1) % THEME_CYCLE.length];
  const label = mounted ? (THEME_LABELS[currentTheme] ?? "Theme") : "Theme";
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
