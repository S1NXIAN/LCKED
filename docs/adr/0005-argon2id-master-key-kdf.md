# Argon2id master-key derivation via libsodium WASM

The Master Password protects everything, so the function that turns it into
the Master Key is the single highest-leverage hardening target. PBKDF2-
HMAC-SHA256 at 600,000 iterations met OWASP's floor but is not memory-hard:
GPU/ASIC rigs parallelize it cheaply. Every newly created vault therefore
derives with Argon2id at 32 MiB / t=6 / p=1 — the memory the issue spec
chose, with a single lane because the derivation runs on the browser main
thread. This is not Bitwarden's parameter set (they ship 64 MiB / t=3 /
p=4); both sit inside OWASP's Argon2id guidance, ours trading memory for
more passes to suit main-thread timing. Parameters live behind the
parameter-driven `deriveMasterKey` seam in `src/lib/crypto.ts`.

**Amendment (2026-08-25, same day):** the legacy PBKDF2 path shipped with
this ADR was removed by owner decision — single-user deployment, no data
worth carrying across the cut. `resolveKdfParams` is gone; VaultMeta and
Backup envelopes require the Argon2id fields outright. Unlocking a
pre-Argon2id vault throws a clear "older version" error (reset to
continue), and pre-Argon2id Backup files decrypt as `corrupt`. Export a
fresh Backup with a compat-bearing build before upgrading past this
amendment.

## Library selection

Candidates evaluated against: maintained within ~6 months, permissive
license, lazy-loadable artifact, no eval-based instantiation. Status
asserted 2026-08-25 from primary repos/registries:

- **hash-wasm 4.12.0** — MIT; per-algorithm chunks (~few KB) are ideal;
  supports secret/associated-data inputs. Rejected: last release and last
  commit November 2024 (~21 months stale) — fails the maintenance gate.
- **libsodium.js (`libsodium-wrappers-sumo`) 0.8.4** — ISC; published April
  2026; maintained by an Argon2 co-author over the audited, decade-battle-
  tested C core; loads via dynamic `import()` only at unlock/setup/Backup
  moments; instantiates through WebAssembly.instantiate (no eval).
  **Selected.** The sumo build is required because `crypto_pwhash` is
  excluded from the standard build (~375 KB gz vs ~290 KB — paid lazily,
  never in the main bundle).
- **wasm-pack builds of phc-winner-argon2** — would mean vendoring and
  maintaining our own compiled artifact; worst supply-chain posture of the
  three. Rejected.

Two consequences of the choice, accepted deliberately:

- libsodium's `crypto_pwhash` fixes parallelism at one lane and cannot take
  a secret or associated data. Recorded `parallelism` values other than 1
  are rejected loudly rather than silently ignored, and the default is 1.
- The RFC 9106 §5.3 test vector uses secret + associated data, which that
  API surface cannot express. Conformance is instead anchored by fixtures
  generated independently with OpenSSL 3.6.3's ARGON2ID KDF and matched
  byte-for-byte against the bundled WASM (`crypto-kdf.test.ts`); OpenSSL
  itself reproduces the published phc-winner-argon2 reference vector
  (`09316115…`, t=2, m=64 MiB, p=1), chaining our anchors to the RFC 9106
  reference implementation.
  The final OpenSSL-to-published-vector link was verified manually once
  during development (not enforced by a fixture, since the reference
  vector's 8-byte salt is outside libsodium's pwhash surface); the repo's
  fixtures enforce the OpenSSL↔WASM link on every test run.

## Integration decisions

- `VaultMeta` and the Backup envelope carry `type`/`memory`/`parallelism`
  (`iterations` doubles as Argon2id's time cost t). Absent fields mean
  legacy PBKDF2, so old vaults keep unlocking and old Backups keep
  restoring without migration code.
- New Backups record an Argon2id `kdf` block; restore honors whatever the
  envelope recorded. Envelope format stays `lcked-encrypted-v1`.
- The derived key imports as non-extractable AES-GCM with
  `["encrypt", "decrypt"]` usages — verified against the existing seam:
  "wrapping" here is AES-GCM encrypt/decrypt of the exported Vault Key, so
  the spec's original wrapKey/unwrapKey usage idea was unnecessary and
  nothing above the derivation changed.
- If the WASM module fails to load, derivation throws a clear error; there
  is deliberately NO fallback to PBKDF2, which could only fail the verifier
  or silently weaken future derivations.
- CSP gains `'wasm-unsafe-eval'` (see ADR-0003).

## References

- OWASP Password Storage Cheat Sheet — Argon2id preferred; PBKDF2-SHA256
  600k as the floor for FIPS-constrained environments.
- Bitwarden KDF documentation — Argon2id defaults 64 MiB/t=3/p=4 (we pick
  32 MiB/t=6/p=1 for main-thread browser reality; same OWASP guidance).
- KeePassXC database security docs — Argon2 recommended over AES-KDF;
  ~1 s unlock budget informed our parameter check (measured ~0.9 s at
  t=6/m=32 MiB on low-end hardware).
