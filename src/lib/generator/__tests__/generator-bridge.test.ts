import { describe, expect, it, vi } from "vitest";

import {
  consumeGeneratorCallback,
  hasGeneratorCallback,
  setGeneratorCallback,
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
});
