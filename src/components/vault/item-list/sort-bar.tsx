"use client";

import * as React from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUpDown,
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  CreditCard,
  History,
  KeyRound,
  LayoutGrid,
  ListChecks,
  MoreVertical,
  Square,
  StickyNote,
  UserRound,
} from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FilterType, ItemType } from "@/lib/types";
import type { SortKey } from "./use-item-sort";

const TYPE_OPTIONS: { value: "all" | ItemType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "all", label: "All", icon: LayoutGrid },
  { value: "login", label: "Logins", icon: KeyRound },
  { value: "note", label: "Notes", icon: StickyNote },
  { value: "card", label: "Cards", icon: CreditCard },
  { value: "identity", label: "Identities", icon: UserRound },
];

const SORT_OPTIONS: { value: SortKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "newest", label: "Newest", icon: Clock },
  { value: "oldest", label: "Oldest", icon: History },
  { value: "alphabetical", label: "A–Z", icon: ArrowDownAZ },
  { value: "reverseAlpha", label: "Z–A", icon: ArrowUpAZ },
];

/**
  * Custom SelectItem for the Type filter. Renders a leading type icon
  * OUTSIDE the ItemText (so it does NOT get cloned into the trigger by
  * radix SelectValue) + its own check indicator.
  *
  * Layout in the dropdown: [type-icon] [label] ……… [check]
  * The trigger shows only the cloned text (label), centered.
  */
function TypeSelectItem({
  value,
  icon: Icon,
  label,
}: {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      )}
    >
      {/* Icon is OUTSIDE ItemText so radix does NOT clone it into the trigger. */}
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-3.5 w-3.5 text-primary" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

/* ------------------------------- SortBar ------------------------------ */

/**
  * Filter/sort bar above the list: the type filter Select, the sort
  * dropdown, and the 3-dots menu that toggles multi-select and selects or
  * deselects all rows. Selection state lives in ItemList; this bar reads it
  * and requests changes through props.
  */
export function SortBar({
  filter,
  setFilter,
  sort,
  setSort,
  multiSelect,
  setMultiSelect,
  filteredCount,
  selectedCount,
  onSelectAll,
  onDeselectAll,
}: {
  /** Type filter (All / Login / Note / Card / Identity). */
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  sort: SortKey;
  setSort: (next: SortKey) => void;
  multiSelect: boolean;
  setMultiSelect: React.Dispatch<React.SetStateAction<boolean>>;
  /** Number of items after filtering — gates Select all. */
  filteredCount: number;
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  return (
    <div className="border-b border-border bg-background px-3 py-2">
      <div className="flex items-center gap-2">
        <Select
          value={typeof filter === "string" ? filter : "all"}
          onValueChange={(v) => setFilter(v as FilterType)}
        >
          {/* Trigger: [icon left] [text centered in remaining space] [chevron]
                              The icon is rendered explicitly on the left; the SelectValue
                              (which clones only the label text, NOT the icon) is flex-1 +
                              text-center so the label centers in the space between the icon
                              and the chevron. */}
          <SelectTrigger size="sm" className="h-8 w-[142px] shrink-0 border-border bg-muted/40 dark:bg-secondary/20">
            {(() => {
              const ActiveIcon = TYPE_OPTIONS.find((o) => o.value === (typeof filter === "string" ? filter : "all"))?.icon ?? LayoutGrid;
              return <ActiveIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
            })()}
            <SelectValue placeholder="Type" className="flex-1 text-center" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
              <TypeSelectItem
                key={opt.value}
                value={opt.value}
                icon={opt.icon}
                label={opt.label}
              />
            ))}
          </SelectContent>
        </Select>
        {/* Sort dropdown — outline + muted/40 + border-border to match
                          the type Select. The trigger shows the ACTIVE sort's icon (not
                          a generic ArrowUpDown) so the current sort is readable at a
                          glance. Each item in the menu carries its own icon + a check on
                          the active option. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 border-border bg-muted/40 px-2.5 hover:bg-muted/60 dark:bg-secondary/20"
            >
              {(() => {
                const TriggerIcon = SORT_OPTIONS.find((o) => o.value === sort)?.icon ?? ArrowUpDown;
                return <TriggerIcon className="h-3.5 w-3.5 text-muted-foreground" />;
              })()}
              <span className="text-xs">{SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort"}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            {SORT_OPTIONS.map((opt) => {
              const OptIcon = opt.icon;
              const isActive = sort === opt.value;
              return (
                <DropdownMenuItem
                  key={opt.value}
                  onSelect={() => setSort(opt.value)}
                  className="gap-2 text-xs"
                >
                  <OptIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {opt.label}
                  {isActive && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 3-dots multi-select + select-all menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="List actions"
              aria-pressed={multiSelect}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => setMultiSelect((m) => !m)}>
              <CheckSquare className="h-3.5 w-3.5" />
              {multiSelect ? "Exit multi-select" : "Multi-select"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSelectAll} disabled={filteredCount === 0}>
              <ListChecks className="h-3.5 w-3.5" />
              Select all
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDeselectAll} disabled={selectedCount === 0}>
              <Square className="h-3.5 w-3.5" />
              Deselect all
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </div>
  );
}
