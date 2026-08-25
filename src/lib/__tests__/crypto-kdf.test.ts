/**
 * Direct unit coverage at the crypto seam — real WebCrypto, real Argon2id
 * WASM (no mocks). Conformance fixtures were generated independently with
 * OpenSSL 3.6.3 (`openssl kdf … ARGON2ID`) and matched byte-for-byte against
 * the bundled libsodium build. OpenSSL itself reproduces the published
 * phc-winner-argon2 reference vector (t=2, m=64 MiB, p=1, pwd="password",
 * salt="somesalt" → 09316115…), chaining these anchors to the RFC 9106
 * reference implementation. The reference suites use 8-byte salts, which the
 * libsodium pwhash surface cannot accept (fixed 16-byte salt), so anchors
 * below use 16-byte salts instead.
 */
import { describe, expect, it } from "vitest";

import {
  ARGON2ID_ITERATIONS,
  ARGON2ID_MEMORY_KIB,
  ARGON2ID_PARALLELISM,
  buildVerifier,
  bytesToBase64,
  checkVerifier,
  decryptJson,
  deriveArgon2idRaw,
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

const te = new TextEncoder();

/* ─── Conformance ────────────────────────────────────────── */

describe("deriveArgon2idRaw conformance", () => {
  // [password, salt, t, memKiB, expected tag]
  const cases: Array<[string, string, number, number, string]> = [
    [
      "password",
      "somesalt00000000",
      2,
      65536,
      "374050d1e7d893c44ddbc031cd5f1c25eed510b5d7a66df663ff3c15f146118c",
    ],
    [
      "correct horse battery staple",
      "0123456789abcdef",
      ARGON2ID_ITERATIONS,
      ARGON2ID_MEMORY_KIB,
      "def9890b6da675cf25b52af7b16b47a4f4af817d0c753a09119aceb8a368f924",
    ],
    [
      "x",
      "aaaaaaaaaaaaaaaa",
      2,
      16384,
      "c5196fcc0d4d5e37e7a865183c834d1bff0b762f84f981f39786392470d01993",
    ],
  ];

  it.each(cases)(
    "matches the independent anchor (%s, t=%i, m=%i)",
    async (pw, salt, t, memKiB, expected) => {
      const tag = await deriveArgon2idRaw(pw, te.encode(salt), {
        type: "Argon2id",
        iterations: t,
        memory: memKiB,
        parallelism: 1,
      });
      expect(
        Array.from(tag)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      ).toBe(expected);
    },
  );

  it("rejects salts whose length differs from 16 bytes", async () => {
    await expect(
      deriveArgon2idRaw("pw", te.encode("short"), {
        type: "Argon2id",
        iterations: 6,
        memory: 32768,
        parallelism: 1,
      }),
    ).rejects.toThrow(/16-byte salt/i);
  });

  it("rejects parallelism the browser build cannot honour", async () => {
    await expect(
      deriveArgon2idRaw("pw", te.encode("aaaaaaaaaaaaaaaa"), {
        type: "Argon2id",
        iterations: 6,
        memory: 32768,
        parallelism: 2,
      }),
    ).rejects.toThrow(/parallelism/i);
  });
});

/* ─── Master-key seam ────────────────────────────────────── */

const argon2Params: KdfParams = {
  type: "Argon2id",
  iterations: ARGON2ID_ITERATIONS,
  memory: ARGON2ID_MEMORY_KIB,
  parallelism: ARGON2ID_PARALLELISM,
};

describe("resolveKdfParams", () => {
  it("treats absent fields as legacy PBKDF2", () => {
    expect(resolveKdfParams({})).toEqual({
      type: "PBKDF2",
      iterations: 600_000,
      memory: 0,
      parallelism: 0,
    });
  });

  it("passes recorded Argon2id parameters through", () => {
    expect(
      resolveKdfParams({
        type: "Argon2id",
        iterations: 4,
        memory: 65536,
        parallelism: 1,
      }),
    ).toEqual({
      type: "Argon2id",
      iterations: 4,
      memory: 65536,
      parallelism: 1,
    });
  });
});

describe("deriveMasterKey", () => {
  it("returns a non-extractable AES-GCM key usable only for wrapping", async () => {
    const salt = bytesToBase64(randomBytes(16));
    const key = await deriveMasterKey("pass", salt, argon2Params);
    expect(key.algorithm.name).toBe("AES-GCM");
    expect(key.extractable).toBe(false);
    expect(key.usages).toEqual(["encrypt", "decrypt"]);
  });

  it("derives the same key from the same password and salt", async () => {
    const salt = bytesToBase64(randomBytes(16));
    const a = await deriveMasterKey("same", salt, argon2Params);
    const b = await deriveMasterKey("same", salt, argon2Params);
    const payload = { secret: 42 };
    const vaultKey = await generateVaultKey();
    const wrapped = await wrapVaultKey(vaultKey, a);
    const unwrapped = await unwrapVaultKey(wrapped.ciphertext, wrapped.iv, b);
    const round = await encryptJson(payload, unwrapped);
    await expect(
      decryptJson(round.ciphertext, round.iv, unwrapped),
    ).resolves.toEqual(payload);
  });

  it("still derives via PBKDF2 when the params say so", async () => {
    const salt = bytesToBase64(randomBytes(16));
    const key = await deriveMasterKey("legacy", salt, {
      type: "PBKDF2",
      iterations: 600_000,
      memory: 0,
      parallelism: 0,
    });
    expect(key.usages).toEqual(["encrypt", "decrypt"]);
    const verifier = await buildVerifier(key);
    await expect(
      checkVerifier(
        key,
        verifier.verifier,
        verifier.verifierIv,
        VERIFIER_TOKEN,
      ),
    ).resolves.toBe(true);
  });
});

/* ─── External behaviour: unlock-shaped round trip ──────── */

describe("key hierarchy under Argon2id", () => {
  it("wraps and unwraps a Vault Key; the verifier proves the password", async () => {
    const salt = bytesToBase64(randomBytes(16));
    const masterKey = await deriveMasterKey(
      "correct horse battery staple",
      salt,
      argon2Params,
    );
    const verifier = await buildVerifier(masterKey);
    const vaultKey = await generateVaultKey();
    const wrapped = await wrapVaultKey(vaultKey, masterKey);

    // Unlock replay: same password derives a key that passes the verifier…
    const unlockKey = await deriveMasterKey(
      "correct horse battery staple",
      salt,
      argon2Params,
    );
    await expect(
      checkVerifier(
        unlockKey,
        verifier.verifier,
        verifier.verifierIv,
        verifier.verifierToken,
      ),
    ).resolves.toBe(true);
    const restored = await unwrapVaultKey(
      wrapped.ciphertext,
      wrapped.iv,
      unlockKey,
    );
    const probe = await encryptJson({ ok: true }, restored);
    await expect(
      decryptJson(probe.ciphertext, probe.iv, restored),
    ).resolves.toEqual({ ok: true });

    // …and a wrong password fails both proofs.
    const wrongKey = await deriveMasterKey("wrong", salt, argon2Params);
    await expect(
      checkVerifier(
        wrongKey,
        verifier.verifier,
        verifier.verifierIv,
        VERIFIER_TOKEN,
      ),
    ).resolves.toBe(false);
    await expect(
      unwrapVaultKey(wrapped.ciphertext, wrapped.iv, wrongKey),
    ).rejects.toThrow();
  });
});
