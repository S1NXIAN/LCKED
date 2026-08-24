"use client";

import type * as React from "react";

import { runBulk } from "@/components/vault/bulk-report";
import { cn } from "@/lib/utils";
import { useVault } from "@/store/vault";

import { parseDraggedIds } from "./drag-drop";

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
  /** Drag-and-drop target vault id. Omit to disable dropping; `null`
   * targets the main vault (drops the items' vault memberships). */
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
export function VaultRow({
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
    const { moveItemsToVault, exitMultiSelect } = useVault.getState();
    const outcome = await runBulk(
      () => moveItemsToVault(ids, dropVaultId ?? null),
      "Moved",
      { tail: `to ${label}` },
    );
    // Exit multi-select if more than one item was dragged.
    if (ids.length > 1 && outcome && outcome.done > 0) exitMultiSelect();
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
        // No focus-visible ring — native typeahead (number keys, etc.) moves
        // focus to role="button" rows and would show a border on every keypress.
        "focus:outline-none",
        active
          ? "text-accent-foreground"
          : warn
            ? "text-foreground hover:bg-amber-500/10"
            : "text-foreground/80 hover:bg-muted/60 hover:text-foreground",
        dragOver &&
          "ring-primary/60 ring-offset-background ring-2 ring-offset-1",
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-tight font-medium">
          {label}
        </span>
        <span
          className={cn(
            "block text-xs leading-tight tabular-nums",
            warn && !active
              ? "text-amber-400/80"
              : active
                ? "text-accent-foreground/70"
                : "text-muted-foreground",
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
