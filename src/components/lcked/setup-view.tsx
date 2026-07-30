"use client";

import * as React from "react";
import { Lock, ShieldCheck, Eye, EyeOff, AlertTriangle, Loader2, KeyRound, Upload, FileJson, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useVault } from "@/store/vault";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { DiamondMark } from "./diamond-mark";
import { DotField } from "./dot-field";
import { cn } from "@/lib/utils";

export function SetupView() {
  const setupVault = useVault((s) => s.setupVault);
  const importItems = useVault((s) => s.importItems);
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
      // Create the vault first.
      await setupVault(password);

      // If importing, decrypt the export and import the items.
      if (importFile) {
        const text = await importFile.text();
        const result = await importItems(importFile.name, text);
        if (result.imported > 0) {
          toast.success("Vault created", {
            description: `Imported ${result.imported} item${result.imported === 1 ? "" : "s"} from your backup.`,
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <DotField className="pointer-events-auto absolute inset-0 h-full w-full" />
      <div className="lcked-glow pointer-events-none absolute inset-0" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="text-primary">
            <DiamondMark size={36} glow className="lcked-pulse" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            LCK<span className="text-primary">ED</span>
          </div>
          <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
            Local Vault
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <h1 className="text-xl font-semibold tracking-tight">
              {isImporting ? "Restore your vault" : "Create your vault"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isImporting
                ? "Enter the password used to create this backup."
                : "Choose a master password to encrypt everything on this device."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                accept=".json"
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
              className="w-full"
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

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your data never leaves this device.
        </p>
      </motion.div>
    </div>
  );
}
