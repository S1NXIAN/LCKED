/**
 * PermanentDeleteDialog contract.
 * ---------------------------------------------------------------------------
 * The one gate for irreversible purges. Radix presence-gates its content on
 * client effects, so SSR can't render the open dialog; the regression-prone
 * part — the target copy — is a pure function tested directly, while the
 * closed state renders nothing through the real component.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PermanentDeleteDialog,
  purgeTargetCopy,
} from "@/components/vault/permanent-delete-dialog";

function renderClosed(): string {
  return renderToStaticMarkup(
    createElement(PermanentDeleteDialog, {
      open: false,
      onOpenChange: () => {},
      label: "x",
      onConfirm: () => {},
    }),
  );
}

describe("purgeTargetCopy", () => {
  it("names a single item by label", () => {
    expect(purgeTargetCopy("Bank Portal", 1)).toBe(
      "“Bank Portal” will be permanently erased.",
    );
  });

  it("falls back to counted copy with correct plural", () => {
    expect(purgeTargetCopy(undefined, 1)).toBe(
      "1 item will be permanently erased.",
    );
    expect(purgeTargetCopy(undefined, 3)).toBe(
      "3 items will be permanently erased.",
    );
  });
});

describe("PermanentDeleteDialog", () => {
  it("closed renders nothing", () => {
    expect(renderClosed()).toBe("");
  });
});
