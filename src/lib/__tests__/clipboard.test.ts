import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  copyWithAutoClear,
  cancelClipboardClear,
  clearAllClipboardTimers,
} from "@/lib/clipboard";

beforeEach(() => {
  vi.useFakeTimers();
  let clipboard = "";
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn(async (text: string) => {
        clipboard = text;
      }),
      readText: vi.fn(async () => clipboard),
    },
  });
});

afterEach(() => {
  clearAllClipboardTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("copyWithAutoClear", () => {
  it("writes the value to the clipboard", async () => {
    await copyWithAutoClear("sekrit");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("sekrit");
  });

  it("clears the clipboard after the timer fires", async () => {
    await copyWithAutoClear("sekrit", "default", 10_000);

    vi.advanceTimersByTime(10_000);
    // Flush the async timer callback's microtasks.
    await vi.advanceTimersByTimeAsync(0);

    // The timer read the clipboard → value still matches → wrote "".
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("");
  });

  it("does NOT clear if clipboard value changed before timer fires", async () => {
    await copyWithAutoClear("sekrit", "default", 10_000);
    // Someone else copied something over.
    navigator.clipboard.writeText("other-value");

    vi.advanceTimersByTime(10_000);
    await vi.advanceTimersByTimeAsync(0);

    // readText returned "other-value", so timer should NOT have cleared.
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("other-value");
  });

  it("throws if clipboard API is unavailable", async () => {
    const origClipboard = navigator.clipboard;
    Object.assign(navigator, { clipboard: undefined });

    await expect(copyWithAutoClear("x")).rejects.toThrow("Clipboard API unavailable");

    Object.assign(navigator, { clipboard: origClipboard });
  });

  it("isolates timers per key", async () => {
    await copyWithAutoClear("alpha", "k1", 10_000);
    // Each key gets its own copied value; k1's clipboard is still "alpha".
    await copyWithAutoClear("beta", "k2", 20_000);

    // Advance past k1's deadline but not k2's.
    vi.advanceTimersByTime(10_000);
    await vi.advanceTimersByTimeAsync(0);

    // k1's timer read the clipboard — "beta" !== "alpha" since k2 overwrote it,
    // so k1's timer did NOT clear. The arrangement above means we can't observe
    // k1's timer via writeText. Instead, verify both keys were written then check
    // that k2's timer is still alive by advancing past it and seeing it fire.
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("alpha");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("beta");

    // Advance past k2's deadline.
    vi.advanceTimersByTime(10_000);
    await vi.advanceTimersByTimeAsync(0);

    // k2's timer fires, reads "beta" (still there), clears it.
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("");
    // Both timers ran readText (k1 read "beta" and skipped, k2 read "beta" and cleared).
    expect(navigator.clipboard.readText).toHaveBeenCalledTimes(2);
  });
});

describe("cancelClipboardClear", () => {
  it("prevents the timer from clearing the clipboard", async () => {
    await copyWithAutoClear("sekrit", "default", 10_000);
    cancelClipboardClear("default");

    vi.advanceTimersByTime(10_000);
    await vi.advanceTimersByTimeAsync(0);

    // The timer should NOT have fired — only the initial writeText.
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("sekrit");
  });
});

describe("clearAllClipboardTimers", () => {
  it("clears all timers and wipes the clipboard", async () => {
    await copyWithAutoClear("sekrit", "a", 10_000);
    await copyWithAutoClear("sekrit2", "b", 20_000);

    clearAllClipboardTimers();

    // Should have attempted to wipe the clipboard.
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("");

    // No timers should fire after clear.
    const callsBefore = vi.mocked(navigator.clipboard.writeText).mock.calls.length;
    vi.advanceTimersByTime(30_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.mocked(navigator.clipboard.writeText).mock.calls.length).toBe(callsBefore);
  });
});
