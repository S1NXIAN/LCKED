import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { importFromText } from "@/lib/import/index";
import { parseKeePassXcXml } from "@/lib/import/keepassxc";

// Build a minimal fake DOM element — just enough for
// readKeePassXcEntry to traverse children by tagName.
type FakeNode = {
  tagName: string;
  children: FakeNode[];
  textContent: string | null;
};

function el(tag: string, children?: FakeNode[], text?: string): FakeNode {
  return { tagName: tag, children: children ?? [], textContent: text ?? null };
}

// Given a list of { key, value } pairs, produce a <String>
// element with nested <Key> and <Value> children.
function kv(key: string, value: string) {
  return el("String", [el("Key", [], key), el("Value", [], value)]);
}

// The fake Document the parser talks to (querySelector/getElementsByTagName).
type FakeDoc = {
  querySelector: (selector: string) => unknown;
  getElementsByTagName: (tag: string) => unknown[];
};
let currentDoc: FakeDoc | null = null;
beforeAll(() => {
  vi.stubGlobal(
    "DOMParser",
    class {
      parseFromString() {
        return currentDoc;
      }
    },
  );
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe("parseKeePassXcXml", () => {
  it("parses entries into login and note items", () => {
    currentDoc = {
      querySelector: vi.fn(() => null),
      getElementsByTagName: vi.fn((tag: string) =>
        tag === "Entry"
          ? [
              el("Entry", [
                kv("Title", "example.com"),
                kv("UserName", "alice"),
                kv("Password", "p@ssw0rd"),
                kv("URL", "https://example.com"),
                kv("Notes", "Primary work account"),
                kv("otp", "JBSWY3DPEHPK3PXP"),
              ]),
              el("Entry", [
                kv("Title", "My Note"),
                kv("Notes", "Remember to bring up Q3 projections."),
              ]),
            ]
          : [],
      ),
    };

    const { result, items } = importFromText("export.xml", "<dummy/>");

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);

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

    expect(items[1]).toMatchObject({
      type: "note",
      name: "My Note",
      details: { content: "Remember to bring up Q3 projections." },
    });
  });

  it("handles no entries gracefully", () => {
    currentDoc = {
      querySelector: vi.fn(() => null),
      getElementsByTagName: vi.fn(() => []),
    };

    const result = parseKeePassXcXml("<empty/>");
    expect(result.imported).toBe(0);
    expect(result.warnings[0]).toContain("No <Entry> elements");
  });

  it("handles parsererror from malformed XML", () => {
    currentDoc = {
      querySelector: vi.fn((sel: string) =>
        sel === "parsererror" ? { textContent: "bad" } : null,
      ),
      getElementsByTagName: vi.fn(() => []),
    };

    const result = parseKeePassXcXml("not xml");
    expect(result.imported).toBe(0);
    expect(result.warnings[0]).toContain("not well-formed XML");
  });
});
