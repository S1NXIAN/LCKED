/**
 * LCKED — Import module public API
 * ---------------------------------------------------------------------------
 * Re-exports all public symbols from the per-format sub-modules so that
 * existing `@/lib/import-export` import paths continue to work (via the
 * barrel re-export in import-export.ts).
 *
 * Also hosts the shared dispatch logic: format detection, import orchestration,
 * and the VaultItem→NewItemInput downgrade helper.
 */

import type { ImportFormat, ImportResult, NewItemInput, VaultItem } from "@/lib/types";
import { parseBitwardenJson, parseBitwardenCsv } from "./bitwarden";
import { parseOnePasswordCsv } from "./onepassword";
import { parseProtonPassCsv } from "./protonpass";
import { parseKeePassXcXml } from "./keepassxc";
import { parseLckedJson } from "./lcked";

export type { LckedExport } from "./lcked";
export { parseBitwardenJson, parseBitwardenCsv } from "./bitwarden";
export { parseOnePasswordCsv } from "./onepassword";
export { parseProtonPassCsv } from "./protonpass";
export { parseKeePassXcXml } from "./keepassxc";
export { parseLckedJson } from "./lcked";
export { parseCsv, rowToObject, csvEscape } from "./csv";
export { exportToCsv, detectCardBrand } from "./export";

export type { ImportFormat } from "@/lib/types";

export function detectFormat(filename: string, text: string): ImportFormat {
  const lower = filename.toLowerCase();
  const trimmed = text.trim();
  if (lower.endsWith(".json")) {
    if (trimmed.startsWith("{") && /"format"\s*:\s*"lcked-encrypted-v1"/.test(trimmed)) {
      return "lcked-json";
    }
    return "bitwarden-json";
  }
  if (lower.endsWith(".xml")) {
    return "keepassxc-xml";
  }
  if (lower.endsWith(".csv")) {
    const firstLine = (trimmed.split(/\r?\n/)[0] || "").toLowerCase();
    if (firstLine.includes("card_pin") || firstLine.includes("identity_company")) return "bitwarden-csv";
    if (firstLine.includes("item_type") || firstLine.includes("login_urls")) return "protonpass-csv";
    if (firstLine.includes("title") && firstLine.includes("url")) return "1password-csv";
    return "bitwarden-csv";
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "bitwarden-json";
  if (/^<\?xml/.test(trimmed) && /<KeePassFile|<Database|<Entry>/i.test(trimmed)) {
    return "keepassxc-xml";
  }
  return "bitwarden-csv";
}

/** Run the appropriate parser and return the prepared items. */
export function importFromText(filename: string, text: string): {
  result: ImportResult;
  items: NewItemInput[];
} {
  const format = detectFormat(filename, text);
  let result: ImportResult;
  switch (format) {
    case "bitwarden-json":
      result = parseBitwardenJson(text);
      break;
    case "bitwarden-csv":
      result = parseBitwardenCsv(text);
      break;
    case "1password-csv":
      result = parseOnePasswordCsv(text);
      break;
    case "protonpass-csv":
      result = parseProtonPassCsv(text);
      break;
    case "keepassxc-xml":
      result = parseKeePassXcXml(text);
      break;
    case "lcked-json":
      result = parseLckedJson(text);
      break;
  }
  const items: NewItemInput[] = result.items ?? [];
  return { result, items };
}

/** Downgrade a stored item to a NewItemInput (drops id/timestamps). */
export function toItemInput(item: VaultItem): NewItemInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = item;
  return rest as NewItemInput;
}
