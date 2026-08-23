"use client";

/**
  * LCKED — ItemEditor (right sidebar)
  * ---------------------------------------------------------------------------
  * Slides in from the right as a Sheet (matching the password-generator and
  * create-vault sidebars). Handles both "New item" and "Edit item" modes,
  * driven by `editorOpen` + `editorItemId` in the vault store.
  *
  * This module is the editor SHELL: dialog chrome, header (type icon + title,
  * vault multi-select, Save/Create), type selector, name field, save flow and
  * busy state. Form lifecycle lives in ./use-item-form; per-type sections in
  * ./login-fields / ./note-fields / ./card-fields / ./identity-fields; custom
  * fields in ./custom-fields; the dirty-check confirmation in ./discard-dialog.
  */

import * as React from "react";
import { Trash2, Star, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useVault } from "@/store/vault";
import { type CustomField, type ItemType, type LoginDetails, type NewItemInput } from "@/lib/types";
import { ItemTypeIcon, ITEM_TYPE_LABELS } from "../item-icons";
import { VaultIcon } from "../vault-icon";
import { cn } from "@/lib/utils";
import { useItemForm } from "./use-item-form";
import { LoginFields } from "./login-fields";
import { NoteFields } from "./note-fields";
import { CardFields } from "./card-fields";
import { IdentityFields } from "./identity-fields";
import { CustomFields } from "./custom-fields";
import { DiscardDialog } from "./discard-dialog";

export function ItemEditor() {
  const {
    open, editorItemId, form, setForm,
    urlKeys, setUrlKeys, cfKeys, setCfKeys,
    nextKey, initialForm, switchType,
  } = useItemForm();
  const vaults = useVault((s) => s.vaults);
  const settings = useVault((s) => s.settings);
  const setEditorOpen = useVault((s) => s.setEditorOpen);
  const saveItem = useVault((s) => s.saveItem);

  const [busy, setBusy] = React.useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = React.useState(false);

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

  const isEditing = Boolean(editorItemId);

  const isDirty = JSON.stringify(form) !== initialForm;

  const update = (patch: Partial<NewItemInput>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const updateDetails = (patch: Record<string, unknown>) =>
    setForm(
      (f) =>
        f ? { ...f, details: { ...(f.details as object), ...patch } as unknown as NewItemInput["details"] } : f,
    );

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
  const urls = form.type === "login" ? (form.details as LoginDetails).urls : [];
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

  // Confirm-discard action: close the dialog AND the editor (IE-4).
  const discardChanges = () => {
    setConfirmDiscardOpen(false);
    setEditorOpen(false);
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
              <LoginFields
                form={form}
                settings={settings}
                knownUrls={knownUrls}
                urlKeys={urlKeys}
                updateDetails={updateDetails}
                setUrl={setUrl}
                addUrl={addUrl}
                removeUrl={removeUrl}
              />
            )}

            {form.type === "note" && (
              <NoteFields form={form} updateDetails={updateDetails} />
            )}

            {form.type === "card" && (
              <CardFields form={form} updateDetails={updateDetails} />
            )}

            {form.type === "identity" && (
              <IdentityFields form={form} updateDetails={updateDetails} />
            )}

            {/* Custom fields */}
            <CustomFields
              fields={form.customFields}
              fieldKeys={cfKeys}
              addCustomField={addCustomField}
              updateCustomField={updateCustomField}
              removeCustomField={removeCustomField}
            />
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
      <DiscardDialog
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
        onDiscard={discardChanges}
      />
    </Sheet>
  );
}
