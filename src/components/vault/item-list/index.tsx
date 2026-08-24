"use client";

import { Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { copyWithAutoClear } from "@/lib/clipboard";
import { searchItems } from "@/lib/search/fuzzy-search";
import type { ItemType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVault } from "@/store/vault";

import { ActiveHighlight } from "../active-highlight";
import { runBulk } from "../bulk-report";
import {
  ITEM_TYPE_COLORS,
  ITEM_TYPE_ICONS,
  ITEM_TYPE_LABELS,
} from "../item-icons";
import { EmptyList } from "./empty-list";
import { ItemRow } from "./item-row";
import { MultiSelectBar } from "./multi-select-bar";
import { SortBar } from "./sort-bar";
import { useItemSort } from "./use-item-sort";

export function ItemList({
  onMobileBack,
}: {
  /** Mobile-only callback when the user taps Back from a Trash detail. */
  onMobileBack?: () => void;
}) {
  const items = useVault((s) => s.items);
  const vaults = useVault((s) => s.vaults);
  const selectedId = useVault((s) => s.selectedId);
  const setSelected = useVault((s) => s.setSelected);
  const searchQuery = useVault((s) => s.searchQuery);
  const setEditorOpen = useVault((s) => s.setEditorOpen);
  const trashItem = useVault((s) => s.trashItem);
  const restoreItem = useVault((s) => s.restoreItem);
  const permanentlyDeleteItem = useVault((s) => s.permanentlyDeleteItem);
  const copyItemToVault = useVault((s) => s.copyItemToVault);
  const toggleFavorite = useVault((s) => s.toggleFavorite);
  const togglePin = useVault((s) => s.togglePin);
  const sortFavoritesFirst = useVault((s) => s.settings.sortFavoritesFirst);
  const hoverItemActions = useVault((s) => s.settings.hoverItemActions);
  const blurEmailMode = useVault((s) => s.settings.blurEmailMode);

  const typeFilter = useVault((s) => s.typeFilter);
  const setTypeFilter = useVault((s) => s.setTypeFilter);
  const multiSelect = useVault((s) => s.multiSelect);
  const multiSelectIds = useVault((s) => s.multiSelectIds);
  const beginMultiSelect = useVault((s) => s.beginMultiSelect);
  const toggleMultiSelectItem = useVault((s) => s.toggleMultiSelectItem);
  const clearMultiSelection = useVault((s) => s.clearMultiSelection);
  const exitMultiSelect = useVault((s) => s.exitMultiSelect);
  const activeVault = useVault((s) => s.activeVault);
  const isTrashView = activeVault === "trash";

  const [sort, setSort] = useItemSort();

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
    else if (activeVault === "favorites")
      list = list.filter((i) => !i.trashed && i.favorite);
    else if (activeVault && activeVault !== "all")
      list = list.filter((i) => !i.trashed && i.vaultIds.includes(activeVault));
    else list = list.filter((i) => !i.trashed);
    // Type filter (secondary, list-header dropdown).
    if (typeFilter !== "all" && typeof typeFilter === "string") {
      list = list.filter((i) => i.type === typeFilter);
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
  }, [
    items,
    activeVault,
    typeFilter,
    deferredSearch,
    sort,
    sortFavoritesFirst,
  ]);

  // Scroll-into-view when selection changes via keyboard. Scoped to the list
  // (IL-6) so it doesn't find elements in other list instances.
  React.useEffect(() => {
    if (!selectedId) return;
    const el = listRef.current?.querySelector(
      `[data-item-id="${CSS.escape(selectedId)}"]`,
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  /* --------------------------- selection helpers --------------------------- */
  // Bars request mode changes through this plain setter; the store keeps
  // the id set consistent across enter/exit (two bar consumers, one map).
  const setMultiSelectMode = (on: boolean) =>
    on ? beginMultiSelect() : exitMultiSelect();

  /* ------------------------------- item helpers ------------------------------- */
  // Helper used by the empty-area context menu (and any other caller that
  // wants to spawn the editor pre-seeded with a type).

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
      <SortBar
        filter={typeFilter}
        setFilter={setTypeFilter}
        sort={sort}
        setSort={setSort}
        multiSelect={multiSelect}
        setMultiSelect={setMultiSelectMode}
        filteredCount={filtered.length}
        selectedCount={multiSelectIds.size}
        onSelectAll={() => beginMultiSelect(filtered.map((i) => i.id))}
        onDeselectAll={clearMultiSelection}
      />

      <MultiSelectBar
        open={multiSelect}
        setMultiSelect={setMultiSelectMode}
        selectedIds={multiSelectIds}
        vaults={vaults}
        isTrashView={isTrashView}
      />

      {/* List — wrapped in a ContextMenu so right-clicking empty space
                    offers quick "New Login/Note/Card/Identity" actions. */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="lcked-scroll min-h-0 flex-1 overflow-y-auto"
            // Suppress native listbox typeahead: pressing bare number keys
            // (0–9) inside a role="listbox" can move the browser's implicit
            // selection / focus, which surfaces as an unwanted active-indicator
            // border. Bare digit keys are preventDefault-ed; digits pressed
            // together with ⌘/Ctrl/Alt fall through untouched.
            onKeyDown={(e) => {
              if (
                /^[0-9]$/.test(e.key) &&
                !e.metaKey &&
                !e.ctrlKey &&
                !e.altKey
              ) {
                e.preventDefault();
              }
            }}
          >
            <div className="p-2">
              {filtered.length === 0 ? (
                <EmptyList
                  hasItems={items.length > 0}
                  isTrash={isTrashView}
                  onCreate={() => setEditorOpen(true, null, "login")}
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
                                                (see src/components/vault/active-highlight.tsx). The
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
                      const checked = multiSelectIds.has(item.id);
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
                                ? Array.from(multiSelectIds)
                                : [item.id]
                            }
                            onPick={() =>
                              multiSelect
                                ? toggleMultiSelectItem(item.id)
                                : setSelected(item.id)
                            }
                            onToggleSelected={() =>
                              toggleMultiSelectItem(item.id)
                            }
                            onRestore={() =>
                              void runBulk(
                                () => restoreItem(item.id),
                                "Restored",
                              )
                            }
                            onPermanentDelete={() =>
                              void runBulk(
                                () => permanentlyDeleteItem(item.id),
                                "Permanently deleted",
                              )
                            }
                            onCopyField={copyField}
                            onToggleFavorite={() => toggleFavorite(item.id)}
                            onTogglePin={() => togglePin(item.id)}
                            onEdit={() => setEditorOpen(true, item.id)}
                            onTrash={() =>
                              void runBulk(() => trashItem(item.id), "Moved", {
                                tail: "to Trash",
                              })
                            }
                            onCopyToVault={(vaultId) =>
                              void runBulk(
                                () => copyItemToVault(item.id, vaultId),
                                "Copied",
                                {
                                  tail: `to ${vaults.find((v) => v.id === vaultId)?.name ?? "vault"}`,
                                },
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
                  <ContextMenuItem
                    key={t}
                    onSelect={() => setEditorOpen(true, null, t)}
                  >
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
        <button onClick={onMobileBack} className="sr-only focus:not-sr-only">
          Back to All Items
        </button>
      )}
    </div>
  );
}
