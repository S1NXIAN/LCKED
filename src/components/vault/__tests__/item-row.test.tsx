/**
 * Item row — favicon contract.
 * ---------------------------------------------------------------------------
 * The "Show website favicons" setting must gate every list-row favicon so an
 * OFF switch makes no third-party request. A blank leading URL slot (the
 * editor always keeps one) must not hide a URL stored in a later slot.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ItemRow } from "@/components/vault/item-list/item-row";
import type { VaultItem } from "@/lib/types";

const URLS = ["https://example.com"];

const LOGIN: VaultItem = {
  id: "login-1",
  name: "Example",
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
  details: {
    username: "u",
    password: "p",
    urls: URLS,
    totp: "",
    notes: "",
  },
};

function renderRow(showFavicons: boolean, urls: string[] = URLS): string {
  const item = {
    ...LOGIN,
    details: { ...LOGIN.details, urls },
  } as VaultItem;
  return renderToStaticMarkup(
    createElement(ItemRow, {
      item,
      active: false,
      checked: false,
      multiSelect: false,
      isTrashView: false,
      hoverItemActions: true,
      blurEmailMode: "off",
      showFavicons,
      activeVaultId: "all",
      vaults: [],
      dragIds: [item.id],
      onPick: () => {},
      onToggleSelected: () => {},
      onRestore: () => {},
      onPermanentDelete: () => {},
      onCopyField: () => {},
      onToggleFavorite: () => {},
      onTogglePin: () => {},
      onEdit: () => {},
      onTrash: () => {},
      onCopyToVault: () => {},
    }),
  );
}

describe("item row favicons", () => {
  it("renders no favicon request when the setting is off", () => {
    const html = renderRow(false);
    expect(html).not.toContain("icons.duckduckgo.com");
  });

  it("renders the favicon when the setting is on", () => {
    const html = renderRow(true);
    expect(html).toContain("https://icons.duckduckgo.com/ip3/example.com.ico");
  });

  it("uses the first non-blank URL slot", () => {
    const html = renderRow(true, ["", "  ", "https://second.example"]);
    expect(html).toContain(
      "https://icons.duckduckgo.com/ip3/second.example.ico",
    );
  });
});
