"use client";

import * as React from "react";
import {
  Upload,
  Download,
  FileJson,
  FileSpreadsheet,
  Lock,
  AlertTriangle,
  Loader2,
  FileUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useVault } from "@/store/vault";
import { detectFormat } from "@/lib/import-export";
import { download } from "@/lib/browser-utils";
import { cn } from "@/lib/utils";

export function ImportExportDialog() {
  const open = useVault((s) => s.importExportOpen);
  const setOpen = useVault((s) => s.setImportExportOpen);
  const importItems = useVault((s) => s.importItems);
  const exportEncrypted = useVault((s) => s.exportEncrypted);
  const exportCsv = useVault((s) => s.exportCsv);
  const items = useVault((s) => s.items);

  const [file, setFile] = React.useState<File | null>(null);
  const [filePreview, setFilePreview] = React.useState<string>("");
  const [detectedFormat, setDetectedFormat] = React.useState<string>("");
  const [importing, setImporting] = React.useState(false);

  const [exportPassword, setExportPassword] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const [csvConfirm, setCsvConfirm] = React.useState(false);

  const handleFile = async (f: File) => {
    setFile(f);
    const text = await f.text();
    setFilePreview(text.slice(0, 600));
    setDetectedFormat(detectFormat(f.name, text));
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const result = await importItems(file.name, text);
      toast.success(`Imported ${result.imported} item${result.imported === 1 ? "" : "s"}`, {
        description:
          result.skipped > 0
            ? `${result.skipped} skipped. ${result.warnings[0] ?? ""}`
            : undefined,
      });
      if (result.warnings.length > 0 && result.skipped > 0) {
        console.warn("Import warnings:", result.warnings);
      }
      setOpen(false);
      setFile(null);
      setFilePreview("");
    } catch (err) {
      console.error(err);
      toast.error("Import failed", { description: "The file may be corrupted or unsupported." });
    } finally {
      setImporting(false);
    }
  };

  const handleExportEncrypted = async () => {
    if (exportPassword.length < 8) {
      toast.error("Export password must be at least 8 characters");
      return;
    }
    setExporting(true);
    try {
      const json = await exportEncrypted(exportPassword);
      const stamp = new Date().toISOString().slice(0, 10);
      download(`lcked-vault-${stamp}.json`, json, "application/json");
      toast.success("Encrypted export downloaded", {
        description: "Keep this file and the password safe — both are required to restore.",
      });
      setExportPassword("");
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = () => {
    const csv = exportCsv();
    const stamp = new Date().toISOString().slice(0, 10);
    download(`lcked-vault-${stamp}.csv`, csv, "text/csv");
    toast.success("CSV export downloaded");
    setCsvConfirm(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Import / Export</DialogTitle>
          <DialogDescription>
            Move items in and out of your local vault. Encrypted JSON is the only fully secure option.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="import" className="w-full">
          <div className="px-5 pt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="import">
                <Upload className="mr-2 h-3.5 w-3.5" />
                Import
              </TabsTrigger>
              <TabsTrigger value="export">
                <Download className="mr-2 h-3.5 w-3.5" />
                Export
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Import */}
          <TabsContent value="import" className="space-y-4 px-5 py-4">
            <label
              htmlFor="import-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors hover:border-primary hover:bg-muted/50"
            >
              <FileUp className="h-7 w-7 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">
                  {file ? file.name : "Choose a file to import"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Bitwarden (JSON/CSV), Chrome (CSV), Firefox (CSV), Proton Pass (CSV), KeePassXC (XML)
                </div>
              </div>
              <input
                id="import-file"
                type="file"
                accept=".json,.csv,.xml"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>

            {file && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Detected format:</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                    {detectedFormat}
                  </span>
                </div>
                {filePreview && (
                  <pre className="lcked-scroll max-h-32 overflow-auto rounded-lg bg-muted/50 p-2 text-[10px] text-muted-foreground">
                    {filePreview}
                  </pre>
                )}
              </div>
            )}

            <Button
              className="w-full"
              disabled={!file || importing}
              onClick={handleImport}
            >
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Import items
            </Button>
          </TabsContent>

          {/* Export */}
          <TabsContent value="export" className="space-y-4 px-5 py-4">
            <div className="text-xs text-muted-foreground">
              {items.length} item{items.length === 1 ? "" : "s"} in your vault.
            </div>

            {/* Encrypted JSON */}
            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <FileJson className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">Encrypted JSON</div>
                  <div className="text-xs text-muted-foreground">Recommended · fully secure</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="export-pw">Export password</Label>
                <Input
                  id="export-pw"
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="Password to protect this export"
                  className="font-secret"
                />
                <p className="text-[11px] text-muted-foreground">
                  This password is independent of your master password. You&apos;ll need it to restore.
                </p>
              </div>
              <Button
                className="mt-3 w-full"
                onClick={handleExportEncrypted}
                disabled={exporting || exportPassword.length < 8 || items.length === 0}
              >
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Export encrypted JSON
              </Button>
            </div>

            {/* CSV */}
            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">Plain CSV</div>
                  <div className="text-xs text-muted-foreground">Not recommended · unencrypted</div>
                </div>
              </div>
              {!csvConfirm ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setCsvConfirm(true)}
                  disabled={items.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              ) : (
                <div className="space-y-3">
                  <Alert className="border-amber-500/40 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <AlertDescription className="text-amber-200/90">
                      The CSV will contain your passwords in plain text. Only do this on a trusted
                      device and delete the file after use.
                    </AlertDescription>
                  </Alert>
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
                      onClick={handleExportCsv}
                    >
                      I understand, export
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
