"use client";

import * as React from "react";
import { estimateStrength } from "@/lib/generator/generator";
import { cn } from "@/lib/utils";

const LABEL_COLORS = [
  "text-red-400",
  "text-orange-400",
  "text-amber-400",
  "text-lime-400",
  "text-emerald-400",
];

const BAR_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
];

/** Inline strength meter with live crack-time estimate. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const result = React.useMemo(() => estimateStrength(password), [password]);
  if (!password) return null;

  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <div className="flex h-1.5 flex-1 gap-1 overflow-hidden rounded-full bg-muted">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-full flex-1 rounded-full transition-colors duration-300",
              i <= result.score ? BAR_COLORS[result.score] : "bg-transparent",
            )}
          />
        ))}
      </div>
      <span className={cn("w-24 shrink-0 text-right text-xs font-medium", LABEL_COLORS[result.score])}>
        {result.label}
      </span>
    </div>
  );
}
