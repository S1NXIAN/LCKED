"use client";

import * as React from "react";
import {
  Search,
  KeyRound,
  StickyNote,
  CreditCard,
  UserRound,
  Lock,
  Dice5,
  Upload,
  Settings,
  Star,
  CornerDownLeft,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useVault } from "@/store/vault";
import { searchItems } from "@/lib/fuzzy-search";
import { frecencyScore, recordUse, sortByFrecency } from "@/lib/frecency";
import { ItemTypeIcon, ITEM_TYPE_LABELS } from "./item-icons";
import { useTheme } from "next-themes";
import { stashNewItemType } from "./new-item-stash";

type ItemType = "login" | "note" | "card" | "identity";

/**
 * Command palette with frecency ranking + prefix modes:
 *   `#`  → items only
 *   `>`  → commands only
 *   `/`  → navigation only
 * Default → mixed (frecency-ordered items, then commands).
 */
export function CommandPalette() {
  const open = useVault((s) => s.commandOpen);
  const setOpen = useVault((s) => s.setCommandOpen);
  const items = useVault((s) => s.items);
  const setSelected = useVault((s) => s.setSelected);
  const setEditorOpen = useVault((s) => s.setEditorOpen);
  const lock = useVault((s) => s.lock);
  const setGeneratorOpen = useVault((s) => s.setGeneratorOpen);
  const setImportExportOpen = useVault((s) => s.setImportExportOpen);
  const setSettingsOpen = useVault((s) => s.setSettingsOpen);
  const { setTheme, theme } = useTheme();

  const [query, setQuery] = React.useState("");

  // Reset query when opening.
  React.useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const prefix = query.startsWith("#") ? "items" : query.startsWith(">") ? "commands" : query.startsWith("/") ? "nav" : "all";
  const stripped = query.replace(/^[#>/]/, "").trim();

  // Items — frecency-ordered when no query, fuzzy when there is one.
  const itemResults = React.useMemo(() => {
    let list = items;
    if (stripped) list = searchItems(list, stripped);
    else list = sortByFrecency(items.map((i) => i.id)).map((id) => items.find((i) => i.id === id)!).filter(Boolean);
    return list.slice(0, 8);
  }, [items, stripped]);

  const newItem = (type: ItemType) => {
    stashNewItemType(type);
    setEditorOpen(true);
  };

  const run = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 0);
  };

  const showItems = prefix === "all" || prefix === "items";
  const showCommands = prefix === "all" || prefix === "commands";
  const showNav = prefix === "all" || prefix === "nav";

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Search items & commands…  # items · > commands · / nav"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {stripped ? "No results." : "Start typing, or use # > / prefixes."}
        </CommandEmpty>

        {showItems && itemResults.length > 0 && (
          <CommandGroup heading={stripped ? "Items" : "Recent items"}>
            {itemResults.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={() => {
                  recordUse(item.id);
                  run(() => setSelected(item.id));
                }}
                className="gap-2"
              >
                <ItemTypeIcon type={item.type} size="sm" />
                <span className="flex-1 truncate">{item.name}</span>
                {!stripped && frecencyScore(item.id) > 0 && (
                  <Star className="h-3 w-3 fill-sunset text-sunset" />
                )}
                {item.favorite && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showCommands && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Create">
              <CommandItem onSelect={() => run(() => newItem("login"))} className="gap-2">
                <KeyRound className="h-4 w-4 text-violet-400" />
                New login
                <CommandShortcut>⌘N</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => run(() => newItem("note"))} className="gap-2">
                <StickyNote className="h-4 w-4 text-amber-400" />
                New secure note
              </CommandItem>
              <CommandItem onSelect={() => run(() => newItem("card"))} className="gap-2">
                <CreditCard className="h-4 w-4 text-emerald-400" />
                New card
              </CommandItem>
              <CommandItem onSelect={() => run(() => newItem("identity"))} className="gap-2">
                <UserRound className="h-4 w-4 text-sky-400" />
                New identity
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {showNav && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => run(() => setGeneratorOpen(true))} className="gap-2">
                <Dice5 className="h-4 w-4 text-primary" />
                Generate password
                <CommandShortcut>⌘G</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => run(() => setImportExportOpen(true))} className="gap-2">
                <Upload className="h-4 w-4" />
                Import / Export
              </CommandItem>
              <CommandItem onSelect={() => run(() => setSettingsOpen(true))} className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </CommandItem>
              <CommandItem
                onSelect={() => run(() => setTheme(theme === "dark" ? "light" : "dark"))}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Toggle theme
              </CommandItem>
              <CommandItem onSelect={() => run(() => lock())} className="gap-2 text-red-400">
                <Lock className="h-4 w-4" />
                Lock vault
                <CommandShortcut>⌘⇧L</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <div className="flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] text-muted-foreground">
          <CornerDownLeft className="h-3 w-3" /> to select · ESC to close · <kbd className="font-mono">#</kbd> items <kbd className="font-mono">&gt;</kbd> commands
        </div>
      </CommandList>
    </CommandDialog>
  );
}
