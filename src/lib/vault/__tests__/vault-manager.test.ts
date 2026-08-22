import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createVault,
  updateVault,
  renameVault,
  deleteVault,
  reorderVaults,
} from "@/lib/vault/vault-manager";
import type { VaultDef, VaultItem, VaultMeta, VaultSettings } from "@/lib/types";

/* ─── Mocks ─────────────────────────────────────────────── */

const mockVaultKey = { algorithm: { name: "AES-GCM" } } as unknown as CryptoKey;

vi.mock("@/lib/crypto", () => ({
  encryptJson: vi.fn(async (item: unknown) => ({
    ciphertext: "enc:" + JSON.stringify(item),
    iv: "mock-iv",
  })),
  randomId: vi.fn(() => "vault-new"),
}));

vi.mock("@/lib/vault/vault-db", () => ({
  loadVaultMeta: vi.fn(async (): Promise<VaultMeta | undefined> => ({
    id: "singleton",
    salt: "salt",
    iterations: 600_000,
    encryptedVaultKey: "ek",
    vaultKeyIv: "ev",
    verifier: "v",
    verifierIv: "vi",
    verifierToken: "vt",
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
  saveVaultMeta: vi.fn(async () => { }),
  putStoredItem: vi.fn(async () => { }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

/* ─── Helpers ───────────────────────────────────────────── */

function makeVaultDef(overrides: Partial<VaultDef> = {}): VaultDef {
  return {
    id: "v1",
    name: "Personal",
    color: "blue",
    icon: "lock",
    createdAt: 1000,
    ...overrides,
  };
}

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

function makeVaultMeta(overrides: Partial<VaultMeta> = {}): VaultMeta {
  return {
    id: "singleton",
    salt: "salt",
    iterations: 600_000,
    encryptedVaultKey: "ek",
    vaultKeyIv: "ev",
    verifier: "v",
    verifierIv: "vi",
    verifierToken: "vt",
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
    },
    vaults: [],
    ...overrides,
  };
}

/* ─── createVault ─────────────────────────────────────────── */

describe("createVault", () => {
  it("saves meta with new vault and returns vaults array including it", async () => {
    const { saveVaultMeta } = await import("@/lib/vault/vault-db");

    const result = await createVault("Personal", "blue", "lock");

    expect(saveVaultMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        vaults: expect.arrayContaining([
          expect.objectContaining({
            id: "vault-new",
            name: "Personal",
            color: "blue",
            icon: "lock",
          }),
        ]),
      }),
    );
    expect(result.vaults).toHaveLength(1);
    expect(result.vaults[0].name).toBe("Personal");
    expect(result.vaults[0].id).toBe("vault-new");
  });

  it("trims empty name to Untitled vault", async () => {
    const { saveVaultMeta } = await import("@/lib/vault/vault-db");

    const result = await createVault("   ", "green", "folder");

    expect(saveVaultMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        vaults: [expect.objectContaining({ name: "Untitled vault" })],
      }),
    );
    expect(result.vaults[0].name).toBe("Untitled vault");
  });

  it("throws when vault meta is missing", async () => {
    const { loadVaultMeta } = await import("@/lib/vault/vault-db");
    vi.mocked(loadVaultMeta).mockResolvedValueOnce(undefined);

    await expect(createVault("Personal", "blue", "lock")).rejects.toThrow(
      "Vault meta missing",
    );
  });
});

/* ─── updateVault ─────────────────────────────────────────── */

describe("updateVault", () => {
  it("patches the correct vault and returns updated vaults", async () => {
    const { loadVaultMeta, saveVaultMeta } = await import("@/lib/vault/vault-db");
    vi.mocked(loadVaultMeta).mockResolvedValueOnce(
      makeVaultMeta({ vaults: [makeVaultDef({ id: "v1", name: "Old" })] }),
    );

    const result = await updateVault("v1", { name: "Renamed" });

    expect(result.vaults).toHaveLength(1);
    expect(result.vaults[0].name).toBe("Renamed");
    expect(saveVaultMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        vaults: [expect.objectContaining({ id: "v1", name: "Renamed" })],
      }),
    );
  });

  it("no-ops when vault id is not found", async () => {
    const { loadVaultMeta } = await import("@/lib/vault/vault-db");
    vi.mocked(loadVaultMeta).mockResolvedValueOnce(
      makeVaultMeta({ vaults: [makeVaultDef({ id: "v1", name: "Original" })] }),
    );

    const result = await updateVault("v999", { name: "Ghost" });

    expect(result.vaults).toHaveLength(1);
    expect(result.vaults[0].name).toBe("Original");
  });
});

/* ─── renameVault ─────────────────────────────────────────── */

describe("renameVault", () => {
  it("delegates to updateVault and changes the name", async () => {
    const { loadVaultMeta, saveVaultMeta } = await import("@/lib/vault/vault-db");
    vi.mocked(loadVaultMeta).mockResolvedValueOnce(
      makeVaultMeta({ vaults: [makeVaultDef({ id: "v1", name: "Old" })] }),
    );

    const result = await renameVault("v1", "Renamed");

    expect(result.vaults).toHaveLength(1);
    expect(result.vaults[0].name).toBe("Renamed");
    expect(saveVaultMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        vaults: [expect.objectContaining({ id: "v1", name: "Renamed" })],
      }),
    );
  });
});

/* ─── deleteVault ─────────────────────────────────────────── */

describe("deleteVault", () => {
  it("removes vault, orphans items that belonged to it, re-encrypts", async () => {
    const { loadVaultMeta, saveVaultMeta, putStoredItem } =
      await import("@/lib/vault/vault-db");
    vi.mocked(loadVaultMeta).mockResolvedValueOnce(
      makeVaultMeta({
        vaults: [
          makeVaultDef({ id: "v1" }),
          makeVaultDef({ id: "v2" }),
        ],
      }),
    );

    const itemInV1 = makeItem({ id: "item-a", vaultIds: ["v1"] });
    const itemInV2 = makeItem({ id: "item-b", vaultIds: ["v2"] });

    const result = await deleteVault("v1", mockVaultKey, [itemInV1, itemInV2]);

    // Vault removed from meta
    expect(result.vaults).toHaveLength(1);
    expect(result.vaults[0].id).toBe("v2");

    // Orphaned item re-encrypted with vaultIds cleared
    expect(result.updatedItems).toHaveLength(1);
    expect(result.updatedItems![0].id).toBe("item-a");
    expect(result.updatedItems![0].vaultIds).toEqual([]);
    expect(result.updatedItems![0].updatedAt).toBeGreaterThan(
      itemInV1.updatedAt,
    );

    // Written to IndexedDB
    expect(putStoredItem).toHaveBeenCalledTimes(1);
    expect(putStoredItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: "item-a" }),
    );

    // Meta saved with vault v2 only
    expect(saveVaultMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        vaults: [expect.objectContaining({ id: "v2" })],
      }),
    );
  });

  it("removes vault when no items belong to it", async () => {
    const { loadVaultMeta, saveVaultMeta, putStoredItem } =
      await import("@/lib/vault/vault-db");
    vi.mocked(loadVaultMeta).mockResolvedValueOnce(
      makeVaultMeta({ vaults: [makeVaultDef({ id: "v1" })] }),
    );

    const result = await deleteVault("v1", mockVaultKey, []);

    expect(result.vaults).toHaveLength(0);
    expect(result.updatedItems).toBeUndefined();
    expect(putStoredItem).not.toHaveBeenCalled();
    expect(saveVaultMeta).toHaveBeenCalled();
  });

  it("silent no-op when vault meta is missing", async () => {
    const { loadVaultMeta, saveVaultMeta } = await import("@/lib/vault/vault-db");
    vi.mocked(loadVaultMeta).mockResolvedValueOnce(undefined);

    const result = await deleteVault("v1", mockVaultKey, []);

    expect(result).toEqual({ vaults: [] });
    expect(saveVaultMeta).not.toHaveBeenCalled();
  });

  it("throws and does not save meta when re-encryption fails", async () => {
    const { encryptJson } = await import("@/lib/crypto");
    const { loadVaultMeta, saveVaultMeta } = await import("@/lib/vault/vault-db");

    vi.mocked(loadVaultMeta).mockResolvedValueOnce(
      makeVaultMeta({ vaults: [makeVaultDef()] }),
    );
    vi.mocked(encryptJson).mockRejectedValueOnce(
      new Error("crypto fail"),
    );

    const item = makeItem({ vaultIds: ["v1"] });

    await expect(
      deleteVault("v1", mockVaultKey, [item]),
    ).rejects.toThrow("crypto fail");
    expect(saveVaultMeta).not.toHaveBeenCalled();
  });
});

/* ─── reorderVaults ───────────────────────────────────────── */

describe("reorderVaults", () => {
  it("saves meta with the new order", async () => {
    const { loadVaultMeta, saveVaultMeta } = await import("@/lib/vault/vault-db");

    const v1 = makeVaultDef({ id: "v1", name: "A" });
    const v2 = makeVaultDef({ id: "v2", name: "B" });
    vi.mocked(loadVaultMeta).mockResolvedValueOnce(
      makeVaultMeta({ vaults: [v1, v2] }),
    );

    const result = await reorderVaults([v2, v1]);

    expect(result.vaults).toEqual([v2, v1]);
    expect(saveVaultMeta).toHaveBeenCalledWith(
      expect.objectContaining({ vaults: [v2, v1] }),
    );
  });
});
