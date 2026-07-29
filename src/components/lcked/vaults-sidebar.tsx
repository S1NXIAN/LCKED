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
 *   • CustomVaultRow is wrapped in <ContextMenu> with the same items as the
 *     3-dots dropdown: Edit, Move all items (submenu), Hide vault, Delete.
 */

import * as React from "react";
import {
  Plus,
  Star,
  StarOff,
  Trash2,
  ShieldCheck,
  MoreVertical,
  Pencil,
  FolderInput,
  Home,
  LayoutGrid,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useVault } from "@/store/vault";
import type { VaultDef } from "@/lib/types";
import {
  VAULT_COLORS,
  VAULT_ICONS,
  DEFAULT_VAULT_COLOR,
  DEFAULT_VAULT_ICON,
  vaultColorHex,
} from "@/lib/vault-assets";
import { VAULT_LUCIDE_BY_ID } from "./vault-lucide-icons";
import { ActiveHighlight } from "./active-highlight";
import { OrganizeVaultDialog } from "./organize-vault-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
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
import { Button } from "@/components/ui/button";

/* ----------------------- drag-drop helper (shared) ----------------------- */

/**
 * Extract item IDs from a drag-drop event. Handles BOTH:
 *   - `text/lcked-items` → JSON array of IDs (multi-select drag)
 *   - `text/lcked-item`  → single ID string (classic single-item drag)
 * Returns an empty array if neither is present.
 */
function parseDraggedIds(e: React.DragEvent): string[] {
  // Multi-select drag carries a JSON array of IDs.
  const multi = e.dataTransfer.getData("text/lcked-items");
  if (multi) {
    try {
      const ids = JSON.parse(multi);
      if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) {
        return ids as string[];
      }
    } catch {
      // Malformed JSON — fall through to single-item.
    }
  }
  // Single-item drag.
  const single = e.dataTransfer.getData("text/lcked-item");
  return single ? [single] : [];
}

/** Signal the item-list to exit multi-select mode after a successful
 *  multi-select drop (the items have been moved/trashed/favorited). */
function exitMultiSelect() {
  window.dispatchEvent(new CustomEvent("lcked:exit-multi-select"));
}

/* --------------------------- dynamic vault icon --------------------------- */

export interface VaultIconProps {
  /** Vault icon id (see VAULT_ICONS). */
  icon: string;
  /** Vault color id (see VAULT_COLORS). */
  color: string;
  /** Pixel size of the square swatch. Default 28. */
  size?: number;
  className?: string;
}

/**
 * Render a vault's icon inside a colored rounded swatch. The fill is the
 * vault color at 18% opacity; the icon glyph uses the full hex for contrast.
 * Used by VaultsSidebar rows AND the create-vault-dialog picker preview.
 * The Lucide-component lookup lives in `./vault-lucide-icons` so both this
 * module and the picker share a single source of truth.
 */
export function VaultIcon({ icon, color, size = 28, className, bare = false }: VaultIconProps & { bare?: boolean }) {
  const hex = vaultColorHex(color);
  const Resolved = VAULT_LUCIDE_BY_ID[icon] ?? Home;
  const px = `${size}px`;
  const glyph = Math.round(size * 0.55);
  if (bare) {
    return (
      <Resolved
        size={glyph}
        strokeWidth={2}
        style={{ color: hex }}
        className={cn("shrink-0", className)}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg", className)}
      style={{
        width: px,
        height: px,
        backgroundColor: `${hex}29`, // ~16% opacity
        color: hex,
      }}
      aria-hidden="true"
    >
      <Resolved size={glyph} strokeWidth={2} />
    </span>
  );
}

/** Re-export the catalogs so the picker UI can grab them in one place. */
export { VAULT_COLORS, VAULT_ICONS, DEFAULT_VAULT_COLOR, DEFAULT_VAULT_ICON };

/* ------------------------------- VaultRow ------------------------------- */

interface VaultRowProps {
  /** Glyph rendered in the swatch. Pass a Lucide component for fixed rows. */
  icon: React.ReactNode;
  /** Row label. */
  label: string;
  /** Item count shown on the right. */
  count: number;
  /** Whether this row is the active filter. */
  active: boolean;
  /** Click handler — sets the active vault filter. */
  onSelect: () => void;
  /** Optional drag-and-drop target vault id (null = no drop). */
  dropVaultId?: string | null;
  /** Optional amber-tinted style (used by Trash when non-empty). */
  warn?: boolean;
  /** Optional ⋮ menu node (rendered in the reserved slot). */
  menu?: React.ReactNode;
  /** Whether the row is being dragged over. */
  dragOver?: boolean;
}

/**
 * A single sidebar row. When `menu` is provided we render a div instead of a
 * button to avoid invalid nested-button HTML. The reserved `menuSlot` keeps
 * every row's right edge aligned whether or not a menu is present.
 *
 * The active state keeps `text-accent-foreground` but NO `bg-accent` — the
 * sliding VaultActiveHighlight provides the background, so a static one
 * would visually fight the spring.
 */
function VaultRow({
  icon,
  label,
  count,
  active,
  onSelect,
  dropVaultId,
  warn,
  menu,
  dragOver,
}: VaultRowProps) {
  const Tag = menu ? "div" : "button";
  const tagProps = menu
    ? { role: "button", tabIndex: 0 }
    : { type: "button" as const };

  const handleDrop = async (e: React.DragEvent) => {
    if (dropVaultId === undefined) return;
    e.preventDefault();
    const ids = parseDraggedIds(e);
    if (ids.length === 0) return;
    const { moveItemsToVault } = useVault.getState();
    const { moved, failed } = await moveItemsToVault(ids, dropVaultId ?? null);
    if (moved > 0 && failed === 0) {
      toast.success(`Moved ${moved} item${moved === 1 ? "" : "s"} to ${label}`);
    } else if (moved > 0 && failed > 0) {
      toast.warning(`Moved ${moved}, ${failed} failed`, { description: `${label}` });
    } else if (failed > 0) {
      toast.error(`Could not move ${failed} item${failed === 1 ? "" : "s"}`);
    }
    // Exit multi-select if more than one item was dragged.
    if (ids.length > 1 && moved > 0) exitMultiSelect();
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (dropVaultId === undefined) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!menu) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <Tag
      {...tagProps}
      onClick={(e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest("[data-menu-slot]")) return;
        onSelect();
      }}
      onKeyDown={menu ? handleKeyDown : undefined}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-100",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        active
          ? "text-accent-foreground"
          : warn
            ? "text-foreground hover:bg-amber-500/10"
            : "text-foreground/80 hover:bg-muted/60 hover:text-foreground",
        dragOver && "ring-2 ring-primary/60 ring-offset-1 ring-offset-background",
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-tight">{label}</span>
        <span
          className={cn(
            "block text-xs leading-tight tabular-nums",
            warn && !active ? "text-amber-400/80" : active ? "text-accent-foreground/70" : "text-muted-foreground",
          )}
        >
          {count} {count === 1 ? "item" : "items"}
        </span>
      </span>
      <span
        data-menu-slot
        className="flex h-7 w-7 shrink-0 items-center justify-center"
      >
        {menu}
      </span>
    </Tag>
  );
}

/* --------------------------- CustomVaultRow --------------------------- */

interface CustomVaultRowProps {
  vault: VaultDef;
  active: boolean;
  count: number;
  dragOver: boolean;
  hoverActions: boolean;
  /** Other vaults (excluding this one) — threaded from the parent so we
   *  don't call useVault.getState() during render (VS-2). */
  otherVaults: VaultDef[];
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => Promise<void>;
  onMoveAll: (targetVaultId: string | null) => void;
  onDragEnterRow: () => void;
  onDragLeaveRow: (e: React.DragEvent) => void;
  onDropClear: () => void;
}

/**
 * Build the menu contents shared by the 3-dots dropdown AND the right-click
 * ContextMenu. Keeps the two menus in lock-step without duplication.
 * `otherVaults` is threaded from the parent (VS-2) — no useVault.getState()
 * calls during render.
 */
function VaultMenuItems({
  vault,
  otherVaults,
  onRename,
  onDelete,
  onMoveAll,
}: {
  vault: VaultDef;
  otherVaults: VaultDef[];
  onRename: () => void;
  onDelete: () => void;
  onMoveAll: (targetVaultId: string | null) => void;
}) {
  return (
    <>
      <ContextMenuItem onSelect={onRename}>
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </ContextMenuItem>

      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <FolderInput className="h-3.5 w-3.5" />
          Move all items
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-48">
          <ContextMenuItem onSelect={() => onMoveAll(null)}>
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            All Items
          </ContextMenuItem>
          {otherVaults.length > 0 && <ContextMenuSeparator />}
          {otherVaults.map((v) => (
            <ContextMenuItem key={v.id} onSelect={() => onMoveAll(v.id)}>
              <VaultIcon icon={v.icon} color={v.color} size={18} />
              <span className="truncate">{v.name}</span>
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSeparator />

      <ContextMenuItem variant="destructive" onSelect={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
        Delete vault
      </ContextMenuItem>
    </>
  );
}

/**
 * A custom-vault row with a ⋮ menu (Edit / Move all items / Delete) AND a
 * right-click ContextMenu mirroring the same items. Uses local state to
 * control the delete-confirm AlertDialog; the delete is async and the
 * dialog stays open (with a spinner) until it resolves (VS-3).
 */
function CustomVaultRow({
  vault,
  active,
  count,
  dragOver,
  hoverActions,
  otherVaults,
  onSelect,
  onRename,
  onDelete,
  onMoveAll,
  onDragEnterRow,
  onDragLeaveRow,
  onDropClear,
}: CustomVaultRowProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const handleRename = () => onRename();
  const handleDelete = () => setConfirmOpen(true);

  // Await the async delete before closing the dialog (VS-3). If it fails, the
  // dialog stays open and the user sees the error toast.
  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
      setConfirmOpen(false);
    } catch {
      // Error toast is surfaced by the parent's handleDelete.
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      data-vault-key={vault.id}
      onDragEnter={onDragEnterRow}
      onDragLeave={onDragLeaveRow}
      onDrop={onDropClear}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <VaultRow
            icon={<VaultIcon icon={vault.icon} color={vault.color} size={28} />}
            label={vault.name}
            count={count}
            active={active}
            onSelect={onSelect}
            dropVaultId={vault.id}
            dragOver={dragOver}
            menu={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground",
                      active && "opacity-60",
                      hoverActions && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                    )}
                    aria-label={`Vault “${vault.name}” options`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {/* Mirror the ContextMenu items inside the dropdown so both
                      entry points offer identical actions. */}
                  <DropdownMenuItem onSelect={handleRename}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FolderInput className="h-3.5 w-3.5" />
                      Move all items
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48">
                      <DropdownMenuItem onSelect={() => onMoveAll(null)}>
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        All Items
                      </DropdownMenuItem>
                      {otherVaults.length > 0 && <DropdownMenuSeparator />}
                      {otherVaults.map((v) => (
                        <DropdownMenuItem key={v.id} onSelect={() => onMoveAll(v.id)}>
                          <VaultIcon icon={v.icon} color={v.color} size={18} />
                          <span className="truncate">{v.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={(e) => {
                      e.preventDefault();
                      setConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete vault
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <VaultMenuItems
            vault={vault}
            otherVaults={otherVaults}
            onRename={handleRename}
            onDelete={handleDelete}
            onMoveAll={onMoveAll}
          />
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!deleting) setConfirmOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{vault.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The vault will be removed. Items inside it will be moved to your
              default vault (not deleted). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete vault"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ----------------------------- VaultsSidebar ----------------------------- */

export function VaultsSidebar() {
  const items = useVault((s) => s.items);
  const vaults = useVault((s) => s.vaults);
  const activeVault = useVault((s) => s.activeVault);
  const settingsOpen = useVault((s) => s.settingsOpen);
  const setActiveVault = useVault((s) => s.setActiveVault);
  const setCreateVaultDialogOpen = useVault((s) => s.setCreateVaultDialogOpen);
  const setVaultEditorOpen = useVault((s) => s.setVaultEditorOpen);
  const deleteVault = useVault((s) => s.deleteVault);
  const moveItemToVault = useVault((s) => s.moveItemToVault);
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

  const allCount = items.filter((i) => !i.trashed).length;
  const favCount = items.filter((i) => !i.trashed && i.favorite).length;
  const trashCount = items.filter((i) => i.trashed).length;
  const vaultCount = (id: string) =>
    items.filter((i) => !i.trashed && i.vaultId === id).length;

  const handleDelete = async (v: VaultDef) => {
    await deleteVault(v.id);
    toast.success(`Deleted vault “${v.name}”`);
  };

  const handleClearFavorites = async () => {
    const { cleared, failed } = await clearFavorites();
    if (cleared > 0 && failed === 0) {
      toast.success(`Cleared ${cleared} favorite${cleared === 1 ? "" : "s"}`);
    } else if (cleared > 0 && failed > 0) {
      toast.warning(`Cleared ${cleared}, ${failed} failed`);
    } else if (failed > 0) {
      toast.error(`Could not clear ${failed} favorite${failed === 1 ? "" : "s"}`);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await emptyTrash();
      toast.success("Trash emptied");
    } catch {
      toast.error("Could not empty trash");
    }
  };

  const handleRestoreAllTrash = async () => {
    const { restored, failed } = await restoreAllTrash();
    if (restored > 0) toast.success(`Restored ${restored} item${restored === 1 ? "" : "s"}`);
    if (failed > 0) toast.error(`Could not restore ${failed} item${failed === 1 ? "" : "s"}`);
  };

  const handleMoveAll = async (source: VaultDef, target: string | null) => {
    const targets = items.filter((i) => !i.trashed && i.vaultId === source.id);
    if (targets.length === 0) {
      toast.info(`“${source.name}” has no items to move`);
      return;
    }
    try {
      await Promise.all(targets.map((i) => moveItemToVault(i.id, target)));
      const label =
        target === null
          ? "All Items"
          : vaults.find((v) => v.id === target)?.name ?? "target vault";
      toast.success(`Moved ${targets.length} item${targets.length === 1 ? "" : "s"} to ${label}`);
    } catch {
      toast.error("Could not move items");
    }
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

  return (
    <div className="flex h-full flex-col gap-1 px-2 py-2">
      {/* Header */}
      <div className="relative flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Vaults
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
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
            activeKey={settingsOpen || activeVault === "trash" ? null : activeVault}
            selectorAttr="data-vault-key"
          />

          {/* All items — drop = move to default vault (vaultId = null). */}
          <div
            data-vault-key="all"
            onDragEnter={() => setOverKey("all")}
            onDragLeave={(e) => {
              const related = e.relatedTarget as Node | null;
              if (related && (e.currentTarget as Node).contains(related)) return;
              setOverKey((c) => (c === "all" ? null : c));
            }}
            onDrop={async (e) => {
              setOverKey(null);
              const ids = parseDraggedIds(e);
              if (ids.length === 0) return;
              const { moveItemsToVault } = useVault.getState();
              const { moved, failed } = await moveItemsToVault(ids, null);
              if (moved > 0) toast.success(`Moved ${moved} item${moved === 1 ? "" : "s"} to All Items`);
              else if (failed > 0) toast.error(`Could not move ${failed} item${failed === 1 ? "" : "s"}`);
              if (ids.length > 1 && moved > 0) exitMultiSelect();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
          >
            <VaultRow
              icon={
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "#7777F829", color: "#7777F8" }}
                  aria-hidden="true"
                >
                  <ShieldCheck className="h-4 w-4" />
                </span>
              }
              label="All Items"
              count={allCount}
              active={activeVault === "all"}
              onSelect={() => setActiveVault("all")}
              dragOver={overKey === "all"}
              menu={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground",
                        hoverItemActions && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                      )}
                      aria-label="All items options"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onSelect={() => setOrganizeOpen(true)}>
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Organize vault
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          </div>

          {/* Favorites — drop = toggle favorite on. */}
          <div
            data-vault-key="favorites"
            onDragEnter={() => setOverKey("favorites")}
            onDragLeave={(e) => {
              const related = e.relatedTarget as Node | null;
              if (related && (e.currentTarget as Node).contains(related)) return;
              setOverKey((c) => (c === "favorites" ? null : c));
            }}
            onDrop={async (e) => {
              setOverKey(null);
              const ids = parseDraggedIds(e);
              if (ids.length === 0) return;
              const store = useVault.getState();
              // Only favorite items that aren't already favorites.
              const toFav = store.items.filter((i) => ids.includes(i.id) && !i.favorite);
              if (toFav.length === 0) {
                toast.info(ids.length === 1 ? "Already a favorite" : "All already favorites");
                return;
              }
              try {
                await Promise.all(toFav.map((it) => store.toggleFavorite(it.id)));
                toast.success(`Added ${toFav.length} item${toFav.length === 1 ? "" : "s"} to Favorites`);
                if (ids.length > 1) exitMultiSelect();
              } catch {
                toast.error("Could not favorite items");
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
          >
            <VaultRow
              icon={
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "#FFB84D29", color: "#FFB84D" }}
                  aria-hidden="true"
                >
                  <Star className="h-4 w-4" />
                </span>
              }
              label="Favorites"
              count={favCount}
              active={activeVault === "favorites"}
              onSelect={() => setActiveVault("favorites")}
              dragOver={overKey === "favorites"}
              menu={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground",
                        hoverItemActions && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                      )}
                      aria-label="Favorites options"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={favCount === 0}
                      onSelect={handleClearFavorites}
                    >
                      <StarOff className="h-3.5 w-3.5" />
                      Clear favorites
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
      </div>{/* End scrollable vault list area */}

      {/* Trash — pinned at the bottom, OUTSIDE the scroll area.
          A thin border-t separates it from the scrollable vault list.

          Its own ActiveHighlight instance is only active when Trash is the
          current filter. Since Trash never scrolls, this highlight is always
          fully visible (no clipping needed). */}
      <div
        ref={trashRef}
        data-vault-key="trash"
        className="relative shrink-0 border-t border-border/60 pt-1"
        onDragEnter={() => setOverKey("trash")}
        onDragLeave={(e) => {
          const related = e.relatedTarget as Node | null;
          if (related && (e.currentTarget as Node).contains(related)) return;
          setOverKey((c) => (c === "trash" ? null : c));
        }}
        onDrop={async (e) => {
          setOverKey(null);
          const ids = parseDraggedIds(e);
          if (ids.length === 0) return;
          const { trashItems } = useVault.getState();
          const { moved, failed } = await trashItems(ids);
          if (moved > 0) toast.success(`Moved ${moved} item${moved === 1 ? "" : "s"} to Trash`);
          else if (ids.length > 0 && moved === 0) toast.info("Already in Trash");
          if (failed > 0) toast.error(`Could not move ${failed} item${failed === 1 ? "" : "s"}`);
          if (ids.length > 1 && moved > 0) exitMultiSelect();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground",
                    hoverItemActions && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                  )}
                  aria-label="Trash options"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onSelect={handleRestoreAllTrash}
                  disabled={trashCount === 0}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore all
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={handleEmptyTrash}
                  disabled={trashCount === 0}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Empty trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      </div>

      {/* Organize vault dialog — opened from the "All Items" 3-dots menu. */}
      <OrganizeVaultDialog open={organizeOpen} onOpenChange={setOrganizeOpen} />
    </div>
  );
}
