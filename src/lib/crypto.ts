/**
 * LCKED — Cryptography Layer (Web Crypto API)
 * ---------------------------------------------------------------------------
 *   • Argon2id (32 MiB / t=6 / p=1) via lazily-loaded WASM to derive a
 *     master key from the master password, with the parameters recorded in
 *     the vault meta.
 *   • AES-256-GCM for authenticated encryption of every vault item.
 *
 * Key hierarchy:
 *   masterPassword ──KDF(params)──▶ masterKey  (non-extractable, in-memory only)
 *   random() ──────────────────▶ vaultKey      (256-bit, encrypts all items)
 *   vaultKey ──AES-GCM(masterKey)──▶ stored ciphertext (persisted in IndexedDB)
 *
 * This indirection means a future "change master password" only re-wraps the
 * vaultKey instead of re-encrypting the entire vault.
 */

import type * as sodiumWrappers from "libsodium-wrappers-sumo";

const IV_LENGTH = 12; // bytes (AES-GCM recommended)
const VERIFIER_TOKEN = "LCKED_VAULT_VALID";

/** Fully-resolved derivation parameters — what deriveMasterKey consumes and
 *  what VaultMeta/Backup envelopes persist. `iterations` is the Argon2id
 *  time cost t. */
export interface KdfParams {
  type: "Argon2id";
  iterations: number;
  /** Memory cost in KiB. */
  memory: number;
  /** Lanes; the WASM build executes a single lane. */
  parallelism: number;
}

/** Hardening defaults: 32 MiB of memory resists GPU/ASIC cracking while
 *  t=6/p=1 keeps unlock near one second on browser main threads, within
 *  OWASP's Argon2id guidance (Bitwarden ships 64 MiB / t=3 / p=4; see
 *  ADR-0005 for the parameter comparison). */
export const ARGON2ID_MEMORY_KIB = 32_768;
export const ARGON2ID_ITERATIONS = 6;
export const ARGON2ID_PARALLELISM = 1;

export const DEFAULT_KDF_PARAMS: KdfParams & { type: "Argon2id" } = {
  type: "Argon2id",
  iterations: ARGON2ID_ITERATIONS,
  memory: ARGON2ID_MEMORY_KIB,
  parallelism: ARGON2ID_PARALLELISM,
};

// Secure-context guard: Web Crypto is only available on HTTPS or localhost.
// Surfacing a clear error here beats a cryptic "Cannot read properties of
// undefined (reading 'subtle')" from deep inside a decrypt call.
if (typeof crypto === "undefined" || !crypto.subtle) {
  throw new Error(
    "LCKED requires the Web Crypto API, which is only available in a secure context (HTTPS or localhost).",
  );
}

/* ----------------------------- base64 helpers ----------------------------- */

const _CHUNK = 0x8000; // 32KB chunks — avoids the call-stack limit on fromCharCode.apply

export function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += _CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      view.subarray(i, i + _CHUNK) as unknown as number[],
    );
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  if (!b64) throw new Error("base64ToBytes: empty input");
  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    throw new Error("base64ToBytes: malformed base64 input");
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

export function randomId(): string {
  // Use crypto.randomUUID where available, fall back to random bytes.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // 17 bytes → 24 base64 chars; after stripping +/= we keep ≥22 chars.
  return bytesToBase64(randomBytes(17)).replace(/[+/=]/g, "").slice(0, 22);
}

/* ------------------------------ KDF / keys -------------------------------- */

/**
 * Derive the non-extractable master key from the master password, using the
 * derivation recorded in the vault meta (or Backup envelope). The raw password
 * is never stored; only this derived key lives in memory for the duration of
 * an unlocked session.
 */
export async function deriveMasterKey(
  password: string,
  saltBase64: string,
  params: KdfParams,
): Promise<CryptoKey> {
  if (!saltBase64) throw new Error("deriveMasterKey: salt is required");

  const tag = await deriveArgon2idRaw(
    password,
    base64ToBytes(saltBase64),
    params,
  );
  // slice(): hand WebCrypto a plain ArrayBuffer-backed view (the WASM build
  // returns an ArrayBufferLike-typed array). "Wrapping" a Vault Key in this
  // codebase is AES-GCM encrypt/decrypt of its exported raw bytes, which is
  // why the master key carries encrypt/decrypt usages.
  const raw = tag.slice();
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable: cannot be read out of memory
    ["encrypt", "decrypt"],
  );
}

/* ------------------------- Argon2id (lazy WASM) --------------------------- */

type Sodium = typeof sodiumWrappers;
// Loaded once per page on first Argon2id use (unlock / setup / Backup), so
// the main bundle never pays for it. Reset on failure so a transient load
// error can be retried with the next unlock attempt instead of caching it.
let sodiumPromise: Promise<Sodium> | null = null;

function loadSodium(): Promise<Sodium> {
  sodiumPromise ??= import("libsodium-wrappers-sumo")
    .then(async (module) => {
      // Interop varies by bundler: ESM builds expose the wrappers object as
      // `default`, while CJS consumers receive the namespace itself.
      const sodium: Sodium =
        "default" in module ? ((module.default ?? module) as Sodium) : module;
      await sodium.ready;
      return sodium;
    })
    .catch((err) => {
      sodiumPromise = null;
      // Deliberately NOT falling back to PBKDF2: deriving a weaker key than
      // the one the vault was created with would just fail the verifier —
      // and silently weakening future derivations would be worse. Fail loudly.
      throw new Error(
        "The Argon2id module failed to load. Check your connection on first load, then reload the page.",
        { cause: err instanceof Error ? err : undefined },
      );
    });
  return sodiumPromise;
}

/**
 * Run Argon2id over the password and return the raw 32-byte tag. Exported as
 * the conformance seam: unit tests pin this output to independently generated
 * RFC 9106 reference vectors.
 */
export async function deriveArgon2idRaw(
  password: string,
  salt: Uint8Array,
  params: KdfParams,
): Promise<Uint8Array> {
  if (params.parallelism !== ARGON2ID_PARALLELISM)
    throw new Error(
      `deriveMasterKey: parallelism ${params.parallelism} is not supported by the browser Argon2id build; record parallelism ${ARGON2ID_PARALLELISM}.`,
    );
  if (salt.length !== 16)
    throw new Error("deriveMasterKey: Argon2id requires a 16-byte salt");

  const sodium = await loadSodium();
  return sodium.crypto_pwhash(
    32,
    password,
    salt,
    params.iterations,
    params.memory * 1024, // libsodium takes bytes; meta stores KiB
    sodium.crypto_pwhash_ALG_ARGON2ID13,
    "uint8array",
  );
}

/** Generate a fresh, extractable 256-bit vault key. */
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable so we can wrap it with the master key
    ["encrypt", "decrypt"],
  );
}

/** Wrap (encrypt) the vault key with the master key for persistent storage. */
export async function wrapVaultKey(
  vaultKey: CryptoKey,
  masterKey: CryptoKey,
): Promise<{ ciphertext: string; iv: string }> {
  const raw = await crypto.subtle.exportKey("raw", vaultKey);
  const iv = randomBytes(IV_LENGTH);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    raw,
  );
  return { ciphertext: bytesToBase64(encrypted), iv: bytesToBase64(iv) };
}

/** Unwrap (decrypt) the vault key using the master key. Throws on wrong key. */
export async function unwrapVaultKey(
  ciphertextBase64: string,
  ivBase64: string,
  masterKey: CryptoKey,
): Promise<CryptoKey> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivBase64) },
    masterKey,
    base64ToBytes(ciphertextBase64),
  );
  // NOTE: the vault key MUST be importable as extractable so that
  // `wrapVaultKey` (which calls `exportKey("raw", vaultKey)`) succeeds when
  // the user changes their master password. The master key stays
  // non-extractable; only the vault key needs to be re-exportable for
  // re-wrapping. An attacker with JS execution can already call encrypt/
  // decrypt with the key — non-extractability is a devtools-guard, not a
  // real security boundary.
  return crypto.subtle.importKey(
    "raw",
    decrypted,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/* --------------------------- verifier (unlock) ---------------------------- */

/**
 * Build the unlock verifier: AES-GCM of a known plaintext using the master key.
 * On unlock we attempt to decrypt this; success ⇒ correct password.
 */
export async function buildVerifier(masterKey: CryptoKey): Promise<{
  verifier: string;
  verifierIv: string;
  verifierToken: string;
}> {
  const enc = new TextEncoder();
  const iv = randomBytes(IV_LENGTH);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    enc.encode(VERIFIER_TOKEN),
  );
  return {
    verifier: bytesToBase64(encrypted),
    verifierIv: bytesToBase64(iv),
    verifierToken: VERIFIER_TOKEN,
  };
}

/** Returns true iff the master key correctly decrypts the verifier. */
export async function checkVerifier(
  masterKey: CryptoKey,
  verifier: string,
  verifierIv: string,
  verifierToken: string,
): Promise<boolean> {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(verifierIv) },
      masterKey,
      base64ToBytes(verifier),
    );
    const decoded = new TextDecoder().decode(decrypted);
    return decoded === verifierToken;
  } catch {
    return false;
  }
}

/* ----------------------------- item encrypt ------------------------------- */

export async function encryptJson(
  data: unknown,
  vaultKey: CryptoKey,
): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder();
  const iv = randomBytes(IV_LENGTH);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    vaultKey,
    enc.encode(JSON.stringify(data)),
  );
  return { ciphertext: bytesToBase64(encrypted), iv: bytesToBase64(iv) };
}

export async function decryptJson<T = unknown>(
  ciphertextBase64: string,
  ivBase64: string,
  vaultKey: CryptoKey,
): Promise<T> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivBase64) },
    vaultKey,
    base64ToBytes(ciphertextBase64),
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

export { IV_LENGTH, VERIFIER_TOKEN };
