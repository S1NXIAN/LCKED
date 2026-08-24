import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkVerifier,
  decryptJson,
  encryptJson,
  randomId,
} from "@/lib/crypto";
import type { VaultItem } from "@/lib/types";
import { deleteStoredItem, saveVaultMeta } from "@/lib/vault/vault-db";
import { useVault } from "@/store/vault";

/* ─── Mocks ─────────────────────────────────────────────── */

const mockMasterKey = {
  algorithm: { name: "AES-GCM" },
} as unknown as CryptoKey;
const mockVaultKey = { algorithm: { name: "AES-GCM" } } as unknown as CryptoKey;

// Deterministic per-test ids (reset in beforeEach).
const idCounter = vi.hoisted(() => ({
  n: 0,
  next: () => `mock-id-${++idCounter.n}`,
}));

// persist is a no-op here — it only touches localStorage, which Node lacks.
// The store's own actions + state are what this harness exercises.
vi.mock("zustand/middleware", () => ({
  persist: (config: unknown) => config,
}));

vi.mock("@/lib/crypto", () => ({
  deriveMasterKey: vi.fn(async (_pw: string, _salt: string) => mockMasterKey),
  generateVaultKey: vi.fn(async () => mockVaultKey),
  wrapVaultKey: vi.fn(async (_vk: CryptoKey, _mk: CryptoKey) => ({
    ciphertext: "wrapped-key-cipher",
    iv: "wrapped-key-iv",
  })),
  buildVerifier: vi.fn(async (_mk: CryptoKey) => ({
    verifier: "verifier-data",
    verifierIv: "verifier-iv",
    verifierToken: "LCKED_VAULT_VALID",
  })),
  checkVerifier: vi.fn(async (_mk: CryptoKey) => true),
  unwrapVaultKey: vi.fn(async () => mockVaultKey),
  encryptJson: vi.fn(async (_data: unknown) => ({
    ciphertext: "encrypted-data",
    iv: "encrypted-iv",
  })),
  decryptJson: vi.fn(async <T>() => ({}) as T),
  randomId: vi.fn(() => idCounter.next()),
  randomBytes: vi.fn((n: number) => new Uint8Array(n)),
  bytesToBase64: vi.fn((_b: Uint8Array | ArrayBuffer) => "base64-data"),
  PBKDF2_ITERATIONS: 600_000,
  VERIFIER_TOKEN: "LCKED_VAULT_VALID",
}));

// In-memory vault meta mirroring real IndexedDB persistence: what
// saveVaultMeta writes is what the next loadVaultMeta reads. The store's
// custom-vault creation depends on that round-trip.
const metaStore = vi.hoisted((): { current: unknown } => ({ current: null }));

vi.mock("@/lib/vault/vault-db", () => ({
  saveVaultMeta: vi.fn(async (m: unknown) => {
    metaStore.current = m;
  }),
  loadVaultMeta: vi.fn(async () => {
    if (metaStore.current) return metaStore.current;
    return {
      id: "singleton",
      salt: "test-salt",
      iterations: 600_000,
      encryptedVaultKey: "enc-vk",
      vaultKeyIv: "vk-iv",
      verifier: "verifier-data",
      verifierIv: "verifier-iv",
      verifierToken: "LCKED_VAULT_VALID",
      createdAt: 1000,
      settings: {},
      vaults: [],
    };
  }),
  loadAllStoredItems: vi.fn(async () => []),
  putStoredItem: vi.fn(async () => {}),
  deleteStoredItem: vi.fn(async () => {}),
  wipeVault: vi.fn(async () => {}),
  vaultExists: vi.fn(async () => true),
}));

vi.mock("@/lib/clipboard", () => ({
  clearAllClipboardTimers: vi.fn(),
}));

/* ─── Helpers ───────────────────────────────────────────── */

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

type StoreState = ReturnType<typeof useVault.getState>;

/** Reset the store to a clean unlocked baseline before each test. */
function seed(partial: Partial<StoreState> = {}) {
  useVault.setState({
    status: "unlocked",
    vaultKey: mockVaultKey,
    items: [],
    vaults: [],
    activeVault: "all",
    selectedId: null,
    typeFilter: "all",
    multiSelect: false,
    multiSelectIds: new Set(),
    editorNewType: null,
    ...partial,
  });
}

function envelopeJson() {
  return JSON.stringify({
    format: "lcked-encrypted-v1",
    version: 1,
    exportedAt: 1,
    salt: "salt",
    iterations: 600_000,
    verifier: "verifier",
    verifierIv: "verifier-iv",
    wrappedVaultKey: "wrapped",
    wrappedVaultKeyIv: "wrapped-iv",
    data: "data",
    dataIv: "data-iv",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  idCounter.n = 0;
  metaStore.current = null;
  seed();
});

/* ─── Bulk actions ──────────────────────────────────────── */

describe("bulk actions — no-op filtering", () => {
  it("trashItems skips items already in trash", async () => {
    seed({ items: [makeItem({ id: "a", trashed: true, trashedAt: 5 })] });

    const result = await useVault.getState().trashItems(["a"]);

    expect(result).toEqual({ done: 0, failed: 0 });
  });

  it("moveItemsToVault skips items already in the target membership", async () => {
    seed({ items: [makeItem({ id: "a", vaultIds: ["v1"] })] });

    const result = await useVault.getState().moveItemsToVault(["a"], "v1");

    expect(result).toEqual({ done: 0, failed: 0 });
  });
});

describe("bulk actions — partial-failure counts", () => {
  it("trashItems reports per-item failures without losing the rest", async () => {
    seed({ items: [makeItem({ id: "a" }), makeItem({ id: "b" })] });
    vi.mocked(encryptJson).mockRejectedValueOnce(new Error("idb fail"));

    const result = await useVault.getState().trashItems(["a", "b"]);

    expect(result).toEqual({ done: 1, failed: 1 });
    const items = useVault.getState().items;
    expect(items.find((i) => i.id === "b")?.trashed).toBe(true);
    expect(items.find((i) => i.id === "a")?.trashed).toBe(false);
  });

  it("restoreItems restores trashed items and skips untrashed ones", async () => {
    seed({
      items: [
        makeItem({ id: "a", trashed: true, trashedAt: 5 }),
        makeItem({ id: "b" }),
      ],
    });

    const result = await useVault.getState().restoreItems(["a", "b"]);

    expect(result).toEqual({ done: 1, failed: 0 });
    expect(useVault.getState().items.find((i) => i.id === "a")?.trashed).toBe(
      false,
    );
  });
});

describe("permanentlyDeleteItems — optimistic removal + rollback", () => {
  it("rolls back only the rows whose IndexedDB delete failed", async () => {
    seed({
      items: [
        makeItem({ id: "a" }),
        makeItem({ id: "b" }),
        makeItem({ id: "c" }),
      ],
    });
    vi.mocked(deleteStoredItem).mockRejectedValueOnce(new Error("idb fail"));

    const result = await useVault
      .getState()
      .permanentlyDeleteItems(["a", "b", "c"]);

    expect(result).toEqual({ done: 2, failed: 1 });
    // Only "a" (the failed row) is rolled back into state.
    expect(useVault.getState().items.map((i) => i.id)).toEqual(["a"]);
  });

  it("removes everything when all deletes succeed", async () => {
    seed({ items: [makeItem({ id: "a" }), makeItem({ id: "b" })] });

    const result = await useVault.getState().permanentlyDeleteItems(["a", "b"]);

    expect(result).toEqual({ done: 2, failed: 0 });
    expect(useVault.getState().items).toEqual([]);
  });
});

describe("emptyTrash — optimistic removal + rollback", () => {
  it("deletes all trashed items and reports counts", async () => {
    seed({
      items: [
        makeItem({ id: "a", trashed: true, trashedAt: 5 }),
        makeItem({ id: "b", trashed: true, trashedAt: 6 }),
        makeItem({ id: "live" }),
      ],
    });

    const result = await useVault.getState().emptyTrash();

    expect(result).toEqual({ done: 2, failed: 0 });
    expect(useVault.getState().items.map((i) => i.id)).toEqual(["live"]);
  });

  it("rolls back only failed rows and never throws for row failures", async () => {
    seed({
      items: [
        makeItem({ id: "a", trashed: true, trashedAt: 5 }),
        makeItem({ id: "b", trashed: true, trashedAt: 6 }),
      ],
    });
    vi.mocked(deleteStoredItem).mockRejectedValueOnce(new Error("idb fail"));

    const result = await useVault.getState().emptyTrash();

    expect(result).toEqual({ done: 1, failed: 1 });
    expect(useVault.getState().items.map((i) => i.id)).toEqual(["a"]);
  });
});

describe("permanentlyDeleteItem — shared optimistic path", () => {
  it("removes the item, clears a selectedId pointing at it, reports counts", async () => {
    seed({ items: [makeItem({ id: "a" })], selectedId: "a" });

    const result = await useVault.getState().permanentlyDeleteItem("a");

    expect(result).toEqual({ done: 1, failed: 0 });
    expect(useVault.getState().items).toEqual([]);
    expect(useVault.getState().selectedId).toBeNull();
  });

  it("keeps the item and resolves {done: 0, failed: 1} — never throws", async () => {
    seed({
      items: [
        makeItem({ id: "a", updatedAt: 2000 }),
        makeItem({ id: "b", updatedAt: 1000 }),
      ],
    });
    vi.mocked(deleteStoredItem).mockRejectedValueOnce(new Error("idb fail"));

    const result = await useVault.getState().permanentlyDeleteItem("a");

    expect(result).toEqual({ done: 0, failed: 1 });
    expect(useVault.getState().items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("single-item mutations speak BulkResult", () => {
  it("trashItem trashes and reports {done: 1}", async () => {
    seed({ items: [makeItem({ id: "a" })] });

    const result = await useVault.getState().trashItem("a");

    expect(result).toEqual({ done: 1, failed: 0 });
    expect(useVault.getState().items.find((i) => i.id === "a")?.trashed).toBe(
      true,
    );
  });

  it("trashItem filters the already-trashed no-op", async () => {
    seed({ items: [makeItem({ id: "a", trashed: true, trashedAt: 5 })] });

    const result = await useVault.getState().trashItem("a");

    expect(result).toEqual({ done: 0, failed: 0 });
  });

  it("restoreItem filters the not-trashed no-op", async () => {
    seed({ items: [makeItem({ id: "a" })] });

    const result = await useVault.getState().restoreItem("a");

    expect(result).toEqual({ done: 0, failed: 0 });
  });

  it("toggleFavorite flips the flag and reports {done: 1}", async () => {
    seed({ items: [makeItem({ id: "a" })] });

    const result = await useVault.getState().toggleFavorite("a");

    expect(result).toEqual({ done: 1, failed: 0 });
    expect(useVault.getState().items.find((i) => i.id === "a")?.favorite).toBe(
      true,
    );
  });

  it("togglePin flips the flag and reports {done: 1}", async () => {
    seed({ items: [makeItem({ id: "a" })] });

    const result = await useVault.getState().togglePin("a");

    expect(result).toEqual({ done: 1, failed: 0 });
    expect(useVault.getState().items.find((i) => i.id === "a")?.pinned).toBe(
      true,
    );
  });

  it("duplicateItem copies unpinned and untrashed, reports {done: 1}", async () => {
    seed({
      items: [
        makeItem({
          id: "orig",
          name: "Original",
          pinned: true,
          trashed: false,
        }),
      ],
    });
    vi.mocked(randomId).mockImplementationOnce(() => "copy-id");

    const result = await useVault.getState().duplicateItem("orig");

    expect(result).toEqual({ done: 1, failed: 0 });
    const copy = useVault.getState().items.find((i) => i.id === "copy-id");
    expect(copy?.name).toBe("Original");
    expect(copy?.pinned).toBe(false);
    expect(copy?.trashed).toBe(false);
  });

  it("duplicateItem folds a row-level write failure into the result", async () => {
    seed({ items: [makeItem({ id: "orig" })] });
    vi.mocked(encryptJson).mockRejectedValueOnce(new Error("idb fail"));

    const result = await useVault.getState().duplicateItem("orig");

    expect(result).toEqual({ done: 0, failed: 1 });
  });

  it("copyItemToVault writes an independent single-vault copy", async () => {
    seed({
      items: [makeItem({ id: "orig", favorite: true, vaultIds: ["home"] })],
    });
    vi.mocked(randomId).mockImplementationOnce(() => "copy-id");

    const result = await useVault.getState().copyItemToVault("orig", "work");

    expect(result).toEqual({ done: 1, failed: 0 });
    const copy = useVault.getState().items.find((i) => i.id === "copy-id");
    expect(copy?.vaultIds).toEqual(["work"]);
    expect(copy?.favorite).toBe(false);
  });

  it("still throws only for the locked-vault invariant", async () => {
    seed({ items: [makeItem({ id: "a" })], vaultKey: null });

    await expect(useVault.getState().trashItem("a")).rejects.toThrow(
      "Vault is locked",
    );
    await expect(useVault.getState().duplicateItem("a")).rejects.toThrow(
      "Vault is locked",
    );
  });
});

/* ─── cross-component UI commands ───────────────────────── */

describe("UI commands ride store transitions", () => {
  it("setTypeFilter sets and clears the secondary list filter", () => {
    useVault.getState().setTypeFilter("card");
    expect(useVault.getState().typeFilter).toBe("card");

    useVault.getState().setTypeFilter("all");
    expect(useVault.getState().typeFilter).toBe("all");
  });

  it("beginMultiSelect enters mode with the given ids", () => {
    useVault.getState().beginMultiSelect(["a", "b"]);

    const s = useVault.getState();
    expect(s.multiSelect).toBe(true);
    expect([...s.multiSelectIds]).toEqual(["a", "b"]);
  });

  it("toggleMultiSelectItem flips one membership without leaving mode", () => {
    useVault.getState().beginMultiSelect(["a"]);

    useVault.getState().toggleMultiSelectItem("b");
    expect(useVault.getState().multiSelectIds.has("b")).toBe(true);

    useVault.getState().toggleMultiSelectItem("a");
    expect(useVault.getState().multiSelectIds.has("a")).toBe(false);
    expect(useVault.getState().multiSelect).toBe(true);
  });

  it("clearMultiSelection empties the ids but stays in mode", () => {
    useVault.getState().beginMultiSelect(["a"]);

    useVault.getState().clearMultiSelection();

    const s = useVault.getState();
    expect(s.multiSelect).toBe(true);
    expect(s.multiSelectIds.size).toBe(0);
  });

  it("exitMultiSelect leaves mode and drops every id", () => {
    useVault.getState().beginMultiSelect(["a", "b"]);

    useVault.getState().exitMultiSelect();

    const s = useVault.getState();
    expect(s.multiSelect).toBe(false);
    expect(s.multiSelectIds.size).toBe(0);
  });

  it("switching the active vault exits multi-select (IL-3)", () => {
    useVault.getState().beginMultiSelect(["a"]);

    useVault.getState().setActiveVault("trash");

    const s = useVault.getState();
    expect(s.activeVault).toBe("trash");
    expect(s.multiSelect).toBe(false);
    expect(s.multiSelectIds.size).toBe(0);
  });

  it("setEditorOpen carries an intended new-item type and never leaks it", () => {
    useVault.getState().setEditorOpen(true, null, "card");
    expect(useVault.getState().editorNewType).toBe("card");

    // Any subsequent open overwrites the handoff — a stale type can't
    // survive into the next editor session.
    useVault.getState().setEditorOpen(true);
    expect(useVault.getState().editorNewType).toBeNull();

    useVault.getState().setEditorOpen(true, null, "note");
    useVault.getState().setEditorOpen(false);
    expect(useVault.getState().editorNewType).toBeNull();
  });

  it("deleting the active vault also exits multi-select (IL-3)", async () => {
    const vault = await useVault.getState().createVault("Temp", "blue", "box");
    useVault.getState().setActiveVault(vault.id);
    useVault.getState().beginMultiSelect(["a"]);

    await useVault.getState().deleteVault(vault.id);

    const s = useVault.getState();
    expect(s.activeVault).toBe("all");
    expect(s.multiSelect).toBe(false);
    expect(s.multiSelectIds.size).toBe(0);
  });

  it("lock resets the filter, selection and editor handoff", () => {
    useVault.getState().setTypeFilter("login");
    useVault.getState().beginMultiSelect(["a"]);
    useVault.getState().setEditorOpen(true, null, "identity");

    useVault.getState().lock();

    const s = useVault.getState();
    expect(s.typeFilter).toBe("all");
    expect(s.multiSelect).toBe(false);
    expect(s.multiSelectIds.size).toBe(0);
    expect(s.editorNewType).toBeNull();
  });
});

/* ─── restoreVault wiring ───────────────────────────────── */

describe("restoreVault — plain import path", () => {
  it("creates the vault and imports items from a Bitwarden CSV", async () => {
    const csv = `name,type,folder,favorite,pinned,login_username,login_password,login_uri,login_totp,notes
example.com,login,Work,1,0,alice,p@ssw0rd,https://example.com,JBSWY3DPEHPK3PXP,Primary work account
"Meeting Notes",note,,0,0,,,,,"Remember to bring up Q3 projections."`;

    seed({ status: "setup" });
    const result = await useVault.getState().restoreVault({
      masterPassword: "pw",
      filename: "export.csv",
      fileText: csv,
    });

    expect(result).toEqual({ ok: true, imported: 2 });
    const state = useVault.getState();
    expect(state.status).toBe("unlocked");
    // Order-insensitive: both rows were written near-simultaneously.
    expect(state.items.map((i) => i.name).sort()).toEqual([
      "Meeting Notes",
      "example.com",
    ]);
  });
});

describe("restoreVault — wrong backup password", () => {
  it("returns wrong-password and creates NO vault", async () => {
    seed({ status: "setup" });
    vi.mocked(checkVerifier).mockResolvedValueOnce(false);

    const result = await useVault.getState().restoreVault({
      masterPassword: "bad",
      filename: "backup.json",
      fileText: envelopeJson(),
    });

    expect(result).toEqual({ ok: false, reason: "wrong-password" });
    expect(useVault.getState().status).toBe("setup");
    expect(saveVaultMeta).not.toHaveBeenCalled();
  });
});

describe("restoreVault — encrypted backup", () => {
  it("re-creates custom vaults and remaps item memberships end to end", async () => {
    const payload = {
      items: [
        makeItem({ id: "i1", name: "Work item", vaultIds: ["old-work"] }),
        makeItem({
          id: "i2",
          name: "Personal item",
          vaultIds: ["old-personal", "ghost"],
        }),
      ],
      vaults: [
        {
          id: "old-work",
          name: "Work",
          color: "blue",
          icon: "briefcase",
          createdAt: 1,
        },
        {
          id: "old-personal",
          name: "Personal",
          color: "red",
          icon: "user",
          createdAt: 1,
        },
      ],
    };
    vi.mocked(decryptJson).mockResolvedValueOnce(payload);

    seed({ status: "setup" });
    const result = await useVault.getState().restoreVault({
      masterPassword: "pw",
      filename: "backup.json",
      fileText: envelopeJson(),
    });

    expect(result).toEqual({ ok: true, imported: 2 });
    const state = useVault.getState();
    expect(state.status).toBe("unlocked");
    // Two custom vaults re-created with fresh ids.
    expect(state.vaults.map((v) => v.name)).toEqual(["Work", "Personal"]);
    const workId = state.vaults.find((v) => v.name === "Work")!.id;
    const personalId = state.vaults.find((v) => v.name === "Personal")!.id;
    expect(workId).not.toBe("old-work");
    // Items restored untrashed with remapped memberships; unmatched id dropped.
    expect(state.items).toHaveLength(2);
    const workItem = state.items.find((i) => i.name === "Work item")!;
    const personalItem = state.items.find((i) => i.name === "Personal item")!;
    expect(workItem.vaultIds).toEqual([workId]);
    expect(personalItem.vaultIds).toEqual([personalId]);
    expect(state.items.every((i) => !i.trashed)).toBe(true);
  });
});
