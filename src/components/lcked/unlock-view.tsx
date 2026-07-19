"use client";

import * as React from "react";
import { ShieldCheck, Lock, Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useVault } from "@/store/vault";
import { DiamondMark } from "./diamond-mark";
import { DotField } from "./dot-field";

export function UnlockView() {
  const unlock = useVault((s) => s.unlock);
  const resetVault = useVault((s) => s.resetVault);
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(false);
    try {
      const ok = await unlock(password);
      if (!ok) {
        setError(true);
        toast.error("Incorrect master password");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to unlock vault");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetVault();
      toast.success("Vault reset", {
        description: "You can set up a new master password now.",
      });
    } catch {
      toast.error("Could not reset the vault");
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Animated dot field */}
      <DotField className="pointer-events-auto absolute inset-0 h-full w-full" />

      {/* Gradient backdrop */}
      <div className="lcked-glow pointer-events-none absolute inset-0" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        {/* Centered brand header */}
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
            <h1 className="text-xl font-semibold tracking-tight">Unlock your vault</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your master password to decrypt your items locally.
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
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(false);
                  }}
                  placeholder="Your master password"
                  autoComplete="current-password"
                  className={`font-secret pl-9 pr-10 focus-visible:ring-1 ${error ? "border-red-500/60 focus-visible:ring-red-500/40" : ""}`}
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
              {error && (
                <p className="text-xs text-red-400">That password didn&apos;t work. Try again.</p>
              )}
            </div>

            <Button type="submit" disabled={!password || busy} className="w-full" size="lg">
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Unlock
            </Button>
          </form>

          <div className="mt-6 text-center">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="text-xs text-muted-foreground underline-offset-2 hover:text-red-400 hover:underline">
                  Forgot password? Reset vault
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    Reset the entire vault?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes every encrypted item stored on this device. There is
                    no recovery — the data is cryptographically erased. Only continue if you truly
                    forgot your master password.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReset}
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    Yes, erase everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your data never leaves this device.
        </p>
      </motion.div>
    </div>
  );
}
