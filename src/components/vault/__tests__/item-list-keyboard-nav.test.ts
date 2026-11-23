/**
 * Vault list keyboard: cursor movement math and the listbox focus wiring.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateCreator } from "zustand/vanilla";

import { ItemList } from "@/components/vault/item-list";
import { nextOptionIndex } from "@/components/vault/item-list/keyboard-nav";
import type { VaultItem } from "@/lib/types";
import { useVault } from "@/store/vault";

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

const item = (id: string, name: string): VaultItem => ({
  id,
  name,
  type: "login",
  favorite: false,
  pinned: false,
  folder: "",
  customFields: [],
  vaultIds: [],
  trashed: false,
  trashedAt: null,
  createdAt: 1000,
  updatedAt: 1000,
  details: { username: "u", password: "p", urls: [], totp: "", notes: "" },
});

const renderList = () => renderToStaticMarkup(createElement(ItemList, {}));

beforeEach(() => {
  useVault.setState({
    items: [item("a", "Alpha"), item("b", "Beta")],
    selectedId: null,
    searchQuery: "",
    typeFilter: "all",
    activeVault: "all",
  });
});

describe("vault list keyboard cursor", () => {
  it("enters the list at the first item on ArrowDown", () => {
    expect(nextOptionIndex("ArrowDown", -1, 3)).toBe(0);
  });

  it("enters the list at the last item on ArrowUp", () => {
    expect(nextOptionIndex("ArrowUp", -1, 3)).toBe(2);
  });

  it("moves one item per arrow press", () => {
    expect(nextOptionIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextOptionIndex("ArrowUp", 2, 3)).toBe(1);
  });

  it("clamps at both ends", () => {
    expect(nextOptionIndex("ArrowDown", 2, 3)).toBe(2);
    expect(nextOptionIndex("ArrowUp", 0, 3)).toBe(0);
  });

  it("jumps to the ends with Home and End", () => {
    expect(nextOptionIndex("Home", 1, 3)).toBe(0);
    expect(nextOptionIndex("End", 1, 3)).toBe(2);
  });

  it("leaves activation and other keys to the handler", () => {
    expect(nextOptionIndex("Enter", 1, 3)).toBeNull();
    expect(nextOptionIndex(" ", 1, 3)).toBeNull();
    expect(nextOptionIndex("a", 1, 3)).toBeNull();
  });

  it("has no cursor when the list is empty", () => {
    expect(nextOptionIndex("ArrowDown", -1, 0)).toBeNull();
  });
});

describe("vault list focus model", () => {
  it("puts one tab stop on the listbox and points the active descendant at the selected item", () => {
    useVault.setState({ selectedId: "b" });
    const html = renderList();
    expect(html).toContain('role="listbox"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-activedescendant="vault-item-option-b"');
    expect(html).toContain('id="vault-item-option-b"');
  });

  it("drops the active descendant when the selected item is filtered out", () => {
    useVault.setState({ selectedId: "b", searchQuery: "Alpha" });
    const html = renderList();
    expect(html).toContain('role="listbox"');
    expect(html).not.toContain("aria-activedescendant");
  });
});
