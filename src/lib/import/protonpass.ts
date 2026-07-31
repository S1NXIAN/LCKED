/**
 * LCKED — Proton Pass CSV import parser
 * ---------------------------------------------------------------------------
 * Parses Proton Pass CSV exports with item_type column and type-specific
 * prefixed columns (login_*, card_*, identity_*).
 */

import type { ImportResult, NewItemInput } from "@/lib/types";
import { parseCsv, rowToObject } from "./csv";
import { makeLogin, makeNote, makeCard, makeIdentity } from "./helpers";

export function parseProtonPassCsv(text: string): ImportResult {
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
      const type = (o.item_type || o.type || "login").toLowerCase();
      const name = o.name || o.title || "Untitled";
      const favorite = /^(1|true|yes)$/i.test(o.favorite);
      const notes = o.note_content || o.notes || "";
      if (type === "login") {
        const urls = (o.login_urls || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        items.push(
          makeLogin({
            name,
            username: o.login_username || "",
            password: o.login_password || "",
            urls,
            totp: o.login_totp || "",
            notes,
            folder: "",
            favorite,
          }),
        );
      } else if (type === "note") {
        items.push(makeNote({ name, content: notes, folder: "", favorite }));
      } else if (type === "card") {
        items.push(
          makeCard({
            name,
            cardholder: o.card_cardholder || "",
            number: o.card_number || "",
            brand: "",
            cvv: o.card_cvv || "",
            expiry: o.card_expiration_date || "",
            pin: o.card_pin || "",
            notes,
            folder: "",
            favorite,
          }),
        );
      } else if (type === "identity") {
        items.push(
          makeIdentity({
            name,
            firstName: o.identity_first_name || "",
            lastName: o.identity_last_name || "",
            email: o.identity_email || "",
            phone: o.identity_phone || "",
            company: o.identity_organization || "",
            address1: o.identity_address_street_address || "",
            address2: "",
            city: o.identity_address_city || "",
            state: o.identity_address_state_or_province || "",
            zip: o.identity_address_postal_or_zip || "",
            country: o.identity_address_country_or_region || "",
            notes,
            folder: "",
            favorite,
          }),
        );
      } else {
        result.skipped++;
        continue;
      }
      result.imported++;
    } catch {
      result.skipped++;
    }
  }
  result.items = items;
  return result;
}
