/**
 * LCKED — CSV parsing utilities
 * ---------------------------------------------------------------------------
 * Minimal RFC-4180-ish CSV parser, output row builder, and CSV field escaping
 * shared by the format-specific import parsers and the export writer.
 */

/** Minimal RFC-4180-ish CSV parser (handles quotes, escaped quotes, CRLF,
 *  old-Mac \r-only line endings, and strips a leading UTF-8 BOM). */
export function parseCsv(text: string): string[][] {
  // Strip UTF-8 BOM (common on Windows-saved exports from Bitwarden/1Password).
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // Handle old-Mac \r-only line endings (rare, but some DB exports use them).
      if (text[i + 1] !== "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      }
      // \r\n is handled by the \n branch above (the \r is a no-op here).
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ""));
}

export function rowToObject(
  headers: string[],
  row: string[],
): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => {
    obj[h.trim()] = (row[i] ?? "").trim();
  });
  return obj;
}

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
