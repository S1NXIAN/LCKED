"use client";

import * as React from "react";

export type SortKey = "newest" | "oldest" | "alphabetical" | "reverseAlpha";

/**
  * Persisted list sort (localStorage key "lcked-sort"). SSR and unknown
  * stored values fall back to "newest"; writes are best-effort.
  */
export function useItemSort(): [SortKey, (next: SortKey) => void] {
  // Sort persistence — read the initial value from localStorage so the
  // user's last sort preference survives reloads.
  const [sort, setSortState] = React.useState<SortKey>(() => {
    if (typeof window === "undefined") return "newest";
    const stored = window.localStorage.getItem("lcked-sort") as SortKey | null;
    return stored === "newest" || stored === "oldest" || stored === "alphabetical" || stored === "reverseAlpha"
      ? stored
      : "newest";
  });
  const setSort = React.useCallback((next: SortKey) => {
    setSortState(next);
    try {
      window.localStorage.setItem("lcked-sort", next);
    } catch {
      // localStorage may be denied (private mode, etc.) — best-effort.
    }
  }, []);
  return [sort, setSort];
}
