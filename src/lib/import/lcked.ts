/**
 * LCKED — LCKED encrypted export parser
 * ---------------------------------------------------------------------------
 * Handles the LCKED native encrypted export format. Actual decryption is
 * deferred to the store layer (needs the export password).
 */

import type { ImportResult } from "@/lib/types";

/** Encrypted export envelope — the only safe round-trip format.
 *
 *   - salt + iterations + kdf + verifier: derive + check the export master
 *     key. `kdf` records which derivation produced it; absent on Backups made
 *     before Argon2id (those are PBKDF2 @ `iterations`).
 *   - wrappedVaultKey + wrappedVaultKeyIv: the export vault key, AES-GCM-wrapped
 *     with the export master key. Hoisted to the TOP LEVEL so decryption is
 *     possible.
 *   - data + dataIv: { items, vaults } encrypted with the export vault key. */
export interface LckedExport {
  format: "lcked-encrypted-v1";
  version: 1;
  exportedAt: number;
  salt: string;
  iterations: number;
  /** Absent ⇒ the envelope predates Argon2id and is PBKDF2. */
  kdf?: ExportKdf;
  verifier: string;
  verifierIv: string;
  wrappedVaultKey: string;
  wrappedVaultKeyIv: string;
  data: string;
  dataIv: string;
}

/** KDF provenance recorded by Backup producers. `iterations` stays on the
 *  envelope top level (PBKDF2 rounds, or Argon2id time cost t) so legacy
 *  envelopes keep their shape; this block adds only Argon2id's parameters. */
export interface ExportKdf {
  type: "Argon2id";
  /** Memory cost in KiB. */
  memory: number;
  parallelism: number;
}

/** Parse an encrypted LCKED export back into its raw envelope (not yet decrypted). */
export function parseLckedJson(text: string): ImportResult {
  const result: ImportResult = { imported: 0, skipped: 0, warnings: [] };
  try {
    const data = JSON.parse(text);
    if (data.format !== "lcked-encrypted-v1") {
      result.warnings.push("Not a recognised LCKED export.");
      return result;
    }
    result.format = "lcked-json";
    result.raw = data;
  } catch {
    result.warnings.push("File is not valid JSON.");
  }
  return result;
}
