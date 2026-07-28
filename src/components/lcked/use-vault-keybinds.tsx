"use client";

/**
 * LCKED — Vault keybinds (the keyboard system)
 * ---------------------------------------------------------------------------
 * Implements the full Phase-A keyboard system from LCKED-DESIGN-PLAN.md:
 *   • Global shortcuts (⌘K, ⌘⇧L lock, ⌘G, ⌘N, ⌘E, ⌘1–⌘9 favorites)
 *   • List verbs (j/k nav, e edit, d duplicate, c copy-primary, f favorite,
 *     ⌫ delete, Enter open, →/← spatial routing)
 *   • Leader-key g-filters (ga/gl/gc/gn/gi) with a visible hint chip
 *   • Hold-⌥ quasimode reveal (global reveal-all flag)
 *   • ? cheat sheet, / focus search
 *   • ARIA live region announcing selection
 *   • WCAG 2.1.4: respects singleKeyDisabled + remappable bindings
 *
 * The hook returns { revealAll, leaderKey } so the UI can react to the
 * quasimode and render the leader-key hint chip.
 */

import * as React from "react";
import { useVault, copyWithAutoClear } from "@/store/vault";
import {
  isTyping,
  matchBinding,
  useKeyboardSettings,
} from "@/lib/keyboard";
import { recordUse } from "@/lib/frecency";
import { stashNewItemType } from "./new-item-stash";
import { toast } from "sonner";
import type { FilterType, VaultItem } from "@/lib/types";

export interface VaultKeybinds {
  /** True while ⌥ is held — UI reveals all masked fields. */
  revealAll: boolean;
  /** Active leader-key state: null | "g" (waiting for next key). */
  leader: string | null;
}

/** A tiny ARIA live region mounted once; updates announce selection. */
function useAriaLiveAnnouncer() {
  const announce = React.useCallback((msg: string) => {
    const el = (typeof window !== "undefined" ? (window as any).__lckedAriaLive : null) as HTMLDivElement | null;
    if (!el) return;
    // Toggle to force re-announcement of identical strings.
    el.textContent = "";
    requestAnimationFrame(() => {
      const node = (typeof window !== "undefined" ? (window as any).__lckedAriaLive : null) as HTMLDivElement | null;
      if (node) node.textContent = msg;
    });
  }, []);
  return { announce };
}

function primarySecret(item: VaultItem): { label: string; value: string } | null {
  switch (item.type) {
    case "login":
      if (item.details.password) return { label: "Password", value: item.details.password };
      if (item.details.username) return { label: "Username", value: item.details.username };
      return null;
    case "card":
      if (item.details.number) return { label: "Card number", value: item.details.number };
      return null;
    case "note":
      return null;
    case "identity":
      if (item.details.email) return { label: "Email", value: item.details.email };
      return null;
  }
}

function copyField(item: VaultItem, which: "username" | "password" | "totp"): string | null {
  if (item.type !== "login") {
    // For non-logins, "username" maps to the primary copyable field.
    if (which === "username") {
      if (item.type === "card" && item.details.number) return item.details.number;
      if (item.type === "identity" && item.details.email) return item.details.email;
    }
    return null;
  }
  if (which === "username") return item.details.username || null;
  if (which === "password") return item.details.password || null;
  if (which === "totp") return item.details.totp || null;
  return null;
}

export function useVaultKeybinds(
  onCheatSheet: () => void,
  setFilter?: (f: FilterType) => void,
  onLargeType?: (value: string, label: string) => void,
): VaultKeybinds {
  const [revealAll, setRevealAll] = React.useState(false);
  const [leader, setLeader] = React.useState<string | null>(null);

  const vault = useVault();
  const settings = useKeyboardSettings();
  const bindingFor = useKeyboardSettings((s) => s.bindingFor);
  const singleKeyDisabled = useKeyboardSettings((s) => s.singleKeyDisabled);

  const { announce } = useAriaLiveAnnouncer();
  // Stable ref so the keydown listener always reads the latest state.
  const stateRef = React.useRef({ revealAll, leader });
  React.useEffect(() => {
    stateRef.current = { revealAll, leader };
  }, [revealAll, leader]);

  // Build a filtered list reference for navigation.
  const items = useVault((s) => s.items);
  const searchQuery = useVault((s) => s.searchQuery);
  const [filterState] = React.useState<{ v: FilterType }>({ v: "all" });
  // We can't import searchItems here without a cycle concern; replicate the
  // minimal filter the list uses. The list & this hook both read the same
  // store, so selection stays consistent because the list sets selectedId.
  const filtered = React.useMemo(() => {
    let list = items;
    if (filterState.v === "favorites") list = list.filter((i) => i.favorite);
    else if (filterState.v !== "all") list = list.filter((i) => i.type === filterState.v);
    // light filter by search query (full fuzzy lives in the list component;
    // for keyboard nav we only need a stable order matching the visible list)
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((i) => i.name.toLowerCase().includes(q) || JSON.stringify(i).toLowerCase().includes(q));
    }
    return list;
  }, [items, filterState.v, searchQuery]);
  void filtered; // filtered used via vault selection in handlers

  // Keep a ref of the filtered list for stable handlers (declared before
  // moveSelection which reads it).
  const filteredRef = React.useRef(filtered);
  React.useEffect(() => {
    filteredRef.current = filtered;
  }, [filtered]);

  const moveSelection = React.useCallback(
    (dir: 1 | -1) => {
      const sel = useVault.getState().selectedId;
      const list = filteredRef.current;
      if (list.length === 0) return;
      const idx = list.findIndex((i) => i.id === sel);
      const next = idx === -1 ? 0 : Math.min(list.length - 1, Math.max(0, idx + dir));
      const item = list[next];
      useVault.getState().setSelected(item.id);
      announce(`Selected: ${item.name}, ${item.type}, ${next + 1} of ${list.length}`);
      recordUse(item.id);
    },
    [announce],
  );

  // Copy helper — hoisted above the keydown effect so it can be referenced.
  const doCopy = React.useCallback((which: "username" | "password" | "totp") => {
    const sel = useVault.getState().selectedId;
    const it = useVault.getState().items.find((i) => i.id === sel);
    if (!it) return;
    const value = copyField(it, which);
    if (!value) {
      toast.error(`No ${which} to copy`);
      return;
    }
    copyWithAutoClear(value, which)
      .then(() => {
        const label = which === "totp" ? "Verification code" : which.charAt(0).toUpperCase() + which.slice(1);
        toast.success(`${label} copied`, { description: "Auto-clears in 30s" });
        if (it.id) recordUse(it.id);
      })
      .catch(() => toast.error("Clipboard access denied"));
  }, []);

  // Reset leader after a short timeout if no second key follows.
  React.useEffect(() => {
    if (!leader) return;
    const t = setTimeout(() => setLeader(null), 1200);
    return () => clearTimeout(t);
  }, [leader]);

  React.useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (useVault.getState().status !== "unlocked") return;
      const typing = isTyping(e);
      const mod = e.metaKey || e.ctrlKey;
      const b = (id: string) => bindingFor(id);

      // ⌥ quasimode reveal — works even in inputs (it's a modifier hold).
      if (e.altKey && !mod && !e.shiftKey && e.key === "Alt") {
        if (!stateRef.current.revealAll) setRevealAll(true);
        return;
      }

      // Cheat sheet (?) — works outside inputs.
      if (!typing && matchBinding(b("cheatSheet"), e)) {
        e.preventDefault();
        onCheatSheet();
        return;
      }

      // `/` focus search — outside inputs only.
      if (!typing && matchBinding(b("focusSearch"), e)) {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          'input[aria-label="Search vault items"]',
        );
        input?.focus();
        input?.select();
        return;
      }

      // Global modifier shortcuts.
      if (mod) {
        if (matchBinding(b("palette"), e)) {
          e.preventDefault();
          useVault.getState().setCommandOpen(true);
          return;
        }
        if (matchBinding(b("lock"), e)) {
          e.preventDefault();
          useVault.getState().lock();
          return;
        }
        if (matchBinding(b("generator"), e)) {
          e.preventDefault();
          useVault.getState().setGeneratorOpen(true);
          return;
        }
        if (matchBinding(b("newItem"), e) && !typing) {
          e.preventDefault();
          stashNewItemType("login");
          useVault.getState().setEditorOpen(true);
          return;
        }
        if (matchBinding(b("edit"), e) && !typing) {
          e.preventDefault();
          const sel = useVault.getState().selectedId;
          if (sel) useVault.getState().setEditorOpen(true, sel);
          return;
        }
        // ⌘1–⌘9 favorites.
        if (/^[1-9]$/.test(e.key)) {
          const slot = parseInt(e.key, 10) - 1;
          const favs = useKeyboardSettings.getState().favorites;
          const pinned = favs[slot];
          if (pinned) {
            e.preventDefault();
            useVault.getState().setSelected(pinned);
            announce("Opened favorite");
            return;
          }
        }
        // Detail copy: modifier-tiered (works when an item is selected).
        if (matchBinding(b("copyUsername"), e)) {
          e.preventDefault();
          doCopy("username");
          return;
        }
        if (matchBinding(b("copyPassword"), e)) {
          e.preventDefault();
          doCopy("password");
          return;
        }
        if (matchBinding(b("copyTotp"), e)) {
          e.preventDefault();
          doCopy("totp");
          return;
        }
        return;
      }

      // Single-key shortcuts — gated by WCAG disable + typing check.
      if (singleKeyDisabled || typing) {
        // Still allow Escape to blur/close handled elsewhere.
        return;
      }

      // Leader-key 'g' sequence.
      if (matchBinding(b("leaderG"), e)) {
        e.preventDefault();
        setLeader("g");
        return;
      }
      if (stateRef.current.leader === "g") {
        const map: Record<string, FilterType> = {
          a: "all",
          l: "login",
          c: "card",
          n: "note",
          i: "identity",
        };
        const f = map[e.key.toLowerCase()];
        if (f) {
          e.preventDefault();
          setFilter?.(f);
          announce(`Filter: ${f}`);
          setLeader(null);
          return;
        }
        // 'g' 'g' = generator
        if (e.key.toLowerCase() === "g") {
          e.preventDefault();
          useVault.getState().setGeneratorOpen(true);
          setLeader(null);
          return;
        }
        // 'g' 's' = settings
        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          useVault.getState().setSettingsOpen(true);
          setLeader(null);
          return;
        }
        // Unknown second key — cancel leader.
        setLeader(null);
        return;
      }

      // List navigation + verbs.
      if (matchBinding(b("navDown"), e)) {
        e.preventDefault();
        moveSelection(1);
        return;
      }
      if (matchBinding(b("navUp"), e)) {
        e.preventDefault();
        moveSelection(-1);
        return;
      }
      if (matchBinding(b("openItem"), e)) {
        e.preventDefault();
        const sel = useVault.getState().selectedId;
        const it = useVault.getState().items.find((i) => i.id === sel);
        if (it) {
          recordUse(it.id);
          if (it.type === "login" && it.details.urls[0]) {
            const url = it.details.urls[0];
            window.open(url.startsWith("http") ? url : `https://${url}`, "_blank", "noopener");
            if (it.details.password) {
              copyWithAutoClear(it.details.password, "password").catch(() => {});
              toast.success("Opened website · password copied", { description: "Auto-clears in 30s" });
            } else {
              toast.success("Opened website");
            }
          }
        }
        return;
      }
      if (matchBinding(b("focusDetail"), e)) {
        e.preventDefault();
        const detail = document.querySelector<HTMLElement>("[data-vault-detail]");
        detail?.focus();
        announce("Detail pane");
        return;
      }
      if (matchBinding(b("focusList"), e)) {
        e.preventDefault();
        const list = document.querySelector<HTMLElement>("[data-vault-list]");
        list?.focus();
        announce("List");
        return;
      }
      if (matchBinding(b("largeType"), e) && onLargeType) {
        e.preventDefault();
        const sel = useVault.getState().selectedId;
        const it = useVault.getState().items.find((i) => i.id === sel);
        if (it) {
          const secret = primarySecret(it);
          if (secret) onLargeType(secret.value, secret.label);
          else toast.error("No secret to reveal");
        }
        return;
      }
      if (matchBinding(b("editItem"), e)) {
        e.preventDefault();
        const sel = useVault.getState().selectedId;
        if (sel) useVault.getState().setEditorOpen(true, sel);
        return;
      }
      if (matchBinding(b("duplicate"), e)) {
        e.preventDefault();
        const sel = useVault.getState().selectedId;
        if (sel) {
          useVault.getState().duplicateItem(sel);
          toast.success("Item duplicated");
        }
        return;
      }
      if (matchBinding(b("copyPrimary"), e)) {
        e.preventDefault();
        doCopy("username");
        return;
      }
      if (matchBinding(b("toggleFav"), e)) {
        e.preventDefault();
        const sel = useVault.getState().selectedId;
        if (sel) useVault.getState().toggleFavorite(sel);
        return;
      }
      if (matchBinding(b("archive"), e)) {
        e.preventDefault();
        const sel = useVault.getState().selectedId;
        if (sel) {
          useVault.getState().trashItem(sel);
          toast.success("Moved to Trash");
        }
        return;
      }
    };

    const onUp = (e: KeyboardEvent) => {
      // Release of ⌥ ends the quasimode.
      if (!e.altKey && stateRef.current.revealAll) {
        setRevealAll(false);
      }
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [bindingFor, singleKeyDisabled, moveSelection, doCopy, announce, onCheatSheet, onLargeType, setFilter]);

  return { revealAll, leader };
}

/** The ARIA live region element. Mount once near the root. */
export function AriaLiveRegion() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  // Store the ref on window so the hook's announcer can find it. Simpler than
  // context for a single-instance region.
  React.useEffect(() => {
    (window as any).__lckedAriaLive = ref.current;
    return () => {
      delete (window as any).__lckedAriaLive;
    };
  }, []);
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  );
}

// (primarySecret kept for potential future use in large-type default target)
void primarySecret;
