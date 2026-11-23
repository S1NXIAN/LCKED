import { describe, expect, it, vi } from "vitest";

import {
  clearGeneratorCallback,
  consumeGeneratorCallback,
  hasGeneratorCallback,
  setGeneratorCallback,
  subscribeGeneratorCallback,
} from "@/lib/generator/generator-bridge";

describe("generator-bridge", () => {
  it("sets a callback and reports it pending", () => {
    setGeneratorCallback(vi.fn());
    expect(hasGeneratorCallback()).toBe(true);
  });

  it("consume fires the callback and clears it", () => {
    const fn = vi.fn();
    setGeneratorCallback(fn);

    const result = consumeGeneratorCallback("my-password");

    expect(result).toBe(true);
    expect(fn).toHaveBeenCalledWith("my-password");
    expect(hasGeneratorCallback()).toBe(false);
  });

  it("consume with no callback returns false", () => {
    setGeneratorCallback(null);

    const result = consumeGeneratorCallback("any-password");

    expect(result).toBe(false);
    expect(hasGeneratorCallback()).toBe(false);
  });

  it("setting null removes the callback without firing it", () => {
    const fn = vi.fn();
    setGeneratorCallback(fn);

    setGeneratorCallback(null);

    expect(hasGeneratorCallback()).toBe(false);
    // Should not have been called.
    expect(fn).not.toHaveBeenCalled();
  });

  it("setting a new callback replaces the old one", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    setGeneratorCallback(fn1);
    setGeneratorCallback(fn2);

    expect(hasGeneratorCallback()).toBe(true);

    consumeGeneratorCallback("pw");
    expect(fn2).toHaveBeenCalledWith("pw");
    expect(fn1).not.toHaveBeenCalled();
  });

  it("clears the field's callback when it unmounts", () => {
    const fieldCallback = vi.fn();
    setGeneratorCallback(fieldCallback);

    // PasswordField's unmount cleanup drops only its own callback, without
    // firing it — the standalone Generator then offers Copy, not "Use".
    clearGeneratorCallback(fieldCallback);

    expect(hasGeneratorCallback()).toBe(false);
    expect(fieldCallback).not.toHaveBeenCalled();
  });

  it("does not clear a newer field's callback", () => {
    const oldField = vi.fn();
    const newField = vi.fn();
    setGeneratorCallback(oldField);
    setGeneratorCallback(newField);

    clearGeneratorCallback(oldField);

    expect(hasGeneratorCallback()).toBe(true);
  });

  it("notifies the open Generator when the pending callback changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeGeneratorCallback(listener);
    const fieldCallback = vi.fn();

    setGeneratorCallback(fieldCallback);
    clearGeneratorCallback(fieldCallback);
    unsubscribe();
    setGeneratorCallback(vi.fn());

    // Two changes while subscribed; the post-unsubscribe change is silent.
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
