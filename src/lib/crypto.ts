/**
 * LCKED — Cryptography Layer (Web Crypto API)
 * ---------------------------------------------------------------------------
 * 100% client-side. Uses:
 *   • PBKDF2-SHA256 (600k iterations) to derive a master key from the password.
 *   • AES-256-GCM for authenticated encryption of every vault item.
 *
 * Key hierarchy:
 *   masterPassword ──PBKDF2──▶ masterKey   (non-extractable, in-memory only)
 *   random() ───────────────▶ vaultKey     (256-bit, encrypts all items)
 *   vaultKey ──AES-GCM(masterKey)──▶ stored ciphertext (persisted in IndexedDB)
 *
 * This indirection means a future "change master password" only re-wraps the
 * vaultKey instead of re-encrypting the entire vault.
 */

const PBKDF2_ITERATIONS = 600_000;
const IV_LENGTH = 12; // bytes (AES-GCM recommended)
const VERIFIER_TOKEN = "LCKED_VAULT_VALID";

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
    binary += String.fromCharCode.apply(null, view.subarray(i, i + _CHUNK) as unknown as number[]);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
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

export function randomBytes(length: number): Uint8Array {
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
 * Derive the non-extractable master key from the master password.
 * The raw password is never stored; only this derived key lives in memory
 * for the duration of an unlocked session.
 */
export async function deriveMasterKey(
  password: string,
  saltBase64: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  if (!saltBase64) throw new Error("deriveMasterKey: salt is required");
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBytes(saltBase64),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable: cannot be read out of memory
    ["encrypt", "decrypt"],
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
  return crypto.subtle.importKey("raw", decrypted, { name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
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

export { PBKDF2_ITERATIONS, IV_LENGTH, VERIFIER_TOKEN };
