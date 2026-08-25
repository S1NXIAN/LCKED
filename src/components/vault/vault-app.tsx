"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

import { useVault } from "@/store/vault";

import { BrandLockup } from "./brand-lockup";
import { DiamondMark } from "./diamond-mark";
import { DotField } from "./dot-field";
import { SetupView } from "./setup-view";
import { UnlockView } from "./unlock-view";
import { VaultView } from "./vault-view";

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
    void init();
  }, [init]);

  if (status === "loading") {
    return (
      <div className="relative flex h-dvh w-full flex-col items-center justify-center gap-6 overflow-hidden">
        {/* Dot field backdrop */}
        <DotField className="pointer-events-auto absolute inset-0 h-full w-full" />

        {/* Gradient backdrop */}
        <div
          className="lcked-glow pointer-events-none absolute inset-0"
          aria-hidden="true"
        />

        {/* Centered loading screen */}
        <div className="relative flex flex-col items-center gap-5">
          <BrandLockup
            className="gap-5"
            wordmarkClassName="text-2xl"
            mark={
              <div className="relative">
                <div
                  className="bg-primary/20 absolute inset-0 -m-4 animate-ping rounded-full"
                  aria-hidden="true"
                />
                <div
                  className="bg-primary/10 absolute inset-0 -m-2 rounded-full blur-md"
                  aria-hidden="true"
                />
                <div className="text-primary relative">
                  <DiamondMark size={52} glow className="lcked-pulse" />
                </div>
              </div>
            }
          />

          <div className="text-muted-foreground flex items-center gap-2 text-sm">
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
