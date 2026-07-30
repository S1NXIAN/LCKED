"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useVault } from "@/store/vault";
import { SetupView } from "./setup-view";
import { UnlockView } from "./unlock-view";
import { VaultView } from "./vault-view";
import { DiamondMark } from "./diamond-mark";
import { DotField } from "./dot-field";

/**
 * Top-level router. Decides which screen to render based on the vault status:
 *   loading → splash
 *   setup   → first-time master password creation
 *   locked  → unlock screen
 *   unlocked → the full vault UI
 */
export function VaultApp() {
  const status = useVault((s) => s.status);
  const init = useVault((s) => s.init);

  React.useEffect(() => {
    init();
  }, [init]);

  if (status === "loading") {
    return (
      <div className="relative flex h-dvh w-full flex-col items-center justify-center overflow-hidden gap-6">
        {/* Dot field backdrop */}
        <DotField className="pointer-events-auto absolute inset-0 h-full w-full" />

        {/* Gradient backdrop */}
        <div className="lcked-glow pointer-events-none absolute inset-0" aria-hidden="true" />

        {/* Centered loading screen */}
        <div className="relative flex flex-col items-center gap-5">
          {/* Diamond in a pulsing glow ring */}
          <div className="relative">
            <div className="absolute inset-0 -m-4 animate-ping rounded-full bg-primary/20" aria-hidden="true" />
            <div className="absolute inset-0 -m-2 rounded-full bg-primary/10 blur-md" aria-hidden="true" />
            <div className="relative text-primary">
              <DiamondMark size={52} glow className="lcked-pulse" />
            </div>
          </div>

          {/* Wordmark */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-2xl font-bold tracking-tight">
              LCK<span className="text-primary">ED</span>
            </div>
            <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
              Local Vault
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Decrypting…
          </div>
        </div>
      </div>
    );
  }

  if (status === "setup") return <SetupView />;
  if (status === "locked") return <UnlockView />;
  return <VaultView />;
}
