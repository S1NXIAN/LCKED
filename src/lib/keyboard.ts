/**
 * LCKED — Keyboard settings (WCAG 2.1.4 compliance)
 * ---------------------------------------------------------------------------
 * Provides three compliance layers for single-key shortcuts:
 *   1. Global disable toggle
 *   2. Per-shortcut remapping
 *   3. Input-scoped disabling (handled in useVaultKeybinds)
 *
 * Persisted to localStorage via Zustand persist. Never touches crypto or items.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Canonical shortcut IDs. The `default` field is the canonical binding. */
export interface ShortcutDef {
  id: string;
  /** Display label shown in the cheat sheet + settings. */
  label: string;
  /** Default binding, e.g. "Meta+Shift+L". Empty for single-key like "j". */
  default: string;
  /** Category for grouping in the cheat sheet. */
  category: "global" | "list" | "detail" | "palette";
}

export const SHORTCUTS: ShortcutDef[] = [
  // Global
  { id: "palette", label: "Open command palette", default: "Meta+K", category: "global" },
  { id: "lock", label: "Lock vault", default: "Meta+Shift+L", category: "global" },
  { id: "generator", label: "Password generator", default: "Meta+G", category: "global" },
  { id: "newItem", label: "New login", default: "Meta+N", category: "global" },
  { id: "edit", label: "Edit active item", default: "Meta+E", category: "global" },
  { id: "cheatSheet", label: "Show keyboard shortcuts", default: "?", category: "global" },
  { id: "focusSearch", label: "Focus search", default: "/", category: "global" },

  // List navigation (single-key — WCAG-relevant)
  { id: "navDown", label: "Next item", default: "j", category: "list" },
  { id: "navUp", label: "Previous item", default: "k", category: "list" },
  { id: "openItem", label: "Open item / go to website", default: "Enter", category: "list" },
  { id: "focusDetail", label: "Move to detail pane", default: "ArrowRight", category: "list" },
  { id: "focusList", label: "Return to list", default: "ArrowLeft", category: "detail" },
  { id: "leaderG", label: "Filters (g then letter)", default: "g", category: "list" },
  { id: "editItem", label: "Edit (single-key)", default: "e", category: "list" },
  { id: "duplicate", label: "Duplicate (single-key)", default: "d", category: "list" },
  { id: "copyPrimary", label: "Copy username (single-key)", default: "c", category: "list" },
  { id: "toggleFav", label: "Toggle favorite (single-key)", default: "f", category: "list" },
  { id: "archive", label: "Delete (single-key)", default: "Backspace", category: "list" },
  { id: "revealQuasimode", label: "Hold to reveal secrets", default: "Alt", category: "list" },

  // Detail copy (modifier-tiered — 1Password signature)
  { id: "copyUsername", label: "Copy username", default: "Meta+C", category: "detail" },
  { id: "copyPassword", label: "Copy password", default: "Meta+Shift+C", category: "detail" },
  { id: "copyTotp", label: "Copy verification code", default: "Meta+Alt+C", category: "detail" },
  { id: "largeType", label: "Large-type reveal", default: "Shift+R", category: "detail" },

  // Favorites
  { id: "fav1", label: "Open favorite #1", default: "Meta+1", category: "global" },
  { id: "fav2", label: "Open favorite #2", default: "Meta+2", category: "global" },
  { id: "fav3", label: "Open favorite #3", default: "Meta+3", category: "global" },
];

interface KeyboardSettings {
  /** Master disable for all single-key shortcuts (WCAG 2.1.4 path 1). */
  singleKeyDisabled: boolean;
  /** Per-shortcut overrides keyed by shortcut id. */
  bindings: Record<string, string>;
  /** Pinned favorite item ids for ⌘1–⌘9. */
  favorites: (string | null)[];
  setSingleKeyDisabled: (v: boolean) => void;
  rebind: (id: string, binding: string) => void;
  resetBindings: () => void;
  setFavorite: (slot: number, itemId: string | null) => void;
  /** Resolve the effective binding for a shortcut (override or default). */
  bindingFor: (id: string) => string;
}

const defaultBindings = () =>
  SHORTCUTS.reduce<Record<string, string>>((acc, s) => {
    acc[s.id] = s.default;
    return acc;
  }, {});

export const useKeyboardSettings = create<KeyboardSettings>()(
  persist(
    (set, get) => ({
      singleKeyDisabled: false,
      bindings: defaultBindings(),
      favorites: [null, null, null],
      setSingleKeyDisabled: (v) => set({ singleKeyDisabled: v }),
      rebind: (id, binding) => set((s) => ({ bindings: { ...s.bindings, [id]: binding } })),
      resetBindings: () => set({ bindings: defaultBindings() }),
      setFavorite: (slot, itemId) =>
        set((s) => {
          const next = [...s.favorites];
          while (next.length < 9) next.push(null);
          next[slot] = itemId;
          return { favorites: next.slice(0, 9) };
        }),
      bindingFor: (id) => get().bindings[id] ?? SHORTCUTS.find((s) => s.id === id)?.default ?? "",
    }),
    { name: "lcked-keyboard" },
  ),
);

/**
 * Parse a binding string ("Meta+Shift+L" / "j" / "Alt") into a predicate
 * that matches a KeyboardEvent. Modifier names follow MDN aria-keyshortcuts:
 * Alt, Control, Shift, Meta. Bare key = single-key shortcut.
 */
export function matchBinding(binding: string, e: KeyboardEvent): boolean {
  const parts = binding.split("+").map((p) => p.trim());
  const key = parts[parts.length - 1].toLowerCase();

  // Modifier-key-only bindings (e.g. "Alt" quasimode): match on the modifier
  // itself being pressed, with no other modifiers and a non-character key.
  if (parts.length === 1 && (parts[0] === "Alt" || parts[0] === "Shift" || parts[0] === "Meta" || parts[0] === "Control")) {
    if (parts[0] === "Alt") return e.altKey;
    if (parts[0] === "Shift") return e.shiftKey;
    if (parts[0] === "Meta") return e.metaKey;
    if (parts[0] === "Control") return e.ctrlKey;
  }

  const eKey = e.key.toLowerCase();
  // Normalise some key names.
  const keyNorm = key === "enter" ? "enter" : key === "backspace" ? "backspace" : key === "arrowright" ? "arrowright" : key === "arrowleft" ? "arrowleft" : key === "arrowup" ? "arrowup" : key === "arrowdown" ? "arrowdown" : key;
  const eKeyNorm = eKey === "enter" ? "enter" : eKey === "backspace" ? "backspace" : eKey === "arrowright" ? "arrowright" : eKey === "arrowleft" ? "arrowleft" : eKey === "arrowup" ? "arrowup" : eKey === "arrowdown" ? "arrowdown" : eKey;

  if (eKeyNorm !== keyNorm) return false;
  // For bare single-key shortcuts, no modifiers should be held (except the
  // quasimode-ish ones which are handled above).
  if (parts.length === 1) {
    return !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
  }
  // STRICT modifier matching: a modifier in the binding must be pressed,
  // and a modifier NOT in the binding must be absent. This prevents
  // "Meta+C" from matching "Meta+Shift+C".
  const want = new Set(parts);
  return (
    (want.has("Meta") === e.metaKey) &&
    (want.has("Control") === e.ctrlKey) &&
    (want.has("Shift") === e.shiftKey) &&
    (want.has("Alt") === e.altKey)
  );
}

/** True if the active element is a text input where single-keys must be disabled. */
export function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  // cmdk wraps input in a combobox; treat the palette as always-typing.
  if (el.closest("[role='combobox'], [cmdk-root]")) return true;
  return false;
}

/** Render a binding for display in a keycap. */
export function formatBinding(binding: string): string {
  const platform = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "mac" : "other";
  return binding
    .split("+")
    .map((p) => {
      const t = p.trim();
      if (platform === "mac") {
        if (t === "Meta") return "⌘";
        if (t === "Shift") return "⇧";
        if (t === "Alt") return "⌥";
        if (t === "Control") return "⌃";
      }
      if (t === "Meta") return "Ctrl";
      return t;
    })
    .join(platform === "mac" ? "" : "+");
}
