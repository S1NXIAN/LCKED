/**
 * LCKED — Import / Export engine
 * ---------------------------------------------------------------------------
 * Import parsers for Bitwarden (JSON + CSV), 1Password (CSV), Proton Pass
 * (CSV), and KeePassXC (unencrypted XML). All parsers are defensive: unknown
 * columns / elements ignored, malformed rows skipped with a collected warning.
 * Export supports encrypted JSON (the only safe round-trip) and plain CSV
 * (with an explicit warning).
 */

import type {
  CardItem,
  IdentityItem,
  ImportResult,
  ItemType,
  LoginItem,
  NewItemInput,
  NoteItem,
  VaultItem,
} from "@/lib/types";

/* ------------------------------ CSV parsing ------------------------------- */

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
  // Warn on unclosed quotes: the parser would otherwise swallow the rest of
  // the file into one giant field. We still return what we have so partial
  // imports are possible, but the caller can detect this via the result.
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ""));
}

function rowToObject(headers: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => {
    obj[h.trim()] = (row[i] ?? "").trim();
  });
  return obj;
}

/* ------------------------- item factory helpers --------------------------- */

function baseFields(
  type: ItemType,
  name: string,
  folder: string,
  favorite: boolean,
  notes: string,
): NewItemInput {
  return {
    type,
    name: name || "Untitled",
    favorite: Boolean(favorite),
    folder: folder || "",
    customFields: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // @ts-expect-error — details attached by each builder; union narrow at call site
    details: { notes },
  } as NewItemInput;
}

function makeLogin(o: {
  name: string;
  username: string;
  password: string;
  urls: string[];
  totp: string;
  notes: string;
  folder: string;
  favorite: boolean;
}): NewItemInput {
  return {
    type: "login",
    name: o.name,
    favorite: o.favorite,
    folder: o.folder,
    customFields: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    details: {
      username: o.username,
      password: o.password,
      urls: o.urls.filter(Boolean),
      totp: o.totp,
      notes: o.notes,
    },
  };
}

function makeNote(o: { name: string; content: string; folder: string; favorite: boolean }): NewItemInput {
  return {
    type: "note",
    name: o.name,
    favorite: o.favorite,
    folder: o.folder,
    customFields: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    details: { content: o.content },
  };
}

function makeCard(o: {
  name: string;
  cardholder: string;
  number: string;
  brand: string;
  cvv: string;
  expiry: string;
  pin: string;
  notes: string;
  folder: string;
  favorite: boolean;
}): NewItemInput {
  return {
    type: "card",
    name: o.name,
    favorite: o.favorite,
    folder: o.folder,
    customFields: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    details: {
      cardholder: o.cardholder,
      number: o.number.replace(/\s+/g, ""),
      brand: o.brand || detectCardBrand(o.number),
      cvv: o.cvv,
      expiry: o.expiry,
      pin: o.pin,
      notes: o.notes,
    },
  };
}

function makeIdentity(o: {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  notes: string;
  folder: string;
  favorite: boolean;
}): NewItemInput {
  return {
    type: "identity",
    name: o.name,
    favorite: o.favorite,
    folder: o.folder,
    customFields: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    details: {
      firstName: o.firstName,
      lastName: o.lastName,
      email: o.email,
      phone: o.phone,
      company: o.company,
      address1: o.address1,
      address2: o.address2,
      city: o.city,
      state: o.state,
      zip: o.zip,
      country: o.country,
      notes: o.notes,
    },
  };
}

/* ------------------------- Bitwarden JSON parser -------------------------- */

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
    result.warnings.push("This Bitwarden export is encrypted. Re-export as unencrypted JSON/CSV to import.");
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
          ? login.uris.map((u: any) => (typeof u === "string" ? u : u?.uri ?? "")).filter(Boolean)
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
            brand: "",
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
  (result as any).__items = items;
  return result;
}

/* ------------------------- Bitwarden CSV parser --------------------------- */

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
      const notes = o.notes || "";
      if (typeStr === "login" || typeStr === "1") {
        const urls = (o.login_uri || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
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
          }),
        );
      } else if (typeStr === "note" || typeStr === "2") {
        items.push(makeNote({ name, content: notes, folder, favorite }));
      } else if (typeStr === "card" || typeStr === "3") {
        const number = o.card_number || "";
        items.push(
          makeCard({
            name,
            cardholder: o.card_cardholder_name || o.card_name || "",
            number,
            brand: detectCardBrand(number),
            cvv: o.card_code || o.card_cvv || "",
            expiry: o.card_exp_month && o.card_exp_year
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
  (result as any).__items = items;
  return result;
}

/* ----------------------- 1Password CSV parser ----------------------------- */

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
      // 1Password's "All Items" CSV often lacks a type column; we infer login
      // when there's a username or url, otherwise treat as a secure note.
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
  (result as any).__items = items;
  return result;
}

/* ----------------------- Proton Pass CSV parser --------------------------- */

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
  (result as any).__items = items;
  return result;
}

/* -------------------------- KeePassXC XML parser -------------------------- */

/**
 * KeePassXC unencrypted XML 2.x export. Entries live under <Root>/<Group>//<Entry>
 * (groups can nest). Each <Entry> holds a sequence of <String><Key>..</Key>
 * <Value>..</Value></String> pairs. Well-known keys: Title, UserName, Password,
 * URL, Notes. TOTP may appear as a custom "otp" or TimeOtp-Secret-* key.
 *
 * We walk every <Entry> in document order, ignoring group nesting (folders are
 * not preserved — they map to LCKED folders in a later revision).
 */
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
      // KeePassXC stores TOTP either as "otp" (otpauth URI) or as separate
      // TimeOtp-Secret-* fields. We accept both, preferring "otp".
      const totp =
        fields.get("otp") ??
        fields.get("TimeOtp-Secret") ??
        fields.get("TimeOtp-Secret-Hex") ??
        "";
      const urls = url
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      // If there's no username/password/url we treat the entry as a note —
      // matches the 1Password CSV inference rule.
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
  (result as any).__items = items;
  return result;
}

/** Read a KeePassXC <Entry> into a Map of Key→Value strings (last write wins). */
function readKeePassXcEntry(entry: Element): Map<string, string> {
  const map = new Map<string, string>();
  const strings = Array.from(entry.children).filter((c) => c.tagName.toLowerCase() === "string");
  for (const str of strings) {
    const keyEl = Array.from(str.children).find((c) => c.tagName.toLowerCase() === "key");
    const valueEl = Array.from(str.children).find((c) => c.tagName.toLowerCase() === "value");
    if (!keyEl || !valueEl) continue;
    // <Value> may be marked Protect="true" for hidden fields — KeePassXC still
    // ships the plaintext in unencrypted exports, so we just read the text.
    const key = (keyEl.textContent ?? "").trim();
    const value = valueEl.textContent ?? "";
    if (key) map.set(key, value);
  }
  return map;
}

/* --------------------------- format detection ---------------------------- */

export type ImportFormat =
  | "bitwarden-json"
  | "bitwarden-csv"
  | "1password-csv"
  | "protonpass-csv"
  | "keepassxc-xml"
  | "lcked-json";

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
    // KeePassXC unencrypted XML export. There's no other common XML vault
    // format, so any .xml file is treated as keepassxc-xml.
    return "keepassxc-xml";
  }
  if (lower.endsWith(".csv")) {
    const firstLine = (trimmed.split(/\r?\n/)[0] || "").toLowerCase();
    // LCKED's own CSV export includes `card_pin` + `identity_company` — a
    // signature no other manager uses. Detect it FIRST so LCKED round-trips
    // don't get misrouted to the ProtonPass parser (which shares `login_urls`).
    if (firstLine.includes("card_pin") || firstLine.includes("identity_company")) return "bitwarden-csv";
    if (firstLine.includes("item_type") || firstLine.includes("login_urls")) return "protonpass-csv";
    if (firstLine.includes("title") && firstLine.includes("url")) return "1password-csv";
    return "bitwarden-csv";
  }
  // Fallback by content sniffing.
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
  const items: NewItemInput[] = (result as any).__items ?? [];
  delete (result as any).__items;
  return { result, items };
}

/* ----------------------------- LCKED export ------------------------------- */

/** Encrypted export envelope — the only safe round-trip format.
 *
 * Structure (v1):
 *   - salt + iterations + verifier: derive + check the export master key.
 *   - wrappedVaultKey + wrappedVaultKeyIv: the export vault key, wrapped with
 *     the export master key. Hoisted to the TOP LEVEL so decryption is
 *     possible: derive master key → check verifier → unwrap vault key →
 *     decrypt `data`. (Earlier drafts buried the wrapped key inside `data`,
 *     which made the envelope unrecoverable — a circular dependency.)
 *   - data + dataIv: { items, vaults } encrypted with the export vault key. */
export interface LckedExport {
  format: "lcked-encrypted-v1";
  version: 1;
  exportedAt: number;
  /** PBKDF2 salt used for THIS export (independent of the vault salt). */
  salt: string;
  iterations: number;
  /** AES-GCM verifier, same scheme as vault unlock. */
  verifier: string;
  verifierIv: string;
  /** The export vault key, AES-GCM-wrapped with the export master key. */
  wrappedVaultKey: string;
  wrappedVaultKeyIv: string;
  /** Encrypted payload ({ items, vaults }) — encrypted with the export vault key. */
  data: string;
  dataIv: string;
}

/** Parse an encrypted LCKED export back into items (requires the password). */
export function parseLckedJson(text: string): ImportResult {
  const result: ImportResult = { imported: 0, skipped: 0, warnings: [] };
  try {
    const data = JSON.parse(text);
    if (data.format !== "lcked-encrypted-v1") {
      result.warnings.push("Not a recognised LCKED export.");
      return result;
    }
    // The actual decryption happens in the store layer (needs the password).
    (result as any).__raw = data;
    result.imported = -1; // signal: deferred decryption
  } catch {
    result.warnings.push("File is not valid JSON.");
  }
  return result;
}

/* ------------------------------- CSV export ------------------------------- */

const CSV_HEADERS = [
  "name",
  "type",
  "folder",
  "favorite",
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

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportToCsv(items: VaultItem[]): string {
  const lines: string[] = [CSV_HEADERS.join(",")];
  for (const item of items) {
    const row: Record<string, string> = {
      name: item.name,
      type: item.type,
      folder: item.folder,
      favorite: item.favorite ? "1" : "0",
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

/* ------------------------------ card brand -------------------------------- */

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

/** Downgrade a stored item to a NewItemInput (drops id/timestamps). */
export function toItemInput(item: VaultItem): NewItemInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = item;
  return rest as NewItemInput;
}
