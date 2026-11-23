"use client";

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
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

  if (status === "error") return <VaultReadError />;
  if (status === "setup") return <SetupView />;
  if (status === "locked") return <UnlockView />;
  return <VaultView />;
}

/** Shown when the initial Vault read throws. Setup would overwrite data that
 *  may still be readable after a retry, so the only action is Retry. */
function VaultReadError() {
  const init = useVault((s) => s.init);

  return (
    <div className="relative flex h-dvh w-full flex-col items-center justify-center overflow-hidden px-4">
      <DotField className="pointer-events-auto absolute inset-0 h-full w-full" />
      <div
        className="lcked-glow pointer-events-none absolute inset-0"
        aria-hidden="true"
      />

      <div
        role="alert"
        className="border-border/60 bg-card/40 relative flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border p-6 text-center shadow-2xl backdrop-blur-xl"
      >
        <AlertTriangle className="text-signal-warning h-8 w-8" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Couldn&apos;t open your vault
          </h1>
          <p className="text-muted-foreground text-sm">
            LCKED couldn&apos;t read this device&apos;s storage. Your encrypted
            items were not changed.
          </p>
        </div>
        <Button onClick={() => void init()} className="w-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    </div>
  );
}
