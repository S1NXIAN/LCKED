import { describe, it, expect } from "vitest";
import { exportToCsv, detectCardBrand } from "@/lib/import/export";
import type { VaultItem } from "@/lib/types";

function makeItem(overrides: Partial<VaultItem> & { type: VaultItem["type"] }): VaultItem {
  const now = Date.now();
  const base = {
    id: "test-id",
    name: "test",
    favorite: false,
    pinned: false,
    folder: "",
    customFields: [],
    createdAt: now,
    updatedAt: now,
    vaultIds: [],
    trashed: false,
    trashedAt: null,
  };
  return { ...base, ...overrides } as VaultItem;
}

describe("exportToCsv", () => {
  it("exports login items", () => {
    const items: VaultItem[] = [
      makeItem({
        type: "login",
        name: "example.com",
        favorite: true,
        folder: "Work",
        details: {
          username: "alice",
          password: "p@ssw0rd",
          urls: ["https://example.com"],
          totp: "JBSWY3DPEHPK3PXP",
          notes: "Primary account",
        },
      }),
    ];

    const csv = exportToCsv(items);
    expect(csv).toContain("example.com");
    expect(csv).toContain("alice");
    expect(csv).toContain("p@ssw0rd");
    expect(csv).toContain("https://example.com");
    expect(csv).toContain("JBSWY3DPEHPK3PXP");
    // First line is headers
    const lines = csv.split("\n");
    expect(lines[0]).toContain("login_username");
  });

  it("exports note items", () => {
    const items: VaultItem[] = [
      makeItem({
        type: "note",
        name: "My Note",
        details: { content: "Some secret content" },
      }),
    ];

    const csv = exportToCsv(items);
    expect(csv).toContain("My Note");
    expect(csv).toContain("Some secret content");
  });

  it("exports card items", () => {
    const items: VaultItem[] = [
      makeItem({
        type: "card",
        name: "Visa",
        details: {
          cardholder: "Alice",
          number: "4111111111111111",
          brand: "Visa",
          cvv: "123",
          expiry: "12/2028",
          pin: "9999",
          notes: "Primary card",
        },
      }),
    ];

    const csv = exportToCsv(items);
    expect(csv).toContain("Alice");
    expect(csv).toContain("4111111111111111");
    expect(csv).toContain("12/2028");
    expect(csv).toContain("9999");
  });

  it("exports identity items", () => {
    const items: VaultItem[] = [
      makeItem({
        type: "identity",
        name: "My Identity",
        details: {
          firstName: "Alice",
          lastName: "Smith",
          email: "alice@example.com",
          phone: "+15551234567",
          company: "Acme",
          address1: "123 Main St",
          address2: "",
          city: "Springfield",
          state: "IL",
          zip: "62701",
          country: "US",
          notes: "",
        },
      }),
    ];

    const csv = exportToCsv(items);
    expect(csv).toContain("Alice");
    expect(csv).toContain("Smith");
    expect(csv).toContain("alice@example.com");
    expect(csv).toContain("Acme");
  });

  it("escapes fields with commas or quotes", () => {
    const items: VaultItem[] = [
      makeItem({
        type: "note",
        name: 'Contains "quote"',
        details: { content: "has,comma" },
      }),
    ];

    const csv = exportToCsv(items);
    expect(csv).toContain('"Contains ""quote"""');
    expect(csv).toContain('"has,comma"');
  });
});

describe("detectCardBrand", () => {
  it("detects Visa", () => {
    expect(detectCardBrand("4111111111111111")).toBe("Visa");
    expect(detectCardBrand("4012888888881881")).toBe("Visa");
  });

  it("detects Mastercard", () => {
    expect(detectCardBrand("5555555555554444")).toBe("Mastercard");
    expect(detectCardBrand("2223003122003222")).toBe("Mastercard");
  });

  it("detects Amex", () => {
    expect(detectCardBrand("378282246310005")).toBe("Amex");
    expect(detectCardBrand("371449635398431")).toBe("Amex");
  });

  it("detects Discover", () => {
    expect(detectCardBrand("6011111111111117")).toBe("Discover");
    expect(detectCardBrand("6011000990139424")).toBe("Discover");
  });

  it("detects Hipercard", () => {
    expect(detectCardBrand("6062825624254001")).toBe("Hipercard");
  });

  it("detects Diners", () => {
    expect(detectCardBrand("30569309025904")).toBe("Diners");
  });

  it("detects JCB", () => {
    expect(detectCardBrand("3530111333300000")).toBe("JCB");
  });

  it("returns empty string for unknown brands", () => {
    expect(detectCardBrand("0000000000000000")).toBe("");
  });

  it("strips whitespace from card numbers", () => {
    expect(detectCardBrand(" 4111 1111 1111 1111 ")).toBe("Visa");
  });
});
