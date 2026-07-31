import { describe, it, expect, vi, beforeEach } from "vitest";
import { useVault } from "@/store/vault";
import type { VaultItem } from "@/lib/types";

/* ─── Mocks ─────────────────────────────────────────────── */

const mockMasterKey = { algorithm: { name: "AES-GCM" } } as unknown as CryptoKey;
const mockVaultKey = { algorithm: { name: "AES-GCM" } } as unknown as CryptoKey;

// Deterministic per-test ids (reset in beforeEach).
const idCounter = vi.hoisted(() => ({ n: 0, next: () => `mock-id-${++idCounter.n}` }));

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
const metaStore = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/vault-db", () => ({
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

    expect(result).toEqual({ moved: 0, failed: 0 });
  });

  it("moveItemsToVault skips items already in the target membership", async () => {
    seed({ items: [makeItem({ id: "a", vaultIds: ["v1"] })] });

    const result = await useVault.getState().moveItemsToVault(["a"], "v1");

    expect(result).toEqual({ moved: 0, failed: 0 });
  });
});

describe("bulk actions — partial-failure counts", () => {
  it("trashItems reports per-item failures without losing the rest", async () => {
    seed({ items: [makeItem({ id: "a" }), makeItem({ id: "b" })] });
    const { encryptJson } = await import("@/lib/crypto");
    vi.mocked(encryptJson).mockRejectedValueOnce(new Error("idb fail"));

    const result = await useVault.getState().trashItems(["a", "b"]);

    expect(result).toEqual({ moved: 1, failed: 1 });
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

    expect(result).toEqual({ restored: 1, failed: 0 });
    expect(useVault.getState().items.find((i) => i.id === "a")?.trashed).toBe(false);
  });
});

describe("permanentlyDeleteItems — optimistic removal + rollback", () => {
  it("rolls back only the rows whose IndexedDB delete failed", async () => {
    seed({ items: [makeItem({ id: "a" }), makeItem({ id: "b" }), makeItem({ id: "c" })] });
    const { deleteStoredItem } = await import("@/lib/vault-db");
    vi.mocked(deleteStoredItem).mockRejectedValueOnce(new Error("idb fail"));

    const result = await useVault.getState().permanentlyDeleteItems(["a", "b", "c"]);

    expect(result).toEqual({ deleted: 2, failed: 1 });
    // Only "a" (the failed row) is rolled back into state.
    expect(useVault.getState().items.map((i) => i.id)).toEqual(["a"]);
  });

  it("removes everything when all deletes succeed", async () => {
    seed({ items: [makeItem({ id: "a" }), makeItem({ id: "b" })] });

    const result = await useVault.getState().permanentlyDeleteItems(["a", "b"]);

    expect(result).toEqual({ deleted: 2, failed: 0 });
    expect(useVault.getState().items).toEqual([]);
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
    expect(state.items.map((i) => i.name).sort()).toEqual(["Meeting Notes", "example.com"]);
  });
});

describe("restoreVault — wrong backup password", () => {
  it("returns wrong-password and creates NO vault", async () => {
    seed({ status: "setup" });
    const { checkVerifier } = await import("@/lib/crypto");
    const { saveVaultMeta } = await import("@/lib/vault-db");
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
        makeItem({ id: "i2", name: "Personal item", vaultIds: ["old-personal", "ghost"] }),
      ],
      vaults: [
        { id: "old-work", name: "Work", color: "blue", icon: "briefcase", createdAt: 1 },
        { id: "old-personal", name: "Personal", color: "red", icon: "user", createdAt: 1 },
      ],
    };
    const { decryptJson } = await import("@/lib/crypto");
    vi.mocked(decryptJson).mockResolvedValueOnce(payload as never);

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
