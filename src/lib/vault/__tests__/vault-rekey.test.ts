/**
 * Change master password — the re-key promise.
 * ---------------------------------------------------------------------------
 * Changing the password re-wraps the same Vault Key under a new Master Key,
 * so after the session ends the new password alone unlocks the vault. Real
 * WebCrypto + Argon2id; only IndexedDB is faked, because persistence is the
 * store's seam, not auth's. Argon2id at ADR-0005 parameters needs headroom.
 */
import { describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 30_000 });

import { decryptJson, encryptJson } from "@/lib/crypto";
import type { VaultMeta } from "@/lib/types";
import {
  changeMasterPassword,
  createVault,
  unlockVault,
} from "@/lib/vault/vault-auth";

const meta = vi.hoisted(() => ({ current: null as VaultMeta | null }));

vi.mock("@/lib/vault/vault-db", () => ({
  saveVaultMeta: vi.fn(async (m: VaultMeta) => {
    meta.current = m;
  }),
  loadVaultMeta: vi.fn(async () => meta.current ?? undefined),
  loadAllStoredItems: vi.fn(async () => []),
  putStoredItem: vi.fn(async () => {}),
  deleteStoredItem: vi.fn(async () => {}),
  vaultExists: vi.fn(async () => meta.current !== null),
  wipeVault: vi.fn(async () => {}),
}));

describe("changeMasterPassword", () => {
  it("re-keys the vault: the new password unlocks it and the old one no longer does", async () => {
    const created = await createVault("old-password");
    const result = await changeMasterPassword(
      "old-password",
      "new-password",
      created.vaultKey,
    );

    expect(result).not.toBeNull();
    const unlocked = await unlockVault("new-password");
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) throw new Error("unlock failed");

    // The same vault key must survive, or every stored item is lost.
    const probe = await encryptJson({ ok: true }, created.vaultKey);
    await expect(
      decryptJson(probe.ciphertext, probe.iv, unlocked.vaultKey),
    ).resolves.toEqual({ ok: true });
    await expect(unlockVault("old-password")).resolves.toEqual({ ok: false });
  });
});
