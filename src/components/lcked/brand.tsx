"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export function LckedBrand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
        <Lock className="h-5 w-5" />
      </div>
      <div className="leading-none">
        <div className="text-lg font-bold tracking-tight">
          LCK<span className="text-primary">ED</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Local vault
        </div>
      </div>
    </div>
  );
}
