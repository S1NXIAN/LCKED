/**
 * EmptyList copy contract.
 * ---------------------------------------------------------------------------
 * The list must distinguish three empty shapes: a genuinely empty vault
 * (welcome), an emptied view under an active search/type filter ("No
 * matches"), and an empty Trash (trash explainer) — including Trash WITH an
 * active filter, which must show the filter hint, not the trash explainer.
 *
 * Rendered via react-dom/server with the real Zustand store (jsdom-free,
 * same convention as item-detail.test.tsx).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateCreator } from "zustand/vanilla";

import { EmptyList } from "@/components/vault/item-list/empty-list";
import { useVault, type VaultState } from "@/store/vault";

/* ─── Mocks ─────────────────────────────────────────────── */

vi.mock("zustand", async (importOriginal) => {
  const actual = await importOriginal<typeof import("zustand")>();
  const vanilla = await import("zustand/vanilla");

  type Creator = StateCreator<Record<string, unknown>, [], []>;
  const build = (createState: Creator) => {
    const api = vanilla.createStore(createState);
    const patched = { ...api, getInitialState: api.getState };
    const useBoundStore = ((selector: never) =>
      actual.useStore(patched, selector)) as never;
    return Object.assign(useBoundStore, patched);
  };

  const create = ((createState?: Creator) =>
    createState
      ? build(createState)
      : build) as unknown as typeof actual.create;

  return { ...actual, create };
});
vi.mock("zustand/middleware", () => ({
  persist: (config: unknown) => config,
}));

/* ─── Helpers ───────────────────────────────────────────── */

function render(props: { filterActive: boolean; isTrash: boolean }): string {
  return renderToStaticMarkup(
    createElement(EmptyList, { ...props, onCreate: () => {} }),
  );
}

beforeEach(() => {
  useVault.setState({});
});

/* ─── Tests ─────────────────────────────────────────────── */

describe("EmptyList copy", () => {
  it("welcomes a genuinely empty vault", () => {
    const html = render({ filterActive: false, isTrash: false });
    expect(html).toContain("Your vault is empty");
    expect(html).toContain("Nothing leaves. Ever.");
    expect(html).toContain("Add your first item");
    expect(html).not.toContain("No matches");
  });

  it("points at clearing an active search or filter", () => {
    const html = render({ filterActive: true, isTrash: false });
    expect(html).toContain("No matches");
    expect(html).toContain("Try a different search or filter.");
    expect(html).not.toContain("Add your first item");
  });

  it("explains an empty Trash", () => {
    const html = render({ filterActive: false, isTrash: true });
    expect(html).toContain("Trash is empty");
    expect(html).toContain("auto-purge after 30 days");
  });

  it("shows the filter hint in Trash when a filter empties the list", () => {
    // Regression: this used to render the trash explainer while a search
    // was active — the same wrong-copy class fixed for the main list.
    const html = render({ filterActive: true, isTrash: true });
    expect(html).toContain("No matches");
    expect(html).toContain("Try a different search or filter.");
    expect(html).not.toContain("Deleted items land here");
  });
});
