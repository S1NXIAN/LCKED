"use client";

import * as React from "react";
import {
  X, Plus, Trash2, GripVertical, FolderInput, ShieldCheck,
  AlertTriangle, Check, ArrowRightCircle, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import type { VaultDef } from "@/lib/types";
import {
  VAULT_COLORS,
  VAULT_ICONS,
  DEFAULT_VAULT_COLOR,
  DEFAULT_VAULT_ICON,
  vaultColorHex,
} from "@/lib/vault-assets";
import { VAULT_LUCIDE_BY_ID } from "./vault-lucide-icons";
import { ItemTypeIcon } from "./item-icons";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Delete-vault dialog — choose what happens to the vault's items.   */
/* ------------------------------------------------------------------ */

type DeleteMode = "transfer" | "delete" | "selective";

function DeleteVaultDialog({
  vault,
  open,
  onOpenChange,
  otherVaults,
  vaultItems,
  onConfirm,
}: {
  vault: VaultDef | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherVaults: VaultDef[];
  vaultItems: { id: string; name: string; type: "login" | "note" | "card" | "identity" }[];
  onConfirm: (mode: DeleteMode, targetVaultId: string | null, itemIdsToDelete: string[]) => Promise<void>;
}) {
  const [mode, setMode] = React.useState<DeleteMode>("transfer");
  const [target, setTarget] = React.useState<string | null>(null); // null = All Items
  const [selectedForDelete, setSelectedForDelete] = React.useState<Set<string>>(new Set());
  const [deleting, setDeleting] = React.useState(false);

  // Reset state when a new vault is opened.
  React.useEffect(() => {
    if (open) {
      setMode("transfer");
      setTarget(null);
      setSelectedForDelete(new Set());
    }
  }, [open]);

  const toggleSelect = (id: string) => {
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!vault) return;
    setDeleting(true);
    try {
      await onConfirm(mode, target, mode === "selective" ? Array.from(selectedForDelete) : []);
      onOpenChange(false);
    } catch {
      // Error toast is surfaced by the parent.
    } finally {
      setDeleting(false);
    }
  };

  if (!vault) return null;

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!deleting) onOpenChange(o); }}>
      <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            Delete “{vault.name}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This vault has {vaultItems.length} item{vaultItems.length === 1 ? "" : "s"}. Choose what happens to them.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Mode selector */}
        <div className="space-y-2 py-2">
          {/* Transfer all items */}
          <button
            type="button"
            onClick={() => setMode("transfer")}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              mode === "transfer" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
            )}
          >
            <div className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", mode === "transfer" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
              {mode === "transfer" && <Check className="h-3 w-3" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Transfer items to another vault</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Move all {vaultItems.length} item{vaultItems.length === 1 ? "" : "s"} to a vault of your choice.</div>
              {mode === "transfer" && (
                <select
                  value={target ?? ""}
                  onChange={(e) => setTarget(e.target.value || null)}
                  className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={deleting}
                >
                  <option value="">All Items (default)</option>
                  {otherVaults.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              )}
            </div>
          </button>

          {/* Delete all items */}
          <button
            type="button"
            onClick={() => setMode("delete")}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              mode === "delete" ? "border-red-500/60 bg-red-500/5" : "border-border hover:bg-muted/40",
            )}
          >
            <div className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", mode === "delete" ? "border-red-500 bg-red-500 text-white" : "border-muted-foreground/40")}>
              {mode === "delete" && <Check className="h-3 w-3" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-red-400">Delete all items with the vault</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Permanently delete all {vaultItems.length} item{vaultItems.length === 1 ? "" : "s"}. This cannot be undone.</div>
            </div>
          </button>

          {/* Selective */}
          <button
            type="button"
            onClick={() => setMode("selective")}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              mode === "selective" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
            )}
          >
            <div className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", mode === "selective" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
              {mode === "selective" && <Check className="h-3 w-3" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Choose items to delete</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Select specific items to delete. The rest move to a vault of your choice.</div>
            </div>
          </button>

          {/* Selective item list */}
          {mode === "selective" && (
            <div className="ml-7 max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {/* Transfer target */}
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowRightCircle className="h-3.5 w-3.5" />
                <span>Remaining items move to:</span>
                <select
                  value={target ?? ""}
                  onChange={(e) => setTarget(e.target.value || null)}
                  className="flex-1 rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none"
                  disabled={deleting}
                >
                  <option value="">All Items</option>
                  {otherVaults.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              {/* Item checkboxes */}
              {vaultItems.length === 0 ? (
                <div className="py-2 text-center text-xs text-muted-foreground/60">No items in this vault.</div>
              ) : (
                vaultItems.map((item) => {
                  const checked = selectedForDelete.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(item.id)}
                        className="h-3.5 w-3.5 accent-red-500"
                      />
                      <ItemTypeIcon type={item.type} size="sm" className="shrink-0" />
                      <span className="truncate">{item.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{checked ? "Delete" : "Keep"}</span>
                    </label>
                  );
                })
              )}
              {selectedForDelete.size > 0 && (
                <div className="mt-1 border-t border-border pt-1 text-xs text-red-400">
                  {selectedForDelete.size} selected for deletion · {vaultItems.length - selectedForDelete.size} will transfer
                </div>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting || (mode === "selective" && selectedForDelete.size === 0 && vaultItems.length > 0)}
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
          >
            {deleting ? "Deleting…" : `Delete vault${mode === "delete" ? " & items" : ""}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Create-vault inline form                                          */
/* ------------------------------------------------------------------ */

function CreateVaultForm({ onCreate }: { onCreate: (name: string, color: string, icon: string) => Promise<void> }) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(DEFAULT_VAULT_COLOR);
  const [icon, setIcon] = React.useState(DEFAULT_VAULT_ICON);
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onCreate(name.trim(), color, icon);
      setName("");
      setColor(DEFAULT_VAULT_COLOR);
      setIcon(DEFAULT_VAULT_ICON);
      toast.success("Vault created");
    } catch {
      toast.error("Could not create vault");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New vault name"
          className="h-8 flex-1 text-sm"
          autoFocus
        />
        <Button type="submit" size="sm" className="h-8 gap-1.5" disabled={!name.trim() || busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </Button>
      </div>
      {/* Color picker */}
      <div className="flex flex-wrap gap-1.5">
        {VAULT_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setColor(c.id)}
            className={cn("h-5 w-5 rounded-full transition-transform", color === c.id && "ring-2 ring-ring ring-offset-2 ring-offset-background scale-110")}
            style={{ backgroundColor: vaultColorHex(c.id) }}
            aria-label={c.label}
            title={c.label}
          />
        ))}
      </div>
      {/* Icon picker */}
      <div className="flex flex-wrap gap-1">
        {VAULT_ICONS.slice(0, 15).map((ic) => {
          const Icon = VAULT_LUCIDE_BY_ID[ic.id] ?? ShieldCheck;
          return (
            <button
              key={ic.id}
              type="button"
              onClick={() => setIcon(ic.id)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                icon === ic.id ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
              aria-label={ic.label}
              title={ic.label}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Main OrganizeVaultDialog                                          */
/* ------------------------------------------------------------------ */

/**
 * LCKED — Organize Vault Dialog
 * ---------------------------------------------------------------------------
 * A full-height sheet for VAULT MANAGEMENT (not item management):
 *   • Drag vaults to reorder them.
 *   • Create new vaults (inline form with color + icon picker).
 *   • Delete vaults with a sophisticated item-transfer dialog:
 *     - Transfer all items to another vault (default: All Items).
 *     - Delete all items with the vault.
 *     - Selectively delete specific items; transfer the rest.
 */
export function OrganizeVaultDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const vaults = useVault((s) => s.vaults);
  const items = useVault((s) => s.items);
  const createVault = useVault((s) => s.createVault);
  const deleteVaultWithOptions = useVault((s) => s.deleteVaultWithOptions);
  const reorderVaults = useVault((s) => s.reorderVaults);

  // Local reorder state — optimistic; synced to store on drop.
  const [localVaults, setLocalVaults] = React.useState<VaultDef[]>(vaults);
  React.useEffect(() => { setLocalVaults(vaults); }, [vaults, open]);

  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<VaultDef | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index);
    }
  };
  const handleDrop = async (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    // Reorder the local array.
    const next = [...localVaults];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setLocalVaults(next);
    setDragIndex(null);
    setDragOverIndex(null);
    try {
      await reorderVaults(next);
    } catch {
      toast.error("Could not reorder vaults");
      setLocalVaults(vaults); // revert
    }
  };

  const handleCreate = async (name: string, color: string, icon: string) => {
    await createVault(name, color, icon);
  };

  const handleDeleteConfirm = async (mode: "transfer" | "delete" | "selective", targetVaultId: string | null, itemIdsToDelete: string[]) => {
    if (!deleteTarget) return;
    try {
      await deleteVaultWithOptions(deleteTarget.id, mode, targetVaultId, itemIdsToDelete);
      const itemCount = mode === "delete"
        ? items.filter((i) => i.vaultId === deleteTarget.id && !i.trashed).length
        : mode === "selective"
          ? itemIdsToDelete.length
          : 0;
      if (mode === "delete" && itemCount > 0) {
        toast.success(`Deleted vault and ${itemCount} item${itemCount === 1 ? "" : "s"}`);
      } else {
        toast.success("Vault deleted");
      }
      setDeleteTarget(null);
    } catch {
      toast.error("Could not delete vault");
    }
  };

  // Items in the vault being deleted (for the delete dialog).
  const deleteVaultItems = React.useMemo(() => {
    if (!deleteTarget) return [];
    return items
      .filter((i) => i.vaultId === deleteTarget.id && !i.trashed)
      .map((i) => ({ id: i.id, name: i.name, type: i.type }));
  }, [deleteTarget, items]);

  const otherVaults = deleteTarget ? vaults.filter((v) => v.id !== deleteTarget.id) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden border-l border-border bg-background p-0 sm:max-w-[480px] [&>button:last-child]:hidden"
      >
        <SheetHeader className="flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <SheetTitle className="flex min-w-0 items-center gap-2.5 text-base font-semibold">
            <FolderInput className="h-4 w-4 text-primary" />
            <span className="truncate">Organize vaults</span>
          </SheetTitle>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>
        <SheetDescription className="sr-only">
          Manage vaults: drag to reorder, create new vaults, or delete vaults with item-transfer options.
        </SheetDescription>

        {/* Body */}
        <div className="lcked-scroll min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Drag vaults to reorder. Create new vaults or delete existing ones — deleting lets you choose what happens to the items inside.
          </p>

          {/* Vault list (draggable) */}
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {localVaults.map((vault, index) => {
                const count = items.filter((i) => !i.trashed && i.vaultId === vault.id).length;
                const isDragging = dragIndex === index;
                const isOver = dragOverIndex === index && dragIndex !== null && dragIndex !== index;
                const Icon = VAULT_LUCIDE_BY_ID[vault.icon] ?? ShieldCheck;
                const hex = vaultColorHex(vault.color);
                return (
                  <motion.div
                    key={vault.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isDragging ? 0.4 : 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={() => setDragOverIndex((c) => (c === index ? null : c))}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                      isOver ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted/30",
                    )}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/50 hover:text-muted-foreground" />
                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${hex}29`, color: hex }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{vault.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {count} item{count === 1 ? "" : "s"}
                      </div>
                    </div>
                    {/* Delete button */}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      onClick={() => setDeleteTarget(vault)}
                      aria-label={`Delete ${vault.name}`}
                      title="Delete vault"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Empty state */}
          {localVaults.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No custom vaults yet. Create one below.
            </div>
          )}

          {/* Create vault form */}
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              <Plus className="h-3 w-3" />
              Create vault
            </div>
            <CreateVaultForm onCreate={handleCreate} />
          </div>
        </div>
      </SheetContent>

      {/* Delete-vault dialog with item-transfer options */}
      <DeleteVaultDialog
        vault={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        otherVaults={otherVaults}
        vaultItems={deleteVaultItems}
        onConfirm={handleDeleteConfirm}
      />
    </Sheet>
  );
}
