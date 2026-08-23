"use client";

import { Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { vaultColorHex } from "@/lib/vault/vault-assets";
import { VAULT_LUCIDE_BY_ID } from "./vault-lucide-icons";

export interface VaultIconProps {
  /** Vault icon id (see VAULT_ICONS). */
  icon: string;
  /** Vault color id (see VAULT_COLORS). */
  color: string;
  /** Pixel size of the square swatch. Default 28. */
  size?: number;
  className?: string;
  /** Render only the raw glyph (no swatch) — used inside dense list rows. */
  bare?: boolean;
}

/**
  * Render a vault's icon inside a colored rounded swatch. The fill is the
  * vault color at ~16% opacity (`${hex}29`); the glyph uses the full hex for contrast.
  * Used by VaultsSidebar rows AND the create-vault-dialog picker preview.
  * The Lucide-component lookup lives in `./vault-lucide-icons` so both this
  * module and the picker share a single source of truth.
  */
export function VaultIcon({ icon, color, size = 28, className, bare = false }: VaultIconProps) {
  const hex = vaultColorHex(color);
  const Resolved = VAULT_LUCIDE_BY_ID[icon] ?? Home;
  const px = `${size}px`;
  const glyph = Math.round(size * 0.55);
  if (bare) {
    return (
      <Resolved
        size={glyph}
        strokeWidth={2}
        style={{ color: hex }}
        className={cn("shrink-0", className)}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg", className)}
      style={{
        width: px,
        height: px,
        backgroundColor: `${hex}29`, // ~16% opacity
        color: hex,
      }}
      aria-hidden="true"
    >
      <Resolved size={glyph} strokeWidth={2} />
    </span>
  );
}
