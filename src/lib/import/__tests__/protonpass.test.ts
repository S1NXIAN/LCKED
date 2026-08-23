import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { importFromText } from "@/lib/import/index";
import { parseProtonPassCsv } from "@/lib/import/protonpass";

function fixture(name: string): string {
  return readFileSync(resolve(__dirname, "../__fixtures__", name), "utf-8");
}

describe("parseProtonPassCsv", () => {
  it("parses a happy-path Proton Pass CSV export", () => {
    const text = fixture("protonpass.csv");
    const { result, items } = importFromText("export.csv", text);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);

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
  });

  it("handles note type items", () => {
    const csv = "item_type,name,note_content\nnote,My Note,Some content";
    const { result, items } = importFromText("export.csv", csv);
    expect(result.imported).toBe(1);
    expect(items[0]).toMatchObject({ type: "note", name: "My Note" });
  });

  it("handles card type items", () => {
    const csv =
      "item_type,name,card_number,card_cardholder,card_cvv,card_expiration_date\ncard,Visa,4111111111111111,Alice,321,12/2028";
    const { result, items } = importFromText("export.csv", csv);
    expect(result.imported).toBe(1);
    expect(items[0]).toMatchObject({
      type: "card",
      name: "Visa",
      details: {
        number: "4111111111111111",
        cardholder: "Alice",
        cvv: "321",
        expiry: "12/2028",
        brand: "Visa",
      },
    });
  });

  it("handles identity type items", () => {
    const csv =
      "item_type,name,identity_first_name,identity_last_name,identity_email,identity_organization\nidentity,Me,Alice,Smith,alice@x.com,Acme";
    const { result, items } = importFromText("export.csv", csv);
    expect(result.imported).toBe(1);
    expect(items[0]).toMatchObject({
      type: "identity",
      name: "Me",
      details: { firstName: "Alice", lastName: "Smith", email: "alice@x.com" },
    });
  });

  it("skips unknown types", () => {
    const csv = "item_type,name\nwidget,Thing";
    const result = parseProtonPassCsv(csv);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("handles empty CSV", () => {
    const result = parseProtonPassCsv("header\n");
    expect(result.imported).toBe(0);
    expect(result.warnings[0]).toContain("no data rows");
  });
});
