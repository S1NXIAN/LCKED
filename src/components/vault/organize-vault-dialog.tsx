"use client";

import { FolderInput, GripVertical, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { VaultDef } from "@/lib/types";
import { cn } from "@/lib/utils";
import { vaultColorHex } from "@/lib/vault/vault-assets";
import { useVault } from "@/store/vault";

import { VAULT_LUCIDE_BY_ID } from "./vault-lucide-icons";

/**
 * LCKED — Organize Vault Dialog
 * ---------------------------------------------------------------------------
 * A pure vault-reordering sheet. Drag vaults up/down to change their position
 * in the sidebar. No create, no delete — just position management.
 *
 * Create/deleting vaults is handled via the sidebar's "+" button and the
 * per-vault 3-dots menu respectively.
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
  const reorderVaults = useVault((s) => s.reorderVaults);

  // Local reorder state — optimistic; synced to store on drop.
  const [localVaults, setLocalVaults] = React.useState<VaultDef[]>(vaults);
  React.useEffect(() => {
    setLocalVaults(vaults);
  }, [vaults, open]);

  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="border-border bg-background w-full gap-0 overflow-hidden border-l p-0 sm:max-w-[454px] [&>button:last-child]:hidden"
      >
        <SheetHeader className="border-border flex-row items-center justify-between gap-2 border-b px-4 py-3">
          <SheetTitle className="flex min-w-0 items-center gap-2.5 text-base font-semibold">
            <FolderInput className="text-primary h-4 w-4" />
            <span className="truncate">Organize vaults</span>
          </SheetTitle>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground h-8 w-8"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>
        <SheetDescription className="sr-only">
          Drag vaults to reorder their position in the sidebar.
        </SheetDescription>

        {/* Body */}
        <div className="lcked-scroll min-h-0 flex-1 overflow-y-auto p-4">
          <p className="text-muted-foreground mb-4 text-xs">
            Drag vaults to reorder their position in the sidebar.
          </p>

          {/* Vault list (draggable) */}
          {localVaults.length === 0 ? (
            <div className="text-muted-foreground py-10 text-center text-sm">
              No custom vaults to organize.
            </div>
          ) : (
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {localVaults.map((vault, index) => {
                  const count = items.filter(
                    (i) => !i.trashed && i.vaultIds.includes(vault.id),
                  ).length;
                  const isDragging = dragIndex === index;
                  const isOver =
                    dragOverIndex === index &&
                    dragIndex !== null &&
                    dragIndex !== index;
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
                      onDragLeave={() =>
                        setDragOverIndex((c) => (c === index ? null : c))
                      }
                      onDrop={() => handleDrop(index)}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                        isOver
                          ? "border-primary/60 bg-primary/5"
                          : "border-border hover:bg-muted/30",
                      )}
                    >
                      <GripVertical className="text-muted-foreground/50 hover:text-muted-foreground h-4 w-4 shrink-0 cursor-grab" />
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${hex}29`, color: hex }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {vault.name}
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          {count} item{count === 1 ? "" : "s"}
                        </div>
                      </div>
                      {/* Position number */}
                      <span className="text-muted-foreground/50 shrink-0 text-[10px] font-medium tabular-nums">
                        #{index + 1}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
