"use client";

import * as React from "react";
import { Lock, ShieldCheck, Eye, EyeOff, AlertTriangle, Loader2, KeyRound, Upload, FileJson, X, ArrowLeft } from "lucide-react";
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
  const [showAgreeStep, setShowAgreeStep] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const isImporting = Boolean(importFile);
  const masterComplete = password.length >= 8;
  const passwordsMatch = !isImporting ? (masterComplete && password === confirm) : masterComplete;
  const canSubmit = passwordsMatch && agreed && !busy;

  const [confirmMode, setConfirmMode] = React.useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setPassword("");
      setConfirm("");
      setConfirmMode(false);
      setShowAgreeStep(false);
      setAgreed(false);
    }
  };

  const handleRemoveFile = () => {
    setImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPassword("");
    setConfirm("");
    setConfirmMode(false);
  };

  // Advance through the flow. Called by the button AND by Enter key.
  // - Importing: go straight to vault creation (no agreement step — the user
  //   already accepted the risks when they first created the vault they're
  //   now restoring).
  // - Non-importing, master mode: swap to confirm mode.
  // - Non-importing, confirm mode: advance to agreement step.
  const handleAdvance = React.useCallback(async () => {
    if (!masterComplete) return;
    if (isImporting) {
      // Importing: skip agreement, create the vault directly.
      await createVaultWithImport();
      return;
    }
    if (!confirmMode) {
      setConfirmMode(true);
      setConfirm("");
      return;
    }
    if (passwordsMatch) {
      setShowAgreeStep(true);
    }
  }, [masterComplete, isImporting, confirmMode, passwordsMatch]);

  // Create the vault + optionally import items. Used by both the import
  // advance (Enter or button) and the agreement submit.
  const createVaultWithImport = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const fileText = importFile ? await importFile.text() : null;

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
          // Not JSON → CSV/other format; fall through to importItems.
        }
      }

      await setupVault(password);

      if (isLckedExport && decryptedPayload) {
        const { items: decryptedItems, vaults: decryptedVaults } = decryptedPayload;
        for (const v of decryptedVaults) {
          try { await createVault(v.name, v.color, v.icon); } catch { /* best-effort */ }
        }
        const currentVaults = useVault.getState().vaults;
        const vaultIdMap = new Map<string, string>();
        for (const oldV of decryptedVaults) {
          const newV = currentVaults.find(
            (nv) => nv.name === oldV.name && nv.color === oldV.color && nv.icon === oldV.icon,
          );
          if (newV) vaultIdMap.set(oldV.id, newV.id);
        }
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
          } catch { /* best-effort per item */ }
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
  }, [busy, importFile, password, setupVault, createVault, saveItem, importItems]);

  const handleBack = () => {
    setShowAgreeStep(false);
    setAgreed(false);
  };

  const handleEditMaster = () => {
    setConfirmMode(false);
    setPassword("");
    setConfirm("");
  };

  const inputCls = "font-secret pl-9 pr-10 focus-visible:ring-0 focus-visible:border-primary/50";

  // Handle Enter key on the password field. Instead of submitting the form
  // (which requires the agreement checkbox), Enter advances the flow:
  // - Master mode: swap to confirm
  // - Confirm mode: advance to agreement
  // - Importing: create the vault directly
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Only advance if the current field is valid.
      if (isImporting ? masterComplete : (confirmMode ? passwordsMatch : masterComplete)) {
        handleAdvance();
      }
    }
  };

  // Agreement step submit (non-import only).
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await createVaultWithImport();
  };

  // Show the back arrow when we're in confirm mode OR the agree step.
  const showBackArrow = confirmMode || showAgreeStep;

  const handleBackArrow = () => {
    if (showAgreeStep) {
      handleBack();
    } else if (confirmMode) {
      handleEditMaster();
    }
  };

  const renderPasswordField = () => {
    if (confirmMode && !showAgreeStep) {
      return (
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm master password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirm"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              className={inputCls}
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
          {confirm.length > 0 && confirm !== password && (
            <p className="text-xs text-red-400">Passwords don&apos;t match</p>
          )}
          {confirm.length === 0 && (
            <button
              type="button"
              onClick={handleEditMaster}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Edit master password
            </button>
          )}
        </div>
      );
    }
    return (
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
            onChange={(e) => {
              setPassword(e.target.value);
              setConfirm("");
            }}
            onKeyDown={handleKeyDown}
            placeholder={isImporting ? "Backup password" : "At least 8 characters"}
            autoComplete="new-password"
            className={inputCls}
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
        {!isImporting && <PasswordStrengthMeter password={password} />}
      </div>
    );
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
        {/* Brand */}
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

        {/* Card */}
        <div className="flex w-full flex-col rounded-2xl border border-border/60 bg-card/40 p-5 shadow-2xl backdrop-blur-xl sm:p-6 md:p-7">
          {/* Back arrow — top-left. Shows when in confirm mode or agree step.
              Smooth fade in/out. Aesthetically subtle: ghost button, muted. */}
          <AnimatePresence>
            {showBackArrow && (
              <motion.button
                type="button"
                onClick={handleBackArrow}
                disabled={busy}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:left-5 sm:top-5"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>

          <div className="mb-4 flex shrink-0 flex-col items-center text-center sm:mb-5">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              {showAgreeStep
                ? "One last thing"
                : isImporting
                  ? "Restore your vault"
                  : "Create your vault"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {showAgreeStep
                ? "Please confirm you understand the risks."
                : isImporting
                  ? "Enter the password used to create this backup."
                  : "Choose a master password to encrypt everything on this device."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3.5 sm:gap-4">
            {/* Step 1+2: password entry */}
            <AnimatePresence initial={false}>
              {!showAgreeStep && (
                <motion.div
                  key="password-step"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-3.5 sm:gap-4">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={confirmMode ? "confirm" : "master"}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      >
                        {renderPasswordField()}
                      </motion.div>
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

                    {/* Advance button */}
                    <Button
                      type="button"
                      onClick={handleAdvance}
                      disabled={isImporting ? !masterComplete || busy : (confirmMode ? !passwordsMatch : !masterComplete)}
                      className="mt-auto w-full"
                      size="lg"
                    >
                      {busy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      {isImporting
                        ? "Restore vault"
                        : confirmMode
                          ? "Create encrypted vault"
                          : "Continue"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 3: agreement + final submit (non-import only) */}
            <AnimatePresence initial={false}>
              {showAgreeStep && (
                <motion.div
                  key="agree-step"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-4">
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            Your master password is the only key
                          </p>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            There is no password recovery, no reset link, no backdoor. If you forget
                            it, your encrypted data is permanently lost — not even LCKED can help.
                          </p>
                        </div>
                      </div>
                    </div>

                    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
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
                      className="w-full"
                      size="lg"
                    >
                      {busy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      Confirm & create
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>

        <p className="mt-3 shrink-0 text-center text-[11px] text-muted-foreground sm:mt-4 sm:text-xs">
          Your data never leaves this device.
        </p>
      </motion.div>
    </div>
  );
}
