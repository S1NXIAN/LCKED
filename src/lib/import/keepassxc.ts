/**
 * LCKED — KeePassXC XML import parser
 * ---------------------------------------------------------------------------
 * Parses KeePassXC unencrypted XML 2.x exports. Entries live under
 * <Root>/<Group>//<Entry> (groups can nest). Each <Entry> holds a sequence
 * of <String><Key>..</Key><Value>..</Value></String> pairs.
 *
 * We walk every <Entry> in document order, ignoring group nesting.
 */

import type { ImportResult, NewItemInput } from "@/lib/types";
import { makeLogin, makeNote } from "./helpers";

export function parseKeePassXcXml(text: string): ImportResult {
  const result: ImportResult = { imported: 0, skipped: 0, warnings: [] };
  if (typeof DOMParser === "undefined") {
    result.warnings.push("DOMParser is not available in this environment.");
    return result;
  }
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    result.warnings.push("File is not well-formed XML.");
    return result;
  }
  const entries = Array.from(doc.getElementsByTagName("Entry"));
  if (entries.length === 0) {
    result.warnings.push("No <Entry> elements found in KeePassXC XML export.");
    return result;
  }
  const items: NewItemInput[] = [];
  for (const entry of entries) {
    try {
      const fields = readKeePassXcEntry(entry);
      const name = (fields.get("Title") ?? "").trim() || "Untitled";
      const username = fields.get("UserName") ?? "";
      const password = fields.get("Password") ?? "";
      const url = fields.get("URL") ?? "";
      const notes = fields.get("Notes") ?? "";
      const totp =
        fields.get("otp") ??
        fields.get("TimeOtp-Secret") ??
        fields.get("TimeOtp-Secret-Hex") ??
        "";
      const urls = url
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (username || password || url) {
        items.push(
          makeLogin({
            name,
            username,
            password,
            urls,
            totp,
            notes,
            folder: "",
            favorite: false,
          }),
        );
      } else {
        items.push(
          makeNote({
            name,
            content: notes,
            folder: "",
            favorite: false,
          }),
        );
      }
      result.imported++;
    } catch {
      result.skipped++;
    }
  }
  result.items = items;
  return result;
}

/** Read a KeePassXC <Entry> into a Map of Key→Value strings (last write wins). */
export function readKeePassXcEntry(entry: Element): Map<string, string> {
  const map = new Map<string, string>();
  const strings = Array.from(entry.children).filter((c) => c.tagName.toLowerCase() === "string");
  for (const str of strings) {
    const keyEl = Array.from(str.children).find((c) => c.tagName.toLowerCase() === "key");
    const valueEl = Array.from(str.children).find((c) => c.tagName.toLowerCase() === "value");
    if (!keyEl || !valueEl) continue;
    const key = (keyEl.textContent ?? "").trim();
    const value = valueEl.textContent ?? "";
    if (key) map.set(key, value);
  }
  return map;
}
