/**
 * LCKED — Proton Pass CSV import parser
 * ---------------------------------------------------------------------------
 * Parses Proton Pass CSV exports in both shapes:
 *  - Current (`createPassExportCSV` in Proton's clients): flat columns
 *    type,name,url,email,username,password,note,totp,createTime,modifyTime,vault —
 *    card/identity rows carry their fields JSON-encoded inside `note`.
 *  - Legacy: item_type column plus login_/card_/identity_-prefixed columns.
 */

import type { ImportResult, NewItemInput } from "@/lib/types";

import { parseCsv, rowToObject } from "./csv";
import { makeCard, makeIdentity, makeLogin, makeNote } from "./helpers";

/** Parse a JSON array column (current-schema autofillUrls). Null = unparsable. */
function parseJsonArray(raw: string): string[] | null {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v)
      ? v.filter((s): s is string => typeof s === "string")
      : null;
  } catch {
    return null;
  }
}

const str = (v: unknown): string =>
  typeof v === "string" || typeof v === "number" ? String(v) : "";

export function parseProtonPassCsv(text: string): ImportResult {
  const result: ImportResult = { imported: 0, skipped: 0, warnings: [] };
  const rows = parseCsv(text);
  if (rows.length < 2) {
    result.warnings.push("CSV has no data rows.");
    return result;
  }
  const headers = rows[0];
  // Current exports key columns off `type`; legacy exports off `item_type`.
  const currentSchema = headers.some((h) => h.trim() === "type");
  const items: NewItemInput[] = [];
  for (let i = 1; i < rows.length; i++) {
    const o = rowToObject(headers, rows[i]);
    try {
      // Current exports use `type` with camelCase values ("creditCard");
      // legacy exports used `item_type` ("card"). Aliases import as logins.
      const rawType = (o.item_type || o.type || "login").toLowerCase();
      const type =
        rawType === "creditcard"
          ? "card"
          : rawType === "alias"
            ? "login"
            : rawType;
      const name = o.name || "Untitled";
      const favorite = /^(1|true|yes)$/i.test(o.favorite);
      const notes = o.note_content || o.note || "";
      // Current-schema card/identity rows carry fields JSON-encoded in
      // `note`; legacy rows keep free-text notes verbatim.
      let j: Record<string, unknown> | null = null;
      if (currentSchema && notes.startsWith("{")) {
        try {
          const parsed: unknown = JSON.parse(notes);
          j =
            parsed && typeof parsed === "object"
              ? (parsed as Record<string, unknown>)
              : null;
        } catch {
          result.warnings.push(
            `Row ${i}: JSON-encoded note failed to parse; imported as plain text.`,
          );
        }
      }
      if (type === "login") {
        // Current schema joins multiple URLs with ", " and carries
        // non-default autofill modes as a JSON array in autofillUrls;
        // legacy uses newline-separated login_urls.
        const base = (currentSchema ? o.url : o.login_urls || "")
          .split(currentSchema ? /,\s*/ : /\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        const autofill = o.autofillUrls ? parseJsonArray(o.autofillUrls) : [];
        if (o.autofillUrls && !autofill) {
          result.warnings.push(`Row ${i}: could not parse autofillUrls; ignored.`);
        }
        const urls = base.slice();
        for (const u of autofill ?? []) {
          if (!urls.includes(u)) urls.push(u);
        }
        items.push(
          makeLogin({
            name,
            username: o.login_username || o.username || o.email || "",
            password: o.login_password || o.password || "",
            urls,
            totp: o.login_totp || o.totp || "",
            notes,
            folder: "",
            favorite,
          }),
        );
      } else if (type === "note") {
        items.push(makeNote({ name, content: notes, folder: "", favorite }));
      } else if (type === "card") {
        // ponytail: current-schema cards/identities only expose fields via the
        // JSON-in-note encoding; keys not mapped below are dropped — add
        // `str(j.x)` fallbacks if a needed Proton field turns up missing.
        items.push(
          makeCard({
            name,
            cardholder: o.card_cardholder || str(j?.cardholderName),
            number: o.card_number || str(j?.number),
            brand: "",
            cvv: o.card_cvv || str(j?.verificationNumber),
            expiry: o.card_expiration_date || str(j?.expirationDate),
            pin: o.card_pin || str(j?.pin),
            notes: j ? str(j.note) : notes,
            folder: "",
            favorite,
          }),
        );
      } else if (type === "identity") {
        items.push(
          makeIdentity({
            name,
            firstName: o.identity_first_name || str(j?.firstName),
            lastName: o.identity_last_name || str(j?.lastName),
            email: o.identity_email || str(j?.email),
            phone: o.identity_phone || str(j?.phoneNumber),
            company: o.identity_organization || str(j?.organization),
            address1: o.identity_address_street_address || str(j?.streetAddress),
            address2: "",
            city: o.identity_address_city || str(j?.city),
            state: o.identity_address_state_or_province || str(j?.stateOrProvince),
            zip: o.identity_address_postal_or_zip || str(j?.zipCode),
            country: o.identity_address_country_or_region || str(j?.countryOrRegion),
            notes: j ? str(j.note) : notes,
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
