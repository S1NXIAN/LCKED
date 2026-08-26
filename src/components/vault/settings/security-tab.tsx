"use client";

import {
  AlertTriangle,
  Clock,
  Eye,
  Loader2,
  Lock,
  ShieldCheck,
  Trash2,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { KdfParams } from "@/lib/crypto";
import { useVault } from "@/store/vault";

import { PasswordStrengthMeter } from "../password-strength-meter";

/** One-line summary of the derivation protecting the vault. */
function formatKdf(kdf: KdfParams): string {
  const mib = Math.round(kdf.memory / 1024);
  return `Argon2id · ${mib} MiB memory · t=${kdf.iterations} · p=${kdf.parallelism}`;
}

export function SecurityTab() {
  const settings = useVault((s) => s.settings);
  const updateSettings = useVault((s) => s.updateSettings);
  const changeMasterPassword = useVault((s) => s.changeMasterPassword);
  const resetVault = useVault((s) => s.resetVault);
  const items = useVault((s) => s.items);
  const kdf = useVault((s) => s.kdf);

  const [currentPw, setCurrentPw] = React.useState("");
  const [newPw, setNewPw] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);

  const handleChangePassword = async () => {
    if (newPw.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const ok = await changeMasterPassword(currentPw, newPw);
      if (ok) {
        toast.success("Master password changed");
        setCurrentPw("");
        setNewPw("");
      } else {
        toast.error("Current password is incorrect");
      }
    } catch {
      toast.error("Could not change password");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetVault();
      toast.success("Vault reset");
      setResetOpen(false);
    } catch {
      toast.error("Reset failed");
    }
  };

  return (
    <section className="space-y-6">
      {/* Auto-lock */}
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="text-muted-foreground h-4 w-4" />
            Auto-lock
          </h2>
          <p className="text-muted-foreground text-xs">
            Automatically lock the vault after a period of inactivity.
          </p>
        </header>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">
            Lock after inactivity:{" "}
            <span className="text-foreground font-medium">
              {settings.autoLockMinutes === 0
                ? "Never"
                : `${settings.autoLockMinutes} min`}
            </span>
          </Label>
          <Slider
            value={[settings.autoLockMinutes]}
            min={0}
            max={60}
            step={5}
            onValueChange={(v) => updateSettings({ autoLockMinutes: v[0] })}
          />
          <div className="text-muted-foreground flex justify-between text-[10px]">
            <span>Never</span>
            <span>30 min</span>
            <span>60 min</span>
          </div>
        </div>

        <label className="border-border bg-muted/20 flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5">
          <span className="flex flex-col">
            <span className="flex items-center gap-2 text-sm">
              <Eye className="text-muted-foreground h-4 w-4" />
              Lock when tab is hidden
            </span>
            <span className="text-muted-foreground ml-6 text-[11px]">
              Locks the vault when you switch to another browser tab.
            </span>
          </span>
          <Switch
            checked={settings.lockOnVisibility}
            onCheckedChange={(v) => updateSettings({ lockOnVisibility: v })}
          />
        </label>
      </div>

      {/* Encryption */}
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="text-muted-foreground h-4 w-4" />
            Encryption
          </h2>
          <p className="text-muted-foreground text-xs">
            The key derivation that protects this vault from offline
            password-guessing.
          </p>
        </header>
        <div className="border-border bg-muted/20 rounded-lg border px-3 py-2.5">
          {kdf ? (
            <span className="font-medium">{formatKdf(kdf)}</span>
          ) : (
            <span className="text-muted-foreground">Unknown</span>
          )}
        </div>
      </div>

      <Separator />

      {/* Change master password */}
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="text-muted-foreground h-4 w-4" />
            Change master password
          </h2>
          <p className="text-muted-foreground text-xs">
            Your master password encrypts everything. Changing it re-encrypts
            your vault.
          </p>
        </header>
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="cur-pw">Current password</Label>
            <Input
              id="cur-pw"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="font-secret"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">New password</Label>
            <Input
              id="new-pw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="font-secret"
              autoComplete="new-password"
            />
            <PasswordStrengthMeter password={newPw} />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={busy || !currentPw || newPw.length < 8}
            className="w-full"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Update master password
          </Button>
        </div>
      </div>

      <Separator />

      {/* Danger zone */}
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-signal-danger">
            <AlertTriangle className="h-4 w-4" />
            Danger zone
          </h2>
        </header>
        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <Button
            variant="outline"
            className="w-full border-signal-danger/40 text-signal-danger hover:bg-signal-danger/10 hover:text-signal-danger"
            onClick={() => setResetOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Reset entire vault
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset the entire vault?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently erases all {items.length} encrypted items from
                this device. There is no recovery. Export an encrypted backup
                first if you want to keep your data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReset}
                className="bg-signal-danger text-black hover:bg-signal-danger/90"
              >
                Erase everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
