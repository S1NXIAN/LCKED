import { beforeEach, describe, expect, it, vi } from "vitest";

import { runBulk } from "@/components/vault/bulk-report";
import type { BulkResult } from "@/lib/types";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

const ok = (done: number, failed = 0): Promise<BulkResult> =>
  Promise.resolve({ done, failed });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runBulk", () => {
  it("toasts success with count, noun, and tail", async () => {
    await runBulk(() => ok(3), "Moved", { tail: "to Trash" });

    expect(toast.success).toHaveBeenCalledWith("Moved 3 items to Trash");
  });

  it("singularizes a single item", async () => {
    await runBulk(() => ok(1), "Moved");

    expect(toast.success).toHaveBeenCalledWith("Moved 1 item");
  });

  it("warns on partial failure", async () => {
    await runBulk(() => ok(2, 1), "Restored");

    expect(toast.warning).toHaveBeenCalledWith("Restored 2 items; 1 failed");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("errors when nothing succeeded", async () => {
    await runBulk(() => ok(0, 2), "Deleted");

    expect(toast.error).toHaveBeenCalledWith("Deleted nothing; 2 items failed");
  });

  it("stays silent on a filtered no-op", async () => {
    await runBulk(() => ok(0), "Moved");

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("errors without throwing when the action rejects", async () => {
    await runBulk(() => Promise.reject(new Error("Vault is locked")), "Moved");

    expect(toast.error).toHaveBeenCalledWith("Moved failed");
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("supports custom counted nouns", async () => {
    await runBulk(() => ok(1), "Cleared", { what: "favorite" });

    expect(toast.success).toHaveBeenCalledWith("Cleared 1 favorite");
  });
});
