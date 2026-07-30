import { describe, it, expect, vi } from "vitest";
import { patchItem, patchItems } from "@/lib/item-crud";
import type { VaultItem } from "@/lib/types";

// Mock the crypto and vault-db modules.
vi.mock("@/lib/crypto", () => ({
  encryptJson: vi.fn(async (item: unknown) => ({
    ciphertext: "enc:" + JSON.stringify(item),
    iv: "mock-iv",
  })),
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

  it("passes index to patchFn", async () => {
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    const indices: number[] = [];

    await patchItems(mockVaultKey, items, (_, i) => {
      indices.push(i);
      return { name: `item-${i}` };
    });

    expect(indices).toEqual([0, 1]);
    // Both items get their own name via patchFn — verify the second persisted.
    const { putStoredItem } = await import("@/lib/vault-db");
    const calls = vi.mocked(putStoredItem).mock.calls;
    expect(calls[1][0].ciphertext).toContain("item-1");
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
