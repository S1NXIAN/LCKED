import { describe, it, expect, vi } from "vitest";
import { patchItem, patchItems, writeItem, writeItems } from "@/lib/item-crud";
import type { NewItemInput, VaultItem } from "@/lib/types";

// Mock the crypto and vault-db modules.
vi.mock("@/lib/crypto", () => ({
  encryptJson: vi.fn(async (item: unknown) => ({
    ciphertext: "enc:" + JSON.stringify(item),
    iv: "mock-iv",
  })),
  randomId: vi.fn(() => "mock-id"),
}));

vi.mock("@/lib/vault-db", () => ({
  putStoredItem: vi.fn(async () => {}),
}));

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

const mockVaultKey = {} as CryptoKey;

function makeInput(overrides: Partial<NewItemInput> = {}): NewItemInput {
  return {
    type: "login",
    name: "test",
    favorite: false,
    pinned: false,
    folder: "",
    customFields: [],
    vaultIds: [],
    trashed: false,
    trashedAt: null,
    details: { username: "u", password: "p", urls: [], totp: "", notes: "" },
    ...overrides,
  } as NewItemInput;
}

describe("patchItem", () => {
  it("merges the patch into the item", async () => {
    const item = makeItem({ favorite: false });
    const result = await patchItem(mockVaultKey, item, { favorite: true });

    expect(result.favorite).toBe(true);
    expect(result.id).toBe("item-1");
    expect(result.updatedAt).toBeGreaterThan(item.updatedAt);
  });

  it("persists the updated item to IndexedDB", async () => {
    const { putStoredItem } = await import("@/lib/vault-db");
    const item = makeItem();

    await patchItem(mockVaultKey, item, { pinned: true });

    expect(putStoredItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "item-1",
        type: "login",
        ciphertext: expect.stringContaining("pinned"),
      }),
    );
  });

  it("always sets updatedAt to now even without explicit patch", async () => {
    const item = makeItem({ updatedAt: 0 });
    const result = await patchItem(mockVaultKey, item, { name: "new" });

    expect(result.updatedAt).toBeGreaterThan(0);
    expect(result.name).toBe("new");
  });
});

describe("patchItems", () => {
  it("patches all items and returns updated + failed count", async () => {
    const items = [
      makeItem({ id: "a", favorite: false }),
      makeItem({ id: "b", favorite: true }),
    ];

    const result = await patchItems(mockVaultKey, items, (item) => ({
      favorite: !item.favorite,
    }));

    expect(result.updated).toHaveLength(2);
    expect(result.failed).toBe(0);
    expect(result.updated[0].favorite).toBe(true);
    expect(result.updated[1].favorite).toBe(false);
  });

  it("reports failures without losing the rest", async () => {
    const { encryptJson } = await import("@/lib/crypto");
    vi.mocked(encryptJson).mockRejectedValueOnce(new Error("crypto fail"));

    const items = [
      makeItem({ id: "a" }),
      makeItem({ id: "b" }),
    ];

    const result = await patchItems(mockVaultKey, items, () => ({ name: "x" }));

    expect(result.updated).toHaveLength(1);
    expect(result.failed).toBe(1);
    expect(result.updated[0].id).toBe("b");

    // Restore mock for other tests.
    vi.mocked(encryptJson).mockReset();
    vi.mocked(encryptJson).mockImplementation(
      async (item: unknown) => ({
        ciphertext: "enc:" + JSON.stringify(item),
        iv: "mock-iv",
      }),
    );
  });

  it("returns empty result for empty input", async () => {
    const result = await patchItems(mockVaultKey, [], () => ({}));
    expect(result.updated).toHaveLength(0);
    expect(result.failed).toBe(0);
  });
});

describe("writeItem", () => {
  it("creates a new item with defaults when no existing item", async () => {
    const input = {
      type: "login",
      name: "new-item",
    } as unknown as NewItemInput;

    const result = await writeItem(mockVaultKey, input);

    expect(result.id).toBe("mock-id");
    expect(result.name).toBe("new-item");
    expect(result.trashed).toBe(false);
    expect(result.trashedAt).toBe(null);
    expect(result.createdAt).toBeGreaterThan(0);
    expect(result.updatedAt).toBeGreaterThan(0);
    expect(result.vaultIds).toEqual([]);
  });

  it("persists the new item to IndexedDB", async () => {
    const { putStoredItem } = await import("@/lib/vault-db");
    const input = {
      type: "login",
      name: "persist-test",
    } as unknown as NewItemInput;

    await writeItem(mockVaultKey, input);

    expect(putStoredItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "mock-id",
        type: "login",
        ciphertext: expect.stringContaining("persist-test"),
      }),
    );
  });

  it("preserves trashed state from existing item", async () => {
    const existing = makeItem({ id: "existing-1", trashed: true, trashedAt: 5000 });
    const input = {
      type: "login",
      name: "updated",
    } as unknown as NewItemInput;

    const result = await writeItem(mockVaultKey, input, existing);

    expect(result.id).toBe("existing-1");
    expect(result.trashed).toBe(true);
    expect(result.trashedAt).toBe(5000);
    expect(result.createdAt).toBe(1000);
  });

  it("allows caller overrides to win over existing item defaults", async () => {
    const existing = makeItem({ id: "override-test", trashed: true, trashedAt: 5000, vaultIds: ["vault-1"] });
    const input = {
      type: "login",
      name: "override-item",
      trashed: false,
      trashedAt: null,
      vaultIds: ["vault-2"],
    } as unknown as NewItemInput;

    const result = await writeItem(mockVaultKey, input, existing);

    expect(result.id).toBe("override-test");
    expect(result.trashed).toBe(false);
    expect(result.trashedAt).toBe(null);
    expect(result.vaultIds).toEqual(["vault-2"]);
  });
});

describe("writeItems", () => {
  it("batch-creates and returns succeeded/failed counts", async () => {
    const items = [
      { type: "login", name: "a", details: { username: "u", password: "p", urls: [], totp: "", notes: "" } },
      { type: "note", name: "b", details: { content: "hello" } },
    ] as unknown as NewItemInput[];

    const result = await writeItems(mockVaultKey, items);

    expect(result.succeeded).toHaveLength(2);
    expect(result.failed).toBe(0);
    expect(result.succeeded[0].name).toBe("a");
    expect(result.succeeded[1].name).toBe("b");
  });

  it("partial failure does not lose successes", async () => {
    const { encryptJson } = await import("@/lib/crypto");
    vi.mocked(encryptJson).mockRejectedValueOnce(new Error("crypto fail"));

    const items = [
      { type: "login", name: "fail-me", details: { username: "u", password: "p", urls: [], totp: "", notes: "" } },
      { type: "note", name: "survivor", details: { content: "hello" } },
    ] as unknown as NewItemInput[];

    const result = await writeItems(mockVaultKey, items);

    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toBe(1);
    expect(result.succeeded[0].name).toBe("survivor");

    vi.mocked(encryptJson).mockReset();
    vi.mocked(encryptJson).mockImplementation(
      async (item: unknown) => ({
        ciphertext: "enc:" + JSON.stringify(item),
        iv: "mock-iv",
      }),
    );
  });

  it("returns empty result for empty input", async () => {
    const result = await writeItems(mockVaultKey, []);
    expect(result.succeeded).toHaveLength(0);
    expect(result.failed).toBe(0);
  });

  it("sets proper defaults for each created item", async () => {
    const items = [
      { type: "card", name: "card-item", details: { cardholder: "Me", number: "4111", brand: "visa", cvv: "123", expiry: "12/28", pin: "0000", notes: "" } },
    ] as unknown as NewItemInput[];

    const result = await writeItems(mockVaultKey, items);

    expect(result.succeeded[0].trashed).toBe(false);
    expect(result.succeeded[0].trashedAt).toBe(null);
    expect(result.succeeded[0].vaultIds).toEqual([]);
    expect(result.succeeded[0].id).toBeTruthy();
    expect(result.succeeded[0].createdAt).toBeGreaterThan(0);
  });
});
