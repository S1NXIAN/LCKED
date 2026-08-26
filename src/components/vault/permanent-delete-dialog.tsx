"use client";

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

/** Sentence naming the purge target: quoted label when known, counted
 * items otherwise. Shared by the dialog body and its tests. */
export function purgeTargetCopy(
  label: string | undefined,
  count: number,
): string {
  return label
    ? `“${label}” will be permanently erased.`
    : `${count} ${count === 1 ? "item" : "items"} will be permanently erased.`;
}

/**
 * The single confirmation gate for every irreversible purge — trash-row
 * delete, bulk delete, empty trash, detail-pane delete. Recoverable
 * actions (move to trash) deliberately do NOT route through here; this
 * dialog exists so the friction gradient always matches the destruction
 * gradient.
 */
export function PermanentDeleteDialog({
  open,
  onOpenChange,
  label,
  count = 1,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Item name for single-item deletes; omit for count-based copy. */
  label?: string;
  count?: number;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            {purgeTargetCopy(label, count)} This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Delete forever
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
