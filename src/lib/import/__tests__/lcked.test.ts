import { describe, expect, it } from "vitest";

import { type LckedExport, parseLckedJson } from "@/lib/import/lcked";

describe("parseLckedJson", () => {
  it("parses a valid LCKED export envelope", () => {
    const text = JSON.stringify({
      format: "lcked-encrypted-v1",
      version: 1,
      exportedAt: 1700000000000,
      salt: "abc123",
      iterations: 600000,
      verifier: "xyz",
      verifierIv: "iv1",
      wrappedVaultKey: "key",
      wrappedVaultKeyIv: "iv2",
      data: "encrypted",
      dataIv: "iv3",
    });

    const result = parseLckedJson(text);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(result.format).toBe("lcked-json");
    expect(result.raw).toBeDefined();
    expect((result.raw as LckedExport).format).toBe("lcked-encrypted-v1");
  });

  it("rejects unknown formats", () => {
    const text = JSON.stringify({ format: "unknown-format" });
    const result = parseLckedJson(text);
    expect(result.imported).toBe(0);
    expect(result.warnings[0]).toContain("Not a recognised");
  });

  it("handles invalid JSON", () => {
    const result = parseLckedJson("not json");
    expect(result.imported).toBe(0);
    expect(result.warnings[0]).toContain("not valid JSON");
  });
});
