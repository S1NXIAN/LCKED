"use client";

import * as React from "react";
import { FileUp, Loader2, Upload } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useVault } from "@/store/vault";
import { IMPORT_SOURCES } from "@/lib/import-sources";
import { detectFormat } from "@/lib/import-export";
import { cn } from "@/lib/utils";

export function ImportTab() {
  const importItems = useVault((s) => s.importItems);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [pendingSource, setPendingSource] =
    React.useState<(typeof IMPORT_SOURCES)[number] | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [detectedFmt, setDetectedFmt] = React.useState("");

  const triggerFilePicker = (
    src: (typeof IMPORT_SOURCES)[number],
  ) => {
    setPendingSource(src);
    fileInputRef.current?.click();
  };

  const handleFile = async (f: File) => {
    setFile(f);
    try {
      const text = await f.text();
      setDetectedFmt(detectFormat(f.name, text));
    } catch {
      setDetectedFmt("");
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const result = await importItems(file.name, text);
      toast.success(
        `Imported ${result.imported} item${result.imported === 1 ? "" : "s"}`,
        {
          description:
            result.skipped > 0
              ? `${result.skipped} skipped. ${result.warnings[0] ?? ""}`
              : undefined,
        },
      );
      setFile(null);
      setPendingSource(null);
      setDetectedFmt("");
    } catch (err) {
      console.error(err);
      toast.error("Import failed", {
        description:
          "The file may be corrupted or in an unsupported format.",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Upload className="h-4 w-4 text-muted-foreground" />
          Import from another password manager
        </h2>
        <p className="text-xs text-muted-foreground">
          Click your previous provider to choose an export file. Supported
          formats: Bitwarden{" "}
          <span className="text-foreground/80">JSON / CSV</span>, Chrome /
          Firefox / Proton Pass <span className="text-foreground/80">
            CSV
          </span>, KeePassXC <span className="text-foreground/80">
            XML
          </span>. LCKED auto-detects the format.
        </p>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv,.xml"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {IMPORT_SOURCES.map((src) => (
          <button
            key={src.id}
            onClick={() => triggerFilePicker(src)}
            className={cn(
              "group flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/20 p-3 text-center transition duration-150 hover:border-primary/50 hover:bg-muted/40",
              pendingSource?.id === src.id &&
                "border-primary ring-1 ring-primary/30",
            )}
            aria-label={`Import from ${src.label}`}
          >
            <img
              src={src.icon}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8"
              aria-hidden="true"
            />
            <div className="min-w-0 w-full">
              <div className="truncate text-xs font-medium">
                {src.label}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {src.hint}
              </div>
            </div>
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {file && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-xs">
                <FileUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate font-medium">{file.name}</span>
                {detectedFmt && (
                  <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                    {detectedFmt}
                  </span>
                )}
              </div>
              <Button
                className="w-full"
                disabled={importing}
                onClick={handleImport}
              >
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import items
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
