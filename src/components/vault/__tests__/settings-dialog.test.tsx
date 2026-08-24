/**
 * Settings view — initial-tab handoff contract.
 * ---------------------------------------------------------------------------
 * The empty-list CTA deep-links into Settings on the Import tab; every other
 * entry point (sidebar button, plain open) lands on General. The command is
 * asserted as a store transition in vault.test.ts; this file pins the render
 * side: the seeded tab decides which tab content mounts.
 *
 * Rendered via react-dom/server with the real Zustand store seeded in memory
 * (same harness as item-detail.test.tsx).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateCreator } from "zustand/vanilla";

import { SettingsView } from "@/components/vault/settings-dialog";
import { useVault, type VaultState } from "@/store/vault";

/* ─── Mocks ─────────────────────────────────────────────── */

const mockVaultKey = { algorithm: { name: "AES-GCM" } } as unknown as CryptoKey;

// react-dom/server serves useSyncExternalStore from getInitialState() — the
// creation-time state — so post-hoc setState fixtures stay invisible to SSR.
// Rebuild create() on top of real vanilla createStore with getInitialState
// aliased to live state. The store module itself stays fully real.
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
    createState ? build(createState) : build) as unknown as typeof actual;

  return { ...actual, create };
});
// persist is a no-op here — it only touches localStorage, which Node lacks.
vi.mock("zustand/middleware", () => ({
  persist: (config: unknown) => config,
}));

/* ─── Fixtures ──────────────────────────────────────────── */

function seed(partial: Partial<VaultState> = {}) {
  useVault.setState({
    status: "unlocked",
    vaultKey: mockVaultKey,
    items: [],
    vaults: [],
    activeVault: "all",
    selectedId: null,
    settingsTab: "general",
    settingsOpen: true,
    ...partial,
  });
}

beforeEach(() => {
  seed();
});

/* ─── Tests ─────────────────────────────────────────────── */

describe("SettingsView initial-tab handoff", () => {
  it("mounts the Import tab content when seeded with settingsTab=import", () => {
    seed({ settingsTab: "import" });
    const html = renderToStaticMarkup(createElement(SettingsView));

    // Import tab's heading copy; General's "Appearance" must be absent —
    // inactive Radix tabs don't mount their content.
    expect(html).toContain("Click your previous provider");
    expect(html).not.toContain("Appearance");
  });

  it("mounts General for the default entry point", () => {
    seed({ settingsTab: "general" });
    const html = renderToStaticMarkup(createElement(SettingsView));

    expect(html).toContain("Appearance");
    expect(html).not.toContain("Click your previous provider");
  });
});
