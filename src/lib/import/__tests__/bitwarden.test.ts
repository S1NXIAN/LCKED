import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseBitwardenCsv, parseBitwardenJson } from "@/lib/import/bitwarden";
import { importFromText } from "@/lib/import/index";

function fixture(name: string): string {
  return readFileSync(resolve(__dirname, "../__fixtures__", name), "utf-8");
}

describe("parseBitwardenJson", () => {
  it("parses a happy-path Bitwarden JSON export", () => {
    const text = fixture("bitwarden.json");
    const { result, items } = importFromText("export.json", text);

    expect(result.imported).toBe(4);
    expect(result.skipped).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(items).toHaveLength(4);

    // Original export dates survive as restore-only overrides
    // (2023-06-01T12:00:00Z / 2023-06-02T08:30:00Z in the fixture).
    expect(items[0].createdAt).toBe(1685620800000);
    expect(items[0].updatedAt).toBe(1685694600000);

    // Login item
    expect(items[0]).toMatchObject({
      type: "login",
      name: "example.com",
      folder: "Work",
      favorite: true,
      details: {
        username: "alice",
        password: "p@ssw0rd",
        urls: ["https://example.com", "https://login.example.com"],
        totp: "JBSWY3DPEHPK3PXP",
        notes: "Primary work account",
      },
    });

    // Note item
    expect(items[1]).toMatchObject({
      type: "note",
      name: "Meeting Notes",
      details: { content: "Remember to bring up the Q3 projections." },
    });

    // Card item
    expect(items[2]).toMatchObject({
      type: "card",
      name: "Visa Platinum",
      folder: "Finance",
      details: {
        cardholder: "Alice Smith",
        number: "4111111111111111",
        cvv: "123",
        expiry: "12/2028",
        brand: "Visa",
      },
    });

    // Identity item
    expect(items[3]).toMatchObject({
      type: "identity",
      name: "My Identity",
      folder: "Personal",
      favorite: true,
      details: {
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@example.com",
        phone: "+15551234567",
        company: "Acme Corp",
        address1: "123 Main St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
        country: "US",
      },
    });
  });

  it("reports encrypted exports", () => {
    const text = JSON.stringify({ encrypted: true, items: [] });
    const result = parseBitwardenJson(text);
    expect(result.imported).toBe(0);
    expect(result.warnings[0]).toContain("encrypted");
  });

  it("handles invalid JSON", () => {
    const result = parseBitwardenJson("not json");
    expect(result.imported).toBe(0);
    expect(result.warnings[0]).toContain("not valid JSON");
  });

  it("handles missing items array", () => {
    const result = parseBitwardenJson(JSON.stringify({}));
    expect(result.imported).toBe(0);
    expect(result.warnings[0]).toContain("No 'items' array");
  });

  it("skips unknown item types", () => {
    const text = JSON.stringify({ items: [{ type: 99, name: "Unknown" }] });
    const { result, items } = importFromText("x.json", text);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(items).toHaveLength(0);
  });
});

describe("parseBitwardenCsv", () => {
  it("parses a happy-path Bitwarden CSV export", () => {
    const text = fixture("bitwarden.csv");
    const { result, items } = importFromText("export.csv", text);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);

    // Login item
    expect(items[0]).toMatchObject({
      type: "login",
      name: "example.com",
      favorite: true,
      details: {
        username: "alice",
        password: "p@ssw0rd",
        urls: ["https://example.com"],
        totp: "JBSWY3DPEHPK3PXP",
        notes: "Primary work account",
      },
    });

    // Note item
    expect(items[1]).toMatchObject({
      type: "note",
      name: "Meeting Notes",
    });
  });

  it("maps the Bitwarden fields column into custom fields", () => {
    const csv =
      "folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\n" +
      'Work,1,login,example.com,"Primary account","Security Question: First pet\nRecovery Code: 1234",0,https://example.com,alice,p@ssw0rd,';
    const { result, items } = importFromText("export.csv", csv);

    expect(result.imported).toBe(1);
    expect(items[0].customFields).toEqual([
      { name: "Security Question", value: "First pet", type: "text" },
      { name: "Recovery Code", value: "1234", type: "text" },
    ]);
  });

  it("handles empty CSV", () => {
    const result = parseBitwardenCsv("header\n");
    expect(result.imported).toBe(0);
    expect(result.warnings[0]).toContain("no data rows");
  });

  it("handles empty file", () => {
    const result = parseBitwardenCsv("");
    expect(result.imported).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
