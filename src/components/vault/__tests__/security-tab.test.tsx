/**
 * Change master password form — the confirmation gate.
 * ---------------------------------------------------------------------------
 * The form is controlled client state and this jsdom-free suite cannot type
 * into it, so the submit decision is a pure function tested directly; the
 * render side only pins that all three fields exist. Same harness as
 * settings-dialog.test.tsx: real Zustand store, no-op persist.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  passwordChangeError,
  SecurityTab,
} from "@/components/vault/settings/security-tab";

vi.mock("zustand/middleware", () => ({
  persist: (config: unknown) => config,
}));

describe("passwordChangeError", () => {
  it("blocks a mismatched confirmation", () => {
    expect(passwordChangeError("new-password", "new-passwerd")).toEqual({
      field: "confirm",
      message: "New passwords do not match",
    });
  });

  it("accepts a matching eight-character confirmation", () => {
    expect(passwordChangeError("12345678", "12345678")).toBeNull();
  });

  it("blocks a new password shorter than eight characters", () => {
    expect(passwordChangeError("short", "short")).toEqual({
      field: "new",
      message: "New password must be at least 8 characters",
    });
  });
});

describe("SecurityTab change password form", () => {
  it("asks for the current, new and confirmation passwords", () => {
    const html = renderToStaticMarkup(createElement(SecurityTab));

    expect(html).toContain('id="cur-pw"');
    expect(html).toContain('id="new-pw"');
    expect(html).toContain('id="confirm-pw"');
  });
});
