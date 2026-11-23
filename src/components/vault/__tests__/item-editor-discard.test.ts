/**
 * Item editor close guard contract.
 * ---------------------------------------------------------------------------
 * Cancel must follow the same path as Escape or an overlay close: a dirty
 * draft asks before discarding, a clean draft closes immediately, and a save
 * in flight never prompts.
 */
import { describe, expect, it, vi } from "vitest";

import { requestEditorClose } from "@/components/vault/item-editor/use-item-form";

function handlers() {
  return { confirmDiscard: vi.fn(), close: vi.fn() };
}

describe("requestEditorClose", () => {
  it("opens the discard dialog for a dirty draft", () => {
    const h = handlers();

    requestEditorClose(true, false, h);

    expect(h.confirmDiscard).toHaveBeenCalledTimes(1);
    expect(h.close).not.toHaveBeenCalled();
  });

  it("closes immediately when the draft is clean", () => {
    const h = handlers();

    requestEditorClose(false, false, h);

    expect(h.close).toHaveBeenCalledTimes(1);
    expect(h.confirmDiscard).not.toHaveBeenCalled();
  });

  it("closes without prompting while a save is in flight", () => {
    const h = handlers();

    requestEditorClose(true, true, h);

    expect(h.close).toHaveBeenCalledTimes(1);
    expect(h.confirmDiscard).not.toHaveBeenCalled();
  });
});
