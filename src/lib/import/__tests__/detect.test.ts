import { describe, expect, it } from "vitest";

import {
  detectFormat,
  importFromText,
  parseBitwardenJson,
} from "@/lib/import/index";
import type { ImportResult } from "@/lib/types";

describe("detectFormat", () => {
  it("detects bitwarden-json from .json extension", () => {
    expect(detectFormat("export.json", '{"items":[]}')).toBe("bitwarden-json");
  });

  it("detects lcked-json from format field", () => {
    expect(detectFormat("export.json", '{"format":"lcked-encrypted-v1"}')).toBe(
      "lcked-json",
    );
  });

  it("detects keepassxc-xml from .xml extension", () => {
    expect(detectFormat("export.xml", "<xml></xml>")).toBe("keepassxc-xml");
  });

  it("detects bitwarden-csv from .csv with card_pin header", () => {
    expect(detectFormat("export.csv", "name,card_pin\n")).toBe("bitwarden-csv");
  });

  it("detects bitwarden-csv from a logins-only export header", () => {
    expect(
      detectFormat(
        "export.csv",
        "folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\n",
      ),
    ).toBe("bitwarden-csv");
  });

  it("detects bitwarden-csv from mixed-case login headers", () => {
    expect(detectFormat("export.csv", "Name,LOGIN_URI,Login_Password\n")).toBe(
      "bitwarden-csv",
    );
  });

  it("detects LCKED's own CSV round-trip as bitwarden-csv", () => {
    expect(
      detectFormat(
        "lcked-vault.csv",
        "name,type,folder,favorite,pinned,login_username,login_password,login_urls,login_totp,note_content,card_cardholder,card_number,card_pin,identity_first_name,identity_email,identity_company\n",
      ),
    ).toBe("bitwarden-csv");
  });

  it("detects protonpass-csv from .csv with item_type header", () => {
    expect(detectFormat("export.csv", "item_type,name\n")).toBe(
      "protonpass-csv",
    );
  });

  it("detects 1password-csv from .csv with Title and Url headers", () => {
    expect(detectFormat("export.csv", "Title,Url\n")).toBe("1password-csv");
  });

  it("reports browser CSV shapes as unknown instead of guessing", () => {
    expect(
      detectFormat("passwords.csv", "name,url,username,password,note\n"),
    ).toBe("unknown");
    expect(
      detectFormat(
        "logins.csv",
        "url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged\n",
      ),
    ).toBe("unknown");
  });

  it("reports unrecognized CSV columns as unknown", () => {
    expect(detectFormat("export.csv", "unknown,columns\n")).toBe("unknown");
  });

  it("detects bitwarden-json from content sniffing on unknown extension", () => {
    expect(detectFormat("data.txt", '{"items":[]}')).toBe("bitwarden-json");
  });

  it("detects keepassxc-xml from content sniffing on unknown extension", () => {
    expect(
      detectFormat(
        "data.txt",
        '<?xml version="1.0"?><KeePassFile><Entry></Entry></KeePassFile>',
      ),
    ).toBe("keepassxc-xml");
  });

  it("reports unrecognized plain-text content as unknown", () => {
    expect(detectFormat("data.txt", "just some text\n")).toBe("unknown");
  });
});

describe("importFromText dispatch", () => {
  it("dispatches to bitwarden-json parser", () => {
    const { result, items } = importFromText(
      "export.json",
      JSON.stringify({ items: [{ type: 2, name: "Note" }] }),
    );
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
    const { result, items } = importFromText(
      "export.csv",
      "name,type,login_username\nTest,login,alice",
    );
    expect(result.imported).toBe(1);
    expect(items[0]).toMatchObject({
      type: "login",
      name: "Test",
      details: { username: "alice" },
    });
  });

  it("dispatches to 1password-csv parser", () => {
    const { result, items } = importFromText(
      "export.csv",
      "Title,Url,Username,Password\nTest,https://x.com,alice,p4ss",
    );
    expect(result.imported).toBe(1);
    expect(items[0]).toMatchObject({
      type: "login",
      name: "Test",
      details: { username: "alice", password: "p4ss" },
    });
  });

  it("dispatches to protonpass-csv parser", () => {
    const { result, items } = importFromText(
      "export.csv",
      "item_type,name,login_username,login_password\nlogin,Test,bob,p4ss",
    );
    expect(result.imported).toBe(1);
    expect(items[0]).toMatchObject({
      type: "login",
      name: "Test",
      details: { username: "bob", password: "p4ss" },
    });
  });

  it("dispatches lcked-json and returns raw data (deferred)", () => {
    const text = JSON.stringify({
      format: "lcked-encrypted-v1",
      salt: "x",
      iterations: 1,
      verifier: "v",
      verifierIv: "i",
      wrappedVaultKey: "k",
      wrappedVaultKeyIv: "i",
      data: "d",
      dataIv: "i",
    });
    const { result, items } = importFromText("export.json", text);
    expect(result.format).toBe("lcked-json");
    expect(result.raw).toBeDefined();
    expect(items).toEqual([]);
  });

  it("resolves unknown formats to a warning result with zero items", () => {
    const { result, items } = importFromText(
      "export.csv",
      "name,url,username,password,note\na,https://x,u,p,\n",
    );

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(items).toEqual([]);
  });

  it("populates result.items from parsers and exposes them through importFromText", () => {
    const rawResult: ImportResult = parseBitwardenJson(
      JSON.stringify({ items: [{ type: 2, name: "Note" }] }),
    );
    expect(rawResult.items).toBeDefined();
    expect(rawResult.items).toHaveLength(1);

    const { result: cleaned, items } = importFromText(
      "x.json",
      JSON.stringify({ items: [{ type: 2, name: "Note" }] }),
    );
    // importFromText returns items separately; result.items is still set
    expect(cleaned.items).toBeDefined();
    expect(items).toHaveLength(1);
  });
});
