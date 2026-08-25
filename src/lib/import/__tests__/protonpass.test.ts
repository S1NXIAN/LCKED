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

  it("parses a current-schema Proton Pass CSV export (type,name,url,...)", () => {
    const text = fixture("protonpass-current.csv");
    // End-to-end through dispatch — this is the exact path that used to
    // answer "File not recognized" for real Proton Pass exports.
    const { result, items } = importFromText("proton-pass-export.csv", text);

    expect(result.imported).toBe(5);
    expect(result.skipped).toBe(0);

    const [login, note, card, identity, alias] = items;
    // Fixture rows carry createTime=1700000000s / modifyTime=1700000100s.
    expect(login.createdAt).toBe(1700000000000);
    expect(login.updatedAt).toBe(1700000100000);
    expect(login).toMatchObject({
      type: "login",
      name: "GitHub",
      details: {
        username: "alice",
        password: "hunter2",
        urls: [
          "https://github.com",
          "https://api.github.com",
          "https://exact.example.com/login",
        ],
        totp: "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub",
        notes: "Work account",
      },
    });
    expect(note).toMatchObject({
      type: "note",
      name: "Wifi home",
      details: { content: "password: hunter2" },
    });
    expect(card).toMatchObject({
      type: "card",
      name: "Visa",
      details: {
        cardholder: "Alice Smith",
        number: "4111111111111111",
        cvv: "321",
        expiry: "12/2028",
        pin: "1234",
        notes: "personal card",
      },
    });
    expect(identity).toMatchObject({
      type: "identity",
      name: "Me",
      details: {
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@x.com",
        phone: "+15551234",
        company: "Acme",
        address1: "1 Main St",
        city: "Springfield",
        state: "IL",
        zip: "62704",
        country: "US",
        notes: "id note",
      },
    });
    expect(alias).toMatchObject({
      type: "login",
      name: "Shop alias",
      details: { username: "spam@alias.com", urls: [] },
    });
  });

  it("preserves legacy card notes that merely look like JSON", () => {
    const csv = 'item_type,name,note_content\ncard,Wallet,"{""amount"": 42}"';
    const { result, items } = importFromText("export.csv", csv);
    expect(result.imported).toBe(1);
    expect(items[0].details).toMatchObject({ notes: '{"amount": 42}' });
  });

  it("warns and keeps raw text when a current-schema note is malformed JSON", () => {
    const csv =
      "type,name,url,email,username,password,note,totp,createTime,modifyTime,vault\n" +
      'creditCard,Broken,,,,,"{not json}",,,1700000000,1700000100,Personal';
    const { result, items } = importFromText("proton-pass-export.csv", csv);
    expect(result.imported).toBe(1);
    expect(result.warnings[0]).toContain("failed to parse");
    expect(items[0].details).toMatchObject({ notes: "{not json}" });
  });


  it("leaves timestamps unstamped when the export has none", () => {
    const csv = "item_type,name\nlogin,Ancient";
    const { result, items } = importFromText("export.csv", csv);
    expect(result.imported).toBe(1);
    expect(items[0].createdAt).toBeUndefined();
    expect(items[0].updatedAt).toBeUndefined();
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
