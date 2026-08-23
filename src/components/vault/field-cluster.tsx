"use client";

/**
 * LCKED — field-cluster primitives shared by the item editor's per-type
 * field sections and the item detail view (Proton-style grouping).
 */

import { type LucideIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/** Bordered card grouping related editable rows, divided by 1px lines. */
export function FieldCluster({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-secondary/10 dark:bg-secondary/10 overflow-hidden rounded-xl border">
      {children}
    </div>
  );
}

/**
 * FieldCluster with a small section header above the card. Used for SECONDARY
 * clusters (TOTP / Websites / Notes / Custom fields) to break up the visual
 * monotony of a stack of identical cards — the primary credentials cluster
 * stays bare for a cleaner look.
 *
 * The header is OUTSIDE the card (per spec), and may carry an optional
 * `action` node on its right (e.g. the "Add" button for custom fields).
 */
export function FieldClusterWithLabel({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-muted-foreground/60 text-[10px] font-medium tracking-wider uppercase">
          {label}
        </span>
        {action}
      </div>
      <FieldCluster>{children}</FieldCluster>
    </div>
  );
}

/** A labelled field row inside a FieldCluster. Matches the item-detail
 *  FieldRow layout: icon (optional) in the flow, label+input stacked in a
 *  flex-1 div. This keeps the editor visually faithful to the detail view.
 *  `icon` — optional leading SVG rendered in the flow (NOT absolute), same
 *  as item-detail's FieldRow. */
export function FieldRowInput({
  label,
  icon: Icon,
  first,
  children,
}: {
  label?: string;
  icon?: LucideIcon;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3.5 py-2.5",
        !first && "border-border/50 border-t",
      )}
    >
      {Icon && <Icon className="text-muted-foreground/70 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1">
        {label && (
          <div className="text-muted-foreground/70 mb-0.5 text-[10px] font-medium tracking-wider uppercase">
            {label}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Flat borderless input used inside FieldCluster rows. */
export const flatInputCls =
  "w-full border-0 bg-transparent dark:bg-transparent px-0 py-0.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:outline-none";

/** Flat borderless variant for PasswordField — keeps right padding for action buttons.
 *  No explicit pl-* here — the PasswordField component adds pl-9 when an icon
 *  is present (via cn(..., Icon && "pl-9", inputClassName)). */
export const flatPasswordInputCls =
  "w-full border-0 bg-transparent dark:bg-transparent py-0.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:outline-none";

/** Flat borderless textarea used inside FieldCluster rows. */
export const flatTextareaCls =
  "w-full border-0 bg-transparent dark:bg-transparent px-0 py-0.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:outline-none resize-none";
