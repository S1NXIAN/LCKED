/**
 * LCKED — Password Generator
 * ---------------------------------------------------------------------------
 * Cryptographically secure (uses crypto.getRandomValues), with the standard
 * character-set toggles and "avoid ambiguous" option. Guarantees at least one
 * character from each enabled set when length permits.
 */

import type { GeneratorOptions } from "@/lib/types";
import { WORDLIST } from "@/lib/wordlist-eff";

const SETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/~",
};

// Characters that are easily confused visually.
const AMBIGUOUS = new Set("Il1O0o`'\"|");

// Reusable buffer for randomInt — avoids a per-call allocation.
const _u32 = new Uint32Array(1);

function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new RangeError("randomInt: maxExclusive must be > 0");
  // Rejection sampling to avoid modulo bias.
  const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
  for (;;) {
    crypto.getRandomValues(_u32);
    if (_u32[0] < limit) return _u32[0] % maxExclusive;
  }
}

function buildAlphabet(opts: GeneratorOptions): { alphabet: string; required: string[] } {
  let alphabet = "";
  const required: string[] = [];
  (["uppercase", "lowercase", "numbers", "symbols"] as const).forEach((key) => {
    if (!opts[key]) return;
    let set = SETS[key];
    if (opts.avoidAmbiguous) {
      set = [...set].filter((c) => !AMBIGUOUS.has(c)).join("");
    }
    alphabet += set;
    if (set.length) required.push(set);
  });
  // Fallback so we never generate from an empty alphabet.
  if (!alphabet) {
    alphabet = SETS.lowercase + SETS.numbers;
    required.length = 0;
    required.push(SETS.lowercase, SETS.numbers);
  }
  return { alphabet, required };
}

export function generatePassword(opts: GeneratorOptions): string {
  const { alphabet, required } = buildAlphabet(opts);
  const length = Math.max(1, Math.min(128, opts.length));

  const chars: string[] = [];
  // Guarantee one char from each enabled set (when length allows).
  for (let i = 0; i < required.length && chars.length < length; i++) {
    chars.push(required[i][randomInt(required[i].length)]);
  }
  // Fill the remainder uniformly from the full alphabet.
  while (chars.length < length) {
    chars.push(alphabet[randomInt(alphabet.length)]);
  }
  // Fisher–Yates shuffle so the guaranteed chars aren't front-loaded.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/* -------------------------- password strength ----------------------------- */

export interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4; // 0 worst, 4 best
  label: string;
  /** 0–100, used for the meter width. */
  percent: number;
  crackTime: string;
}

/**
 * Lightweight entropy-based strength estimator (zxcvbn is heavy for a local app).
 * Combines length × pool-size entropy with penalties for common patterns.
 */
export function estimateStrength(password: string): StrengthResult {
  if (!password) return { score: 0, label: "Empty", percent: 0, crackTime: "—" };

  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += 32;

  const entropy = password.length * Math.log2(pool || 1);

  // Penalise repetition and simple sequences.
  let penalty = 0;
  if (/(.)\1{2,}/.test(password)) penalty += 10; // aaa
  if (/(0123|1234|2345|3456|4567|5678|6789|abcd|qwe|asdf)/i.test(password)) penalty += 12;

  const effective = Math.max(0, entropy - penalty);
  // 10^11 guesses/sec assumption for crack-time phrasing.
  const guesses = Math.pow(2, effective);
  const seconds = guesses / 1e11;

  const crackTime = humanizeSeconds(seconds);

  let score: StrengthResult["score"] = 0;
  if (effective >= 28) score = 1;
  if (effective >= 45) score = 2;
  if (effective >= 60) score = 3;
  if (effective >= 80) score = 4;

  const labels = ["Very weak", "Weak", "Fair", "Strong", "Excellent"];
  const percent = Math.min(100, Math.round((effective / 90) * 100));

  return { score, label: labels[score], percent, crackTime };
}

function humanizeSeconds(seconds: number): string {
  if (seconds < 1) return "instant";
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`;
  const years = seconds / 31536000;
  if (years < 1000) return `${Math.round(years)} years`;
  if (years < 1e6) return `${Math.round(years / 1000)}k years`;
  if (years < 1e9) return `${Math.round(years / 1e6)}M years`;
  if (years < 1e12) return `${Math.round(years / 1e9)}B years`;
  return "astronomical time";
}

/** Generate a memorable passphrase from the 7776-word list (12.9 bits/word). */
export function generatePassphrase(words = 4, separator = "-"): string {
  const count = Math.max(1, Math.min(12, words));
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(WORDLIST[randomInt(WORDLIST.length)]);
  }
  return out.join(separator);
}
