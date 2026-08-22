import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setGeneratorCallback,
  getGeneratorCallback,
  consumeGeneratorCallback,
  clearGeneratorCallback,
} from "@/lib/generator/generator-bridge";

describe("generator-bridge", () => {
  beforeEach(() => {
    clearGeneratorCallback();
  });

  it("sets a callback and retrieves it", () => {
    const fn = vi.fn();
    setGeneratorCallback(fn);
    expect(getGeneratorCallback()).toBe(fn);
  });

  it("consume fires the callback and clears it", () => {
    const fn = vi.fn();
    setGeneratorCallback(fn);

    const result = consumeGeneratorCallback("my-password");

    expect(result).toBe(true);
    expect(fn).toHaveBeenCalledWith("my-password");
    expect(getGeneratorCallback()).toBeNull();
  });

  it("consume with no callback returns false", () => {
    setGeneratorCallback(null);

    const result = consumeGeneratorCallback("any-password");

    expect(result).toBe(false);
    expect(getGeneratorCallback()).toBeNull();
  });

  it("clear without consuming removes the callback", () => {
    const fn = vi.fn();
    setGeneratorCallback(fn);

    clearGeneratorCallback();

    expect(getGeneratorCallback()).toBeNull();
    // Should not have been called.
    expect(fn).not.toHaveBeenCalled();
  });

  it("setting a new callback replaces the old one", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    setGeneratorCallback(fn1);
    setGeneratorCallback(fn2);

    // old one is gone
    expect(getGeneratorCallback()).toBe(fn2);
    expect(getGeneratorCallback()).not.toBe(fn1);

    consumeGeneratorCallback("pw");
    expect(fn2).toHaveBeenCalledWith("pw");
    expect(fn1).not.toHaveBeenCalled();
  });
});
