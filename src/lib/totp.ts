/**
 * LCKED — TOTP (RFC 6238) generator
 * ---------------------------------------------------------------------------
 * Pure Web Crypto HMAC-SHA1/SHA256/SHA512. Supports base32 secrets with
 * optional spaces / hyphens and padding fix-up. Honours `digits`, `period`,
 * and `algorithm` parsed from otpauth:// URIs (defaults: 6 digits, 30s,
 * SHA-1). Returns the code plus seconds-until-rotate.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decode a base32 string to bytes. Strips spaces, hyphens, and padding. */
export function base32Decode(secret: string): Uint8Array<ArrayBuffer> {
  const cleaned = secret.replace(/[\s-]/g, "").toUpperCase().replace(/=+$/, "");
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue; // ignore stray chars
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

type TotpAlgorithm = "SHA-1" | "SHA-256" | "SHA-512";

async function hmac(
  key: Uint8Array<ArrayBuffer>,
  message: Uint8Array<ArrayBuffer>,
  algorithm: TotpAlgorithm,
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, message);
}

export interface TotpParams {
  /** Raw base32 secret. */
  secret: string;
  /** Number of digits (6–8). Default 6. */
  digits: number;
  /** Step period in seconds. Default 30. */
  period: number;
  /** HMAC algorithm. Default SHA-1. */
  algorithm: TotpAlgorithm;
}

export interface TotpCode {
  code: string;
  /** Seconds remaining before the code rotates (0–period). */
  remaining: number;
  /** 0–1 progress for the circular indicator. */
  progress: number;
}

/** Parse an otpauth:// URI into structured TOTP params. */
export function parseOtpauthUri(uri: string): TotpParams | null {
  try {
    const url = new URL(uri);
    const secret = url.searchParams.get("secret");
    if (!secret) return null;
    const digitsRaw = url.searchParams.get("digits");
    const periodRaw = url.searchParams.get("period");
    const algorithmRaw = url.searchParams.get("algorithm")?.toUpperCase();
    const digits =
      digitsRaw &&
      /^\d+$/.test(digitsRaw) &&
      Number(digitsRaw) >= 6 &&
      Number(digitsRaw) <= 8
        ? Number(digitsRaw)
        : 6;
    const period =
      periodRaw &&
      /^\d+$/.test(periodRaw) &&
      Number(periodRaw) > 0 &&
      Number(periodRaw) <= 600
        ? Number(periodRaw)
        : 30;
    const algorithm: TotpAlgorithm =
      algorithmRaw === "SHA256"
        ? "SHA-256"
        : algorithmRaw === "SHA512"
          ? "SHA-512"
          : "SHA-1";
    return { secret, digits, period, algorithm };
  } catch {
    return null;
  }
}

/** Resolve a raw secret string (which may be an otpauth:// URI) into params. */
export function resolveTotpParams(raw: string): TotpParams | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith("otpauth://")) {
    return parseOtpauthUri(trimmed);
  }
  return { secret: trimmed, digits: 6, period: 30, algorithm: "SHA-1" };
}

export async function generateTotp(
  secretOrParams: string | TotpParams,
  atSeconds?: number,
): Promise<TotpCode | null> {
  const params =
    typeof secretOrParams === "string"
      ? resolveTotpParams(secretOrParams)
      : secretOrParams;
  if (!params || !params.secret) return null;
  const key = base32Decode(params.secret);
  if (key.length === 0) return null;

  const period = params.period;
  const now = Math.floor((atSeconds ?? Date.now()) / 1000);
  const counter = Math.floor(now / period);
  const remaining = period - (now % period);

  // 8-byte big-endian counter.
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter & 0xffffffff);

  const signature = await hmac(key, new Uint8Array(buffer), params.algorithm);
  const bytes = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226).
  const offset = bytes[bytes.length - 1] & 0x0f;
  const binary =
    ((bytes[offset] & 0x7f) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff);

  const modulus = Math.pow(10, params.digits);
  const code = (binary % modulus).toString().padStart(params.digits, "0");
  return { code, remaining, progress: remaining / period };
}

/** Heuristic: does this string look like a base32 TOTP secret or an otpauth URL? */
export function looksLikeTotp(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("otpauth://")) return true;
  const cleaned = value.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z2-7]+=*$/.test(cleaned) && cleaned.length >= 16;
}
