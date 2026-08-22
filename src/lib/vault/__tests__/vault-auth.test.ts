import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createVault,
  unlockVault,
  clearSession,
  changeMasterPassword,
  exportEncrypted,
  decryptLckedExport,
} from "@/lib/vault/vault-auth";
import type {
  VaultItem,
  VaultDef,
  VaultMeta,
  VaultSettings,
} from "@/lib/types";
import type { LckedExport } from "@/lib/import";

/* ─── Mocks ─────────────────────────────────────────────── */

const mockMasterKey = { algorithm: { name: "AES-GCM" } } as unknown as CryptoKey;
const mockVaultKey = { algorithm: { name: "AES-GCM" } } as unknown as CryptoKey;

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
  randomId: vi.fn(() => "mock-id"),
  randomBytes: vi.fn((n: number) => new Uint8Array(n)),
  bytesToBase64: vi.fn((_b: Uint8Array | ArrayBuffer) => "base64-data"),
  PBKDF2_ITERATIONS: 600_000,
  VERIFIER_TOKEN: "LCKED_VAULT_VALID",
}));

vi.mock("@/lib/vault/vault-db", () => ({
  saveVaultMeta: vi.fn(async () => { }),
  loadVaultMeta: vi.fn(async (): Promise<VaultMeta | undefined> => ({
    id: "singleton",
    salt: "test-salt",
    iterations: 600_000,
    encryptedVaultKey: "enc-vk",
    vaultKeyIv: "vk-iv",
    verifier: "verifier-data",
    verifierIv: "verifier-iv",
    verifierToken: "LCKED_VAULT_VALID",
    createdAt: 1000,
    settings: {
      autoLockMinutes: 15,
      lockOnVisibility: true,
      generator: {
        length: 20,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
        avoidAmbiguous: true,
      },
      theme: "dark",
      showFavicons: true,
      sortFavoritesFirst: false,
      hoverItemActions: true,
      blurEmailMode: "off",
    } as VaultSettings,
    vaults: [],
  })),
  loadAllStoredItems: vi.fn(async () => []),
  putStoredItem: vi.fn(async () => { }),
  deleteStoredItem: vi.fn(async () => { }),
  wipeVault: vi.fn(async () => { }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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

/* ─── createVault ───────────────────────────────────────── */

describe("createVault", () => {
  it("saves vault meta to IndexedDB", async () => {
    const { saveVaultMeta } = await import("@/lib/vault/vault-db");

    await createVault("test-password");

    expect(saveVaultMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "singleton",
        iterations: 600_000,
        settings: expect.objectContaining({ autoLockMinutes: 15 }),
      }),
    );
  });

  it("returns session with keys and empty vault data", async () => {
    const result = await createVault("test-password");

    expect(result.masterKey).toBe(mockMasterKey);
    expect(result.vaultKey).toBe(mockVaultKey);
    expect(result.masterPassword).toBe("test-password");
    expect(result.items).toEqual([]);
    expect(result.vaults).toEqual([]);
    expect(result.settings).toBeDefined();
  });
});

/* ─── unlockVault ───────────────────────────────────────── */

describe("unlockVault", () => {
  it("returns session + data on correct password", async () => {
    const result = await unlockVault("correct-pw");

    expect(result).toHaveProperty("ok", true);
    if (result.ok) {
      expect(result.masterKey).toBe(mockMasterKey);
      expect(result.vaultKey).toBe(mockVaultKey);
      expect(result.masterPassword).toBe("correct-pw");
    }
  });

  it("returns ok:false on wrong password", async () => {
    const { checkVerifier } = await import("@/lib/crypto");
    vi.mocked(checkVerifier).mockResolvedValueOnce(false);

    const result = await unlockVault("wrong-pw");

    expect(result).toEqual({ ok: false });
  });

  it("returns ok:false when no vault meta exists", async () => {
    const { loadVaultMeta } = await import("@/lib/vault/vault-db");
    vi.mocked(loadVaultMeta).mockResolvedValueOnce(undefined);

    const result = await unlockVault("pw");

    expect(result).toEqual({ ok: false });
  });

  it("loads and decrypts stored items", async () => {
    const { loadAllStoredItems } = await import("@/lib/vault/vault-db");
    const { decryptJson } = await import("@/lib/crypto");
    const item = makeItem({ id: "stored-1" });
    vi.mocked(loadAllStoredItems).mockResolvedValueOnce([
      { id: "stored-1", type: "login", ciphertext: "ct", iv: "iv", createdAt: 1000, updatedAt: 1000 },
    ]);
    vi.mocked(decryptJson).mockResolvedValueOnce(item);

    const result = await unlockVault("pw");

    expect(result).toHaveProperty("ok", true);
    if (result.ok) {
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("stored-1");
    }
  });

  it("deletes expired trashed items", async () => {
    const { loadAllStoredItems, deleteStoredItem } = await import("@/lib/vault/vault-db");
    const { decryptJson } = await import("@/lib/crypto");
    const expired = makeItem({
      id: "expired",
      trashed: true,
      trashedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    });
    vi.mocked(loadAllStoredItems).mockResolvedValueOnce([
      { id: "expired", type: "login", ciphertext: "ct", iv: "iv", createdAt: 1000, updatedAt: 1000 },
    ]);
    vi.mocked(decryptJson).mockResolvedValueOnce(expired);

    await unlockVault("pw");

    expect(deleteStoredItem).toHaveBeenCalledWith("expired");
  });

  it("migrates items missing newer fields", async () => {
    const { loadAllStoredItems, putStoredItem } = await import("@/lib/vault/vault-db");
    const { decryptJson } = await import("@/lib/crypto");
    // Simulate an item without vaultIds (pre-migration).
    const partial = makeItem({ id: "migrate-me" });
    delete (partial as any).vaultIds;
    vi.mocked(loadAllStoredItems).mockResolvedValueOnce([
      { id: "migrate-me", type: "login", ciphertext: "ct", iv: "iv", createdAt: 1000, updatedAt: 1000 },
    ]);
    vi.mocked(decryptJson).mockResolvedValueOnce(partial);

    const result = await unlockVault("pw");

    expect(result).toHaveProperty("ok", true);
    if (result.ok) {
      const migrated = result.items.find((i) => i.id === "migrate-me");
      expect(migrated).toBeDefined();
      expect(migrated!.vaultIds).toEqual([]); // default for missing field
    }
    // Migrated items should be re-encrypted and persisted.
    expect(putStoredItem).toHaveBeenCalled();
  });
});

/* ─── clearSession ──────────────────────────────────────── */

describe("clearSession", () => {
  it("returns null keys", () => {
    const result = clearSession();
    expect(result.masterKey).toBeNull();
    expect(result.vaultKey).toBeNull();
  });
});

/* ─── changeMasterPassword ──────────────────────────────── */

describe("changeMasterPassword", () => {
  it("saves updated meta with new salt and master key", async () => {
    const { saveVaultMeta } = await import("@/lib/vault/vault-db");

    const result = await changeMasterPassword("old-pw", "new-pw", mockVaultKey);

    expect(result).not.toBeNull();
    expect(result!.masterKey).toBe(mockMasterKey);
    expect(saveVaultMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        salt: "base64-data", // mock returns this from bytesToBase64
      }),
    );
  });

  it("returns null when current password is wrong", async () => {
    const { checkVerifier } = await import("@/lib/crypto");
    vi.mocked(checkVerifier).mockResolvedValueOnce(false);

    const result = await changeMasterPassword("wrong-pw", "new-pw", mockVaultKey);

    expect(result).toBeNull();
  });

  it("returns null when no vault meta exists", async () => {
    const { loadVaultMeta } = await import("@/lib/vault/vault-db");
    vi.mocked(loadVaultMeta).mockResolvedValueOnce(undefined);

    const result = await changeMasterPassword("pw", "new-pw", mockVaultKey);

    expect(result).toBeNull();
  });
});

/* ─── exportEncrypted ───────────────────────────────────── */

describe("exportEncrypted", () => {
  it("returns a JSON string with the expected envelope format", async () => {
    const items = [makeItem()];
    const vaults: VaultDef[] = [{ id: "v1", name: "V", color: "blue", icon: "lock", createdAt: 1000 }];

    const json = await exportEncrypted(items, vaults, "export-pw");
    const envelope = JSON.parse(json);

    expect(envelope.format).toBe("lcked-encrypted-v1");
    expect(envelope.version).toBe(1);
    expect(envelope.salt).toBeDefined();
    expect(envelope.data).toBeDefined();
    expect(envelope.exportedAt).toBeGreaterThan(0);
  });
});

/* ─── decryptLckedExport ────────────────────────────────── */

describe("decryptLckedExport", () => {
  it("returns wrong-password when the verifier check fails", async () => {
    const { checkVerifier } = await import("@/lib/crypto");
    vi.mocked(checkVerifier).mockResolvedValueOnce(false);

    const envelope: LckedExport = {
      format: "lcked-encrypted-v1",
      version: 1,
      exportedAt: Date.now(),
      salt: "salt",
      iterations: 600_000,
      verifier: "v",
      verifierIv: "vi",
      wrappedVaultKey: "wvk",
      wrappedVaultKeyIv: "wvk-iv",
      data: "data",
      dataIv: "data-iv",
    };

    const result = await decryptLckedExport(envelope, "wrong-pw");
    expect(result).toEqual({ ok: false, reason: "wrong-password" });
  });

  it("returns corrupt for unknown format", async () => {
    const envelope = { format: "unknown" } as unknown as LckedExport;

    const result = await decryptLckedExport(envelope, "pw");
    expect(result).toEqual({ ok: false, reason: "corrupt" });
  });

  it("returns corrupt when the payload fails to decrypt", async () => {
    const { decryptJson } = await import("@/lib/crypto");
    vi.mocked(decryptJson).mockRejectedValueOnce(new Error("bad ciphertext"));

    const envelope: LckedExport = {
      format: "lcked-encrypted-v1",
      version: 1,
      exportedAt: Date.now(),
      salt: "salt",
      iterations: 600_000,
      verifier: "v",
      verifierIv: "vi",
      wrappedVaultKey: "wvk",
      wrappedVaultKeyIv: "wvk-iv",
      data: "garbage",
      dataIv: "data-iv",
    };

    const result = await decryptLckedExport(envelope, "pw");
    expect(result).toEqual({ ok: false, reason: "corrupt" });
  });

  it("returns the decrypted payload on success", async () => {
    const { decryptJson } = await import("@/lib/crypto");
    vi.mocked(decryptJson).mockResolvedValueOnce({
      items: [{ id: "i1" }],
      vaults: [{ id: "v1" }],
    });

    const envelope: LckedExport = {
      format: "lcked-encrypted-v1",
      version: 1,
      exportedAt: Date.now(),
      salt: "salt",
      iterations: 600_000,
      verifier: "v",
      verifierIv: "vi",
      wrappedVaultKey: "wvk",
      wrappedVaultKeyIv: "wvk-iv",
      data: "data",
      dataIv: "data-iv",
    };

    const result = await decryptLckedExport(envelope, "pw");
    expect(result).toEqual({
      ok: true,
      items: [{ id: "i1" }],
      vaults: [{ id: "v1" }],
    });
  });
});
