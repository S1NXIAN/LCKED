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
 * All existing functionality is preserved: blankItem(), itemToInput(),
 * saveItem(), custom-field add/update/remove, login URL list helpers,
 * favourite toggle, folder, and card-brand detection.
 */

import * as React from "react";
import { Plus, Trash2, Star, Loader2, Link2, Check, ChevronsUpDown } from "lucide-react";
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
} from "@/components/ui/dropdown-menu";
import { useVault } from "@/store/vault";
import {
  type CustomField,
  type ItemType,
  type NewItemInput,
  type VaultItem,
} from "@/lib/types";
import { detectCardBrand } from "@/lib/import-export";
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
    vaultId: null as string | null,
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

function itemToInput(item: VaultItem): NewItemInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = item;
  return rest as NewItemInput;
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

/** A labelled field row inside a FieldCluster. Flat borderless input.
 *  `label` is optional — when omitted (e.g. inside a FieldClusterWithLabel
 *  whose header already names the section), the row renders without the
 *  small uppercase label so the section isn't visually redundant. */
function FieldRowInput({
  label,
  first,
  children,
}: {
  label?: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("px-3.5 py-2", !first && "border-t border-border/50")}>
      {label && (
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

/** Flat borderless input used inside FieldCluster rows. */
const flatInputCls =
  "w-full border-0 bg-transparent dark:bg-transparent px-0 py-0.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:outline-none";

/** Flat borderless variant for PasswordField — keeps right padding for action buttons. */
const flatPasswordInputCls =
  "w-full border-0 bg-transparent dark:bg-transparent pl-0 py-0.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:outline-none";

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

  // Initialise form when the sheet opens. Depends ONLY on [open, editorItemId]
  // (IE-1) — the `items` array changes on every unrelated mutation (auto-purge,
  // duplicate, drag-drop), which would overwrite the user's unsaved edits.
  React.useEffect(() => {
    if (!open) {
      setForm(null);
      setUrlKeys([]);
      setCfKeys([]);
      setInitialForm("");
      return;
    }
    if (editorItemId) {
      // Read via getState() so we don't depend on the items array.
      const existing = useVault.getState().items.find((i) => i.id === editorItemId);
      if (existing) {
        const input = itemToInput(existing);
        setForm(input);
        setUrlKeys((existing.details as { urls?: string[] }).urls?.map(() => nextKey()) ?? []);
        setCfKeys(existing.customFields.map(() => nextKey()));
        setInitialForm(JSON.stringify(input));
        return;
      }
    }
    // Honour a type pre-selected via ⌘K / icon rail, then clear the stash.
    const initialType = consumeNewItemType() ?? "login";
    const blank = blankItem(initialType);
    setForm(blank);
    setUrlKeys([""].map(() => nextKey()));
    setCfKeys([]);
    setInitialForm(JSON.stringify(blank));
  }, [open, editorItemId, nextKey]);

  const isEditing = Boolean(editorItemId);

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

  // Switch item type while preserving overlapping fields (IE-3).
  const switchType = (t: ItemType) => {
    setForm((f) => {
      if (!f) return f;
      const blank = blankItem(t);
      return { ...blank, name: f.name, favorite: f.favorite, pinned: f.pinned, folder: f.folder, customFields: f.customFields, vaultId: f.vaultId };
    });
  };

  // Selected vault (for the header dropdown).
  const selectedVault = form.vaultId ? vaults.find((v) => v.id === form.vaultId) ?? null : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden border-l border-border bg-background p-0 sm:max-w-[480px] [&>button:last-child]:hidden"
      >
        {/* Header — type icon + title (left); vault selector + Save (right) */}
        <SheetHeader className="flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
          <SheetTitle className="flex min-w-0 items-center gap-2.5 text-base font-semibold">
            <ItemTypeIcon type={form.type} size="sm" />
            <span className="truncate">{isEditing ? "Edit item" : "New item"}</span>
          </SheetTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Vault selector dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs text-foreground transition-colors hover:bg-muted/60"
                  aria-label="Select vault"
                  title={selectedVault ? selectedVault.name : "No vault"}
                >
                  {selectedVault ? (
                    <VaultIcon icon={selectedVault.icon} color={selectedVault.color} size={18} />
                  ) : (
                    <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                      —
                    </span>
                  )}
                  <span className="max-w-[80px] truncate">{selectedVault ? selectedVault.name : "No vault"}</span>
                  <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem
                  onSelect={() => update({ vaultId: null })}
                  className={cn("gap-2", !selectedVault && "bg-muted/60")}
                >
                  <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                    —
                  </span>
                  No vault
                </DropdownMenuItem>
                {vaults.map((v) => (
                  <DropdownMenuItem
                    key={v.id}
                    onSelect={() => update({ vaultId: v.id })}
                    className={cn("gap-2", selectedVault?.id === v.id && "bg-muted/60")}
                  >
                    <VaultIcon icon={v.icon} color={v.color} size={18} />
                    <span className="truncate">{v.name}</span>
                    {selectedVault?.id === v.id && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Save / Create */}
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={busy}
              className="min-w-[72px]"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </SheetHeader>
        <SheetDescription className="sr-only">
          {isEditing ? "Edit the selected vault item." : "Create a new vault item."}
        </SheetDescription>

        {/* Body — flat scrollable form */}
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
              {/* Username + Password */}
              <FieldCluster>
                <FieldRowInput label={isEmail(form.details.username) ? "Email" : "Username"} first>
                  <Input
                    value={form.details.username}
                    onChange={(e) => updateDetails({ username: e.target.value })}
                    placeholder="you@example.com"
                    autoComplete="off"
                    className={flatInputCls}
                  />
                </FieldRowInput>
                <FieldRowInput label="Password">
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
                <FieldRowInput first>
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
                  "Add URL" action in the header. Matches the TOTP / Notes /
                  Custom fields pattern so every secondary section reads as a
                  consistent card. Each URL is a divided row inside the card. */}
              <FieldClusterWithLabel
                label="Websites"
                action={
                  <Button type="button" variant="ghost" size="sm" onClick={addUrl}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add URL
                  </Button>
                }
              >
                {urls.map((url, idx) => (
                  <div
                    key={urlKeys[idx] ?? idx}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-2",
                      idx !== 0 && "border-t border-border/50",
                    )}
                  >
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <Input
                      value={url}
                      onChange={(e) => setUrl(idx, e.target.value)}
                      placeholder="https://example.com"
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
              <FieldRowInput label="Content" first>
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
                <FieldRowInput label="Cardholder name" first>
                  <Input
                    value={form.details.cardholder}
                    onChange={(e) => updateDetails({ cardholder: e.target.value })}
                    placeholder="Name on card"
                    autoComplete="off"
                    className={flatInputCls}
                  />
                </FieldRowInput>
                <FieldRowInput label="Card number">
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
                  <FieldRowInput label="CVV" first>
                    <PasswordField
                      value={form.details.cvv}
                      onChange={(v) => updateDetails({ cvv: v })}
                      placeholder="123"
                      showGenerate={false}
                      inputClassName={flatPasswordInputCls}
                    />
                  </FieldRowInput>
                  <FieldRowInput label="Expiry (MM/YY)" first>
                    <Input
                      value={form.details.expiry}
                      onChange={(e) => updateDetails({ expiry: e.target.value })}
                      placeholder="08/27"
                      className={cn(flatInputCls, "font-secret")}
                      autoComplete="off"
                    />
                  </FieldRowInput>
                </div>
                <FieldRowInput label="PIN">
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
                  <FieldRowInput label="First name" first>
                    <Input
                      value={form.details.firstName}
                      onChange={(e) => updateDetails({ firstName: e.target.value })}
                      autoComplete="off"
                      className={flatInputCls}
                    />
                  </FieldRowInput>
                  <FieldRowInput label="Last name" first>
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
                  <FieldRowInput label="Email" first>
                    <Input
                      type="email"
                      value={form.details.email}
                      onChange={(e) => updateDetails({ email: e.target.value })}
                      autoComplete="off"
                      className={flatInputCls}
                    />
                  </FieldRowInput>
                  <FieldRowInput label="Phone" first>
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
                <FieldRowInput label="Company" first>
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
                <FieldRowInput label="Address line 1" first>
                  <Input
                    value={form.details.address1}
                    onChange={(e) => updateDetails({ address1: e.target.value })}
                    autoComplete="off"
                    className={flatInputCls}
                  />
                </FieldRowInput>
                <FieldRowInput label="Address line 2">
                  <Input
                    value={form.details.address2}
                    onChange={(e) => updateDetails({ address2: e.target.value })}
                    autoComplete="off"
                    className={flatInputCls}
                  />
                </FieldRowInput>
                <div className="grid grid-cols-2 divide-x divide-border/50">
                  <FieldRowInput label="City">
                    <Input
                      value={form.details.city}
                      onChange={(e) => updateDetails({ city: e.target.value })}
                      autoComplete="off"
                      className={flatInputCls}
                    />
                  </FieldRowInput>
                  <FieldRowInput label="State / Province">
                    <Input
                      value={form.details.state}
                      onChange={(e) => updateDetails({ state: e.target.value })}
                      autoComplete="off"
                      className={flatInputCls}
                    />
                  </FieldRowInput>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border/50">
                  <FieldRowInput label="Postal / ZIP">
                    <Input
                      value={form.details.zip}
                      onChange={(e) => updateDetails({ zip: e.target.value })}
                      autoComplete="off"
                      className={flatInputCls}
                    />
                  </FieldRowInput>
                  <FieldRowInput label="Country">
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
