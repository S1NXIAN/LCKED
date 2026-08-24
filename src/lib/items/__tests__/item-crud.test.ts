import { describe, expect, it, vi } from "vitest";

import {
  deleteStoredItems,
  patchItem,
  patchItems,
  sortItems,
  toItemInput,
  writeItem,
  writeItems,
} from "@/lib/items/item-crud";
import type { NewItemInput, VaultItem } from "@/lib/types";
import { deleteStoredItem } from "@/lib/vault/vault-db";

// Mock the crypto and vault-db modules.
vi.mock("@/lib/crypto", () => ({
  encryptJson: vi.fn(async (item: unknown) => ({
    ciphertext: "enc:" + JSON.stringify(item),
    iv: "mock-iv",
  })),
  randomId: vi.fn(() => "mock-id"),
}));

vi.mock("@/lib/vault/vault-db", () => ({
  putStoredItem: vi.fn(async () => {}),
  deleteStoredItem: vi.fn(async () => {}),
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
    const { putStoredItem } = await import("@/lib/vault/vault-db");
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

    const items = [makeItem({ id: "a" }), makeItem({ id: "b" })];

    const result = await patchItems(mockVaultKey, items, () => ({ name: "x" }));

    expect(result.updated).toHaveLength(1);
    expect(result.failed).toBe(1);
    expect(result.updated[0].id).toBe("b");

    // Restore mock for other tests.
    vi.mocked(encryptJson).mockReset();
    vi.mocked(encryptJson).mockImplementation(async (item: unknown) => ({
      ciphertext: "enc:" + JSON.stringify(item),
      iv: "mock-iv",
    }));
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

  it("honors createdAt/updatedAt overrides on create (restore path)", async () => {
    const input = {
      type: "login",
      name: "restored",
      createdAt: 1111,
      updatedAt: 2222,
    } as unknown as NewItemInput;

    const result = await writeItem(mockVaultKey, input);

    expect(result.createdAt).toBe(1111);
    expect(result.updatedAt).toBe(2222);
  });

  it("forces create defaults over input trashed/vaultIds", async () => {
    // The create path must never let an input smuggle in a trashed item or a
    // `vaultIds: undefined` that would crash the list (`item.vaultIds.includes`).
    const input = {
      type: "login",
      name: "new-item",
      trashed: true,
      trashedAt: 999,
      vaultIds: undefined,
    } as unknown as NewItemInput;

    const result = await writeItem(mockVaultKey, input);

    expect(result.trashed).toBe(false);
    expect(result.trashedAt).toBe(null);
    expect(result.vaultIds).toEqual([]);
  });

  it("keeps a real vault membership array on create", async () => {
    const input = {
      type: "login",
      name: "member",
      vaultIds: ["vault-1"],
    } as unknown as NewItemInput;

    const result = await writeItem(mockVaultKey, input);

    expect(result.vaultIds).toEqual(["vault-1"]);
  });

  it("persists the new item to IndexedDB", async () => {
    const { putStoredItem } = await import("@/lib/vault/vault-db");
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
    const existing = makeItem({
      id: "existing-1",
      trashed: true,
      trashedAt: 5000,
    });
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
    const existing = makeItem({
      id: "override-test",
      trashed: true,
      trashedAt: 5000,
      vaultIds: ["vault-1"],
    });
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
      {
        type: "login",
        name: "a",
        details: {
          username: "u",
          password: "p",
          urls: [],
          totp: "",
          notes: "",
        },
      },
      { type: "note", name: "b", details: { content: "hello" } },
    ] as unknown as NewItemInput[];

    const result = await writeItems(mockVaultKey, items);

    expect(result.succeeded).toHaveLength(2);
    expect(result.failed).toBe(0);
    expect(result.succeeded[0].name).toBe("a");
    expect(result.succeeded[1].name).toBe("b");
  });

  it("stamps fresh timestamps even when input carries them (third-party imports)", async () => {
    const items = [
      {
        type: "login",
        name: "imported",
        createdAt: 1111,
        updatedAt: 2222,
        details: {
          username: "u",
          password: "p",
          urls: [],
          totp: "",
          notes: "",
        },
      },
    ] as unknown as NewItemInput[];

    const result = await writeItems(mockVaultKey, items);

    expect(result.succeeded[0].createdAt).not.toBe(1111);
    expect(result.succeeded[0].updatedAt).not.toBe(2222);
  });
  it("partial failure does not lose successes", async () => {
    const { encryptJson } = await import("@/lib/crypto");
    vi.mocked(encryptJson).mockRejectedValueOnce(new Error("crypto fail"));

    const items = [
      {
        type: "login",
        name: "fail-me",
        details: {
          username: "u",
          password: "p",
          urls: [],
          totp: "",
          notes: "",
        },
      },
      { type: "note", name: "survivor", details: { content: "hello" } },
    ] as unknown as NewItemInput[];

    const result = await writeItems(mockVaultKey, items);

    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toBe(1);
    expect(result.succeeded[0].name).toBe("survivor");

    vi.mocked(encryptJson).mockReset();
    vi.mocked(encryptJson).mockImplementation(async (item: unknown) => ({
      ciphertext: "enc:" + JSON.stringify(item),
      iv: "mock-iv",
    }));
  });

  it("returns empty result for empty input", async () => {
    const result = await writeItems(mockVaultKey, []);
    expect(result.succeeded).toHaveLength(0);
    expect(result.failed).toBe(0);
  });

  it("sets proper defaults for each created item", async () => {
    const items = [
      {
        type: "card",
        name: "card-item",
        details: {
          cardholder: "Me",
          number: "4111",
          brand: "visa",
          cvv: "123",
          expiry: "12/28",
          pin: "0000",
          notes: "",
        },
      },
    ] as unknown as NewItemInput[];

    const result = await writeItems(mockVaultKey, items);

    expect(result.succeeded[0].trashed).toBe(false);
    expect(result.succeeded[0].trashedAt).toBe(null);
    expect(result.succeeded[0].vaultIds).toEqual([]);
    expect(result.succeeded[0].id).toBeTruthy();
    expect(result.succeeded[0].createdAt).toBeGreaterThan(0);
  });

  it("applies ITEM_DEFAULTS to fields missing from the input", async () => {
    const input = {
      type: "login",
      name: "partial",
    } as unknown as NewItemInput;

    const result = await writeItem(mockVaultKey, input);

    expect(result.favorite).toBe(false);
    expect(result.pinned).toBe(false);
    expect(result.folder).toBe("");
    expect(result.customFields).toEqual([]);
    expect(result.vaultIds).toEqual([]);
    expect(result.trashed).toBe(false);
    expect(result.trashedAt).toBeNull();
  });
});

describe("toItemInput", () => {
  it("drops id and timestamps, keeps everything else", () => {
    const item = makeItem({
      id: "drop-me",
      name: "keep-me",
      favorite: true,
      pinned: true,
      trashed: true,
      trashedAt: 5000,
      vaultIds: ["v1"],
    });

    const input = toItemInput(item);

    expect(input).not.toHaveProperty("id");
    expect(input).not.toHaveProperty("createdAt");
    expect(input).not.toHaveProperty("updatedAt");
    expect(input.name).toBe("keep-me");
    expect(input.favorite).toBe(true);
    expect(input.pinned).toBe(true);
    expect(input.trashed).toBe(true);
    expect(input.trashedAt).toBe(5000);
    expect(input.vaultIds).toEqual(["v1"]);
    expect(input.type).toBe("login");
    expect(input.details).toEqual(item.details);
  });
});

describe("sortItems", () => {
  it("orders by most-recently-updated, newest first", () => {
    const old = makeItem({ id: "old", updatedAt: 1000 });
    const mid = makeItem({ id: "mid", updatedAt: 2000 });
    const recent = makeItem({ id: "recent", updatedAt: 3000 });

    const sorted = sortItems([old, recent, mid]);

    expect(sorted.map((i) => i.id)).toEqual(["recent", "mid", "old"]);
  });

  it("does not mutate the input array", () => {
    const items = [
      makeItem({ id: "a", updatedAt: 1000 }),
      makeItem({ id: "b", updatedAt: 2000 }),
    ];
    const copy = [...items];

    sortItems(items);

    expect(items).toEqual(copy);
  });
});

describe("deleteStoredItems", () => {
  it("deletes every row when IndexedDB succeeds", async () => {
    const result = await deleteStoredItems([
      makeItem({ id: "a" }),
      makeItem({ id: "b" }),
    ]);

    expect(result).toEqual({ deletedIds: ["a", "b"], failedIds: [] });
    expect(deleteStoredItem).toHaveBeenCalledTimes(2);
  });

  it("reports per-row failures without losing the rest", async () => {
    vi.mocked(deleteStoredItem).mockRejectedValueOnce(new Error("idb fail"));
    const result = await deleteStoredItems([
      makeItem({ id: "a" }),
      makeItem({ id: "b" }),
      makeItem({ id: "c" }),
    ]);

    expect(result.failedIds).toEqual(["a"]);
    expect(result.deletedIds).toEqual(["b", "c"]);
  });

  it("resolves empty for no rows", async () => {
    expect(await deleteStoredItems([])).toEqual({
      deletedIds: [],
      failedIds: [],
    });
  });
});
