// lib/crypto.js
// Zero-knowledge crypto layer for the LCKED extension.
//
//   * Master key:    PBKDF2-SHA256, 600,000 iterations, 32-byte salt, 256-bit output
//   * Vault cipher:  AES-256-GCM, 96-bit random IV per record
//   * Session key:   raw 256-bit key in chrome.storage.session (in-memory only,
//                    cleared when the browser closes)
//
// All functions are async and Web-Crypto-based — no external dependencies.

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 32; // 256-bit
const IV_BYTES = 12; // 96-bit (GCM standard)
const KEY_BITS = 256;

// ---- storage keys -------------------------------------------------------

const SALT_KEY = "lcked_vault_salt"; // chrome.storage.local
const VERIFIER_KEY = "lcked_vault_verifier"; // chrome.storage.local
const SESSION_KEY = "lcked_session_key"; // chrome.storage.session
const SESSION_IV_KEY = "lcked_session_key_iv"; // chrome.storage.session

// ---- tiny promise wrappers ---------------------------------------------

function storageGetLocal(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(items || {});
    });
  });
}

function storageSetLocal(patch) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(patch, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(true);
    });
  });
}

function storageGetSession(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.session.get(keys, (items) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(items || {});
    });
  });
}

function storageSetSession(patch) {
  return new Promise((resolve, reject) => {
    chrome.storage.session.set(patch, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(true);
    });
  });
}

function storageRemoveSession(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.session.remove(keys, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(true);
    });
  });
}

// ---- base64 helpers (binary-safe) ---------------------------------------

export function bytesToB64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ---- salt + verifier ----------------------------------------------------

/** Generate or load the per-user 32-byte salt (persisted in local storage). */
export async function getOrCreateSalt() {
  const items = await storageGetLocal([SALT_KEY]);
  if (items[SALT_KEY]) return b64ToBytes(items[SALT_KEY]);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  await storageSetLocal({ [SALT_KEY]: bytesToB64(salt) });
  return salt;
}

/** Wipe salt + verifier (called on full reset). */
export async function clearVaultCrypto() {
  await storageSetLocal({ [SALT_KEY]: null, [VERIFIER_KEY]: null });
  await chrome.storage.local.remove([SALT_KEY, VERIFIER_KEY]);
  await clearSessionKey();
}

// ---- master key derivation ---------------------------------------------

/**
 * Derive a 256-bit AES-GCM master key from the master password.
 * Key is extractable so it can be persisted to chrome.storage.session as raw
 * bytes (the session store only accepts JSON-serializable values).
 *
 * @param {string} masterPassword
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
export async function deriveMasterKey(masterPassword, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(masterPassword),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: KEY_BITS },
    true, // extractable: needed so we can stash the raw key in session storage
    ["encrypt", "decrypt"]
  );
}

/**
 * Build the verifier envelope (encrypted constant). Stored in local storage
 * so future unlock attempts can confirm the password is correct without
 * keeping plaintext around.
 *
 * @param {CryptoKey} key
 */
export async function buildVerifier(key) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode("lcked-verifier-v1")
  );
  await storageSetLocal({
    [VERIFIER_KEY]: JSON.stringify({
      cipher: bytesToB64(new Uint8Array(cipher)),
      iv: bytesToB64(iv),
    }),
  });
}

/** Returns true if the derived key successfully decrypts the verifier. */
export async function verifyMasterKey(key) {
  const items = await storageGetLocal([VERIFIER_KEY]);
  if (!items[VERIFIER_KEY]) return true; // first-run: no verifier yet
  try {
    const env = JSON.parse(items[VERIFIER_KEY]);
    const iv = b64ToBytes(env.iv);
    const cipher = b64ToBytes(env.cipher);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    const txt = new TextDecoder().decode(plain);
    return txt === "lcked-verifier-v1";
  } catch {
    return false;
  }
}

// ---- session key --------------------------------------------------------

/**
 * Persist a derived master key into chrome.storage.session (in-memory only).
 * The raw 256-bit bytes are stored; on read we re-import them as an AES-GCM
 * CryptoKey.
 */
export async function storeSessionKey(cryptoKey) {
  const raw = await crypto.subtle.exportKey("raw", cryptoKey);
  const bytes = new Uint8Array(raw);
  // We also stash a per-session IV just so encryption is unique each unlock;
  // not strictly required since we generate a fresh IV per call.
  await storageSetSession({
    [SESSION_KEY]: bytesToB64(bytes),
    [SESSION_IV_KEY]: bytesToB64(crypto.getRandomValues(new Uint8Array(IV_BYTES))),
  });
}

/** Return the session AES-GCM CryptoKey, or null if vault is locked. */
export async function getSessionKey() {
  const items = await storageGetSession([SESSION_KEY]);
  if (!items[SESSION_KEY]) return null;
  const raw = b64ToBytes(items[SESSION_KEY]);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: KEY_BITS },
    true,
    ["encrypt", "decrypt"]
  );
}

/** Wipe the session key — locks the vault immediately. */
export async function clearSessionKey() {
  await storageRemoveSession([SESSION_KEY, SESSION_IV_KEY]);
}

/** True when a session key is present (vault is unlocked). */
export async function hasSessionKey() {
  const items = await storageGetSession([SESSION_KEY]);
  return Boolean(items[SESSION_KEY]);
}

// ---- encrypt / decrypt JSON --------------------------------------------

/**
 * Encrypt any JSON-serialisable object.
 * @returns {Promise<{cipher: string, iv: string}>} both base64
 */
export async function encryptJson(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder();
  const plain = enc.encode(JSON.stringify(obj));
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return {
    cipher: bytesToB64(new Uint8Array(cipherBuf)),
    iv: bytesToB64(iv),
  };
}

/**
 * Decrypt a {cipher, iv} envelope back into a JS object.
 * @throws if the key is wrong or the data is corrupt (GCM tag mismatch).
 */
export async function decryptJson(cipherB64, ivB64, key) {
  const iv = b64ToBytes(ivB64);
  const cipher = b64ToBytes(cipherB64);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  const txt = new TextDecoder().decode(plainBuf);
  return JSON.parse(txt);
}

export const CRYPTO_CONFIG = {
  pbkdf2Iterations: PBKDF2_ITERATIONS,
  saltBytes: SALT_BYTES,
  ivBytes: IV_BYTES,
  keyBits: KEY_BITS,
};
