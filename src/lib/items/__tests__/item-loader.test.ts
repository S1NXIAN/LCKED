import { beforeEach, describe, expect, it, vi } from "vitest";

import { decryptJson } from "@/lib/crypto";
import { loadDecryptedItems } from "@/lib/items/item-loader";
import type { StoredItem, VaultItem } from "@/lib/types";
import {
  deleteStoredItem,
  loadAllStoredItems,
  putStoredItem,
} from "@/lib/vault/vault-db";

// Mock the crypto and vault-db modules. Ciphertexts are tagged with the
// plaintext item id (`enc:<id>`); decryption looks the id up in a per-test
// table so each row's outcome is explicit.
vi.mock("@/lib/crypto", () => ({
  decryptJson: vi.fn(),
  encryptJson: vi.fn(async (item: { id: string }) => ({
    ciphertext: "enc:" + item.id,
    iv: "mock-iv",
  })),
}));

vi.mock("@/lib/vault/vault-db", () => ({
  loadAllStoredItems: vi.fn(async () => []),
  putStoredItem: vi.fn(async () => {}),
  deleteStoredItem: vi.fn(async () => {}),
}));

// 31 days ago — past TRASH_TTL_MS regardless of when the test runs.
const EXPIRED_AT = Date.now() - 31 * 24 * 60 * 60 * 1000;

function makeItem(overrides: Partial<VaultItem> = {}): VaultItem {
  return {
    id: "item-1",
    type: "login",
    name: "test",
    favorite: false,
    pinned: false,
    folder: "",
    customFields: [],
    createdAt: 1000,
    updatedAt: 1000,
    vaultIds: [],
    trashed: false,
    trashedAt: null,
    details: { username: "u", password: "p", urls: [], totp: "", notes: "" },
    ...overrides,
  } as VaultItem;
}

/** Strip defaulted fields to simulate a pre-Containers legacy record. */
function stripDefaults(item: VaultItem, fields: string[]): VaultItem {
  for (const field of fields) {
    delete (item as unknown as Record<string, unknown>)[field];
  }
  return item;
}

/** A fully legacy record: none of the defaulted fields exist. */
function makeLegacyItem(overrides: Partial<VaultItem> = {}): VaultItem {
  return stripDefaults(makeItem(overrides), [
    "favorite",
    "pinned",
    "folder",
    "customFields",
    "vaultIds",
    "trashed",
    "trashedAt",
  ]);
}

function makeRow(
  item: Pick<VaultItem, "id" | "type" | "createdAt" | "updatedAt">,
): StoredItem {
  return {
    id: item.id,
    type: item.type,
    ciphertext: "enc:" + item.id,
    iv: "mock-iv",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

const mockVaultKey = {} as CryptoKey;

/** Point the decrypt mock at plaintexts keyed by tagged ciphertext. */
function stubDecrypt(plaintexts: VaultItem[], brokenIds: string[] = []) {
  const byId: Record<string, VaultItem> = {};
  for (const p of plaintexts) byId[p.id] = p;
  vi.mocked(decryptJson).mockImplementation(async (ciphertext: unknown) => {
    const id = String(ciphertext).slice("enc:".length);
    if (brokenIds.includes(id)) throw new Error("corrupt row");
    return byId[id];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadDecryptedItems", () => {
  it("backfills every defaulted field on legacy records and re-encrypts them", async () => {
    const legacy = makeLegacyItem({ id: "legacy" });
    stubDecrypt([legacy]);
    vi.mocked(loadAllStoredItems).mockResolvedValue([
      makeRow({
        id: "legacy",
        type: "login",
        createdAt: 1000,
        updatedAt: 1000,
      }),
    ]);

    const items = await loadDecryptedItems(mockVaultKey);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      favorite: false,
      pinned: false,
      folder: "",
      customFields: [],
      vaultIds: [],
      trashed: false,
      trashedAt: null,
    });
    expect(putStoredItem).toHaveBeenCalledTimes(1);
  });

  it("does not re-encrypt items already in current shape", async () => {
    const current = makeItem({ id: "current" });
    stubDecrypt([current]);
    vi.mocked(loadAllStoredItems).mockResolvedValue([makeRow(current)]);

    const items = await loadDecryptedItems(mockVaultKey);

    expect(items).toEqual([current]);
    expect(putStoredItem).not.toHaveBeenCalled();
  });

  it("purges expired trash from the store and omits it from the result", async () => {
    const expired = makeItem({
      id: "expired",
      trashed: true,
      trashedAt: EXPIRED_AT,
    });
    stubDecrypt([expired]);
    vi.mocked(loadAllStoredItems).mockResolvedValue([makeRow(expired)]);

    const items = await loadDecryptedItems(mockVaultKey);

    expect(items).toEqual([]);
    expect(deleteStoredItem).toHaveBeenCalledWith("expired");
    expect(putStoredItem).not.toHaveBeenCalled();
  });

  it("tolerates a failed purge delete (best-effort)", async () => {
    const expired = makeItem({
      id: "expired",
      trashed: true,
      trashedAt: EXPIRED_AT,
    });
    stubDecrypt([expired]);
    vi.mocked(loadAllStoredItems).mockResolvedValue([makeRow(expired)]);
    vi.mocked(deleteStoredItem).mockRejectedValueOnce(new Error("idb down"));

    await expect(loadDecryptedItems(mockVaultKey)).resolves.toEqual([]);
  });

  it("keeps fresh trash", async () => {
    const fresh = makeItem({
      id: "fresh",
      trashed: true,
      trashedAt: Date.now(),
    });
    stubDecrypt([fresh]);
    vi.mocked(loadAllStoredItems).mockResolvedValue([makeRow(fresh)]);

    const items = await loadDecryptedItems(mockVaultKey);

    expect(items).toEqual([fresh]);
    expect(deleteStoredItem).not.toHaveBeenCalled();
  });

  it("purges an expired record without re-encrypting it, even when migration applied", async () => {
    // Partially legacy: expired trash fields present, newer fields missing.
    const both = stripDefaults(
      makeItem({ id: "both", trashed: true, trashedAt: EXPIRED_AT }),
      ["favorite", "vaultIds"],
    );
    stubDecrypt([both]);
    vi.mocked(loadAllStoredItems).mockResolvedValue([
      makeRow({ id: "both", type: "login", createdAt: 1000, updatedAt: 1000 }),
    ]);

    const items = await loadDecryptedItems(mockVaultKey);

    expect(items).toEqual([]);
    expect(deleteStoredItem).toHaveBeenCalledWith("both");
    expect(putStoredItem).not.toHaveBeenCalled();
  });

  it("skips undecryptable rows without failing the load", async () => {
    const good = makeItem({ id: "good" });
    stubDecrypt([good], ["bad"]);
    vi.mocked(loadAllStoredItems).mockResolvedValue([
      makeRow(good),
      { ...makeRow(good), id: "bad", ciphertext: "enc:bad" },
    ]);

    const items = await loadDecryptedItems(mockVaultKey);

    expect(items.map((i) => i.id)).toEqual(["good"]);
    expect(putStoredItem).not.toHaveBeenCalled();
    expect(deleteStoredItem).not.toHaveBeenCalled();
  });

  it("returns items ordered most-recently-updated first", async () => {
    const a = makeItem({ id: "a", updatedAt: 1000 });
    const b = makeItem({ id: "b", updatedAt: 3000 });
    const c = makeItem({ id: "c", updatedAt: 2000 });
    stubDecrypt([a, b, c]);
    vi.mocked(loadAllStoredItems).mockResolvedValue([
      makeRow(a),
      makeRow(b),
      makeRow(c),
    ]);

    const items = await loadDecryptedItems(mockVaultKey);

    expect(items.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });
});
