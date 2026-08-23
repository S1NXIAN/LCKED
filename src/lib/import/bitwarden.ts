/**
 * LCKED — Bitwarden import parsers (JSON + CSV)
 * ---------------------------------------------------------------------------
 * Parses Bitwarden unencrypted JSON exports and Bitwarden-format CSV exports
 * (which cover Bitwarden's own CSV as well as LCKED's own CSV round-trip).
 */

import type { ImportResult, ItemType, NewItemInput } from "@/lib/types";

import { parseCsv, rowToObject } from "./csv";
import { detectCardBrand } from "./export";
import { makeCard, makeIdentity, makeLogin, makeNote } from "./helpers";

const BITWARDEN_TYPE_MAP: Record<number, ItemType> = {
  1: "login",
  2: "note",
  3: "card",
  4: "identity",
};

export function parseBitwardenJson(text: string): ImportResult {
  const result: ImportResult = { imported: 0, skipped: 0, warnings: [] };
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    result.warnings.push("File is not valid JSON.");
    return result;
  }
  if (!data || !Array.isArray(data.items)) {
    result.warnings.push("No 'items' array found in Bitwarden export.");
    return result;
  }
  if (data.encrypted === true) {
    result.warnings.push(
      "This Bitwarden export is encrypted. Re-export as unencrypted JSON/CSV to import.",
    );
    return result;
  }

  const items: NewItemInput[] = [];
  for (const raw of data.items) {
    try {
      const type = BITWARDEN_TYPE_MAP[raw.type];
      if (!type) {
        result.skipped++;
        continue;
      }
      const name = raw.name ?? "Untitled";
      const folder = raw.folder ?? "";
      const favorite = Boolean(raw.favorite);
      const notes = raw.notes ?? "";

      if (type === "login") {
        const login = raw.login ?? {};
        const urls = Array.isArray(login.uris)
          ? login.uris
              .map((u: any) => (typeof u === "string" ? u : (u?.uri ?? "")))
              .filter(Boolean)
          : [];
        items.push(
          makeLogin({
            name,
            username: login.username ?? "",
            password: login.password ?? "",
            urls,
            totp: login.totp ?? "",
            notes,
            folder,
            favorite,
          }),
        );
      } else if (type === "note") {
        items.push(makeNote({ name, content: notes, folder, favorite }));
      } else if (type === "card") {
        const card = raw.card ?? {};
        const expiry = [card.expMonth, card.expYear].filter(Boolean).join("/");
        items.push(
          makeCard({
            name,
            cardholder: card.cardholderName ?? "",
            number: card.number ?? "",
            brand: detectCardBrand(card.number ?? ""),
            cvv: card.code ?? "",
            expiry,
            pin: "",
            notes,
            folder,
            favorite,
          }),
        );
      } else if (type === "identity") {
        const id = raw.identity ?? {};
        items.push(
          makeIdentity({
            name,
            firstName: id.firstName ?? "",
            lastName: id.lastName ?? "",
            email: id.email ?? "",
            phone: id.phone ?? "",
            company: id.company ?? "",
            address1: id.address1 ?? "",
            address2: id.address2 ?? "",
            city: id.city ?? "",
            state: id.state ?? "",
            zip: id.postalCode ?? "",
            country: id.country ?? "",
            notes,
            folder,
            favorite,
          }),
        );
      }
      result.imported++;
    } catch {
      result.skipped++;
      result.warnings.push(`Skipped a malformed "${raw?.name ?? "item"}".`);
    }
  }
  result.items = items;
  return result;
}

export function parseBitwardenCsv(text: string): ImportResult {
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
      const typeStr = (o.type || "login").toLowerCase();
      const name = o.name || "Untitled";
      const folder = o.folder || "";
      const favorite = /^(1|true|yes)$/i.test(o.favorite);
      const pinned = /^(1|true|yes)$/i.test(o.pinned);
      const notes = o.notes || "";
      if (typeStr === "login" || typeStr === "1") {
        const urls = (o.login_uri || "")
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        items.push(
          makeLogin({
            name,
            username: o.login_username || "",
            password: o.login_password || "",
            urls,
            totp: o.login_totp || "",
            notes,
            folder,
            favorite,
            pinned,
          }),
        );
      } else if (typeStr === "note" || typeStr === "2") {
        items.push(
          makeNote({ name, content: notes, folder, favorite, pinned }),
        );
      } else if (typeStr === "card" || typeStr === "3") {
        const number = o.card_number || "";
        items.push(
          makeCard({
            name,
            cardholder: o.card_cardholder_name || o.card_name || "",
            number,
            brand: detectCardBrand(number),
            cvv: o.card_code || o.card_cvv || "",
            expiry:
              o.card_exp_month && o.card_exp_year
                ? `${o.card_exp_month}/${o.card_exp_year}`
                : o.card_expiration || "",
            pin: "",
            notes,
            folder,
            favorite,
          }),
        );
      } else if (typeStr === "identity" || typeStr === "4") {
        items.push(
          makeIdentity({
            name,
            firstName: o.identity_first_name || "",
            lastName: o.identity_last_name || "",
            email: o.identity_email || "",
            phone: o.identity_phone || "",
            company: o.identity_company || "",
            address1: o.identity_address1 || "",
            address2: o.identity_address2 || "",
            city: o.identity_city || "",
            state: o.identity_state || "",
            zip: o.identity_postal_code || "",
            country: o.identity_country || "",
            notes,
            folder,
            favorite,
            pinned,
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
