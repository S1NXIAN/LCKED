/**
 * LCKED — Browser-side shared utilities
 * ---------------------------------------------------------------------------
 * Shared browser/DOM helpers.
 */

/**
 * Trigger a browser file download.
 */
export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
