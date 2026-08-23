/**
 * LCKED — Export and card-brand detection
 * ---------------------------------------------------------------------------
 * CSV export writer and credit-card brand detection (shared by export UI
 * and import parsers that auto-detect brand from the card number).
 */

import type { VaultItem } from "@/lib/types";

import { csvEscape } from "./csv";

const CSV_HEADERS = [
  "name",
  "type",
  "folder",
  "favorite",
  "pinned",
  "login_username",
  "login_password",
  "login_urls",
  "login_totp",
  "note_content",
  "card_cardholder",
  "card_number",
  "card_cvv",
  "card_expiration",
  "card_pin",
  "identity_first_name",
  "identity_last_name",
  "identity_email",
  "identity_phone",
  "identity_company",
  "identity_address1",
  "identity_address2",
  "identity_city",
  "identity_state",
  "identity_zip",
  "identity_country",
  "notes",
];

export { CSV_HEADERS };

export function exportToCsv(items: VaultItem[]): string {
  const lines: string[] = [CSV_HEADERS.join(",")];
  for (const item of items) {
    const row: Record<string, string> = {
      name: item.name,
      type: item.type,
      folder: item.folder,
      favorite: item.favorite ? "1" : "0",
      pinned: item.pinned ? "1" : "0",
      notes: "",
    };
    if (item.type === "login") {
      row.login_username = item.details.username;
      row.login_password = item.details.password;
      row.login_urls = item.details.urls.join("\n");
      row.login_totp = item.details.totp;
      row.notes = item.details.notes;
    } else if (item.type === "note") {
      row.note_content = item.details.content;
    } else if (item.type === "card") {
      row.card_cardholder = item.details.cardholder;
      row.card_number = item.details.number;
      row.card_cvv = item.details.cvv;
      row.card_expiration = item.details.expiry;
      row.card_pin = item.details.pin;
      row.notes = item.details.notes;
    } else if (item.type === "identity") {
      row.identity_first_name = item.details.firstName;
      row.identity_last_name = item.details.lastName;
      row.identity_email = item.details.email;
      row.identity_phone = item.details.phone;
      row.identity_company = item.details.company;
      row.identity_address1 = item.details.address1;
      row.identity_address2 = item.details.address2;
      row.identity_city = item.details.city;
      row.identity_state = item.details.state;
      row.identity_zip = item.details.zip;
      row.identity_country = item.details.country;
      row.notes = item.details.notes;
    }
    lines.push(CSV_HEADERS.map((h) => csvEscape(row[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

export function detectCardBrand(number: string): string {
  const n = number.replace(/\s+/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6(?:011|5)/.test(n)) return "Discover";
  if (/^(606282|3841)/.test(n)) return "Hipercard";
  if (/^3(?:0[0-5]|[68])/.test(n)) return "Diners";
  if (/^(?:352[89]|35[3-8])/.test(n)) return "JCB";
  return "";
}
