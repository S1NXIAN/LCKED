"use client";

import * as React from "react";
import { toast } from "sonner";

import { copyWithAutoClear, type TimeoutHandle } from "./clipboard";

/**
 * Shared copy-with-feedback for secret fields: writes through
 * `copyWithAutoClear` (or raw clipboard when `noAutoClear`), flashes
 * `copied` for 1.5s so buttons can swap Copy→Check, reports via toast,
 * and cleans up its flash timer on unmount. One hook per component;
 * button markup stays site-specific.
 */
export function useSecretCopy() {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<TimeoutHandle | undefined>(undefined);

  // Clear the flash timer on unmount — no setState-after-unmount.
  React.useEffect(
    () => () => {
      clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = React.useCallback(
    async (
      value: string | undefined,
      label: string,
      opts?: { noAutoClear?: boolean },
    ): Promise<boolean> => {
      if (!value) return false;
      try {
        if (opts?.noAutoClear) {
          await navigator.clipboard.writeText(value);
        } else {
          await copyWithAutoClear(value, label);
        }
        setCopied(true);
        toast.success(
          `${label} copied`,
          opts?.noAutoClear ? undefined : { description: "Auto-clears in 30s" },
        );
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 1500);
        return true;
      } catch {
        toast.error("Clipboard access denied");
        return false;
      }
    },
    [],
  );

  return { copied, copy };
}
