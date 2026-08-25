/**
 * LCKED — Vault Auth Lifecycle
 * ---------------------------------------------------------------------------
 * Pure auth functions extracted from the Zustand store. No zustand dependency.
 * Each function is a complete auth operation that may read/write IndexedDB
 * (via vault-db.ts) but never touches React or zustand state directly.
 *
 * The caller (the store) applies returned state fragments via set().
 */

import {
  buildVerifier,
  bytesToBase64,
  checkVerifier,
  decryptJson,
  DEFAULT_KDF_PARAMS,
  deriveMasterKey,
  encryptJson,
  generateVaultKey,
  type KdfParams,
  randomBytes,
  resolveKdfParams,
  unwrapVaultKey,
  VERIFIER_TOKEN,
  wrapVaultKey,
} from "@/lib/crypto";
import type { LckedExport } from "@/lib/import";
import { loadDecryptedItems } from "@/lib/items/item-loader";
import type {
  VaultDef,
  VaultItem,
  VaultMeta,
  VaultSettings,
} from "@/lib/types";
import { DEFAULT_VAULT_SETTINGS } from "@/lib/types";
import { loadVaultMeta, saveVaultMeta } from "@/lib/vault/vault-db";

/* ─── Types ─────────────────────────────────────────────── */

export interface AuthSession {
  masterKey: CryptoKey;
  vaultKey: CryptoKey;
  masterPassword: string;
}

export interface VaultData {
  items: VaultItem[];
  vaults: VaultDef[];
  settings: VaultSettings;
}

export type CreateVaultResult = AuthSession & VaultData & { kdf: KdfParams };

export type UnlockResult =
  | (AuthSession & VaultData & { kdf: KdfParams } & { ok: true })
  | {
      ok: false;
    };

export interface ClearSessionResult {
  masterKey: null;
  vaultKey: null;
}

export interface ChangePasswordOk {
  masterKey: CryptoKey;
}

/* ─── Implementation ────────────────────────────────────── */

/**
 * Create a brand-new vault. Generates all keys, builds the verifier, persists
 * the vault meta to IndexedDB, and returns the session + empty vault data.
 *
 * Called from setup-view.tsx — the store applies the returned state fragment
 * and wires up the sync engine.
 */
export async function createVault(
  masterPassword: string,
): Promise<CreateVaultResult> {
  const salt = bytesToBase64(randomBytes(16));
  const masterKey = await deriveMasterKey(
    masterPassword,
    salt,
    DEFAULT_KDF_PARAMS,
  );
  const vaultKey = await generateVaultKey();
  const { ciphertext, iv } = await wrapVaultKey(vaultKey, masterKey);
  const verifier = await buildVerifier(masterKey);

  const meta: VaultMeta = {
    id: "singleton",
    salt,
    ...DEFAULT_KDF_PARAMS,
    encryptedVaultKey: ciphertext,
    vaultKeyIv: iv,
    verifier: verifier.verifier,
    verifierIv: verifier.verifierIv,
    verifierToken: verifier.verifierToken,
    createdAt: Date.now(),
    settings: DEFAULT_VAULT_SETTINGS,
    vaults: [],
  };
  await saveVaultMeta(meta);

  return {
    masterKey,
    vaultKey,
    masterPassword,
    items: [],
    vaults: [],
    settings: DEFAULT_VAULT_SETTINGS,
    kdf: DEFAULT_KDF_PARAMS,
  };
}

/**
 * Unlock an existing vault. Reads the vault meta, verifies the master
 * password, decrypts every stored item (with migration + TTL cleanup),
 * and returns the session + decrypted vault data.
 *
 * Returns `{ ok: false }` if the password is wrong or no vault exists.
 */
export async function unlockVault(
  masterPassword: string,
): Promise<UnlockResult> {
  const meta = await loadVaultMeta();
  if (!meta) return { ok: false };

  const params = resolveKdfParams(meta);
  const masterKey = await deriveMasterKey(masterPassword, meta.salt, params);
  const ok = await checkVerifier(
    masterKey,
    meta.verifier,
    meta.verifierIv,
    meta.verifierToken,
  );
  if (!ok) return { ok: false };

  const vaultKey = await unwrapVaultKey(
    meta.encryptedVaultKey,
    meta.vaultKeyIv,
    masterKey,
  );

  // Item policy lives in the item domain: decrypt, migrate legacy records,
  // purge expired Trash. Auth only answers "is this the Master Password?".
  const items = await loadDecryptedItems(vaultKey);

  const vaults: VaultDef[] = Array.isArray(meta.vaults) ? meta.vaults : [];

  return {
    ok: true,
    masterKey,
    vaultKey,
    masterPassword,
    vaults,
    settings: { ...DEFAULT_VAULT_SETTINGS, ...meta.settings },
    items,
    kdf: params,
  };
}

/**
 * Clear the crypto session. Returns the state fragment for lock: both keys
 * set to null. UI state reset is handled by the store.
 */
export function clearSession(): ClearSessionResult {
  return { masterKey: null, vaultKey: null };
}

/**
 * Change the master password. Verifies the current password, generates a new
 * salt + master key, re-wraps the SAME vault key (no item re-encryption
 * needed), and persists the updated meta.
 *
 * @param current - current master password
 * @param next    - new master password
 * @param vaultKey - the current vault key (must be held in memory)
 * @returns the new master key, or null if verification fails / meta missing
 */
export async function changeMasterPassword(
  current: string,
  next: string,
  vaultKey: CryptoKey,
): Promise<ChangePasswordOk | null> {
  const meta = await loadVaultMeta();
  if (!meta) return null;

  const currentKey = await deriveMasterKey(
    current,
    meta.salt,
    resolveKdfParams(meta),
  );
  const ok = await checkVerifier(
    currentKey,
    meta.verifier,
    meta.verifierIv,
    meta.verifierToken,
  );
  if (!ok) return null;

  const newSalt = bytesToBase64(randomBytes(16));
  // Keep the recorded KDF: a password change re-keys, it never silently
  // migrates the vault to a different derivation.
  const params = resolveKdfParams(meta);
  const newMasterKey = await deriveMasterKey(next, newSalt, params);
  const wrapped = await wrapVaultKey(vaultKey, newMasterKey);
  const verifier = await buildVerifier(newMasterKey);

  await saveVaultMeta({
    ...meta,
    salt: newSalt,
    iterations: params.iterations,
    encryptedVaultKey: wrapped.ciphertext,
    vaultKeyIv: wrapped.iv,
    verifier: verifier.verifier,
    verifierIv: verifier.verifierIv,
    verifierToken: verifier.verifierToken,
  });

  return { masterKey: newMasterKey };
}

/**
 * Build an encrypted export envelope. Derives an export key from the given
 * password, wraps a fresh vault key, encrypts the items+vaults payload, and
 * returns the serialised JSON envelope.
 */
export async function exportEncrypted(
  items: VaultItem[],
  vaults: VaultDef[],
  password: string,
): Promise<string> {
  const salt = bytesToBase64(randomBytes(16));
  const exportMasterKey = await deriveMasterKey(
    password,
    salt,
    DEFAULT_KDF_PARAMS,
  );
  const exportVaultKey = await generateVaultKey();
  const verifier = await buildVerifier(exportMasterKey);
  const wrapped = await wrapVaultKey(exportVaultKey, exportMasterKey);

  const payload = { items, vaults };
  const { ciphertext: dataCipher, iv: dataIv } = await encryptJson(
    payload,
    exportVaultKey,
  );

  const envelope: LckedExport = {
    format: "lcked-encrypted-v1",
    version: 1,
    exportedAt: Date.now(),
    salt,
    iterations: DEFAULT_KDF_PARAMS.iterations,
    kdf: {
      type: DEFAULT_KDF_PARAMS.type,
      memory: DEFAULT_KDF_PARAMS.memory,
      parallelism: DEFAULT_KDF_PARAMS.parallelism,
    },
    verifier: verifier.verifier,
    verifierIv: verifier.verifierIv,
    wrappedVaultKey: wrapped.ciphertext,
    wrappedVaultKeyIv: wrapped.iv,
    data: dataCipher,
    dataIv,
  };
  return JSON.stringify(envelope, null, 2);
}

/** Result of decrypting an LCKED encrypted-export envelope: the decrypted
 *  payload, or a failure that distinguishes a wrong password from a
 *  damaged/foreign file (so callers can say exactly which one failed). */
export type LckedDecryptResult =
  | { ok: true; items: VaultItem[]; vaults: VaultDef[] }
  | { ok: false; reason: "wrong-password" | "corrupt" };

/**
 * Decrypt an LCKED encrypted-export envelope (produced by `exportEncrypted`).
 * A failed verifier check means the password is wrong; any throw during key
 * derivation / unwrap / data decryption means the envelope is corrupt.
 */
export async function decryptLckedExport(
  envelope: LckedExport,
  password: string,
): Promise<LckedDecryptResult> {
  if (envelope.format !== "lcked-encrypted-v1")
    return { ok: false, reason: "corrupt" };
  try {
    const exportMasterKey = await deriveMasterKey(
      password,
      envelope.salt,
      resolveKdfParams({ ...envelope.kdf, iterations: envelope.iterations }),
    );
    const ok = await checkVerifier(
      exportMasterKey,
      envelope.verifier,
      envelope.verifierIv,
      VERIFIER_TOKEN,
    );
    if (!ok) return { ok: false, reason: "wrong-password" };
    const exportVaultKey = await unwrapVaultKey(
      envelope.wrappedVaultKey,
      envelope.wrappedVaultKeyIv,
      exportMasterKey,
    );
    const payload = await decryptJson<{
      items: VaultItem[];
      vaults: VaultDef[];
    }>(envelope.data, envelope.dataIv, exportVaultKey);
    return { ok: true, items: payload.items, vaults: payload.vaults };
  } catch (err) {
    console.error("decryptLckedExport: corrupted envelope", err);
    return { ok: false, reason: "corrupt" };
  }
}
