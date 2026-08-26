"use client";

import {
  AlertTriangle,
  Check,
  Download,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsvExport, downloadEncryptedExport } from "@/lib/import/flows";
import { cn } from "@/lib/utils";
import { useVault } from "@/store/vault";

const TRANSITION = { duration: 0.12, ease: [0.16, 1, 0.3, 1] } as const;

type ExportFormat = "pgp" | "zip" | "csv";

const FORMATS: {
  id: ExportFormat;
  label: string;
  caption: string;
  icon: LucideIcon;
  accent: string;
  badge?: string;
}[] = [
  {
    id: "pgp",
    label: "PGP-encrypted JSON",
    caption:
      "AES-256-GCM envelope. Restore only with the passphrase. Recommended for backups.",
    icon: FileJson,
    accent: "bg-signal-success/15 text-signal-success",
    badge: "Recommended",
  },
  {
    id: "zip",
    label: "Encrypted ZIP",
    caption: "Same encrypted payload packaged as a single-file .zip archive.",
    icon: FileArchive,
    accent: "bg-primary/15 text-primary",
  },
  {
    id: "csv",
    label: "Plain CSV",
    caption:
      "Unencrypted text file. Readable by any password manager or spreadsheet tool.",
    icon: FileSpreadsheet,
    accent: "bg-signal-warning/15 text-signal-warning",
  },
];

export function ExportTab() {
  const items = useVault((s) => s.items);
  const exportEncrypted = useVault((s) => s.exportEncrypted);
  const exportCsv = useVault((s) => s.exportCsv);

  const itemCount = items.filter((i) => !i.trashed).length;
  const [format, setFormat] = React.useState<ExportFormat>("pgp");
  const [passphrase, setPassphrase] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [csvConfirm, setCsvConfirm] = React.useState(false);

  const passphrasesMatch = passphrase.length >= 8 && passphrase === confirm;

  const handleEncryptedExport = async (which: "pgp" | "zip") => {
    setBusy(true);
    const ok = await downloadEncryptedExport({
      exportEncrypted,
      passphrase,
      confirm,
      zip: which === "zip",
    });
    setBusy(false);
    if (ok) {
      setPassphrase("");
      setConfirm("");
    }
  };

  const handleCsvExport = () => {
    downloadCsvExport(exportCsv);
    setCsvConfirm(false);
  };

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Download className="text-muted-foreground h-4 w-4" />
          Export your vault
        </h2>
        <p className="text-muted-foreground text-xs">
          {itemCount} item{itemCount === 1 ? "" : "s"} ready to back up. Choose
          an encrypted format for safe storage, or plain CSV for migration to
          another tool.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {FORMATS.map((f) => {
          const active = format === f.id;
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={cn(
                "relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition duration-150",
                active
                  ? "border-primary bg-primary/5 ring-primary/30 ring-1"
                  : "border-border bg-muted/20 hover:bg-muted/40",
              )}
              aria-pressed={active}
            >
              <div className="flex w-full items-center gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    f.accent,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {f.badge && (
                  <span className="bg-primary/15 text-primary ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase">
                    {f.badge}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{f.label}</span>
                  {active && <Check className="text-primary h-3 w-3" />}
                </div>
                <div className="text-muted-foreground text-[11px]">
                  {f.caption}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {format === "csv" ? (
          <motion.div
            key="csv"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION}
            className="space-y-3"
          >
            <div className="border-signal-warning/30 bg-signal-warning/10 text-signal-warning flex items-start gap-2 rounded-lg border p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                The CSV will contain your passwords in plain text. Only do this
                on a trusted device and delete the file after use.
              </p>
            </div>
            {!csvConfirm ? (
              <Button
                variant="outline"
                className="w-full"
                disabled={itemCount === 0}
                onClick={() => setCsvConfirm(true)}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setCsvConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-signal-warning hover:bg-signal-warning/90 flex-1 text-black"
                  onClick={handleCsvExport}
                >
                  I understand, export
                </Button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="encrypted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION}
            className="space-y-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="exp-pass">Passphrase</Label>
              <div className="relative">
                <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="exp-pass"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="At least 8 characters"
                  className="font-secret pl-9"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-confirm">Confirm passphrase</Label>
              <div className="relative">
                <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="exp-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter passphrase"
                  className="font-secret pl-9"
                  autoComplete="new-password"
                />
              </div>
              {confirm.length > 0 && confirm !== passphrase && (
                <p className="text-signal-danger text-xs">
                  Passphrases don&apos;t match
                </p>
              )}
            </div>
            <p className="text-muted-foreground text-[11px]">
              This passphrase is independent of your master password.
              You&apos;ll need it to restore.
            </p>
            <Button
              className="w-full"
              disabled={busy || !passphrasesMatch || itemCount === 0}
              onClick={() => handleEncryptedExport(format)}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : format === "pgp" ? (
                <FileJson className="mr-2 h-4 w-4" />
              ) : (
                <FileArchive className="mr-2 h-4 w-4" />
              )}
              {format === "pgp"
                ? "Export encrypted JSON"
                : "Export encrypted ZIP"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
