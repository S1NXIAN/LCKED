"use client";

import {
  FolderInput,
  MoreVertical,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import * as React from "react";

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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { VaultDef } from "@/lib/types";
import { cn } from "@/lib/utils";

import { VaultIcon } from "../vault-icon";
import { VaultRow } from "./vault-row";

/** Which radix menu family a row's entries render through. */
type MenuKind = "dropdown" | "context";

/** The menu primitives a row menu needs, common to both radix families. */
interface MenuParts {
  Item: React.ComponentType<{
    variant?: "default" | "destructive";
    disabled?: boolean;
    onSelect?: (event: Event) => void;
    children?: React.ReactNode;
  }>;
  Separator: React.ComponentType<{ className?: string }>;
  Sub: React.ComponentType<{ children?: React.ReactNode }>;
  SubTrigger: React.ComponentType<{ children?: React.ReactNode }>;
  SubContent: React.ComponentType<{
    className?: string;
    children?: React.ReactNode;
  }>;
}

const DROPDOWN_MENU_PARTS: MenuParts = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

const CONTEXT_MENU_PARTS: MenuParts = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};

/** One selectable entry in a row menu. */
interface MenuItemSpec {
  type: "item";
  /** Stable React key. */
  key: string;
  icon: React.ReactNode;
  label: string;
  /** Red destructive styling. */
  destructive?: boolean;
  /** Visible but greyed out. */
  disabled?: boolean;
  onSelect: (event: Event) => void;
}

/** The entries a row's menus render, in order. */
type MenuEntry =
  | MenuItemSpec
  | { type: "separator" }
  | {
      type: "move-all";
      /** Other vaults (excluding this one), threaded from the parent (VS-2). */
      otherVaults: VaultDef[];
      onMoveAll: (targetVaultId: string | null) => void;
    };

/**
 * Render a row menu's entries through one radix menu family — "dropdown"
 * (⋮ menu) or "context" (right-click menu). Every sidebar row draws its
 * menu from here so mirrored entry points stay in lock-step without
 * duplication. `move-all` carries the parent-threaded vault list (VS-2) —
 * no useVault.getState() calls during render.
 */
export function VaultMenuItems({
  kind,
  entries,
}: {
  kind: MenuKind;
  entries: MenuEntry[];
}) {
  const Parts = kind === "dropdown" ? DROPDOWN_MENU_PARTS : CONTEXT_MENU_PARTS;
  return (
    <>
      {entries.map((entry, index) => {
        switch (entry.type) {
          case "separator":
            return <Parts.Separator key={`separator-${index}`} />;
          case "move-all":
            return (
              <Parts.Sub key={`move-all-${index}`}>
                <Parts.SubTrigger>
                  <FolderInput className="h-3.5 w-3.5" />
                  Move all items
                </Parts.SubTrigger>
                <Parts.SubContent className="w-48">
                  <Parts.Item onSelect={() => entry.onMoveAll(null)}>
                    <ShieldCheck className="text-primary h-3.5 w-3.5" />
                    All Items
                  </Parts.Item>
                  {entry.otherVaults.length > 0 && <Parts.Separator />}
                  {entry.otherVaults.map((v) => (
                    <Parts.Item
                      key={v.id}
                      onSelect={() => entry.onMoveAll(v.id)}
                    >
                      <VaultIcon icon={v.icon} color={v.color} size={18} />
                      <span className="truncate">{v.name}</span>
                    </Parts.Item>
                  ))}
                </Parts.SubContent>
              </Parts.Sub>
            );
          case "item":
            return (
              <Parts.Item
                key={entry.key}
                variant={entry.destructive ? "destructive" : undefined}
                disabled={entry.disabled}
                onSelect={entry.onSelect}
              >
                {entry.icon}
                {entry.label}
              </Parts.Item>
            );
        }
      })}
    </>
  );
}

/**
 * The ⋮ dropdown a sidebar row hosts: a MoreVertical trigger button plus a
 * w-44 content drawn from VaultMenuItems, so every row's trigger and menu
 * shell stay identical. `dimmed` softens the trigger while the row is
 * active; `fade` hides it until row hover when the hover-item-actions
 * setting is on.
 */
export function RowMenu({
  label,
  dimmed,
  fade,
  entries,
}: {
  label: string;
  dimmed?: boolean;
  fade?: boolean;
  entries: MenuEntry[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-muted-foreground hover:bg-muted hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150",
            dimmed && "opacity-60",
            fade &&
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <VaultMenuItems kind="dropdown" entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
 * A custom-vault row with a ⋮ menu (Edit / Move all items / Delete) AND a
 * right-click ContextMenu mirroring the same items. Uses local state to
 * control the delete-confirm AlertDialog; the delete is async and the
 * dialog stays open (with a spinner) until it resolves (VS-3).
 */
export function CustomVaultRow({
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

  // The ⋮ dropdown keeps itself open behind the delete-confirm dialog
  // (preventDefault on select); the context menu closes before the dialog
  // opens. Preserve each pre-existing behaviour exactly.
  const menuEntries = (onDeleteSelect: (event: Event) => void): MenuEntry[] => [
    {
      type: "item",
      key: "edit",
      icon: <Pencil className="h-3.5 w-3.5" />,
      label: "Edit",
      onSelect: onRename,
    },
    { type: "move-all", otherVaults, onMoveAll },
    { type: "separator" },
    {
      type: "item",
      key: "delete-vault",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      label: "Delete vault",
      destructive: true,
      onSelect: onDeleteSelect,
    },
  ];

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
              <RowMenu
                label={`Vault “${vault.name}” options`}
                dimmed={active}
                fade={hoverActions}
                entries={menuEntries((event) => {
                  event.preventDefault();
                  setConfirmOpen(true);
                })}
              />
            }
          />
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <VaultMenuItems
            kind="context"
            entries={menuEntries(() => setConfirmOpen(true))}
          />
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!deleting) setConfirmOpen(o);
        }}
      >
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
                void confirmDelete();
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
