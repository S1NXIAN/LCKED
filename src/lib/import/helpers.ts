/**
 * LCKED — Import item factory helpers
 * ---------------------------------------------------------------------------
 * Shared factory functions used by format-specific parsers to construct
 * NewItemInput objects.
 */

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
    type: "login",
    name: o.name,
    favorite: o.favorite,
    pinned: o.pinned ?? false,
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

export function makeNote(o: { name: string; content: string; folder: string; favorite: boolean; pinned?: boolean }): NewItemInput {
  return {
    type: "note",
    name: o.name,
    favorite: o.favorite,
    pinned: o.pinned ?? false,
    folder: o.folder,
    customFields: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
    type: "card",
    name: o.name,
    favorite: o.favorite,
    pinned: o.pinned ?? false,
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
    type: "identity",
    name: o.name,
    favorite: o.favorite,
    pinned: o.pinned ?? false,
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
