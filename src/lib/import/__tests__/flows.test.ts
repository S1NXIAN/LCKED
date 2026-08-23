import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toast } from "sonner";
import { download } from "@/lib/browser-utils";
import { readPickedFile, runImport, downloadEncryptedExport, downloadCsvExport } from "@/lib/import/flows";

// The flows module is the seam under test; toast + download are its edges.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/browser-utils", () => ({
  download: vi.fn(),
}));

function makeReadableFile(name: string, body: string): File {
  return { name, text: async () => body } as unknown as File;
}

function makeUnreadableFile(name: string): File {
  return {
    name,
    text: async () => {
      throw new Error("disk");
    },
  } as unknown as File;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-23T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("readPickedFile", () => {
  it("returns the text plus detected format", async () => {
    const picked = await readPickedFile(makeReadableFile("vault.json", "{}"));

    expect(picked).toEqual({ text: "{}", format: "bitwarden-json" });
  });

  it("resolves null when the file cannot be read", async () => {
    const picked = await readPickedFile(makeUnreadableFile("vault.json"));

    expect(picked).toBeNull();
  });
});

describe("runImport", () => {
  it("toasts the imported count and reports success", async () => {
    const importItems = vi.fn().mockResolvedValue({
      imported: 2,
      skipped: 0,
      warnings: [],
    });

    const ok = await runImport(makeReadableFile("vault.json", "file-body"), importItems);

    expect(ok).toBe(true);
    expect(importItems).toHaveBeenCalledWith("vault.json", "file-body");
    expect(toast.success).toHaveBeenCalledWith(
      "Imported 2 items",
      expect.objectContaining({ description: undefined }),
    );
  });

  it("uses singular wording for one item and mentions skips", async () => {
    const importItems = vi.fn().mockResolvedValue({
      imported: 1,
      skipped: 3,
      warnings: ["bad row"],
    });

    const ok = await runImport(makeReadableFile("a.csv", "file-body"), importItems);

    expect(ok).toBe(true);
    expect(toast.success).toHaveBeenCalledWith(
      "Imported 1 item",
      expect.objectContaining({ description: "3 skipped. bad row" }),
    );
  });

  it("toasts a friendly failure and reports it", async () => {
    const importItems = vi.fn().mockRejectedValue(new Error("boom"));

    const ok = await runImport(makeReadableFile("x.xml", "file-body"), importItems);

    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      "Import failed",
      expect.objectContaining({ description: expect.any(String) }),
    );
  });
});

describe("downloadEncryptedExport", () => {
  const exportEncrypted = vi.fn().mockResolvedValue("{}");

  it("rejects short passwords without exporting (dialog mode)", async () => {
    const ok = await downloadEncryptedExport({ exportEncrypted, passphrase: "short" });

    expect(ok).toBe(false);
    expect(exportEncrypted).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Export password must be at least 8 characters");
  });

  it("rejects mismatched confirmation (tab mode)", async () => {
    const ok = await downloadEncryptedExport({
      exportEncrypted,
      passphrase: "long-enough",
      confirm: "different",
    });

    expect(ok).toBe(false);
    expect(exportEncrypted).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Passphrase must be at least 8 characters and match");
  });

  it("exports and downloads a dated JSON file", async () => {
    const ok = await downloadEncryptedExport({
      exportEncrypted,
      passphrase: "long-enough",
      confirm: "long-enough",
    });

    expect(ok).toBe(true);
    expect(exportEncrypted).toHaveBeenCalledWith("long-enough");
    expect(download).toHaveBeenCalledWith(
      "lcked-vault-2026-08-23.json",
      "{}",
      "application/json",
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("downloads a ZIP variant when asked", async () => {
    const ok = await downloadEncryptedExport({ exportEncrypted, passphrase: "long-enough", zip: true });

    expect(ok).toBe(true);
    expect(download).toHaveBeenCalledWith(
      "lcked-vault-2026-08-23.zip",
      "{}",
      "application/zip",
    );
  });

  it("reports export failures", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("crypto"));
    const ok = await downloadEncryptedExport({ exportEncrypted: failing, passphrase: "long-enough" });

    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Export failed");
  });
});

describe("downloadCsvExport", () => {
  it("downloads a dated CSV and toasts", () => {
    const exportCsv = vi.fn().mockReturnValue("name,url\n");

    downloadCsvExport(exportCsv);

    expect(download).toHaveBeenCalledWith("lcked-vault-2026-08-23.csv", "name,url\n", "text/csv");
    expect(toast.success).toHaveBeenCalled();
  });
});
