"use client";

import * as React from "react";

import { useVault } from "@/store/vault";

/**
 * AutoLockManager — invisible component that wires up the session-timeout logic.
 *  • Inactivity timer: resets on any user input; locks after settings.autoLockMinutes.
 *  • Visibility: optionally locks when the tab is hidden for a moment.
 *  • beforeunload: clears in-memory keys when the tab closes.
 *
 * Mounted once inside VaultView; only active while the vault is unlocked.
 */
export function AutoLockManager() {
  const status = useVault((s) => s.status);
  const lock = useVault((s) => s.lock);
  const autoLockMinutes = useVault((s) => s.settings.autoLockMinutes);
  const lockOnVisibility = useVault((s) => s.settings.lockOnVisibility);

  React.useEffect(() => {
    if (status !== "unlocked") return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const ms = autoLockMinutes * 60_000;

    const arm = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (ms > 0) {
        timeoutId = setTimeout(() => {
          lock();
        }, ms);
      }
    };

    // Any of these signal user activity → reset the timer.
    const reset = () => arm();
    const events = ["mousedown", "keydown", "touchstart", "scroll", "wheel"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    arm();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [status, autoLockMinutes, lock]);

  // Visibility-based lock (locks as soon as the tab is hidden, if enabled).
  React.useEffect(() => {
    if (status !== "unlocked" || !lockOnVisibility) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        lock();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
    // Deliberate: `lock` is a stable store action; re-subscribing on its
    // identity would add churn without changing behaviour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, lockOnVisibility]);

  // Clear keys when the tab is closing.
  React.useEffect(() => {
    if (status !== "unlocked") return;
    const onUnload = () => lock();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [status, lock]);

  return null;
}
