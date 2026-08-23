"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  FolderInput,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { useVault } from "@/store/vault";

/* --------------------------- MultiSelectBar --------------------------- */

/**
  * Action bar for multi-select mode. The selection itself is owned by
  * ItemList and arrives via props; bulk actions apply to exactly the ids in
  * `selectedIds`, and every action ends by exiting multi-select mode.
  */
export function MultiSelectBar({
  open,
  setMultiSelect,
  selectedIds,
  vaults,
  isTrashView,
}: {
  /** Whether multi-select mode is on — the bar mounts while true. */
  open: boolean;
  setMultiSelect: React.Dispatch<React.SetStateAction<boolean>>;
  /** Live selection owned by ItemList — the ids bulk actions apply to. */
  selectedIds: Set<string>;
  vaults: { id: string; name: string; icon: string; color: string }[];
  isTrashView: boolean;
}) {
  const trashItems = useVault((s) => s.trashItems);
  const moveItemsToVault = useVault((s) => s.moveItemsToVault);
  const restoreItems = useVault((s) => s.restoreItems);
  const permanentlyDeleteItems = useVault((s) => s.permanentlyDeleteItems);

  const handleMultiTrash = async () => {
    if (selectedIds.size === 0) return;
    try {
      const { moved, failed } = await trashItems(Array.from(selectedIds));
      if (moved > 0 && failed === 0) toast.success(`Moved ${moved} to Trash`);
      else if (moved > 0 && failed > 0) toast.warning(`Moved ${moved}, ${failed} failed`);
      else if (failed > 0) toast.error(`Could not move ${failed} item${failed === 1 ? "" : "s"}`);
    } catch {
      toast.error("Could not move items");
    }
    setMultiSelect(false);
  };
  const handleMultiMove = async (vaultId: string | null) => {
    if (selectedIds.size === 0) return;
    const label =
      vaultId === null ? "All Items" : vaults.find((v) => v.id === vaultId)?.name ?? "vault";
    try {
      const { moved, failed } = await moveItemsToVault(Array.from(selectedIds), vaultId);
      if (moved > 0 && failed === 0) toast.success(`Moved ${moved} to ${label}`);
      else if (moved > 0 && failed > 0) toast.warning(`Moved ${moved}, ${failed} failed`);
      else if (failed > 0) toast.error(`Could not move ${failed} item${failed === 1 ? "" : "s"}`);
    } catch {
      toast.error("Could not move items");
    }
    setMultiSelect(false);
  };
  const handleMultiRestore = async () => {
    if (selectedIds.size === 0) return;
    try {
      const { restored, failed } = await restoreItems(Array.from(selectedIds));
      if (restored > 0 && failed === 0) toast.success(`Restored ${restored} item${restored === 1 ? "" : "s"}`);
      else if (restored > 0 && failed > 0) toast.warning(`Restored ${restored}, ${failed} failed`);
      else if (failed > 0) toast.error(`Could not restore ${failed} item${failed === 1 ? "" : "s"}`);
    } catch {
      toast.error("Could not restore items");
    }
    setMultiSelect(false);
  };
  const handleMultiDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const { deleted, failed } = await permanentlyDeleteItems(Array.from(selectedIds));
      if (deleted > 0 && failed === 0) toast.success(`Permanently deleted ${deleted} item${deleted === 1 ? "" : "s"}`);
      else if (deleted > 0 && failed > 0) toast.warning(`Deleted ${deleted}, ${failed} failed`);
      else if (failed > 0) toast.error(`Could not delete ${failed} item${failed === 1 ? "" : "s"}`);
    } catch {
      toast.error("Could not delete items");
    }
    setMultiSelect(false);
  };

  return (
    <AnimatePresence>
      {open && (
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
  );
}
