import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { importFromText } from "@/lib/import/index";
import { parseOnePasswordCsv } from "@/lib/import/onepassword";

function fixture(name: string): string {
  return readFileSync(resolve(__dirname, "../__fixtures__", name), "utf-8");
}

describe("parseOnePasswordCsv", () => {
  it("parses a happy-path 1Password CSV export", () => {
    const text = fixture("onepassword.csv");
    const { result, items } = importFromText("export.csv", text);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);

    // Login item (username, url, and password present)
    expect(items[0]).toMatchObject({
      type: "login",
      name: "example.com",
      details: {
        username: "alice",
        password: "p@ssw0rd",
        urls: ["https://example.com"],
        totp: "JBSWY3DPEHPK3PXP",
        notes: "Primary work account",
      },
    });

    // Note item (only title and notes)
    expect(items[1]).toMatchObject({
      type: "note",
      name: "Notes",
      details: { content: "Remember to bring up Q3 projections." },
    });
  });

  it("treats items without username/password/url as notes", () => {
    const text = "Title,Url,Username,Password,Notes\nMy Note,,,,Some content";
    const { result, items } = importFromText("export.csv", text);
    expect(result.imported).toBe(1);
    expect(items[0].type).toBe("note");
  });

  it("handles lowercase column headers", () => {
    const text =
      "title,url,username,password,notes\nexample.com,https://x.com,alice,p4ss,";
    const { result, items } = importFromText("export.csv", text);
    expect(result.imported).toBe(1);
    expect(items[0]).toMatchObject({
      type: "login",
      name: "example.com",
      details: { username: "alice", password: "p4ss" },
    });
  });

  it("handles empty CSV", () => {
    const result = parseOnePasswordCsv("header\n");
    expect(result.imported).toBe(0);
    expect(result.warnings[0]).toContain("no data rows");
  });
});
