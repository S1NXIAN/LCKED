/**
 * Item detail — text wrapping contract.
 * ---------------------------------------------------------------------------
 * The detail view must wrap unbreakable runs (API keys, base64, JWTs) on every
 * note surface exactly like the editor does, while preserving newlines. A
 * jsdom-free repo cannot measure real layout, but Tailwind v4 generates CSS by
 * scanning source — a utility class present in rendered markup is guaranteed
 * to have corresponding CSS rules, so class presence is a faithful behavioral
 * proxy here.
 *
 * Rendered via react-dom/server with the real Zustand store seeded in memory.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateCreator } from "zustand/vanilla";

import { ItemDetail } from "@/components/vault/item-detail";
import { DEFAULT_VAULT_SETTINGS, type VaultItem } from "@/lib/types";
import { useVault, type VaultState } from "@/store/vault";
/* ─── Mocks ─────────────────────────────────────────────── */

const mockVaultKey = { algorithm: { name: "AES-GCM" } } as unknown as CryptoKey;

// react-dom/server serves useSyncExternalStore from getInitialState() — the
// creation-time state — so post-hoc setState fixtures stay invisible to SSR.
// Rebuild create() on top of real vanilla createStore with getInitialState
// aliased to live state. The store module itself stays fully real.
vi.mock("zustand", async (importOriginal) => {
  const actual = await importOriginal<typeof import("zustand")>();
  const vanilla = await import("zustand/vanilla");

  type Creator = StateCreator<Record<string, unknown>, [], []>;
  const build = (createState: Creator) => {
    const api = vanilla.createStore(createState);
    const patched = { ...api, getInitialState: api.getState };
    const useBoundStore = ((selector: never) =>
      actual.useStore(patched, selector)) as never;
    return Object.assign(useBoundStore, patched);
  };

  const create = ((createState?: Creator) =>
    createState
      ? build(createState)
      : build) as unknown as typeof actual.create;

  return { ...actual, create };
});
// persist is a no-op here — it only touches localStorage, which Node lacks.
vi.mock("zustand/middleware", () => ({
  persist: (config: unknown) => config,
}));

/* ─── Fixtures ──────────────────────────────────────────── */

/** Pathological payloads: unbreakable runs + preserved newline formatting. */
const LOGIN_NOTE = "A".repeat(500);
const NOTE_BODY = `line one\n${"B".repeat(500)}`;
const CARD_NOTE = "C".repeat(500);
const IDENTITY_NOTE = "D".repeat(500);
/** Unbreakable custom vault name for the rotating chip. */
const VAULT_NAME = "V".repeat(300);

const baseItem = {
  id: "item-1",
  name: "test item",
  favorite: false,
  pinned: false,
  folder: "",
  customFields: [],
  createdAt: 1000,
  updatedAt: 1000,
  vaultIds: ["vault-1"],
  trashed: false,
  trashedAt: null,
};

const ITEMS: VaultItem[] = [
  {
    ...baseItem,
    id: "login-1",
    type: "login",
    details: {
      username: "u",
      password: "p",
      urls: [],
      totp: "",
      notes: LOGIN_NOTE,
    },
  },
  {
    ...baseItem,
    id: "note-1",
    type: "note",
    details: { content: NOTE_BODY },
  },
  {
    ...baseItem,
    id: "card-1",
    type: "card",
    details: {
      cardholder: "",
      number: "",
      brand: "",
      cvv: "",
      expiry: "",
      pin: "",
      notes: CARD_NOTE,
    },
  },
  {
    ...baseItem,
    id: "identity-1",
    type: "identity",
    details: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      zip: "",
      country: "",
      notes: IDENTITY_NOTE,
    },
  },
];

function seed(partial: Partial<VaultState> = {}) {
  useVault.setState({
    status: "unlocked",
    vaultKey: mockVaultKey,
    items: ITEMS,
    vaults: [
      {
        id: "vault-1",
        name: VAULT_NAME,
        color: "heliotrope",
        icon: "home",
        createdAt: 1000,
      },
    ],
    activeVault: "all",
    selectedId: null,
    settings: DEFAULT_VAULT_SETTINGS,
    ...partial,
  });
}

beforeEach(() => {
  seed();
});

/* ─── Helpers ───────────────────────────────────────────── */

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Class attribute of the <p> whose content starts with `openingText`. */
function getParagraphClass(
  html: string,
  openingText: string,
): string | undefined {
  const match = new RegExp(
    `<p class="([^"]*)">${escapeRegExp(openingText)}`,
  ).exec(html);
  return match?.[1];
}

/* ─── Tests ─────────────────────────────────────────────── */

describe("item detail wrapping contract", () => {
  it("renders each item type's note with pre-wrap AND break-word", () => {
    const cases = [
      { selectedId: "login-1", note: LOGIN_NOTE },
      { selectedId: "note-1", note: NOTE_BODY },
      { selectedId: "card-1", note: CARD_NOTE },
      { selectedId: "identity-1", note: IDENTITY_NOTE },
    ] as const;

    for (const { selectedId, note } of cases) {
      seed({ selectedId });
      const html = renderToStaticMarkup(createElement(ItemDetail));

      const cls = getParagraphClass(html, note);
      expect(cls, `no <p> renders the ${selectedId} note`).toBeDefined();
      // Newline preservation stays; unbreakable runs now break at the edge.
      expect(cls!).toContain("whitespace-pre-wrap");
      expect(cls!).toContain("break-words");
    }
  });

  it("truncates the rotating vault-chip name inside the header", () => {
    seed({ selectedId: "login-1" });
    const html = renderToStaticMarkup(createElement(ItemDetail));

    const match = new RegExp(`<span class="([^"]*)">${VAULT_NAME}</span>`).exec(
      html,
    );
    expect(match, "expected the vault-chip name span").toBeTruthy();

    const cls = match![1];
    expect(cls).toContain("max-w-48");
  });
});
