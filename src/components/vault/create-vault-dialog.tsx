"use client";

/**
 * LCKED — CreateVaultDialog
 * ---------------------------------------------------------------------------
 * A right-side Sheet that handles BOTH create and edit modes for a user-
 * defined vault. Driven by two store flags so any component can open it:
 *
 *   • createVaultDialogOpen  → blank form, "New vault" title, no delete btn
 *   • vaultEditorOpen + editingVaultId  → pre-filled form, "Edit vault" title
 *
 * Design language matches the item-list + item-editor aesthetic:
 *   • Header: live vault-icon swatch + title + Save/Create button (NO close X —
 *     the built-in radix close button is hidden via `[&>button:last-child]:hidden`).
 *   • Body: a flat borderless name input (no surrounding border, big text),
 *     followed by labeled swatch pickers for color and icon.
 *   • Footer: Cancel (left) + Delete vault (right, edit mode only, with an
 *     AlertDialog confirmation).
 *
 * Save calls createVault() or updateVault() depending on the active mode. The
 * sheet uses the same `bg-background border-l border-border` styling as the
 * item editor so the surface language stays consistent across all editing
 * panels.
 */

import { Check, Home, Loader2, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  DEFAULT_VAULT_COLOR,
  DEFAULT_VAULT_ICON,
  VAULT_COLORS,
  VAULT_ICONS,
  vaultColorHex,
} from "@/lib/vault/vault-assets";
import { useVault } from "@/store/vault";

import { VaultIcon } from "./vault-icon";
import { VAULT_LUCIDE_BY_ID } from "./vault-lucide-icons";

export function CreateVaultDialog() {
  // Both modes share the same Sheet; we open whenever either flag is set.
  const createOpen = useVault((s) => s.createVaultDialogOpen);
  const editorOpen = useVault((s) => s.vaultEditorOpen);
  const editingVaultId = useVault((s) => s.editingVaultId);
  const vaults = useVault((s) => s.vaults);
  const setCreateVaultDialogOpen = useVault((s) => s.setCreateVaultDialogOpen);
  const setVaultEditorOpen = useVault((s) => s.setVaultEditorOpen);
  const createVault = useVault((s) => s.createVault);
  const updateVault = useVault((s) => s.updateVault);
  const deleteVault = useVault((s) => s.deleteVault);

  const open = createOpen || editorOpen;
  const editingVault = editingVaultId
    ? (vaults.find((v) => v.id === editingVaultId) ?? null)
    : null;
  // Edit mode is active only when we have a real editing target; otherwise
  // we're in create mode even if vaultEditorOpen flipped true without an id.
  const isEdit = editorOpen && Boolean(editingVault);

  // Local form state.
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<string>(DEFAULT_VAULT_COLOR);
  const [icon, setIcon] = React.useState<string>(DEFAULT_VAULT_ICON);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Initialise / reset the form whenever the sheet opens or the target vault
  // changes. In create mode we always start from defaults; in edit mode we
  // hydrate from the existing VaultDef.
  React.useEffect(() => {
    if (!open) return;
    if (isEdit && editingVault) {
      setName(editingVault.name);
      setColor(editingVault.color);
      setIcon(editingVault.icon);
    } else {
      setName("");
      setColor(DEFAULT_VAULT_COLOR);
      setIcon(DEFAULT_VAULT_ICON);
    }
    setConfirmDelete(false);
  }, [open, isEdit, editingVault]);

  const close = () => {
    if (createOpen) setCreateVaultDialogOpen(false);
    if (editorOpen) setVaultEditorOpen(false);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Please give the vault a name");
      return;
    }
    setBusy(true);
    try {
      if (isEdit && editingVault) {
        await updateVault(editingVault.id, { name: trimmed, color, icon });
        toast.success("Vault updated");
      } else {
        await createVault(trimmed, color, icon);
        toast.success("Vault created");
      }
      close();
    } catch (err) {
      console.error(err);
      toast.error(isEdit ? "Could not update vault" : "Could not create vault");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!editingVault) return;
    setBusy(true);
    try {
      await deleteVault(editingVault.id);
      toast.success(`Deleted vault “${editingVault.name}”`);
      close();
    } catch {
      toast.error("Could not delete vault");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const accentHex = vaultColorHex(color);

  // Hide the default close X (top-right) with `[&>button:last-child]:hidden`
  // — the radix Sheet always renders its Close as the last child of
  // SheetContent. Our header has its own actions and we want a cleaner look
  // with no X in the corner.
  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? close() : undefined)}>
      <SheetContent
        side="right"
        className="border-border bg-background w-full gap-0 border-l p-0 sm:max-w-[454px] [&>button:last-child]:hidden"
      >
        {/* Header — live type icon + title + Save/Create */}
        <SheetHeader className="border-border flex-row items-center gap-2.5 border-b px-4 py-3.5">
          <VaultIcon icon={icon} color={color} size={28} />
          <SheetTitle className="flex-1 truncate text-base font-semibold">
            {isEdit ? "Edit vault" : "New vault"}
          </SheetTitle>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={busy}
            className="min-w-[72px]"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEdit ? (
              "Save"
            ) : (
              "Create"
            )}
          </Button>
        </SheetHeader>
        <SheetDescription className="sr-only">
          {isEdit
            ? "Edit this vault's name, color, and icon."
            : "Create a new vault with a name, color, and icon."}
        </SheetDescription>

        {/* Body — flat, spacious form */}
        <div className="lcked-scroll flex-1 overflow-y-auto">
          {/* Live preview — compact, inline with the name input to save vertical space */}
          <div className="flex items-center gap-3 px-6 pt-6">
            <VaultIcon icon={icon} color={color} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide uppercase">
                Name
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  isEdit ? editingVault?.name || "Vault name" : "Untitled vault"
                }
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSave();
                  }
                }}
                className="text-foreground placeholder:text-muted-foreground/60 w-full border-0 bg-transparent px-0 py-0.5 text-lg font-medium focus:outline-none"
                aria-label="Vault name"
              />
            </div>
          </div>

          {/* Divider before pickers */}
          <div className="bg-border mx-6 my-5 h-px" />

          {/* Color swatches — 10 in a 5×2 grid */}
          <div className="px-6">
            <div className="text-muted-foreground mb-2.5 text-[11px] font-medium tracking-wide uppercase">
              Color
            </div>
            <div className="grid grid-cols-5 gap-2.5">
              {VAULT_COLORS.map((c) => {
                const selected = c.id === color;
                const hex = vaultColorHex(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(c.id)}
                    aria-label={c.label}
                    aria-pressed={selected}
                    className={cn(
                      "relative flex h-9 items-center justify-center rounded-lg transition duration-150",
                      selected
                        ? "ring-offset-background ring-2 ring-offset-2"
                        : "hover:scale-105",
                    )}
                    style={{
                      backgroundColor: `${hex}29`,
                      ...(selected
                        ? { boxShadow: `0 0 0 2px ${hex}` }
                        : undefined),
                    }}
                  >
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: hex }}
                    />
                    {selected && (
                      <Check
                        className="absolute top-1 right-1 h-3 w-3"
                        style={{ color: hex }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Icon picker — grid of raw Lucide glyphs tinted with selected color */}
          <div className="px-6 pt-6">
            <div className="text-muted-foreground mb-2.5 text-[11px] font-medium tracking-wide uppercase">
              Icon
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {VAULT_ICONS.map((ic) => {
                const selected = ic.id === icon;
                const Glyph = VAULT_LUCIDE_BY_ID[ic.id] ?? Home;
                return (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => setIcon(ic.id)}
                    aria-label={ic.label}
                    aria-pressed={selected}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-lg transition-colors duration-100",
                      selected
                        ? "bg-muted"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                    style={selected ? { color: accentHex } : undefined}
                  >
                    <Glyph className="h-[18px] w-[18px]" strokeWidth={2} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer — Cancel (left) + Delete vault (right, edit mode only) */}
        <div className="border-border flex items-center gap-2 border-t px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={close}
            disabled={busy}
            className="flex-1"
          >
            Cancel
          </Button>

          {isEdit && editingVault ? (
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive flex-1"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete vault
              </Button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete “{editingVault.name}”?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    The vault will be removed. Items inside it will be moved to
                    your default vault (not deleted). This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                  >
                    Delete vault
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
