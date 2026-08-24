/**
 * LCKED — Import/export UI flows
 * ---------------------------------------------------------------------------
 * The shared choreography behind every surface that triggers an import or an
 * export: file reading, format detection, validation, toasts, and export
 * filenames live here once. The Settings tabs are thin skins that keep only
 * their own busy/file state and close-or-reset behaviour.
 *
 * Every function takes its store actions as parameters — no store import —
 * so callers stay explicit and tests inject fakes.
 */

import { toast } from "sonner";

import { download } from "@/lib/browser-utils";
import { detectFormat, type ImportFormat } from "@/lib/import";
import type { ImportResult } from "@/lib/types";

type ImportItemsFn = (filename: string, text: string) => Promise<ImportResult>;

/** All export files share one date stamp so a day's exports sort together. */
const vaultFileName = (ext: string) =>
  `lcked-vault-${new Date().toISOString().slice(0, 10)}.${ext}`;

/** Read a picked file and detect its import format. Resolves `null` when
 *  the file can't be read — callers show an empty detection badge. */
export async function readPickedFile(
  file: File,
): Promise<{ text: string; format: ImportFormat } | null> {
  try {
    const text = await file.text();
    return { text, format: detectFormat(file.name, text) };
  } catch {
    return null;
  }
}

/** Import a picked file via the store with the shared success/error toasts.
 *  Resolves `true` on success — the caller then closes/resets; `false` on
 *  failure. Never throws. */
export async function runImport(
  file: File,
  importItems: ImportItemsFn,
): Promise<boolean> {
  try {
    const result = await importItems(file.name, await file.text());
    toast.success(
      `Imported ${result.imported} item${result.imported === 1 ? "" : "s"}`,
      {
        description:
          result.skipped > 0
            ? `${result.skipped} skipped. ${result.warnings[0] ?? ""}`
            : undefined,
      },
    );
    if (result.warnings.length > 0 && result.skipped > 0) {
      console.warn("Import warnings:", result.warnings);
    }
    return true;
  } catch (err) {
    console.error(err);
    toast.error("Import failed", {
      description: "The file may be corrupted or in an unsupported format.",
    });
    return false;
  }
}

/** Validate the passphrase, export encrypted, download the file.
 *  Length ≥ 8 always applies; when `confirm` is provided it must also match
 *  (the settings tab's two-field skin — the dialog passes none). Resolves
 *  `true` when the file downloaded; never throws. */
export async function downloadEncryptedExport(opts: {
  exportEncrypted: (password: string) => Promise<string>;
  passphrase: string;
  confirm?: string;
  zip?: boolean;
}): Promise<boolean> {
  const valid =
    opts.passphrase.length >= 8 &&
    (opts.confirm === undefined || opts.confirm === opts.passphrase);
  if (!valid) {
    toast.error(
      opts.confirm === undefined
        ? "Export password must be at least 8 characters"
        : "Passphrase must be at least 8 characters and match",
    );
    return false;
  }

  try {
    const json = await opts.exportEncrypted(opts.passphrase);
    const ext = opts.zip ? "zip" : "json";
    download(
      vaultFileName(ext),
      json,
      opts.zip ? "application/zip" : "application/json",
    );
    toast.success(
      opts.zip ? "Encrypted ZIP downloaded" : "Encrypted export downloaded",
      {
        description:
          "Keep this file and the passphrase safe — both are required to restore.",
      },
    );
    return true;
  } catch (err) {
    console.error(err);
    toast.error("Export failed");
    return false;
  }
}

/** Export the vault as plain CSV and download it. */
export function downloadCsvExport(exportCsv: () => string): void {
  download(vaultFileName("csv"), exportCsv(), "text/csv");
  toast.success("CSV export downloaded");
}
