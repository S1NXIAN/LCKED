"use client";

/**
  * LCKED — ItemEditor form lifecycle.
  *
  * Owns the draft form state plus everything tied to its lifecycle: the
  * initial snapshot used for dirty-checking (IE-4), stable row keys for the
  * URL + custom-field lists (IE-2), and the per-type details cache that
  * preserves typed values when switching item type (IE-3).
  */

import * as React from "react";
import { useVault } from "@/store/vault";
import { type ItemType, type NewItemInput } from "@/lib/types";
import { toItemInput, ITEM_DEFAULTS } from "@/lib/items/item-crud";
import { consumeNewItemType } from "../new-item-stash";

function blankItem(type: ItemType): NewItemInput {
  const base = {
    name: "",
    ...ITEM_DEFAULTS,
  };
  if (type === "login") {
    return { ...base, type, details: { username: "", password: "", urls: [""], totp: "", notes: "" } };
  }
  if (type === "note") {
    return { ...base, type, details: { content: "" } };
  }
  if (type === "card") {
    return {
      ...base,
      type,
      details: { cardholder: "", number: "", brand: "", cvv: "", expiry: "", pin: "", notes: "" },
    };
  }
  return {
    ...base,
    type,
    details: {
      firstName: "", lastName: "", email: "", phone: "", company: "",
      address1: "", address2: "", city: "", state: "", zip: "", country: "", notes: "",
    },
  };
}

export function useItemForm() {
  const open = useVault((s) => s.editorOpen);
  const editorItemId = useVault((s) => s.editorItemId);
  const vaults = useVault((s) => s.vaults);

  const [form, setForm] = React.useState<NewItemInput | null>(null);
  // Stable React keys for URL + custom-field rows (IE-2). Index-based keys
  // cause focus/selection to jump to the wrong field when a middle row is
  // removed. These arrays stay in lockstep with urls / customFields.
  const [urlKeys, setUrlKeys] = React.useState<string[]>([]);
  const [cfKeys, setCfKeys] = React.useState<string[]>([]);
  const keyCounter = React.useRef(0);
  const nextKey = React.useCallback(() => `k${++keyCounter.current}`, []);
  // Track the initial form snapshot for dirty-checking (IE-4).
  const [initialForm, setInitialForm] = React.useState<string>("");
  // Per-type details cache so switching item types preserves the values
  // the user already typed for each type. Without this, switching Login →
  // Card → Login would wipe the Login fields (only name survived). The
  // cache is keyed by ItemType and stores the `details` object.
  const detailsCache = React.useRef<Partial<Record<ItemType, NewItemInput["details"]>>>({});
  // The detailsCache is cleared whenever the editor opens fresh.

  // Initialise form when the sheet opens. Depends ONLY on [open, editorItemId]
  // (IE-1) — the `items` array changes on every unrelated mutation (auto-purge,
  // duplicate, drag-drop), which would overwrite the user's unsaved edits.
  React.useEffect(() => {
    if (!open) {
      setForm(null);
      setUrlKeys([]);
      setCfKeys([]);
      setInitialForm("");
      detailsCache.current = {};
      return;
    }
    if (editorItemId) {
      // Read via getState() so we don't depend on the items array.
      const existing = useVault.getState().items.find((i) => i.id === editorItemId);
      if (existing) {
        const input = toItemInput(existing);
        setForm(input);
        setUrlKeys((existing.details as { urls?: string[] }).urls?.map(() => nextKey()) ?? []);
        setCfKeys(existing.customFields.map(() => nextKey()));
        setInitialForm(JSON.stringify(input));
        detailsCache.current = { [existing.type]: existing.details };
        return;
      }
    }
    // Honour a type pre-selected via ⌘K / icon rail, then clear the stash.
    const initialType = consumeNewItemType() ?? "login";
    const blank = blankItem(initialType);
    // When creating a new item while viewing a specific vault, auto-assign
    // the item to that vault so it appears in the current category (not just
    // "All Items"). Only real vault ids count — "all"/"favorites"/"trash" are
    // filters, not vaults.
    const activeVault = useVault.getState().activeVault;
    const isRealVault = activeVault && activeVault !== "all" && activeVault !== "favorites" && activeVault !== "trash";
    if (isRealVault && vaults.some((v) => v.id === activeVault)) {
      blank.vaultIds = [activeVault];
    }
    setForm(blank);
    setUrlKeys([""].map(() => nextKey()));
    setCfKeys([]);
    setInitialForm(JSON.stringify(blank));
    detailsCache.current = {};
  }, [open, editorItemId, nextKey, vaults]);

  // Switch item type while preserving overlapping fields (IE-3) AND the
  // per-type details via the detailsCache ref. Without the cache, switching
  // Login → Card → Login would lose every Login field the user typed.
  const switchType = (t: ItemType) => {
    setForm((f) => {
      if (!f) return f;
      // Stash the current type's details before switching.
      detailsCache.current[f.type] = f.details;
      const blank = blankItem(t);
      // Restore cached details for the target type if present; else blank.
      const cachedDetails = detailsCache.current[t];
      return {
        ...blank,
        name: f.name,
        favorite: f.favorite,
        pinned: f.pinned,
        folder: f.folder,
        customFields: f.customFields,
        vaultIds: f.vaultIds,
        details: (cachedDetails ?? blank.details) as NewItemInput["details"],
      } as NewItemInput;
    });
  };

  return {
    open, editorItemId, form, setForm,
    urlKeys, setUrlKeys, cfKeys, setCfKeys,
    nextKey, initialForm, switchType,
  };
}
