"use client";

import * as React from "react";
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
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVault } from "@/store/vault";
import { download } from "@/lib/api-settings";
import { cn } from "@/lib/utils";

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
    accent: "bg-emerald-500/15 text-emerald-400",
    badge: "Recommended",
  },
  {
    id: "zip",
    label: "Encrypted ZIP",
    caption:
      "Same encrypted payload packaged as a single-file .zip archive.",
    icon: FileArchive,
    accent: "bg-violet-500/15 text-violet-400",
  },
  {
    id: "csv",
    label: "Plain CSV",
    caption:
      "Unencrypted text file. Readable by any password manager or spreadsheet tool.",
    icon: FileSpreadsheet,
    accent: "bg-amber-500/15 text-amber-400",
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

  const passphrasesMatch =
    passphrase.length >= 8 && passphrase === confirm;

  const handleEncryptedExport = async (which: "pgp" | "zip") => {
    if (!passphrasesMatch) {
      toast.error(
        "Passphrase must be at least 8 characters and match",
      );
      return;
    }
    setBusy(true);
    try {
      const json = await exportEncrypted(passphrase);
      const stamp = new Date().toISOString().slice(0, 10);
      if (which === "pgp") {
        download(
          `lcked-vault-${stamp}.json`,
          json,
          "application/json",
        );
      } else {
        download(
          `lcked-vault-${stamp}.zip`,
          json,
          "application/zip",
        );
      }
      toast.success(
        which === "pgp"
          ? "Encrypted export downloaded"
          : "Encrypted ZIP downloaded",
        {
          description:
            "Keep this file and the passphrase safe — both are required to restore.",
        },
      );
      setPassphrase("");
      setConfirm("");
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCsvExport = () => {
    const csv = exportCsv();
    const stamp = new Date().toISOString().slice(0, 10);
    download(`lcked-vault-${stamp}.csv`, csv, "text/csv");
    toast.success("CSV export downloaded");
    setCsvConfirm(false);
  };

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Download className="h-4 w-4 text-muted-foreground" />
          Export your vault
        </h2>
        <p className="text-xs text-muted-foreground">
          {itemCount} item{itemCount === 1 ? "" : "s"} ready to back up.
          Choose an encrypted format for safe storage, or plain CSV for
          migration to another tool.
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
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
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
                  <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                    {f.badge}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{f.label}</span>
                  {active && (
                    <Check className="h-3 w-3 text-primary" />
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
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
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                The CSV will contain your passwords in plain text. Only do
                this on a trusted device and delete the file after use.
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
                  className="flex-1 bg-amber-500 text-white hover:bg-amber-600"
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
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="exp-pass">Passphrase</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                <p className="text-xs text-red-400">
                  Passphrases don&apos;t match
                </p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              This passphrase is independent of your master password.
              You&apos;ll need it to restore.
            </p>
            <Button
              className="w-full"
              disabled={
                busy || !passphrasesMatch || itemCount === 0
              }
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
