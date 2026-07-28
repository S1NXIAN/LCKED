"use client";

import * as React from "react";
import { X, Pencil, Trash2, FolderInput, GripVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useVault } from "@/store/vault";
import type { VaultDef, VaultItem } from "@/lib/types";
import { ItemTypeIcon, ITEM_TYPE_LABELS } from "./item-icons";
import { VaultIcon } from "./vaults-sidebar";
import { cn } from "@/lib/utils";

/**
 * LCKED — Organize Vault Dialog
 * ---------------------------------------------------------------------------
 * A full-height sheet that shows ALL non-trashed items grouped by vault.
 * Users can drag items between vault groups to reassign them, and each item
 * has quick edit / trash buttons for full CRUD control.
 *
 * The "No vault" group represents items with vaultId = null (the default
 * vault). Items can be dragged from any group to any other group.
 */
export function OrganizeVaultDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const items = useVault((s) => s.items);
  const vaults = useVault((s) => s.vaults);
  const moveItemToVault = useVault((s) => s.moveItemToVault);
  const trashItem = useVault((s) => s.trashItem);
  const setEditorOpen = useVault((s) => s.setEditorOpen);

  // Group non-trashed items by vaultId. null = "No vault" (default).
  const groups = React.useMemo(() => {
    const map = new Map<string | null, VaultItem[]>();
    for (const item of items) {
      if (item.trashed) continue;
      const key = item.vaultId ?? null;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  const [dragItemId, setDragItemId] = React.useState<string | null>(null);
  const [dragOverVault, setDragOverVault] = React.useState<string | null | undefined>(undefined);

  const handleDrop = async (targetVaultId: string | null) => {
    if (!dragItemId) return;
    setDragOverVault(undefined);
    setDragItemId(null);
    try {
      await moveItemToVault(dragItemId, targetVaultId);
      const label = targetVaultId === null
        ? "No vault"
        : vaults.find((v) => v.id === targetVaultId)?.name ?? "vault";
      toast.success(`Moved to ${label}`);
    } catch {
      toast.error("Could not move item");
    }
  };

  const handleTrash = async (id: string) => {
    try {
      await trashItem(id);
      toast.success("Moved to Trash");
    } catch {
      toast.error("Could not trash item");
    }
  };

  // Build the list of group headers: "No vault" + each custom vault.
  const groupKeys: (string | null)[] = [null, ...vaults.map((v) => v.id)];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden border-l border-border bg-background p-0 sm:max-w-[560px] [&>button:last-child]:hidden"
      >
        <SheetHeader className="flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <SheetTitle className="flex min-w-0 items-center gap-2.5 text-base font-semibold">
            <FolderInput className="h-4 w-4 text-primary" />
            <span className="truncate">Organize vault</span>
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
          Drag items between vault groups to reassign them. Use the edit and trash buttons for quick changes.
        </SheetDescription>

        {/* Body — scrollable list of vault groups with drag-and-drop. */}
        <div className="lcked-scroll min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-4 text-xs text-muted-foreground">
            Drag items between groups to reassign their vault. Each item has quick edit and trash actions.
          </p>

          <div className="space-y-4">
            {groupKeys.map((key) => {
              const groupItems = groups.get(key) ?? [];
              const vaultDef = key === null ? null : vaults.find((v) => v.id === key) ?? null;
              const label = key === null ? "No vault" : vaultDef?.name ?? "Unknown vault";
              const isOver = dragOverVault === key;
              return (
                <div
                  key={String(key)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverVault(key); }}
                  onDragLeave={() => setDragOverVault((c) => (c === key ? undefined : c))}
                  onDrop={() => handleDrop(key)}
                  className={cn(
                    "rounded-xl border transition-colors",
                    isOver ? "border-primary/60 bg-primary/5" : "border-border",
                  )}
                >
                  {/* Group header */}
                  <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
                    {vaultDef ? (
                      <VaultIcon icon={vaultDef.icon} color={vaultDef.color} size={20} />
                    ) : (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                        —
                      </span>
                    )}
                    <span className="text-sm font-medium">{label}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {groupItems.length} item{groupItems.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {/* Items in this group */}
                  {groupItems.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground/60">
                      {isOver ? "Drop here" : "No items"}
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {groupItems.map((item) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/lcked-item", item.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDragItemId(item.id);
                          }}
                          onDragEnd={() => { setDragItemId(null); setDragOverVault(undefined); }}
                          className={cn(
                            "group flex items-center gap-2 px-3 py-2 transition-opacity",
                            dragItemId === item.id && "opacity-40",
                          )}
                        >
                          <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/50 hover:text-muted-foreground" />
                          <ItemTypeIcon type={item.type} size="sm" className="shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{item.name}</div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {ITEM_TYPE_LABELS[item.type]}
                            </div>
                          </div>
                          {/* Quick actions */}
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => { setEditorOpen(true, item.id); onOpenChange(false); }}
                              aria-label="Edit"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-red-400"
                              onClick={() => handleTrash(item.id)}
                              aria-label="Move to trash"
                              title="Move to trash"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
