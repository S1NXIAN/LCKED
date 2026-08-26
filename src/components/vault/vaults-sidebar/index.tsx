"use client";

/**
 * LCKED — VaultsSidebar
 * ---------------------------------------------------------------------------
 * Proton Pass–style vault selector. Renders the fixed rows (All / Favorites /
 * Trash) plus every user-defined vault. Each row is a drag-and-drop drop
 * target so an item dragged from the list can be moved between vaults.
 *
 * Pattern notes:
 *   • Rows that host a ⋮ dropdown are rendered as <div role="button"> (NOT
 *     <button>) so the trigger button doesn't nest inside another button —
 *     nested buttons are invalid HTML and break accessibility tree.
 *   • A fixed-width slot is reserved for the menu button on EVERY row (even
 *     the menu-less ones) so all the right-aligned counts line up.
 *   • "Rename" opens the vault editor sheet via setVaultEditorOpen(true, id);
 *     "Delete" calls deleteVault (which orphan-rescues any items inside).
 *   • Each row wrapper carries a `data-vault-key` attribute consumed by the
 *     shared sliding ActiveHighlight (rAF spring — same component used by
 *     item-list). TWO instances are rendered: one inside the scroll area's
 *     content wrapper (for All / Favorites / custom vaults) and one inside
 *     the Trash wrapper (Trash lives outside the scroll area). Because the
 *     scroll-area instance lives INSIDE the scrolling content, it is
 *     naturally clipped by `overflow` when the active vault row scrolls out
 *     of view — exactly like the item-list indicator. No floating overlay.
 *   • CustomVaultRow is wrapped in <ContextMenu> mirroring the 3-dots
 *     dropdown: Edit, Move all items (submenu), Delete vault.
 */

import {
 LayoutGrid,
 Plus,
 RotateCcw,
 ShieldCheck,
 Star,
 StarOff,
 Trash2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { runBulk } from "@/components/vault/bulk-report";
import { PermanentDeleteDialog } from "@/components/vault/permanent-delete-dialog";
import type { VaultDef } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVault } from "@/store/vault";

import { ActiveHighlight } from "../active-highlight";
import { OrganizeVaultDialog } from "../organize-vault-dialog";
import { CustomVaultRow, RowMenu } from "./custom-vault-row";
import { parseDraggedIds } from "./drag-drop";
import { VaultRow } from "./vault-row";

export function VaultsSidebar() {
 const items = useVault((s) => s.items);
 const vaults = useVault((s) => s.vaults);
 const activeVault = useVault((s) => s.activeVault);
 const settingsOpen = useVault((s) => s.settingsOpen);
 const setActiveVault = useVault((s) => s.setActiveVault);
 const setCreateVaultDialogOpen = useVault((s) => s.setCreateVaultDialogOpen);
 const setVaultEditorOpen = useVault((s) => s.setVaultEditorOpen);
 const deleteVault = useVault((s) => s.deleteVault);
 const clearFavorites = useVault((s) => s.clearFavorites);
 const emptyTrash = useVault((s) => s.emptyTrash);
 const restoreAllTrash = useVault((s) => s.restoreAllTrash);
 const hoverItemActions = useVault((s) => s.settings.hoverItemActions);

 // Refs for the two ActiveHighlight instances:
 //   • listRef  — the relative content wrapper INSIDE the scroll area
 //     (holds All / Favorites / custom vaults). The highlight rendered here
 //     is clipped by the scroll area's overflow, so it disappears with the
 //     active row when it scrolls out of view — exactly like item-list.
 //   • trashRef — the Trash wrapper, which lives OUTSIDE the scroll area
 //     (Trash is pinned at the bottom). Its highlight is always visible
 //     when Trash is the active filter.
 const listRef = React.useRef<HTMLDivElement | null>(null);
 const trashRef = React.useRef<HTMLDivElement | null>(null);

 const [overKey, setOverKey] = React.useState<string | null>(null);
 const [organizeOpen, setOrganizeOpen] = React.useState(false);
 const [emptyTrashOpen, setEmptyTrashOpen] = React.useState(false);

 const allCount = items.filter((i) => !i.trashed).length;
 const favCount = items.filter((i) => !i.trashed && i.favorite).length;
 const trashCount = items.filter((i) => i.trashed).length;
 const vaultCount = (id: string) =>
  items.filter((i) => !i.trashed && i.vaultIds.includes(id)).length;

 const handleDelete = async (v: VaultDef) => {
  await deleteVault(v.id);
  toast.success(`Deleted vault “${v.name}”`);
 };

 const handleClearFavorites = () =>
  runBulk(clearFavorites, "Cleared", { what: "favorite" });

 const handleEmptyTrash = () => {
  setEmptyTrashOpen(false);
  void runBulk(emptyTrash, "Deleted");
 };

 const handleRestoreAllTrash = () => runBulk(restoreAllTrash, "Restored");

 const handleMoveAll = async (source: VaultDef, target: string | null) => {
  const targets = items.filter(
   (i) => !i.trashed && i.vaultIds.includes(source.id),
  );
  if (targets.length === 0) {
   toast.info(`“${source.name}” has no items to move`);
   return;
  }
  const label =
   target === null
    ? "All Items"
    : (vaults.find((v) => v.id === target)?.name ?? "target vault");
  const { moveItemsToVault } = useVault.getState();
  await runBulk(
   () =>
    moveItemsToVault(
     targets.map((i) => i.id),
     target,
    ),
   "Moved",
   { tail: `to ${label}` },
  );
 };

 const renderCustomVault = (v: VaultDef) => (
  <CustomVaultRow
   key={v.id}
   vault={v}
   active={activeVault === v.id}
   count={vaultCount(v.id)}
   dragOver={overKey === `vault-${v.id}`}
   hoverActions={hoverItemActions}
   otherVaults={vaults.filter((x) => x.id !== v.id)}
   onSelect={() => setActiveVault(v.id)}
   onRename={() => setVaultEditorOpen(true, v.id)}
   onDelete={() => handleDelete(v)}
   onMoveAll={(target) => handleMoveAll(v, target)}
   onDragEnterRow={() => setOverKey(`vault-${v.id}`)}
   onDragLeaveRow={(e) => {
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) return;
    setOverKey((c) => (c === `vault-${v.id}` ? null : c));
   }}
   onDropClear={() => setOverKey(null)}
  />
 );

 // Every drop target shares the same hover bookkeeping: mark the entered
 // key, clear it only when the pointer truly leaves the wrapper (not just
 // a child), and keep the native "move" drag affordance alive.
 const dropHoverHandlers = (key: string) => ({
  onDragEnter: () => setOverKey(key),
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
   const related = e.relatedTarget as Node | null;
   if (related && (e.currentTarget as Node).contains(related)) return;
   setOverKey((c) => (c === key ? null : c));
  },
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
   e.preventDefault();
   e.dataTransfer.dropEffect = "move";
  },
 });

 // Fixed-row icons share the same colored rounded swatch (Trash tints via
 // classes for its warn state, so it stays hand-rolled below).
 const renderSwatch = (
  bg: string,
  color: string,
  Glyph: React.ComponentType<{ className?: string }>,
 ) => (
  <span
   className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
   style={{ backgroundColor: bg, color }}
   aria-hidden="true"
  >
   <Glyph className="h-4 w-4" />
  </span>
 );

 return (
  <div className="flex h-full flex-col gap-1 px-2 py-2">
   {/* Header */}
   <div className="relative flex items-center justify-between px-3 py-2">
    <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
     Vaults
    </span>
    <Button
     size="icon"
     variant="ghost"
     className="text-muted-foreground hover:text-foreground h-6 w-6"
     onClick={() => setCreateVaultDialogOpen(true)}
     aria-label="Create vault"
    >
     <Plus className="h-4 w-4" />
    </Button>
   </div>

   {/* Scrollable vault list area — All Items, Favorites, custom vaults.
                    Trash is OUTSIDE this scroll area so it stays pinned at the bottom.

                    The highlight lives INSIDE the `relative` content wrapper below,
                    which itself scrolls with the content — so the highlight is
                    clipped by the scroll area's `overflow-y-auto` the moment the
                    active vault row leaves the visible viewport. No floating overlay,
                    no follow-the-item-off-screen: it disappears with the row, exactly
                    like the item-list indicator. (Shared ActiveHighlight component.) */}
   <div className="lcked-scroll min-h-0 flex-1 overflow-y-auto">
    <div ref={listRef} className="relative">
     {/* Sliding highlight — only active for non-trash vaults. Clipped
                            by the scroll area's overflow when the row scrolls away. */}
     <ActiveHighlight
      containerRef={listRef}
      activeKey={
       settingsOpen || activeVault === "trash" ? null : activeVault
      }
      selectorAttr="data-vault-key"
     />

     {/* All items — drop = move to default vault (vaultId = null). */}
     <div
      data-vault-key="all"
      {...dropHoverHandlers("all")}
      onDrop={async (e) => {
       setOverKey(null);
       const ids = parseDraggedIds(e);
       if (ids.length === 0) return;
       const { moveItemsToVault, exitMultiSelect } = useVault.getState();
       const outcome = await runBulk(
        () => moveItemsToVault(ids, null),
        "Moved",
        {
         tail: "to All Items",
        },
       );
       if (ids.length > 1 && outcome && outcome.done > 0)
        exitMultiSelect();
      }}
     >
      <VaultRow
       icon={renderSwatch("#7777F829", "#7777F8", ShieldCheck)}
       label="All Items"
       count={allCount}
       active={activeVault === "all"}
       onSelect={() => setActiveVault("all")}
       dragOver={overKey === "all"}
       menu={
        <RowMenu
         label="All items options"
         fade={hoverItemActions}
         entries={[
          {
           type: "item",
           key: "organize",
           icon: <LayoutGrid className="h-3.5 w-3.5" />,
           label: "Organize vault",
           onSelect: () => setOrganizeOpen(true),
          },
         ]}
        />
       }
      />
     </div>

     {/* Favorites — drop = toggle favorite on. */}
     <div
      data-vault-key="favorites"
      {...dropHoverHandlers("favorites")}
      onDrop={async (e) => {
       setOverKey(null);
       const ids = parseDraggedIds(e);
       if (ids.length === 0) return;
       const store = useVault.getState();
       // Only favorite items that aren't already favorites.
       const toFav = store.items.filter(
        (i) => ids.includes(i.id) && !i.favorite,
       );
       if (toFav.length === 0) {
        toast.info(
         ids.length === 1
          ? "Already a favorite"
          : "All already favorites",
        );
        return;
       }
       const outcome = await runBulk(
        async () => {
         const results = await Promise.all(
          toFav.map((it) => store.toggleFavorite(it.id)),
         );
         return results.reduce(
          (t, r) => ({
           done: t.done + r.done,
           failed: t.failed + r.failed,
          }),
          { done: 0, failed: 0 },
         );
        },
        "Added",
        { tail: "to Favorites" },
       );
       if (outcome && ids.length > 1) store.exitMultiSelect();
      }}
     >
      <VaultRow
       icon={renderSwatch("#FFB84D29", "#FFB84D", Star)}
       label="Favorites"
       count={favCount}
       active={activeVault === "favorites"}
       onSelect={() => setActiveVault("favorites")}
       dragOver={overKey === "favorites"}
       menu={
        <RowMenu
         label="Favorites options"
         fade={hoverItemActions}
         entries={[
          {
           type: "item",
           key: "clear-favorites",
           icon: <StarOff className="h-3.5 w-3.5" />,
           label: "Clear favorites",
           destructive: true,
           disabled: favCount === 0,
           onSelect: handleClearFavorites,
          },
         ]}
        />
       }
      />
     </div>

     {/* Custom vaults */}
     {vaults.length > 0 && (
      <div className="mt-1 flex flex-col gap-0.5">
       {vaults.map(renderCustomVault)}
      </div>
     )}
    </div>
   </div>
   {/* End scrollable vault list area */}

   {/* Trash — pinned at the bottom, OUTSIDE the scroll area.
                    A thin border-t separates it from the scrollable vault list.

                    Its own ActiveHighlight instance is only active when Trash is the
                    current filter. Since Trash never scrolls, this highlight is always
                    fully visible (no clipping needed). */}
   <div
    ref={trashRef}
    data-vault-key="trash"
    className="border-border/60 relative shrink-0 border-t pt-1"
    {...dropHoverHandlers("trash")}
    onDrop={async (e) => {
     setOverKey(null);
     const ids = parseDraggedIds(e);
     if (ids.length === 0) return;
     const { trashItems, exitMultiSelect } = useVault.getState();
     const outcome = await runBulk(() => trashItems(ids), "Moved", {
      tail: "to Trash",
     });
     // A caught throw resolves null — never announce a no-op for it.
     if (outcome && outcome.done === 0 && outcome.failed === 0)
      toast.info("Already in Trash");
     if (ids.length > 1 && outcome && outcome.done > 0) exitMultiSelect();
    }}
   >
    <ActiveHighlight
     containerRef={trashRef}
     activeKey={!settingsOpen && activeVault === "trash" ? "trash" : null}
     selectorAttr="data-vault-key"
    />
    <VaultRow
     icon={
      <span
       className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-lg",
        trashCount > 0
         ? "bg-amber-500/15 text-amber-400"
         : "bg-muted text-muted-foreground",
       )}
       aria-hidden="true"
      >
       <Trash2 className="h-4 w-4" />
      </span>
     }
     label="Trash"
     count={trashCount}
     active={activeVault === "trash"}
     warn={trashCount > 0}
     onSelect={() => setActiveVault("trash")}
     dragOver={overKey === "trash"}
     menu={
      <RowMenu
       label="Trash options"
       fade={hoverItemActions}
       entries={[
        {
         type: "item",
         key: "restore-all",
         icon: <RotateCcw className="h-3.5 w-3.5" />,
         label: "Restore all",
         disabled: trashCount === 0,
         onSelect: handleRestoreAllTrash,
        },
        { type: "separator" },
        {
         type: "item",
         key: "empty-trash",
         icon: <Trash2 className="h-3.5 w-3.5" />,
         label: "Empty trash",
         destructive: true,
         disabled: trashCount === 0,
         onSelect: () => setEmptyTrashOpen(true),
        },
       ]}
      />
     }
    />
   </div>

   {/* Organize vault dialog — opened from the "All Items" 3-dots menu. */}
   <OrganizeVaultDialog open={organizeOpen} onOpenChange={setOrganizeOpen} />

   <PermanentDeleteDialog
    open={emptyTrashOpen}
    onOpenChange={setEmptyTrashOpen}
    count={trashCount}
    onConfirm={handleEmptyTrash}
   />
  </div>
 );
}
