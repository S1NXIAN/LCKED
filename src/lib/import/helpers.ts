/**
 * LCKED — Import item factory helpers
 * ---------------------------------------------------------------------------
 * Shared factory functions used by format-specific parsers to construct
 * NewItemInput objects.
 */

import { ITEM_DEFAULTS } from "@/lib/items/item-crud";
import type { NewItemInput } from "@/lib/types";

import { detectCardBrand } from "./export";

export function makeLogin(o: {
  name: string;
  username: string;
  password: string;
  urls: string[];
  totp: string;
  notes: string;
  folder: string;
  favorite: boolean;
  pinned?: boolean;
}): NewItemInput {
  return {
    ...ITEM_DEFAULTS,
    type: "login",
    name: o.name,
    favorite: o.favorite,
    pinned: o.pinned ?? false,

    folder: o.folder,
    customFields: [],
    details: {
      username: o.username,
      password: o.password,
      urls: o.urls.filter(Boolean),
      totp: o.totp,
      notes: o.notes,
    },
  };
}

/** Map an export's original timestamps onto NewItemInput's restore-only
 *  createdAt/updatedAt overrides — writeItems honours these instead of
 *  stamping now. Accepts epoch seconds ("1700000000", Proton Pass) and ISO
 *  strings (Bitwarden); absent or unparsable values are omitted so the
 *  caller stamps fresh. */
export function withTimestamps<T extends NewItemInput>(
  item: T,
  created?: string,
  updated?: string,
): T {
  const toMs = (raw: string | undefined): number | undefined => {
    if (!raw) return undefined;
    const n = Number(raw);
    // Epoch seconds vs ms: only seconds are produced today (Proton); the
    // threshold keeps a future ms source from being double-scaled.
    if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
    const t = Date.parse(raw);
    return Number.isNaN(t) ? undefined : t;
  };
  const createdAt = toMs(created);
  const updatedAt = toMs(updated);
  return {
    ...item,
    ...(createdAt === undefined ? null : { createdAt }),
    ...(updatedAt === undefined ? null : { updatedAt }),
  };
}

export function makeNote(o: {
  name: string;
  content: string;
  folder: string;
  favorite: boolean;
  pinned?: boolean;
}): NewItemInput {
  return {
    ...ITEM_DEFAULTS,
    type: "note",
    name: o.name,
    favorite: o.favorite,
    pinned: o.pinned ?? false,
    folder: o.folder,
    customFields: [],
    details: { content: o.content },
  };
}

export function makeCard(o: {
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
  pinned?: boolean;
}): NewItemInput {
  return {
    ...ITEM_DEFAULTS,
    type: "card",
    name: o.name,
    favorite: o.favorite,
    pinned: o.pinned ?? false,
    folder: o.folder,
    customFields: [],
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

export function makeIdentity(o: {
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
  pinned?: boolean;
}): NewItemInput {
  return {
    ...ITEM_DEFAULTS,
    type: "identity",
    name: o.name,
    favorite: o.favorite,
    pinned: o.pinned ?? false,
    folder: o.folder,
    customFields: [],
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
