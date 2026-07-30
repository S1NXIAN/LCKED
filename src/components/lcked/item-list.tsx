"use client";

import * as React from "react";
import {
  Star,
  Trash2,
  RotateCcw,
  CheckSquare,
  Square,
  X,
  FolderInput,
  CopyPlus,
  ChevronDown,
  ArrowUpDown,
  LayoutGrid,
  MoreVertical,
  KeyRound,
  StickyNote,
  CreditCard,
  UserRound,
  Mail,
  User,
  Pencil,
  Copy,
  Link2,
  Plus,
  Check,
  Clock,
  History,
  ArrowDownAZ,
  ArrowUpAZ,
  ListChecks,
  Pin,
  PinOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { cn, isEmail } from "@/lib/utils";
import { useVault, copyWithAutoClear } from "@/store/vault";
import { searchItems } from "@/lib/fuzzy-search";
import { ActiveHighlight } from "./active-highlight";
import { toast } from "sonner";
import type { FilterType, ItemType, VaultItem } from "@/lib/types";
import { ItemTypeIcon, ITEM_TYPE_LABELS, ITEM_TYPE_ICONS, ITEM_TYPE_COLORS } from "./item-icons";
import { DiamondMark } from "./diamond-mark";
import { FaviconIcon } from "./favicon-icon";
import { VaultIcon } from "./vaults-sidebar";
import { stashNewItemType } from "./new-item-stash";

/* ------------------------------- helpers ------------------------------- */

type SortKey = "newest" | "oldest" | "alphabetical" | "reverseAlpha";

const TYPE_OPTIONS: { value: "all" | ItemType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "all", label: "All", icon: LayoutGrid },
  { value: "login", label: "Logins", icon: KeyRound },
  { value: "note", label: "Notes", icon: StickyNote },
  { value: "card", label: "Cards", icon: CreditCard },
  { value: "identity", label: "Identities", icon: UserRound },
];

const SORT_OPTIONS: { value: SortKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "newest", label: "Newest", icon: Clock },
  { value: "oldest", label: "Oldest", icon: History },
  { value: "alphabetical", label: "A–Z", icon: ArrowDownAZ },
  { value: "reverseAlpha", label: "Z–A", icon: ArrowUpAZ },
];

function subtitle(item: VaultItem): string {
  switch (item.type) {
    case "login":
      return item.details.username || item.details.urls[0] || "—";
    case "note":
      return (item.details.content || "Empty note").replace(/\n/g, " ").trim();
    case "card":
      return (
        item.details.brand ||
        item.details.number.slice(-4).padStart(item.details.number.length, "•") ||
        "—"
      );
    case "identity":
      return [item.details.firstName, item.details.lastName].filter(Boolean).join(" ") || item.details.email || "—";
  }
}

/* --------------------------- TypeSelectItem ---------------------------- */

/**
 * Custom SelectItem for the Type filter. Renders a leading type icon
 * OUTSIDE the ItemText (so it does NOT get cloned into the trigger by
 * radix SelectValue) + its own check indicator.
 *
 * Layout in the dropdown: [type-icon] [label] ……… [check]
 * The trigger shows only the cloned text (label), centered.
 */
function TypeSelectItem({
  value,
  icon: Icon,
  label,
}: {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      )}
    >
      {/* Icon is OUTSIDE ItemText so radix does NOT clone it into the trigger. */}
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-3.5 w-3.5 text-primary" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

/* ------------------------------- ItemList ------------------------------ */

export function ItemList({
  filter,
  setFilter,
  activeVault: activeVaultProp,
  onMobileBack,
}: {
  /** Type filter (All / Login / Note / Card / Identity). */
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  /** Active vault filter from the store — passed explicitly so the list re-
   *  renders when the sidebar switches between All/Favorites/Trash/vault. */
  activeVault?: string;
  /** Mobile-only callback when the user taps Back from a Trash detail. */
  onMobileBack?: () => void;
}) {
  // Store hooks — we read activeVault directly here as well so the list
  // always re-renders even if a parent forgets to thread the prop through.
  const items = useVault((s) => s.items);
  const vaults = useVault((s) => s.vaults);
  const selectedId = useVault((s) => s.selectedId);
  const setSelected = useVault((s) => s.setSelected);
  const searchQuery = useVault((s) => s.searchQuery);
  const setEditorOpen = useVault((s) => s.setEditorOpen);
  const trashItem = useVault((s) => s.trashItem);
  const restoreItem = useVault((s) => s.restoreItem);
  const permanentlyDeleteItem = useVault((s) => s.permanentlyDeleteItem);
  const moveItemToVault = useVault((s) => s.moveItemToVault);
  const copyItemToVault = useVault((s) => s.copyItemToVault);
  const toggleFavorite = useVault((s) => s.toggleFavorite);
  const togglePin = useVault((s) => s.togglePin);
  const sortFavoritesFirst = useVault((s) => s.settings.sortFavoritesFirst);
  const hoverItemActions = useVault((s) => s.settings.hoverItemActions);
  const blurEmailMode = useVault((s) => s.settings.blurEmailMode);

  // Always subscribe to activeVault reactively (IL-1). The prop is kept for
  // backwards-compat but the store subscription is the source of truth —
  // `useVault.getState()` is NOT reactive and would miss vault switches.
  const storeActiveVault = useVault((s) => s.activeVault);
  const activeVault = activeVaultProp ?? storeActiveVault;
  const isTrashView = activeVault === "trash";

  // Sort persistence — read the initial value from localStorage so the
  // user's last sort preference survives reloads.
  const [sort, setSortState] = React.useState<SortKey>(() => {
    if (typeof window === "undefined") return "newest";
    const stored = window.localStorage.getItem("lcked-sort") as SortKey | null;
    return stored === "newest" || stored === "oldest" || stored === "alphabetical" || stored === "reverseAlpha"
      ? stored
      : "newest";
  });
  const setSort = React.useCallback((next: SortKey) => {
    setSortState(next);
    try {
      window.localStorage.setItem("lcked-sort", next);
    } catch {
      // localStorage may be denied (private mode, etc.) — best-effort.
    }
  }, []);

  const [multiSelect, setMultiSelect] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  // Reset multi-select whenever we leave multi-select mode.
  React.useEffect(() => {
    if (!multiSelect) setSelectedIds(new Set());
  }, [multiSelect]);
  // Reset multi-select when the active vault filter changes (IL-3) so stale
  // selections from e.g. Trash don't leak into "All Items".
  React.useEffect(() => {
    setMultiSelect(false);
    setSelectedIds(new Set());
  }, [activeVault]);
  // Listen for the "lcked:exit-multi-select" custom event — dispatched by the
  // vaults-sidebar drop targets after a successful multi-select drag-drop so
  // the list exits multi-select mode (the items have been moved/trashed).
  React.useEffect(() => {
    const handler = () => {
      setMultiSelect(false);
      setSelectedIds(new Set());
    };
    window.addEventListener("lcked:exit-multi-select", handler);
    return () => window.removeEventListener("lcked:exit-multi-select", handler);
  }, []);

  // Deferred search query — keeps typing responsive on large vaults by
  // letting the filter/sort work happen at lower priority.
  const deferredSearch = React.useDeferredValue(searchQuery);

  // List ref for the shared ActiveHighlight.
  const listRef = React.useRef<HTMLUListElement | null>(null);

  /* --------------------------- filtering + sorting --------------------------- */
  const filtered = React.useMemo(() => {
    let list = items;
    // Vault-level filter.
    if (activeVault === "trash") list = list.filter((i) => i.trashed);
    else if (activeVault === "favorites") list = list.filter((i) => !i.trashed && i.favorite);
    else if (activeVault && activeVault !== "all")
      list = list.filter((i) => !i.trashed && i.vaultIds.includes(activeVault));
    else list = list.filter((i) => !i.trashed);
    // Type filter (secondary, list-header dropdown).
    if (filter !== "all" && typeof filter === "string") {
      list = list.filter((i) => i.type === filter);
    }
    // Fuzzy search.
    list = searchItems(list, deferredSearch);
    // Sort. Priority order (highest first):
    //   1. Favorite (only when sortFavoritesFirst is on)
    //   2. Pinned    (ALWAYS — pin is independent of the favorites toggle)
    //   3. Primary sort (newest / oldest / A–Z / Z–A)
    // Edge cases:
    //   - starred + pinned → sorted as favorite (higher priority wins)
    //   - !sortFavoritesFirst → favorites sort normally, pins still sort to top
    const sorted = [...list];
    sorted.sort((a, b) => {
      const aFav = sortFavoritesFirst && a.favorite;
      const bFav = sortFavoritesFirst && b.favorite;
      if (aFav !== bFav) return aFav ? -1 : 1;
      // Both are favorites OR both are non-favorites → check pinned.
      // Pin ALWAYS sorts to top — it's independent of sortFavoritesFirst.
      const aPin = a.pinned ?? false;
      const bPin = b.pinned ?? false;
      if (aPin !== bPin) return aPin ? -1 : 1;
      // Primary sort.
      if (sort === "newest") return b.updatedAt - a.updatedAt;
      if (sort === "oldest") return a.updatedAt - b.updatedAt;
      if (sort === "reverseAlpha") return b.name.localeCompare(a.name);
      return a.name.localeCompare(b.name); // alphabetical (A–Z)
    });
    return sorted;
  }, [items, activeVault, filter, deferredSearch, sort, sortFavoritesFirst]);

  // Scroll-into-view when selection changes via keyboard. Scoped to the list
  // (IL-6) so it doesn't find elements in other list instances.
  React.useEffect(() => {
    if (!selectedId) return;
    const el = listRef.current?.querySelector(`[data-item-id="${CSS.escape(selectedId)}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  /* --------------------------- multi-select actions --------------------------- */
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  // Select-all ALSO enables multi-select mode. Without this, the IDs were
  // set but `multiSelect` stayed false — so checkboxes didn't render on
  // rows and the multi-select action bar (Cancel / Actions) didn't appear,
  // leaving the user with an invisible selection they couldn't act on.
  const selectAll = () => {
    setMultiSelect(true);
    setSelectedIds(new Set(filtered.map((i) => i.id)));
  };
  const deselectAll = () => setSelectedIds(new Set());

  const handleMultiTrash = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => trashItem(id)));
      toast.success(`Moved ${ids.length} to Trash`);
      setMultiSelect(false);
    } catch {
      toast.error("Could not move items");
    }
  };
  const handleMultiMove = async (vaultId: string | null) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => moveItemToVault(id, vaultId)));
      const label =
        vaultId === null
          ? "All Items"
          : vaults.find((v) => v.id === vaultId)?.name ?? "vault";
      toast.success(`Moved ${ids.length} to ${label}`);
      setMultiSelect(false);
    } catch {
      toast.error("Could not move items");
    }
  };
  const handleMultiRestore = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => restoreItem(id)));
      toast.success(`Restored ${ids.length} item${ids.length === 1 ? "" : "s"}`);
      setMultiSelect(false);
    } catch {
      toast.error("Could not restore items");
    }
  };
  const handleMultiDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => permanentlyDeleteItem(id)));
      toast.success(`Permanently deleted ${ids.length} item${ids.length === 1 ? "" : "s"}`);
      setMultiSelect(false);
    } catch {
      toast.error("Could not delete items");
    }
  };

  /* ------------------------------- item helpers ------------------------------- */
  // Helper used by the empty-area context menu (and any other caller that
  // wants to spawn the editor pre-seeded with a type).
  const createItem = React.useCallback((type: ItemType) => {
    stashNewItemType(type);
    setEditorOpen(true);
  }, [setEditorOpen]);

  const copyField = React.useCallback(
    async (value: string | undefined, label: string) => {
      if (!value) return;
      try {
        await copyWithAutoClear(value, label);
        toast.success(`${label} copied`, { description: "Auto-clears in 30s" });
      } catch {
        toast.error("Clipboard access denied");
      }
    },
    [],
  );

  /* ------------------------------- rendering ------------------------------- */
  return (
    <div className="flex h-full flex-col">
      {/* Filter bar — type + sort + multi-select menu */}
      <div className="border-b border-border bg-background px-3 py-2">
        <div className="flex items-center gap-2">
          <Select
            value={typeof filter === "string" ? filter : "all"}
            onValueChange={(v) => setFilter(v as FilterType)}
          >
            {/* Trigger: [icon left] [text centered in remaining space] [chevron]
                The icon is rendered explicitly on the left; the SelectValue
                (which clones only the label text, NOT the icon) is flex-1 +
                text-center so the label centers in the space between the icon
                and the chevron. */}
            <SelectTrigger size="sm" className="h-8 w-[142px] shrink-0 border-border bg-muted/40 dark:bg-secondary/20">
              {(() => {
                const ActiveIcon = TYPE_OPTIONS.find((o) => o.value === (typeof filter === "string" ? filter : "all"))?.icon ?? LayoutGrid;
                return <ActiveIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
              })()}
              <SelectValue placeholder="Type" className="flex-1 text-center" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <TypeSelectItem
                  key={opt.value}
                  value={opt.value}
                  icon={opt.icon}
                  label={opt.label}
                />
              ))}
            </SelectContent>
          </Select>
          {/* Sort dropdown — outline + muted/40 + border-border to match
              the type Select. The trigger shows the ACTIVE sort's icon (not
              a generic ArrowUpDown) so the current sort is readable at a
              glance. Each item in the menu carries its own icon + a check on
              the active option. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 border-border bg-muted/40 px-2.5 hover:bg-muted/60 dark:bg-secondary/20"
              >
                {(() => {
                  const TriggerIcon = SORT_OPTIONS.find((o) => o.value === sort)?.icon ?? ArrowUpDown;
                  return <TriggerIcon className="h-3.5 w-3.5 text-muted-foreground" />;
                })()}
                <span className="text-xs">{SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort"}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {SORT_OPTIONS.map((opt) => {
                const OptIcon = opt.icon;
                const isActive = sort === opt.value;
                return (
                  <DropdownMenuItem
                    key={opt.value}
                    onSelect={() => setSort(opt.value)}
                    className="gap-2 text-xs"
                  >
                    <OptIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {opt.label}
                    {isActive && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 3-dots multi-select + select-all menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="List actions"
                aria-pressed={multiSelect}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => setMultiSelect((m) => !m)}>
                <CheckSquare className="h-3.5 w-3.5" />
                {multiSelect ? "Exit multi-select" : "Multi-select"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={selectAll} disabled={filtered.length === 0}>
                <ListChecks className="h-3.5 w-3.5" />
                Select all
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={deselectAll} disabled={selectedIds.size === 0}>
                <Square className="h-3.5 w-3.5" />
                Deselect all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

      </div>

      {/* Multi-select action bar — opacity + translateY (transform) only,
          never height. Keeps the layout stable and the animation GPU-composited. */}
      <AnimatePresence>
        {multiSelect && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }}
            className="overflow-hidden border-b border-border bg-muted/40"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2" onClick={() => setMultiSelect(false)}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              {/* "N Item(s) selected" — fixed minWidth prevents layout
                  shift as the count changes between 0/1/many. */}
              <span
                className="text-xs text-muted-foreground"
                style={{ minWidth: 130, display: "inline-block" }}
              >
                {selectedIds.size} Item{selectedIds.size === 1 ? "" : "s"} selected
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                {/* Single Actions dropdown — combines Move + Trash/Restore/Delete */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2" disabled={selectedIds.size === 0}>
                      Actions
                      <ChevronDown className="h-3 w-3 opacity-90" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {/* Move to vault submenu */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <FolderInput className="h-3.5 w-3.5" />
                        Move to vault
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-44">
                        <DropdownMenuItem onSelect={() => handleMultiMove(null)}>
                          All Items
                        </DropdownMenuItem>
                        {vaults.map((v) => (
                          <DropdownMenuItem key={v.id} onSelect={() => handleMultiMove(v.id)}>
                            {v.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    {isTrashView ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={handleMultiRestore}>
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore all
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={handleMultiDelete}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete permanently
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={handleMultiTrash}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Move to trash
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List — wrapped in a ContextMenu so right-clicking empty space
          offers quick "New Login/Note/Card/Identity" actions. */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="lcked-scroll min-h-0 flex-1 overflow-y-auto"
            // Suppress native listbox typeahead: pressing bare number keys
            // (0–9) inside a role="listbox" can move the browser's implicit
            // selection / focus, which surfaces as an unwanted active-indicator
            // border. We preventDefault on bare digit keys so only our own
            // keybinds (which require ⌘/Ctrl for ⌘1–⌘9) move selection.
            onKeyDown={(e) => {
              if (/^[0-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
              }
            }}
          >
            <div className="p-2">
              {filtered.length === 0 ? (
                <EmptyList
                  hasItems={items.length > 0}
                  isTrash={isTrashView}
                  onCreate={() => createItem("login")}
                />
              ) : (
                <ul
                  ref={listRef}
                    className="relative space-y-0.5"
                    role="listbox"
                    aria-label="Vault items"
                  >
                    {/* Single persistent highlight — slides between active
                        items via rAF spring. Shared with the vaults-sidebar
                        (see src/components/lcked/active-highlight.tsx). The
                        highlight lives INSIDE the <ul> (which is inside the
                        scroll area) so it is naturally clipped by overflow
                        when the active row scrolls out of view. */}
                    <ActiveHighlight
                      containerRef={listRef}
                      activeKey={multiSelect ? null : selectedId}
                      selectorAttr="data-item-id"
                    />
                    <AnimatePresence initial={false}>
                      {filtered.map((item) => {
                        const active = item.id === selectedId && !multiSelect;
                        const checked = selectedIds.has(item.id);
                        return (
                          <motion.li
                            key={item.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.1, ease: "easeOut" }}
                            data-item-id={item.id}
                            className="relative"
                          >
                            <ItemRow
                              item={item}
                              active={active}
                              checked={checked}
                              multiSelect={multiSelect}
                              isTrashView={isTrashView}
                              hoverItemActions={hoverItemActions}
                              blurEmailMode={blurEmailMode}
                              activeVaultId={activeVault}
                              vaults={vaults}
                              // In multi-select mode, dragging a SELECTED row
                              // carries ALL selected IDs. Dragging an unselected
                              // row carries just its own id (single-item drag).
                              dragIds={
                                multiSelect && checked
                                  ? Array.from(selectedIds)
                                  : [item.id]
                              }
                              onPick={() =>
                                multiSelect ? toggleSelected(item.id) : setSelected(item.id)
                              }
                              onToggleSelected={() => toggleSelected(item.id)}
                              onRestore={() =>
                                restoreItem(item.id).then(() =>
                                  toast.success("Item restored"),
                                )
                              }
                              onPermanentDelete={() =>
                                permanentlyDeleteItem(item.id).then(() =>
                                  toast.success("Permanently deleted"),
                                )
                              }
                              onCopyField={copyField}
                              onToggleFavorite={() => toggleFavorite(item.id)}
                              onTogglePin={() => togglePin(item.id)}
                              onEdit={() => setEditorOpen(true, item.id)}
                              onTrash={() =>
                                trashItem(item.id).then(() =>
                                  toast.success("Moved to Trash"),
                                )
                              }
                              onCopyToVault={(vaultId) =>
                                copyItemToVault(item.id, vaultId).then(() =>
                                  toast.success(`Copied to ${vaults.find((v) => v.id === vaultId)?.name ?? "vault"}`),
                                )
                              }
                            />
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Plus className="h-3.5 w-3.5" />
              Create item
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {(Object.keys(ITEM_TYPE_LABELS) as ItemType[]).map((t) => {
                const Icon = ITEM_TYPE_ICONS[t];
                return (
                  <ContextMenuItem key={t} onSelect={() => createItem(t)}>
                    <Icon className={cn("h-3.5 w-3.5", ITEM_TYPE_COLORS[t])} />
                    {ITEM_TYPE_LABELS[t]}
                  </ContextMenuItem>
                );
              })}
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>

      {/* Mobile back hint (only in trash view, for screen-reader friendliness) */}
      {isTrashView && onMobileBack && (
        <button
          onClick={onMobileBack}
          className="sr-only focus:not-sr-only"
        >
          Back to All Items
        </button>
      )}
    </div>
  );
}

/* ------------------------------- ItemRow ------------------------------- */

/**
 * The per-item row, extracted so it can carry its own ContextMenu without
 * forcing the parent map to re-render every row when one is right-clicked.
 */
function ItemRow({
  item,
  active,
  checked,
  multiSelect,
  isTrashView,
  hoverItemActions,
  blurEmailMode,
  activeVaultId,
  vaults,
  dragIds,
  onPick,
  onToggleSelected,
  onRestore,
  onPermanentDelete,
  onCopyField,
  onToggleFavorite,
  onTogglePin,
  onEdit,
  onTrash,
  onCopyToVault,
}: {
  item: VaultItem;
  active: boolean;
  checked: boolean;
  multiSelect: boolean;
  isTrashView: boolean;
  hoverItemActions: boolean;
  blurEmailMode: "off" | "hover" | "full";
  /** The current vault filter id ("all" | "favorites" | "trash" | vaultId). */
  activeVaultId: string;
  /** All user-defined vaults — for the "Copy to vault" submenu. */
  vaults: { id: string; name: string; icon: string; color: string }[];
  /** IDs to move when this row is dragged. In multi-select mode, if this row
   *  is selected, ALL selected IDs are moved. If not selected, just this one
   *  (and it's added to the selection first). Single-select: just this id. */
  dragIds: string[];
  onPick: () => void;
  onToggleSelected: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
  onCopyField: (value: string | undefined, label: string) => void;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onTrash: () => void;
  /** Duplicate the item into a target vault. The copy is a fully independent
   *  record — deleting it does NOT affect the original. */
  onCopyToVault: (vaultId: string) => void;
}) {
  // Per-item context menu — wraps the button so left-click still picks the
  // item, and right-click opens the context menu with copy/edit/etc.
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={(e) => {
            // Only respond to left-clicks (button === 0). Right-clicks
            // (button === 2) open the context menu — we must NOT fire onPick
            // here, otherwise the selection change re-renders the list and
            // the context menu loses its anchor / closes immediately.
            if (e.button !== 0) return;
            onPick();
          }}
          onContextMenu={(e) => {
            // Prevent the list-level ContextMenu from also firing when
            // right-clicking an item row — only the item's own ContextMenu
            // should open.
            e.stopPropagation();
          }}
          role="option"
          aria-selected={active || checked}
          // Always draggable — multi-select drag carries all selected IDs.
          draggable
          onDragStart={(e) => {
            // Multi-select drag: carry ALL selected IDs as a JSON array.
            // Single-select drag: carry just this item's id.
            if (dragIds.length > 1) {
              e.dataTransfer.setData("text/lcked-items", JSON.stringify(dragIds));
            }
            e.dataTransfer.setData("text/lcked-item", item.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          className={cn(
            "group relative flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
            active ? "text-accent-foreground" : "hover:bg-muted/60",
            checked && "bg-accent/60",
          )}
        >
          {/* Multi-select checkbox OR favicon/type-icon */}
          {multiSelect ? (
            <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center">
              {checked ? (
                <CheckSquare className="h-5 w-5 text-primary" />
              ) : (
                <Square className="h-5 w-5 text-muted-foreground" />
              )}
            </span>
          ) : item.type === "login" && item.details.urls[0] ? (
            <FaviconIcon
              url={item.details.urls[0]}
              size={28}
              className="relative z-10"
              fallback={<ItemTypeIcon type={item.type} size="sm" className="relative z-10" />}
            />
          ) : (
            <ItemTypeIcon type={item.type} size="sm" className="relative z-10" />
          )}

          <div className="relative z-10 min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={cn("truncate text-sm font-medium", item.trashed && "line-through opacity-60")}>
                {item.name}
              </span>
              {/* Pin icon — shown when pinned AND not trashed. Sits before the
                  favorite star so both can coexist gracefully. */}
              {item.pinned && !item.trashed && (
                <Pin className="h-3 w-3 shrink-0 fill-primary/20 text-primary" />
              )}
              {item.favorite && !item.trashed && (
                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
              )}
            </div>
            <div
              className={cn(
                "truncate text-xs text-muted-foreground",
                // Privacy blur for email/username subtitles. Login subtitles
                // are always the username (often an email); identity subtitles
                // may be a name OR an email. We blur both for consistency.
                //  - "hover": blurred by default, reveals on row hover OR when
                //    the row is the active selection.
                //  - "full":  always blurred — even on hover. Reveal only in
                //    the detail pane (handled there).
                // The blur uses CSS filter (GPU-composited) + a 200ms transition
                // so the reveal is smooth. Lightweight: no JS, no re-render.
                blurEmailMode !== "off" && (item.type === "login" || item.type === "identity") && "lcked-email-blur",
                blurEmailMode === "hover" && "lcked-email-blur--hoverable",
                blurEmailMode === "hover" && (active || checked) && "lcked-email-blur--revealed",
              )}
            >
              {subtitle(item)}
            </div>
          </div>

          {/* Type badge OR trash hover actions */}
          {isTrashView ? (
            <div className={cn(
              "relative z-10 flex shrink-0 items-center gap-0.5 transition-opacity",
              hoverItemActions ? "opacity-0 group-hover:opacity-100 focus-within:opacity-100" : "opacity-100",
            )}>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
                aria-label="Restore"
                title="Restore"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation();
                  onPermanentDelete();
                }}
                aria-label="Delete permanently"
                title="Delete permanently"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {item.type === "login" && (
          <>
            <ContextMenuItem
              onSelect={() => onCopyField(item.details.username, isEmail(item.details.username) ? "Email" : "Username")}
              disabled={!item.details.username}
            >
              {isEmail(item.details.username) ? <Mail className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              {isEmail(item.details.username) ? "Copy email" : "Copy username"}
            </ContextMenuItem>
            {item.details.password && (
              <ContextMenuItem onSelect={() => onCopyField(item.details.password, "Password")}>
                <KeyRound className="h-3.5 w-3.5" />
                Copy password
              </ContextMenuItem>
            )}
            {item.details.urls[0] && (
              <ContextMenuItem onSelect={() => onCopyField(item.details.urls[0], "URL")}>
                <Link2 className="h-3.5 w-3.5" />
                Copy URL
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
          </>
        )}
        {!isTrashView && (
          <ContextMenuItem onSelect={onToggleFavorite}>
            <Star className="h-3.5 w-3.5" />
            {item.favorite ? "Unfavorite" : "Favorite"}
          </ContextMenuItem>
        )}
        {!isTrashView && (
          <ContextMenuItem onSelect={onTogglePin}>
            {item.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {item.pinned ? "Unpin" : "Pin to top"}
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </ContextMenuItem>
        {/* Copy to vault — creates a fully independent duplicate of the item
            in the target vault. The copy gets its own ID, so deleting it
            never affects the original (and vice versa). Shown in all non-trash
            views as long as there's at least one vault to copy to. */}
        {!isTrashView && vaults.length > 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <CopyPlus className="h-3.5 w-3.5" />
                Copy to vault
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                {vaults.map((v) => (
                  <ContextMenuItem key={v.id} onSelect={() => onCopyToVault(v.id)}>
                    <VaultIcon icon={v.icon} color={v.color} size={16} />
                    <span className="truncate">{v.name}</span>
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}
        {!isTrashView && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onSelect={onTrash}>
              <Trash2 className="h-3.5 w-3.5" />
              Move to trash
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/* ------------------------------ EmptyList ------------------------------ */

function EmptyList({
  hasItems,
  isTrash,
  onCreate,
}: {
  hasItems: boolean;
  isTrash: boolean;
  onCreate: () => void;
}) {
  const setActiveVault = useVault((s) => s.setActiveVault);
  const setImportExportOpen = useVault((s) => s.setImportExportOpen);
  return (
    // Background matches the populated list exactly (no dotted grid) so the
    // transition between empty and non-empty is seamless — the dots-to-solid
    // flash was jarring. The solid bg-background is what the list scroll area
    // already uses.
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <DiamondMark size={56} glow className="mb-4" />
      <h3 className="text-sm font-semibold">
        {isTrash
          ? "Trash is empty"
          : hasItems
            ? "No matches"
            : "Your vault is empty"}
      </h3>
      <p className="mt-1.5 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
        {isTrash
          ? "Deleted items land here. They auto-purge after 30 days."
          : hasItems
            ? "Try a different search or filter."
            : "Your secrets, encrypted on this device. Nothing leaves. Ever."}
      </p>
      {!hasItems && !isTrash && (
        <div className="mt-5 flex flex-col gap-2">
          <Button size="sm" onClick={onCreate}>
            Add your first item
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setImportExportOpen(true)}>
            Import from Bitwarden / 1Password / Proton Pass
          </Button>
        </div>
      )}
      {isTrash && hasItems && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-5"
          onClick={() => setActiveVault("all")}
        >
          Back to All Items
        </Button>
      )}
    </div>
  );
}

