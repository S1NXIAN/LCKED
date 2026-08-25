"use client";

import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Vertical brand lockup shared by the splash / setup / unlock screens:
 * an optional mark slot over the LCKED wordmark over the "LOCAL VAULT"
 * micro-caption. The caller owns the mark's size and treatment (glow,
 * pulse, halo) via the `mark` node; the container's `className` controls
 * the mark-to-text spacing and outer margins.
 */
export function BrandLockup({
  mark,
  wordmarkClassName,
  className,
}: {
  mark?: React.ReactNode;
  /** Size classes for the wordmark line; defaults to auth-screen sizing. */
  wordmarkClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      {mark}
      <div className="flex flex-col items-center gap-1">
        <div
          className={cn(
            "font-bold tracking-tight",
            wordmarkClassName ?? "text-xl sm:text-2xl",
          )}
        >
          LCK<span className="text-primary">ED</span>
        </div>
        <div className="text-muted-foreground text-[9px] tracking-[0.3em] uppercase">
          Local Vault
        </div>
      </div>
    </div>
  );
}
