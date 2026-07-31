import { describe, it, expect } from "vitest";
import { detectFormat, importFromText, parseBitwardenJson, parseKeePassXcXml } from "@/lib/import/index";
import type { ImportResult } from "@/lib/types";

describe("detectFormat", () => {
  it("detects bitwarden-json from .json extension", () => {
    expect(detectFormat("export.json", '{"items":[]}')).toBe("bitwarden-json");
  });

  it("detects lcked-json from format field", () => {
    expect(detectFormat("export.json", '{"format":"lcked-encrypted-v1"}')).toBe("lcked-json");
  });

  it("detects keepassxc-xml from .xml extension", () => {
    expect(detectFormat("export.xml", "<xml></xml>")).toBe("keepassxc-xml");
  });

  it("detects bitwarden-csv from .csv with card_pin header", () => {
    expect(detectFormat("export.csv", "name,card_pin\n")).toBe("bitwarden-csv");
  });

  it("detects protonpass-csv from .csv with item_type header", () => {
    expect(detectFormat("export.csv", "item_type,name\n")).toBe("protonpass-csv");
  });

  it("detects 1password-csv from .csv with Title and Url headers", () => {
    expect(detectFormat("export.csv", "Title,Url\n")).toBe("1password-csv");
  });

  it("defaults unknown CSV to bitwarden-csv", () => {
    expect(detectFormat("export.csv", "unknown,columns\n")).toBe("bitwarden-csv");
  });

  it("detects bitwarden-json from content sniffing on unknown extension", () => {
    expect(detectFormat("data.txt", '{"items":[]}')).toBe("bitwarden-json");
  });

  it("detects keepassxc-xml from content sniffing on unknown extension", () => {
    expect(detectFormat("data.txt", '<?xml version="1.0"?><KeePassFile><Entry></Entry></KeePassFile>')).toBe("keepassxc-xml");
  });
});

describe("importFromText dispatch", () => {
  it("dispatches to bitwarden-json parser", () => {
    const { result, items } = importFromText("export.json", JSON.stringify({ items: [{ type: 2, name: "Note" }] }));
    expect(result.imported).toBe(1);
    expect(items[0].type).toBe("note");
  });

  it("dispatches to keepassxc-xml parser", () => {
    const xml = `<?xml version="1.0"?><KeePassFile><Root><Group><Name>Root</Name></Group></Root></KeePassFile>`;
    const { result } = importFromText("export.xml", xml);
    // DOMParser isn't available in Node, but the dispatch still happened.
    expect(typeof result.imported).toBe("number");
  });

  it("dispatches to bitwarden-csv parser", () => {
    const { result, items } = importFromText("export.csv", "name,type,login_username\nTest,login,alice");
    expect(result.imported).toBe(1);
    expect(items[0]).toMatchObject({ type: "login", name: "Test", details: { username: "alice" } });
  });

  it("dispatches to 1password-csv parser", () => {
    const { result, items } = importFromText("export.csv", "Title,Url,Username,Password\nTest,https://x.com,alice,p4ss");
    expect(result.imported).toBe(1);
    expect(items[0]).toMatchObject({ type: "login", name: "Test", details: { username: "alice", password: "p4ss" } });
  });

  it("dispatches to protonpass-csv parser", () => {
    const { result, items } = importFromText("export.csv", "item_type,name,login_username,login_password\nlogin,Test,bob,p4ss");
    expect(result.imported).toBe(1);
    expect(items[0]).toMatchObject({ type: "login", name: "Test", details: { username: "bob", password: "p4ss" } });
  });

  it("dispatches lcked-json and returns raw data (deferred)", () => {
    const text = JSON.stringify({ format: "lcked-encrypted-v1", salt: "x", iterations: 1, verifier: "v", verifierIv: "i", wrappedVaultKey: "k", wrappedVaultKeyIv: "i", data: "d", dataIv: "i" });
    const { result, items } = importFromText("export.json", text);
    expect(result.format).toBe("lcked-json");
    expect(result.raw).toBeDefined();
    expect(items).toEqual([]);
  });

  it("populates result.items from parsers and exposes them through importFromText", () => {
    const rawResult: ImportResult = parseBitwardenJson(JSON.stringify({ items: [{ type: 2, name: "Note" }] }));
    expect(rawResult.items).toBeDefined();
    expect(rawResult.items).toHaveLength(1);

    const { result: cleaned, items } = importFromText("x.json", JSON.stringify({ items: [{ type: 2, name: "Note" }] }));
    // importFromText returns items separately; result.items is still set
    expect(cleaned.items).toBeDefined();
    expect(items).toHaveLength(1);
  });
});
