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

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Convert a KeePassXC hex TOTP secret to the base32 the generator expects. */
function hexToBase32(hex: string): string | null {
  const cleaned = hex.replace(/\s+/g, "");
  if (!cleaned || cleaned.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(cleaned)) {
    return null;
  }
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < cleaned.length; i += 2) {
    value = (value << 8) | parseInt(cleaned.slice(i, i + 2), 16);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

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
      let totp = fields.get("otp") ?? fields.get("TimeOtp-Secret") ?? "";
      if (!totp) {
        const hex = fields.get("TimeOtp-Secret-Hex");
        if (hex) {
          const encoded = hexToBase32(hex);
          if (encoded) {
            totp = encoded;
          } else {
            result.warnings.push(
              `Skipped TOTP for "${name}": the secret is not valid hex.`,
            );
          }
        }
      }
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
  const strings = Array.from(entry.children).filter(
    (c) => c.tagName.toLowerCase() === "string",
  );
  for (const str of strings) {
    const keyEl = Array.from(str.children).find(
      (c) => c.tagName.toLowerCase() === "key",
    );
    const valueEl = Array.from(str.children).find(
      (c) => c.tagName.toLowerCase() === "value",
    );
    if (!keyEl || !valueEl) continue;
    const key = (keyEl.textContent ?? "").trim();
    const value = valueEl.textContent ?? "";
    if (key) map.set(key, value);
  }
  return map;
}
