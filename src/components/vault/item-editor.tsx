"use client";

/**
 * LCKED — ItemEditor (right sidebar)
 * ---------------------------------------------------------------------------
 * Slides in from the right as a Sheet (matching the password-generator and
 * create-vault sidebars). Handles both "New item" and "Edit item" modes,
 * driven by `editorOpen` + `editorItemId` in the vault store.
 *
 * Layout (mirrors create-vault-dialog aesthetic):
 *   • Header: live ItemTypeIcon + "New item"/"Edit item" title (left),
 *     vault selector dropdown + Save/Create button (right). NO close X — the
 *     radix Sheet's built-in Close (last child of SheetContent) is hidden via
 *     `[&>button:last-child]:hidden`.
 *   • Body: scrollable form. The Name field uses the flat borderless input
 *     pattern from create-vault-dialog; the remaining fields use labelled
 *     Inputs grouped into FieldCluster cards (matching item-detail's
 *     FieldRow presentation). All type-specific fields (login/note/card/
 *     identity), URLs, TOTP, notes, custom fields are preserved.
 *   • Footer: a single Cancel button (left). Save/Create lives in the header.
 *
 * All existing functionality is preserved: blankItem(), toItemInput(),
 * saveItem(), custom-field add/update/remove, login URL list helpers,
 * favourite toggle, folder, and card-brand detection.
 */

import * as React from "react";
import {
  Plus, Trash2, Star, Loader2, Check, ChevronsUpDown,
  Mail, User, KeyRound, Globe, CreditCard, Calendar, Lock,
  Phone, Building2, MapPin, StickyNote, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useVault } from "@/store/vault";
import {
  type CustomField,
  type ItemType,
  type NewItemInput,
  type VaultItem,
} from "@/lib/types";
import { detectCardBrand } from "@/lib/import-export";
import { toItemInput } from "@/lib/item-crud";
import { PasswordField } from "./password-field";
import { ItemTypeIcon, ITEM_TYPE_LABELS } from "./item-icons";
import { consumeNewItemType } from "./new-item-stash";
import { VaultIcon } from "./vaults-sidebar";
import { cn, isEmail } from "@/lib/utils";

function blankItem(type: ItemType): NewItemInput {
  const base = {
    name: "",
    favorite: false,
    pinned: false,
    folder: "",
    customFields: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    vaultIds: [] as string[],
    trashed: false,
    trashedAt: null as number | null,
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

/* -------------------- Field cluster (matches item-detail) -------------------- */

/** Bordered card grouping related editable rows, divided by 1px lines. */
function FieldCluster({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-secondary/10 dark:bg-secondary/10">
      {children}
    </div>
  );
}

/**
 * FieldCluster with a small section header above the card. Used for SECONDARY
 * clusters (TOTP / Websites / Notes / Custom fields) to break up the visual
 * monotony of a stack of identical cards — the primary credentials cluster
 * stays bare for a cleaner look.
 *
 * The header is OUTSIDE the card (per spec), and may carry an optional
 * `action` node on its right (e.g. the "Add" button for custom fields).
 */
function FieldClusterWithLabel({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          {label}
        </span>
        {action}
      </div>
      <FieldCluster>{children}</FieldCluster>
    </div>
  );
}

/** A labelled field row inside a FieldCluster. Matches the item-detail
 *  FieldRow layout: icon (optional) in the flow, label+input stacked in a
 *  flex-1 div. This keeps the editor visually faithful to the detail view.
 *  `icon` — optional leading SVG rendered in the flow (NOT absolute), same
 *  as item-detail's FieldRow. */
function FieldRowInput({
  label,
  icon: Icon,
  first,
  children,
}: {
  label?: string;
  icon?: LucideIcon;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-3.5 py-2.5", !first && "border-t border-border/50")}>
      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />}
      <div className="min-w-0 flex-1">
        {label && (
          <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
            {label}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Flat borderless input used inside FieldCluster rows. */
const flatInputCls =
  "w-full border-0 bg-transparent dark:bg-transparent px-0 py-0.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:outline-none";

/** Flat borderless variant for PasswordField — keeps right padding for action buttons.
 *  No explicit pl-* here — the PasswordField component adds pl-9 when an icon
 *  is present (via cn(..., Icon && "pl-9", inputClassName)). Previously this
 *  had pl-0 which overrode the icon padding, causing dots to overlap the key icon. */
const flatPasswordInputCls =
  "w-full border-0 bg-transparent dark:bg-transparent py-0.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:outline-none";

/** Flat borderless textarea used inside FieldCluster rows. */
const flatTextareaCls =
  "w-full border-0 bg-transparent dark:bg-transparent px-0 py-0.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:outline-none resize-none";

export function ItemEditor() {
  const open = useVault((s) => s.editorOpen);
  const editorItemId = useVault((s) => s.editorItemId);
  const vaults = useVault((s) => s.vaults);
  const settings = useVault((s) => s.settings);
  const setEditorOpen = useVault((s) => s.setEditorOpen);
  const saveItem = useVault((s) => s.saveItem);

  const [form, setForm] = React.useState<NewItemInput | null>(null);
  const [busy, setBusy] = React.useState(false);
  // Stable React keys for URL + custom-field rows (IE-2). Index-based keys
  // cause focus/selection to jump to the wrong field when a middle row is
  // removed. These arrays stay in lockstep with urls / customFields.
  const [urlKeys, setUrlKeys] = React.useState<string[]>([]);
  const [cfKeys, setCfKeys] = React.useState<string[]>([]);
  const keyCounter = React.useRef(0);
  const nextKey = React.useCallback(() => `k${++keyCounter.current}`, []);
  // Track the initial form snapshot for dirty-checking (IE-4).
  const [initialForm, setInitialForm] = React.useState<string>("");
  const [confirmDiscardOpen, setConfirmDiscardOpen] = React.useState(false);
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
    // #10: when creating a new item while viewing a specific vault, auto-assign
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

  const isEditing = Boolean(editorItemId);

  // Existing URLs across all non-trashed items — used for the website input
  // autofill suggestions (native <datalist>). De-duped + capped at 50.
  // Computed before the early return so the hook order is stable.
  const knownUrls = React.useMemo(() => {
    const set = new Set<string>();
    for (const it of useVault.getState().items) {
      if (it.trashed) continue;
      if (it.type !== "login") continue;
      for (const u of it.details.urls) {
        if (u) set.add(u);
      }
    }
    return Array.from(set).slice(0, 50);
  }, [open]);

  if (!open || !form) return null;

  const isDirty = JSON.stringify(form) !== initialForm;

  const update = (patch: Partial<NewItemInput>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const updateDetails = (patch: Record<string, unknown>) =>
    setForm((f) => (f ? { ...f, details: { ...(f.details as object), ...patch } } : f));

  const handleSave = async () => {
    if (!form) return;
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast.error("Please give the item a name");
      return;
    }
    // Trim the name before saving so "  GitHub  " doesn't break fuzzy-search.
    const toSave = { ...form, name: trimmedName };
    setBusy(true);
    try {
      await saveItem(toSave, editorItemId ?? undefined);
      toast.success(isEditing ? "Item updated" : "Item created");
      setEditorOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Could not save item");
    } finally {
      setBusy(false);
    }
  };

  // Intercept Sheet close: if there are unsaved edits, ask first (IE-4).
  const handleOpenChange = (o: boolean) => {
    if (!o && isDirty && !busy) {
      setConfirmDiscardOpen(true);
      return;
    }
    setEditorOpen(o);
  };

  const addCustomField = () => {
    update({ customFields: [...form.customFields, { name: "", value: "", type: "text" }] });
    setCfKeys((k) => [...k, nextKey()]);
  };
  const updateCustomField = (idx: number, patch: Partial<CustomField>) =>
    update({
      customFields: form.customFields.map((cf, i) => (i === idx ? { ...cf, ...patch } : cf)),
    });
  const removeCustomField = (idx: number) => {
    update({ customFields: form.customFields.filter((_, i) => i !== idx) });
    setCfKeys((k) => k.filter((_, i) => i !== idx));
  };

  // Login URL list helpers.
  const urls = form.type === "login" ? form.details.urls : [];
  const setUrl = (idx: number, val: string) => {
    const next = urls.map((u, i) => (i === idx ? val : u));
    updateDetails({ urls: next });
  };
  const addUrl = () => {
    updateDetails({ urls: [...urls, ""] });
    setUrlKeys((k) => [...k, nextKey()]);
  };
  const removeUrl = (idx: number) => {
    updateDetails({ urls: urls.filter((_, i) => i !== idx) });
    setUrlKeys((k) => k.filter((_, i) => i !== idx));
  };

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

  // Selected vaults (multi-vault). The header trigger shows the first vault
  // (or "No vault" if none). The dropdown is a multi-select with checkboxes.
  const selectedVaults = form.vaultIds
    .map((id) => vaults.find((v) => v.id === id))
    .filter((v): v is NonNullable<typeof v> => Boolean(v));
  const toggleVault = (id: string) => {
    setForm((f) => {
      if (!f) return f;
      const has = f.vaultIds.includes(id);
      return { ...f, vaultIds: has ? f.vaultIds.filter((v) => v !== id) : [...f.vaultIds, id] };
    });
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden border-l border-border bg-background p-0 sm:max-w-[454px] [&>button:last-child]:hidden"
      >
        {/* Header — type icon + title (left); vault selector + Save (right) */}
        <SheetHeader className="flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <SheetTitle className="flex min-w-0 items-center gap-2.5 text-base font-semibold">
            <ItemTypeIcon type={form.type} size="sm" />
            <span className="truncate">{isEditing ? "Edit item" : "New item"}</span>
          </SheetTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Vault selector — multi-select dropdown (an item can belong to
                several vaults). The trigger shows a stacked icon preview +
                count (or "No vault"). Each vault row toggles membership without
                closing the menu, so the user can check several in one go.
                e.stopPropagation on each row prevents the radix auto-close. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs text-foreground transition-colors hover:bg-muted/60"
                  aria-label="Select vaults"
                  title={selectedVaults.length > 0 ? selectedVaults.map((v) => v.name).join(", ") : "No vault"}
                >
                  {selectedVaults.length > 0 ? (
                    <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center">
                      {selectedVaults.slice(0, 2).map((v, i) => (
                        <span
                          key={v.id}
                          className="absolute inline-flex items-center justify-center rounded-md"
                          style={{
                            left: `${i * 4}px`,
                            width: "16px",
                            height: "16px",
                            backgroundColor: "var(--background)",
                            zIndex: 2 - i,
                          }}
                        >
                          <VaultIcon icon={v.icon} color={v.color} size={16} />
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                      —
                    </span>
                  )}
                  <span className="max-w-[72px] truncate">
                    {selectedVaults.length === 0
                      ? "No vault"
                      : selectedVaults.length === 1
                        ? selectedVaults[0].name
                        : `${selectedVaults.length} vaults`}
                  </span>
                  <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                {vaults.length === 0 && (
                  <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                    Create a vault first
                  </div>
                )}
                {vaults.map((v) => {
                  const checked = form.vaultIds.includes(v.id);
                  return (
                    <DropdownMenuItem
                      key={v.id}
                      // Use onSelect with preventDefault so the menu stays open
                      // — lets the user toggle multiple vaults in one open.
                      onSelect={(e) => { e.preventDefault(); toggleVault(v.id); }}
                      className="gap-2"
                    >
                      <span className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}>
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <VaultIcon icon={v.icon} color={v.color} size={18} />
                      <span className="truncate">{v.name}</span>
                    </DropdownMenuItem>
                  );
                })}
                {form.vaultIds.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => { e.preventDefault(); update({ vaultIds: [] }); }}
                      className="gap-2 text-muted-foreground"
                    >
                      <span className="flex h-4 w-4 items-center justify-center">
                        <Trash2 className="h-3 w-3" />
                      </span>
                      Clear all
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Save / Create — type="submit" so Enter inside any input saves. */}
            <Button
              type="submit"
              size="sm"
              disabled={busy}
              className="min-w-[72px]"
              form="lcked-item-editor-form"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </SheetHeader>
        <SheetDescription className="sr-only">
          {isEditing ? "Edit the selected vault item." : "Create a new vault item."}
        </SheetDescription>

        {/* Body — flat scrollable form. The <form> wraps the body + footer so
            Enter inside any input triggers handleSave (type="submit" button
            in the header references this form via the `form` attribute). */}
        <form id="lcked-item-editor-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="flex min-h-0 flex-1 flex-col">
        <div className="lcked-scroll flex-1 overflow-y-auto p-4">
          {/* Type selector — only when creating */}
          {!isEditing && (
            <div className="mb-4 grid grid-cols-4 gap-2">
              {(Object.keys(ITEM_TYPE_LABELS) as ItemType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchType(t)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors",
                    form.type === t
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <ItemTypeIcon type={t} size="sm" />
                  {ITEM_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          )}

          {/* Name + favorite star — inline to save space */}
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Name
              </div>
              <button
                type="button"
                onClick={() => update({ favorite: !form.favorite })}
                className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted"
                aria-label={form.favorite ? "Remove favorite" : "Add favorite"}
                title={form.favorite ? "Remove favorite" : "Add favorite"}
              >
                <Star className={cn("h-4 w-4 transition-colors", form.favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
              </button>
            </div>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. GitHub, Bank card, WiFi password"
              autoFocus
              className="w-full border-0 bg-transparent dark:bg-transparent px-0 py-0.5 text-base font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              aria-label="Item name"
            />
          </div>

          {/* Type-specific */}
          {form.type === "login" && (
            <div className="space-y-4">
              {/* Username + Password — the username label AND leading icon
                  switch between Mail / User based on whether the value looks
                  like an email. This mirrors the item-detail presentation. */}
              <FieldCluster>
                <FieldRowInput label={isEmail(form.details.username) ? "Email" : "Username"} icon={isEmail(form.details.username) ? Mail : User} first>
                  <Input
                    value={form.details.username}
                    onChange={(e) => updateDetails({ username: e.target.value })}
                    placeholder="you@example.com"
                    autoComplete="off"
                    className={flatInputCls}
                  />
                </FieldRowInput>
                <FieldRowInput label="Password" icon={KeyRound}>
                  <PasswordField
                    value={form.details.password}
                    onChange={(v) => updateDetails({ password: v })}
                    placeholder="Enter password"
                    showStrength
                    showGenerate
                    generatorOptions={settings.generator}
                    inputClassName={flatPasswordInputCls}
                  />
                </FieldRowInput>
              </FieldCluster>

              {/* TOTP */}
              <FieldClusterWithLabel label="Verification">
                <FieldRowInput icon={Lock} first>
                  <Input
                    value={form.details.totp}
                    onChange={(e) => updateDetails({ totp: e.target.value })}
                    placeholder="Base32 secret or otpauth:// URI"
                    className={cn(flatInputCls, "font-secret")}
                    autoComplete="off"
                  />
                </FieldRowInput>
              </FieldClusterWithLabel>

              {/* URLs — wrapped in a labelled card cluster (Websites) with the
                  "Add URL" action in the header. Each URL row has a Globe icon
                  + Tab-to-autofill-https + a native <datalist> of every URL
                  already in the vault (trash excluded) for quick reuse. */}
              <FieldClusterWithLabel
                label="Websites"
                action={
                  <Button type="button" variant="ghost" size="sm" onClick={addUrl}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add URL
                  </Button>
                }
              >
                <datalist id="lcked-known-urls">
                  {knownUrls.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
                {urls.map((url, idx) => (
                  <div
                    key={urlKeys[idx] ?? idx}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5",
                      idx !== 0 && "border-t border-border/50",
                    )}
                  >
                    <Globe className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                    <Input
                      value={url}
                      onChange={(e) => setUrl(idx, e.target.value)}
                      onKeyDown={(e) => {
                        // Tab on an empty-ish website field auto-types
                        // "https://" so the user doesn't have to. Only fires
                        // when the field is empty or lacks a scheme — we then
                        // insert the prefix and let the Tab proceed so focus
                        // moves to the next field with the prefix already in
                        // place. Shift+Tab (reverse) is left alone.
                        if (e.key === "Tab" && !e.shiftKey) {
                          const v = (e.target as HTMLInputElement).value.trim();
                          if (v && !/^[a-z]+:\/\//i.test(v)) {
                            e.preventDefault();
                            setUrl(idx, `https://${v}`);
                            // Move focus forward manually since we prevented Tab.
                            const inputs = (e.currentTarget.closest("form") as HTMLFormElement | null)?.querySelectorAll<HTMLElement>("input,textarea,button");
                            if (inputs) {
                              const arr = Array.from(inputs);
                              const cur = arr.indexOf(e.currentTarget as HTMLElement);
                              const nextEl = arr[cur + 1];
                              nextEl?.focus();
                            }
                          }
                        }
                      }}
                      list="lcked-known-urls"
                      placeholder="example.com"
                      className={cn(flatInputCls, "font-secret")}
                      autoComplete="off"
                    />
                    {urls.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-400"
                        onClick={() => removeUrl(idx)}
                        aria-label={`Remove URL ${idx + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </FieldClusterWithLabel>

              {/* Notes */}
              <FieldClusterWithLabel label="Notes">
                <FieldRowInput first>
                  <Textarea
                    value={form.details.notes}
                    onChange={(e) => updateDetails({ notes: e.target.value })}
                    placeholder="Optional secure notes…"
                    rows={3}
                    className={flatTextareaCls}
                  />
                </FieldRowInput>
              </FieldClusterWithLabel>
            </div>
          )}

          {form.type === "note" && (
            <FieldCluster>
              <FieldRowInput label="Content" icon={StickyNote} first>
                <Textarea
                  value={form.details.content}
                  onChange={(e) => updateDetails({ content: e.target.value })}
                  placeholder="Write your secure note here…"
                  rows={10}
                  className={flatTextareaCls}
                />
              </FieldRowInput>
            </FieldCluster>
          )}

          {form.type === "card" && (
            <div className="space-y-4">
              {/* Cardholder + Card number + CVV + Expiry + PIN */}
              <FieldCluster>
                <FieldRowInput label="Cardholder name" icon={User} first>
                  <Input
                    value={form.details.cardholder}
                    onChange={(e) => updateDetails({ cardholder: e.target.value })}
                    placeholder="Name on card"
                    autoComplete="off"
                    className={flatInputCls}
                  />
                </FieldRowInput>
                <FieldRowInput label="Card number" icon={CreditCard}>
                  <PasswordField
                    value={form.details.number}
                    onChange={(v) => {
                      const brand = detectCardBrand(v);
                      updateDetails({ number: v, brand: brand || form.details.brand });
                    }}
                    placeholder="0000 0000 0000 0000"
                    showGenerate={false}
                    inputClassName={flatPasswordInputCls}
                  />
                  {form.details.brand && (
                    <p className="mt-1 text-xs text-muted-foreground">Detected: {form.details.brand}</p>
                  )}
                </FieldRowInput>
                <div className="grid grid-cols-2 divide-x divide-border/50">
                  <FieldRowInput label="CVV" icon={Lock} first>
                    <PasswordField
                      value={form.details.cvv}
                      onChange={(v) => updateDetails({ cvv: v })}
                      placeholder="123"
                      showGenerate={false}
                      inputClassName={flatPasswordInputCls}
                    />
                  </FieldRowInput>
                  <FieldRowInput label="Expiry (MM/YY)" icon={Calendar} first>
                    <Input
                      value={form.details.expiry}
                      onChange={(e) => {
                        // Auto-format as MM/YY: strip non-digits, max 4 digits,
                        // insert slash after the 2nd digit.
                        let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                        if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
                        updateDetails({ expiry: v });
                      }}
                      placeholder="08/27"
                      className={cn(flatInputCls, "font-secret")}
                      autoComplete="off"
                      inputMode="numeric"
                      maxLength={5}
                    />
                  </FieldRowInput>
                </div>
                <FieldRowInput label="PIN" icon={KeyRound}>
                  <PasswordField
                    value={form.details.pin}
                    onChange={(v) => updateDetails({ pin: v })}
                    placeholder="••••"
                    showGenerate={false}
                    inputClassName={flatPasswordInputCls}
                  />
                </FieldRowInput>
              </FieldCluster>

              {/* Notes */}
              <FieldClusterWithLabel label="Notes">
                <FieldRowInput first>
                  <Textarea
                    value={form.details.notes}
                    onChange={(e) => updateDetails({ notes: e.target.value })}
                    placeholder="Optional notes…"
                    rows={3}
                    className={flatTextareaCls}
                  />
                </FieldRowInput>
              </FieldClusterWithLabel>
            </div>
          )}

          {form.type === "identity" && (
            <div className="space-y-4">
              {/* First name + Last name */}
              <FieldCluster>
                <div className="grid grid-cols-2 divide-x divide-border/50">
                  <FieldRowInput label="First name" icon={User} first>
                    <Input
                      value={form.details.firstName}
                      onChange={(e) => updateDetails({ firstName: e.target.value })}
                      autoComplete="off"
                      className={flatInputCls}
                    />
                  </FieldRowInput>
                  <FieldRowInput label="Last name" icon={User} first>
                    <Input
                      value={form.details.lastName}
                      onChange={(e) => updateDetails({ lastName: e.target.value })}
                      autoComplete="off"
                      className={flatInputCls}
                    />
                  </FieldRowInput>
                </div>
              </FieldCluster>

              {/* Email + Phone */}
              <FieldCluster>
                <div className="grid grid-cols-2 divide-x divide-border/50">
                  <FieldRowInput label="Email" icon={Mail} first>
                    <Input
                      type="email"
                      value={form.details.email}
                      onChange={(e) => updateDetails({ email: e.target.value })}
                      autoComplete="off"
                      className={flatInputCls}
                    />
                  </FieldRowInput>
                  <FieldRowInput label="Phone" icon={Phone} first>
                    <Input
                      value={form.details.phone}
                      onChange={(e) => updateDetails({ phone: e.target.value })}
                      autoComplete="off"
                      className={flatInputCls}
                    />
                  </FieldRowInput>
                </div>
              </FieldCluster>

              {/* Company */}
              <FieldCluster>
                <FieldRowInput label="Company" icon={Building2} first>
                  <Input
                    value={form.details.company}
                    onChange={(e) => updateDetails({ company: e.target.value })}
                    autoComplete="off"
                    className={flatInputCls}
                  />
                </FieldRowInput>
              </FieldCluster>

              {/* Address fields */}
              <FieldCluster>
                <FieldRowInput label="Address line 1" icon={MapPin} first>
                  <Input
                    value={form.details.address1}
                    onChange={(e) => updateDetails({ address1: e.target.value })}
                    autoComplete="off"
                    className={flatInputCls}
                  />
                </FieldRowInput>
                <FieldRowInput label="Address line 2" icon={MapPin}>
                  <Input
                    value={form.details.address2}
                    onChange={(e) => updateDetails({ address2: e.target.value })}
                    autoComplete="off"
                    className={flatInputCls}
                  />
                </FieldRowInput>
                <div className="grid grid-cols-2 divide-x divide-border/50">
                  <FieldRowInput label="City" icon={MapPin}>
                    <Input
                      value={form.details.city}
                      onChange={(e) => updateDetails({ city: e.target.value })}
                      autoComplete="off"
                      className={flatInputCls}
                    />
                  </FieldRowInput>
                  <FieldRowInput label="State / Province" icon={MapPin}>
                    <Input
                      value={form.details.state}
                      onChange={(e) => updateDetails({ state: e.target.value })}
                      autoComplete="off"
                      className={flatInputCls}
                    />
                  </FieldRowInput>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border/50">
                  <FieldRowInput label="Postal / ZIP" icon={MapPin}>
                    <Input
                      value={form.details.zip}
                      onChange={(e) => updateDetails({ zip: e.target.value })}
                      autoComplete="off"
                      className={flatInputCls}
                    />
                  </FieldRowInput>
                  <FieldRowInput label="Country" icon={Globe}>
                    <Input
                      value={form.details.country}
                      onChange={(e) => updateDetails({ country: e.target.value })}
                      autoComplete="off"
                      className={flatInputCls}
                    />
                  </FieldRowInput>
                </div>
              </FieldCluster>

              {/* Notes */}
              <FieldClusterWithLabel label="Notes">
                <FieldRowInput first>
                  <Textarea
                    value={form.details.notes}
                    onChange={(e) => updateDetails({ notes: e.target.value })}
                    rows={3}
                    className={flatTextareaCls}
                  />
                </FieldRowInput>
              </FieldClusterWithLabel>
            </div>
          )}

          {/* Custom fields */}
          <div className="mt-4">
            {form.customFields.length === 0 ? (
              <FieldClusterWithLabel
                label="Custom fields"
                action={
                  <Button type="button" variant="ghost" size="sm" onClick={addCustomField}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add
                  </Button>
                }
              >
                <div className="px-3.5 py-3 text-xs text-muted-foreground">
                  Add extra fields like security questions or recovery codes.
                </div>
              </FieldClusterWithLabel>
            ) : (
              <FieldClusterWithLabel
                label="Custom fields"
                action={
                  <Button type="button" variant="ghost" size="sm" onClick={addCustomField}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add
                  </Button>
                }
              >
                {form.customFields.map((cf, idx) => (
                  <div
                    key={cfKeys[idx] ?? idx}
                    className={cn("px-3.5 py-2.5", idx !== 0 && "border-t border-border/50")}
                  >
                    {/* Top row — small name input + type badge (small, pill-shaped) */}
                    <div className="flex items-center gap-2">
                      <Input
                        value={cf.name}
                        onChange={(e) => updateCustomField(idx, { name: e.target.value })}
                        placeholder="Field name"
                        className={cn(flatInputCls, "text-xs")}
                        aria-label={`Custom field ${idx + 1} name`}
                      />
                      <Select
                        value={cf.type}
                        onValueChange={(v) => updateCustomField(idx, { type: v as "text" | "hidden" })}
                      >
                        <SelectTrigger className="h-6 w-fit shrink-0 gap-1 rounded-full border-border/60 bg-secondary/40 px-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:bg-secondary/70 focus-visible:ring-0 focus-visible:outline-none data-[placeholder]:text-muted-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="hidden">Hidden</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Bottom row — larger value input + subtle ghost remove */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <Input
                        value={cf.value}
                        onChange={(e) => updateCustomField(idx, { value: e.target.value })}
                        placeholder="Value"
                        className={cn(
                          flatInputCls,
                          cf.type === "hidden" && "font-secret",
                        )}
                        type={cf.type === "hidden" ? "password" : "text"}
                        aria-label={`Custom field ${idx + 1} value`}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground/60 hover:text-red-400"
                        onClick={() => removeCustomField(idx)}
                        aria-label={`Remove custom field ${idx + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </FieldClusterWithLabel>
            )}
          </div>
        </div>

        {/* Footer — Cancel only (Save/Create is in the header) */}
        <div className="border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditorOpen(false)}
            disabled={busy}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
        </form>
      </SheetContent>

      {/* Confirm-discard dialog (IE-4) — shown when the user closes the
          editor with unsaved edits. */}
      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits. Discarding will close the editor and lose
              your changes. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmDiscardOpen(false);
                setEditorOpen(false);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
