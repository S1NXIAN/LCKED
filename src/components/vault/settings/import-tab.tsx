"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileUp, Loader2, Upload } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { readPickedFile, runImport } from "@/lib/import/flows";
import { IMPORT_SOURCES } from "@/lib/import/sources";
import { cn } from "@/lib/utils";
import { useVault } from "@/store/vault";

export function ImportTab() {
  const importItems = useVault((s) => s.importItems);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [pendingSource, setPendingSource] = React.useState<
    (typeof IMPORT_SOURCES)[number] | null
  >(null);
  const [importing, setImporting] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [detectedFmt, setDetectedFmt] = React.useState("");

  const triggerFilePicker = (src: (typeof IMPORT_SOURCES)[number]) => {
    setPendingSource(src);
    fileInputRef.current?.click();
  };

  const handleFile = async (f: File) => {
    setFile(f);
    const picked = await readPickedFile(f);
    setDetectedFmt(picked?.format ?? "");
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    if (await runImport(file, importItems)) {
      setFile(null);
      setPendingSource(null);
      setDetectedFmt("");
    }
    setImporting(false);
  };

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Upload className="text-muted-foreground h-4 w-4" />
          Import from another password manager
        </h2>
        <p className="text-muted-foreground text-xs">
          Click your previous provider to choose an export file. Supported
          formats: Bitwarden{" "}
          <span className="text-foreground/80">JSON / CSV</span>, Chrome /
          Firefox / Proton Pass <span className="text-foreground/80">CSV</span>,
          KeePassXC <span className="text-foreground/80">XML</span>. LCKED
          auto-detects the format.
        </p>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv,.xml"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {IMPORT_SOURCES.map((src) => (
          <button
            key={src.id}
            onClick={() => triggerFilePicker(src)}
            className={cn(
              "group border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40 flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition duration-150",
              pendingSource?.id === src.id &&
                "border-primary ring-primary/30 ring-1",
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
            <div className="w-full min-w-0">
              <div className="truncate text-xs font-medium">{src.label}</div>
              <div className="text-muted-foreground text-[10px]">
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
            <div className="border-border bg-muted/20 space-y-3 rounded-xl border p-3">
              <div className="flex items-center gap-2 text-xs">
                <FileUp className="text-muted-foreground h-3.5 w-3.5" />
                <span className="truncate font-medium">{file.name}</span>
                {detectedFmt && (
                  <span className="bg-primary/10 text-primary ml-auto rounded px-1.5 py-0.5 font-medium">
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
