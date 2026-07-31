/**
 * LCKED — 1Password CSV import parser
 * ---------------------------------------------------------------------------
 * Parses 1Password "All Items" CSV exports. Lacks a type column, so items
 * with a username/URL/password are treated as logins; everything else as a
 * secure note.
 */

import type { ImportResult, NewItemInput } from "@/lib/types";
import { parseCsv, rowToObject } from "./csv";
import { makeLogin, makeNote } from "./helpers";

export function parseOnePasswordCsv(text: string): ImportResult {
  const result: ImportResult = { imported: 0, skipped: 0, warnings: [] };
  const rows = parseCsv(text);
  if (rows.length < 2) {
    result.warnings.push("CSV has no data rows.");
    return result;
  }
  const headers = rows[0];
  const items: NewItemInput[] = [];
  for (let i = 1; i < rows.length; i++) {
    const o = rowToObject(headers, rows[i]);
    try {
      const title = o.Title || o.title || "Untitled";
      const url = o.Url || o.URL || o.url || "";
      const username = o.Username || o.username || "";
      const password = o.Password || o.password || "";
      const notes = o.Notes || o.notes || "";
      const totp = o.OTPAuth || o.OTP || o.totp || "";
      if (username || url || password) {
        items.push(
          makeLogin({
            name: title,
            username,
            password,
            urls: url ? [url] : [],
            totp,
            notes,
            folder: "",
            favorite: false,
          }),
        );
      } else {
        items.push(makeNote({ name: title, content: notes, folder: "", favorite: false }));
      }
      result.imported++;
    } catch {
      result.skipped++;
    }
  }
  result.items = items;
  return result;
}
