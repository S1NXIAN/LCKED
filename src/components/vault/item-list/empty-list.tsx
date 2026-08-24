"use client";

import { Button } from "@/components/ui/button";
import { useVault } from "@/store/vault";

import { DiamondMark } from "../diamond-mark";

export function EmptyList({
  hasItems,
  isTrash,
  onCreate,
}: {
  hasItems: boolean;
  isTrash: boolean;
  onCreate: () => void;
}) {
  const setActiveVault = useVault((s) => s.setActiveVault);
  const setSettingsOpen = useVault((s) => s.setSettingsOpen);
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
      <p className="text-muted-foreground mt-1.5 max-w-[16rem] text-xs leading-relaxed">
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSettingsOpen(true, "import")}
          >
            Import from another password manager
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
