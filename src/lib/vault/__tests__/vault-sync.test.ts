import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VaultSyncEvent } from "@/lib/vault/vault-sync";

type Listener = (event: { data: unknown }) => void;

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  posted: unknown[] = [];
  private listeners = new Set<Listener>();

  constructor(public name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown) {
    this.posted.push(data);
  }

  addEventListener(type: string, listener: Listener) {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    if (type === "message") this.listeners.delete(listener);
  }

  close() {}

  emit(data: unknown) {
    for (const listener of this.listeners) listener({ data });
  }
}

async function loadModule() {
  vi.resetModules();
  return import("@/lib/vault/vault-sync");
}

beforeEach(() => {
  FakeBroadcastChannel.instances = [];
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("vault-sync", () => {
  it("broadcasts a lock on the shared channel", async () => {
    const { broadcastVaultEvent } = await loadModule();

    broadcastVaultEvent("lock");

    const channel = FakeBroadcastChannel.instances[0];
    expect(channel.name).toBe("lcked-vault");
    expect(channel.posted).toEqual([{ type: "lock" }]);
  });

  it("delivers lock and reset events from another tab", async () => {
    const { onVaultSync } = await loadModule();
    const events: VaultSyncEvent[] = [];
    onVaultSync((event) => events.push(event));

    const channel = FakeBroadcastChannel.instances[0];
    channel.emit({ type: "lock" });
    channel.emit({ type: "reset" });

    expect(events).toEqual(["lock", "reset"]);
  });

  it("ignores unrelated messages", async () => {
    const { onVaultSync } = await loadModule();
    const handler = vi.fn();
    onVaultSync(handler);

    FakeBroadcastChannel.instances[0].emit({ type: "something-else" });
    FakeBroadcastChannel.instances[0].emit(null);

    expect(handler).not.toHaveBeenCalled();
  });

  it("stops delivering after unsubscribe", async () => {
    const { onVaultSync } = await loadModule();
    const handler = vi.fn();
    const unsubscribe = onVaultSync(handler);

    unsubscribe();
    FakeBroadcastChannel.instances[0].emit({ type: "lock" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("no-ops when BroadcastChannel is unavailable", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const { broadcastVaultEvent, onVaultSync } = await loadModule();
    const handler = vi.fn();

    expect(() => broadcastVaultEvent("lock")).not.toThrow();
    expect(() => onVaultSync(handler)()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});
