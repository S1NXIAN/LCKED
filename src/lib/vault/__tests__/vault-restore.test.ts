import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildVaultIdMap,
  remapVaultIds,
  restoreVault,
  type RestoreDeps,
} from "@/lib/vault/vault-restore";
import type { VaultDef, VaultItem } from "@/lib/types";

// Mock the decryptor and format detector; the restore module's own
// choreography is what's under test.
vi.mock("@/lib/vault/vault-auth", () => ({
  decryptLckedExport: vi.fn(),
}));

vi.mock("@/lib/import-export", () => ({
  importFromText: vi.fn(),
}));

const { decryptLckedExport } = await import("@/lib/vault/vault-auth");
const { importFromText } = await import("@/lib/import-export");

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

function makeVault(id: string, name: string): VaultDef {
  return { id, name, color: "blue", icon: "briefcase", createdAt: 1000 };
}

function makeDeps(overrides: Partial<RestoreDeps> = {}): RestoreDeps {
  return {
    setupVault: vi.fn(async () => { }),
    createCustomVault: vi.fn(async (name: string) => makeVault(`new-${name}`, name)),
    saveItem: vi.fn(async () => { }),
    importItems: vi.fn(async () => ({ imported: 0 })),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildVaultIdMap", () => {
  it("matches by name+color+icon and returns old→new ids", () => {
    const oldVaults = [makeVault("old-1", "Work"), makeVault("old-2", "Personal")];
    const newVaults = [
      { ...makeVault("new-9", "Personal") },
      { ...makeVault("new-1", "Work") },
    ];

    const map = buildVaultIdMap(oldVaults, newVaults);

    expect(map.get("old-1")).toBe("new-1");
    expect(map.get("old-2")).toBe("new-9");
  });

  it("leaves a vault id unmapped when no fresh vault matches", () => {
    const map = buildVaultIdMap([makeVault("old-1", "Work")], [makeVault("new-1", "Other")]);
    expect(map.has("old-1")).toBe(false);
  });

  it("maps duplicate-triple vaults to DISTINCT fresh vaults", () => {
    // Two old vaults share name+color+icon; two fresh ones were created the
    // same way. Each old vault must land on its own fresh vault — not both on
    // the first match, which would silently merge one vault's items into the
    // other and leave the second fresh vault empty.
    const oldVaults = [makeVault("old-1", "Work"), makeVault("old-2", "Work")];
    const newVaults = [makeVault("new-1", "Work"), makeVault("new-2", "Work")];

    const map = buildVaultIdMap(oldVaults, newVaults);

    expect(map.get("old-1")).toBe("new-1");
    expect(map.get("old-2")).toBe("new-2");
    expect(new Set(map.values()).size).toBe(2);
  });

  it("drops the surplus old vault when fewer fresh vaults match", () => {
    const map = buildVaultIdMap(
      [makeVault("old-1", "Work"), makeVault("old-2", "Work")],
      [makeVault("new-1", "Work")],
    );
    expect(map.has("old-1")).toBe(true);
    expect(map.has("old-2")).toBe(false);
  });
});

describe("remapVaultIds", () => {
  it("remaps through the map and drops unmatched ids", () => {
    const map = new Map([["a", "A"]]);
    expect(remapVaultIds(["a", "ghost"], map)).toEqual(["A"]);
  });

  it("handles undefined vaultIds as empty", () => {
    expect(remapVaultIds(undefined, new Map())).toEqual([]);
  });
});

describe("restoreVault — encrypted backup", () => {
  it("returns wrong-password and creates NO vault when the password is wrong", async () => {
    vi.mocked(importFromText).mockReturnValue({ result: { format: "lcked-json" }, items: [] } as never);
    vi.mocked(decryptLckedExport).mockResolvedValue({ ok: false, reason: "wrong-password" });

    const deps = makeDeps();
    const result = await restoreVault({
      masterPassword: "bad",
      filename: "backup.json",
      fileText: "{}",
      deps,
    });

    expect(result).toEqual({ ok: false, reason: "wrong-password" });
    expect(deps.setupVault).not.toHaveBeenCalled();
    expect(deps.createCustomVault).not.toHaveBeenCalled();
    expect(deps.saveItem).not.toHaveBeenCalled();
  });

  it("returns invalid-file and creates NO vault for a corrupt backup", async () => {
    vi.mocked(importFromText).mockReturnValue({ result: { format: "lcked-json" }, items: [] } as never);
    vi.mocked(decryptLckedExport).mockResolvedValue({ ok: false, reason: "corrupt" });

    const deps = makeDeps();
    const result = await restoreVault({
      masterPassword: "pw",
      filename: "backup.json",
      fileText: "{}",
      deps,
    });

    expect(result).toEqual({ ok: false, reason: "invalid-file" });
    expect(deps.setupVault).not.toHaveBeenCalled();
  });

  it("creates the vault before custom vaults, remaps memberships, and counts imports", async () => {
    const vaults = [makeVault("old-1", "Work"), makeVault("old-2", "Personal")];
    const items = [
      makeItem({ id: "i1", vaultIds: ["old-1"] }),
      makeItem({ id: "i2", vaultIds: ["old-2", "ghost"] }),
    ];
    vi.mocked(importFromText).mockReturnValue({ result: { format: "lcked-json" }, items: [] } as never);
    vi.mocked(decryptLckedExport).mockResolvedValue({ ok: true, items, vaults });

    const deps = makeDeps();
    const result = await restoreVault({
      masterPassword: "pw",
      filename: "backup.json",
      fileText: "{}",
      deps,
    });

    expect(result).toEqual({ ok: true, imported: 2 });
    // Main vault first, then each custom vault.
    expect(deps.setupVault).toHaveBeenCalledTimes(1);
    expect(deps.createCustomVault).toHaveBeenCalledTimes(2);
    const inputs = vi.mocked(deps.saveItem).mock.calls.map(([input]) => input);
    expect(inputs).toHaveLength(2);
    // Membership remapped; unmatched "ghost" dropped; restore untrashes.
    expect(inputs[0].vaultIds).toEqual(["new-Work"]);
    expect(inputs[1].vaultIds).toEqual(["new-Personal"]);
    expect(inputs[0].trashed).toBe(false);
    expect(inputs[0].trashedAt).toBeNull();
    // Downgrade drops id + timestamps.
    expect(inputs[0]).not.toHaveProperty("id");
    expect(inputs[0]).not.toHaveProperty("createdAt");
    expect(inputs[0]).not.toHaveProperty("updatedAt");
  });

  it("keeps importing best-effort when one item write fails", async () => {
    vi.mocked(importFromText).mockReturnValue({ result: { format: "lcked-json" }, items: [] } as never);
    vi.mocked(decryptLckedExport).mockResolvedValue({
      ok: true,
      items: [makeItem({ id: "i1" }), makeItem({ id: "i2" })],
      vaults: [],
    });

    const saveItem = vi
      .fn()
      .mockRejectedValueOnce(new Error("idb fail"))
      .mockResolvedValue(undefined);
    const deps = makeDeps({ saveItem });

    const result = await restoreVault({
      masterPassword: "pw",
      filename: "backup.json",
      fileText: "{}",
      deps,
    });

    expect(result).toEqual({ ok: true, imported: 1 });
    expect(saveItem).toHaveBeenCalledTimes(2);
  });
});

describe("restoreVault — plain import and no-file paths", () => {
  it("routes a plain (non-encrypted) file through importItems", async () => {
    vi.mocked(importFromText).mockReturnValue({ result: { format: "bitwarden-json" }, items: [] } as never);
    const importItems = vi.fn(async () => ({ imported: 3 }));
    const deps = makeDeps({ importItems });

    const result = await restoreVault({
      masterPassword: "pw",
      filename: "import.json",
      fileText: "{}",
      deps,
    });

    expect(result).toEqual({ ok: true, imported: 3 });
    expect(deps.setupVault).toHaveBeenCalledWith("pw");
    expect(importItems).toHaveBeenCalledWith("import.json", "{}");
    expect(deps.createCustomVault).not.toHaveBeenCalled();
    expect(decryptLckedExport).not.toHaveBeenCalled();
  });

  it("just creates the vault when no file is given", async () => {
    const deps = makeDeps();

    const result = await restoreVault({
      masterPassword: "pw",
      filename: "",
      fileText: null,
      deps,
    });

    expect(result).toEqual({ ok: true, imported: 0 });
    expect(deps.setupVault).toHaveBeenCalledWith("pw");
    expect(importFromText).not.toHaveBeenCalled();
  });
});
