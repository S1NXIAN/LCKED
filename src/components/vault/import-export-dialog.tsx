"use client";

import {
  AlertTriangle,
  Download,
  FileJson,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Lock,
  Upload,
} from "lucide-react";
import * as React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  downloadCsvExport,
  downloadEncryptedExport,
  readPickedFile,
  runImport,
} from "@/lib/import/flows";
import { useVault } from "@/store/vault";

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
    const picked = await readPickedFile(f);
    setDetectedFormat(picked?.format ?? "");
    if (picked) setFilePreview(picked.text.slice(0, 600));
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    if (await runImport(file, importItems)) {
      setOpen(false);
      setFile(null);
      setFilePreview("");
    }
    setImporting(false);
  };

  const handleExportEncrypted = async () => {
    setExporting(true);
    const ok = await downloadEncryptedExport({
      exportEncrypted,
      passphrase: exportPassword,
    });
    setExporting(false);
    if (ok) {
      setExportPassword("");
      setOpen(false);
    }
  };

  const handleExportCsv = () => {
    downloadCsvExport(exportCsv);
    setCsvConfirm(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-border border-b px-5 py-4">
          <DialogTitle>Import / Export</DialogTitle>
          <DialogDescription>
            Move items in and out of your local vault. Encrypted JSON is the
            only fully secure option.
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
              className="border-border bg-muted/30 hover:border-primary hover:bg-muted/50 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors"
            >
              <FileUp className="text-muted-foreground h-7 w-7" />
              <div>
                <div className="text-sm font-medium">
                  {file ? file.name : "Choose a file to import"}
                </div>
                <div className="text-muted-foreground text-xs">
                  Bitwarden (JSON/CSV), Chrome (CSV), Firefox (CSV), Proton Pass
                  (CSV), KeePassXC (XML)
                </div>
              </div>
              <input
                id="import-file"
                type="file"
                accept=".json,.csv,.xml"
                className="sr-only"
                onChange={(e) =>
                  e.target.files?.[0] && handleFile(e.target.files[0])
                }
              />
            </label>

            {file && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    Detected format:
                  </span>
                  <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 font-medium">
                    {detectedFormat}
                  </span>
                </div>
                {filePreview && (
                  <pre className="lcked-scroll bg-muted/50 text-muted-foreground max-h-32 overflow-auto rounded-lg p-2 text-[10px]">
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
            <div className="text-muted-foreground text-xs">
              {items.length} item{items.length === 1 ? "" : "s"} in your vault.
            </div>

            {/* Encrypted JSON */}
            <div className="border-border rounded-xl border p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <FileJson className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">Encrypted JSON</div>
                  <div className="text-muted-foreground text-xs">
                    Recommended · fully secure
                  </div>
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
                <p className="text-muted-foreground text-[11px]">
                  This password is independent of your master password.
                  You&apos;ll need it to restore.
                </p>
              </div>
              <Button
                className="mt-3 w-full"
                onClick={handleExportEncrypted}
                disabled={
                  exporting || exportPassword.length < 8 || items.length === 0
                }
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
            <div className="border-border rounded-xl border p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">Plain CSV</div>
                  <div className="text-muted-foreground text-xs">
                    Not recommended · unencrypted
                  </div>
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
                      The CSV will contain your passwords in plain text. Only do
                      this on a trusted device and delete the file after use.
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
