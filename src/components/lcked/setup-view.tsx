"use client";

import * as React from "react";
import { Lock, ShieldCheck, Eye, EyeOff, AlertTriangle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useVault } from "@/store/vault";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { DiamondMark } from "./diamond-mark";
import { DotField } from "./dot-field";

export function SetupView() {
  const setupVault = useVault((s) => s.setupVault);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [agreed, setAgreed] = React.useState(false);

  const canSubmit =
    password.length >= 8 && password === confirm && agreed && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await setupVault(password);
      toast.success("Vault created", {
        description: "Your data is encrypted and stored only on this device.",
      });
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
      {/* Animated dot field — painted first so everything else stacks on top. */}
      <DotField className="pointer-events-auto absolute inset-0 h-full w-full" />

      {/* Gradient backdrop (sits above the dot field, below the content). */}
      <div className="lcked-glow pointer-events-none absolute inset-0" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        {/* Centered brand header — diamond + LCKED + LOCAL VAULT */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="text-primary">
            <DiamondMark size={36} glow />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            LCK<span className="text-primary">ED</span>
          </div>
          <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
            Local Vault
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-tight">Create your vault</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a strong master password. It encrypts everything and can never be recovered.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="master">Master password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="master"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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
              <PasswordStrengthMeter password={password} />
            </div>

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

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span className="text-muted-foreground">
                I understand that if I lose this password,{" "}
                <span className="font-medium text-foreground">no one can recover my data</span> —
                not even LCKED. There is no server, no reset link, no backdoor.
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
              Create encrypted vault
            </Button>
          </form>

          <div className="mt-5 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200/90">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Tip: write your master password down on paper and store it somewhere safe.
              All encryption runs locally in your browser.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your data never leaves this device.
        </p>
      </motion.div>
    </div>
  );
}
