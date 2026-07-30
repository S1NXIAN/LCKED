"use client";

import * as React from "react";
import { Lock, ShieldCheck, Eye, EyeOff, AlertTriangle, Loader2, KeyRound, Upload, FileJson, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useVault, decryptLckedExport } from "@/store/vault";
import type { LckedExport } from "@/lib/import-export";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { DiamondMark } from "./diamond-mark";
import { DotField } from "./dot-field";
import { cn } from "@/lib/utils";

export function SetupView() {
  const setupVault = useVault((s) => s.setupVault);
  const importItems = useVault((s) => s.importItems);
  const saveItem = useVault((s) => s.saveItem);
  const createVault = useVault((s) => s.createVault);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [agreed, setAgreed] = React.useState(false);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // When importing, the export password IS the master password — no separate
  // confirm field needed. The user already knows the password from when they
  // created the backup.
  const isImporting = Boolean(importFile);

  const canSubmit =
    password.length >= 8 &&
    (isImporting || password === confirm) &&
    agreed &&
    !busy;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      // Clear the confirm field — it's not needed when importing.
      setConfirm("");
    }
  };

  const handleRemoveFile = () => {
    setImportFile(null);
    // Reset the file input so the same file can be re-selected.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      // Read the file text once (if importing).
      const fileText = importFile ? await importFile.text() : null;

      // If importing an encrypted LCKED export, decrypt it FIRST (before
      // creating the vault) so we can fail early on a wrong password without
      // leaving an empty vault behind. The export password IS the master
      // password the user just entered.
      let decryptedPayload: { items: import("@/lib/types").VaultItem[]; vaults: import("@/lib/types").VaultDef[] } | null = null;
      let isLckedExport = false;
      if (importFile && fileText) {
        try {
          const parsed = JSON.parse(fileText);
          if (parsed?.format === "lcked-encrypted-v1") {
            isLckedExport = true;
            decryptedPayload = await decryptLckedExport(parsed as LckedExport, password);
            if (!decryptedPayload) {
              toast.error("Wrong password", {
                description: "The password doesn't match this backup file.",
              });
              setBusy(false);
              return;
            }
          }
        } catch {
          // Not JSON → it's a CSV/other format; fall through to importItems.
        }
      }

      // Create the vault with the master password.
      await setupVault(password);

      if (isLckedExport && decryptedPayload) {
        // LCKED encrypted export: import decrypted items + recreate vaults.
        // Re-encrypt each item with the NEW vault key (already created by
        // setupVault) via saveItem, and recreate custom vaults.
        const { items: decryptedItems, vaults: decryptedVaults } = decryptedPayload;

        // Recreate custom vaults first (so items can reference them).
        for (const v of decryptedVaults) {
          try {
            await createVault(v.name, v.color, v.icon);
          } catch {
            // best-effort — if a vault fails, items still import
          }
        }

        // Build a map from old vault id → new vault id (createVault generated
        // fresh ids). Match by name+color+icon since those are preserved.
        const currentVaults = useVault.getState().vaults;
        const vaultIdMap = new Map<string, string>();
        for (const oldV of decryptedVaults) {
          const newV = currentVaults.find(
            (nv) => nv.name === oldV.name && nv.color === oldV.color && nv.icon === oldV.icon,
          );
          if (newV) vaultIdMap.set(oldV.id, newV.id);
        }

        // Import each item, remapping vaultIds to the new vault ids.
        let imported = 0;
        for (const item of decryptedItems) {
          try {
            const remappedVaultIds = item.vaultIds
              ?.map((oldId) => vaultIdMap.get(oldId))
              .filter((id): id is string => Boolean(id)) ?? [];
            const { id: _id, createdAt: _c, updatedAt: _u, trashed: _t, trashedAt: _ta, ...rest } = item;
            await saveItem({
              ...rest,
              vaultIds: remappedVaultIds,
              trashed: false,
              trashedAt: null,
            } as import("@/lib/types").NewItemInput);
            imported++;
          } catch {
            // best-effort per item
          }
        }

        if (imported > 0) {
          toast.success("Vault restored", {
            description: `Imported ${imported} item${imported === 1 ? "" : "s"} from your backup.`,
          });
        } else {
          toast.success("Vault created", {
            description: "Your vault is ready but no items could be imported.",
          });
        }
      } else if (importFile && fileText) {
        // Non-LCKED file (Bitwarden/1Password/ProtonPass/KeePassXC CSV/XML).
        const result = await importItems(importFile.name, fileText);
        if (result.imported > 0) {
          toast.success("Vault created", {
            description: `Imported ${result.imported} item${result.imported === 1 ? "" : "s"} from your file.`,
          });
        } else {
          toast.success("Vault created", {
            description: "Could not import items from the file. Your vault is ready.",
          });
        }
      } else {
        toast.success("Vault created", {
          description: "Your data is encrypted and stored only on this device.",
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create vault", {
        description: "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 py-4 sm:py-6">
      <DotField className="pointer-events-auto absolute inset-0 h-full w-full" />
      <div className="lcked-glow pointer-events-none absolute inset-0" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex w-full max-w-md flex-col"
      >
        {/* Brand — compact, scales down on short screens */}
        <div className="mb-4 flex shrink-0 flex-col items-center gap-1 text-center sm:mb-6 sm:gap-2">
          <div className="text-primary">
            <DiamondMark size={32} glow className="lcked-pulse" />
          </div>
          <div className="text-xl font-bold tracking-tight sm:text-2xl">
            LCK<span className="text-primary">ED</span>
          </div>
          <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
            Local Vault
          </div>
        </div>

        {/* Card — flex-1 so it fills available height; max-h + overflow-y-auto
            for extreme small screens (landscape phones) */}
        <div className="flex max-h-[75vh] w-full flex-col overflow-y-auto rounded-2xl border border-border/60 bg-card/40 p-5 shadow-2xl backdrop-blur-xl sm:p-6 md:p-7">
          <div className="mb-4 flex shrink-0 flex-col items-center text-center sm:mb-5">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              {isImporting ? "Restore your vault" : "Create your vault"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {isImporting
                ? "Enter the password used to create this backup."
                : "Choose a master password to encrypt everything on this device."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3.5 sm:gap-4">
            {/* Master password — always shown. When importing, this IS the
                export password (no confirm needed). */}
            <div className="space-y-1.5">
              <Label htmlFor="master">
                {isImporting ? "Vault password" : "Master password"}
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="master"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isImporting ? "Backup password" : "At least 8 characters"}
                  autoComplete="new-password"
                  className="font-secret pl-9 pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Hide" : "Show"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Strength meter only for fresh vault creation — when importing,
                  the password already exists, so showing strength is noise. */}
              {!isImporting && <PasswordStrengthMeter password={password} />}
            </div>

            {/* Confirm password — smoothly collapses when importing. */}
            <AnimatePresence initial={false}>
              {!isImporting && (
                <motion.div
                  key="confirm-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm">Confirm master password</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirm"
                        type={show ? "text" : "password"}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        className="font-secret pl-9"
                      />
                    </div>
                    {confirm.length > 0 && confirm !== password && (
                      <p className="text-xs text-red-400">Passwords don&apos;t match</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Import existing vault (optional) */}
            <div className="space-y-2 pt-1">
              <AnimatePresence mode="wait" initial={false}>
                {!importFile ? (
                  <motion.button
                    key="import-button"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Import existing LCKED vault
                  </motion.button>
                ) : (
                  <motion.div
                    key="import-info"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5"
                  >
                    <FileJson className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{importFile.name}</span>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Remove file"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv,.xml"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-sm">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span className="text-muted-foreground">
                I understand that if I lose this password,{" "}
                <span className="font-medium text-foreground">no one can recover my data</span> —
                not even LCKED.
              </span>
            </label>

            <Button
              type="submit"
              disabled={!canSubmit}
              className="mt-auto w-full"
              size="lg"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              {isImporting ? "Restore vault" : "Create encrypted vault"}
            </Button>
          </form>
        </div>

        <p className="mt-3 shrink-0 text-center text-[11px] text-muted-foreground sm:mt-4 sm:text-xs">
          Your data never leaves this device.
        </p>
      </motion.div>
    </div>
  );
}
