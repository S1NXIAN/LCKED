/**
 * LCKED — Vault assets (colors + icons)
 * ---------------------------------------------------------------------------
 * Static catalogs for user-defined vaults (Proton Pass–style colored
 * containers). Each `VaultDef` stores a `color` and `icon` id; this module is
 * the single source of truth that maps those ids to actual values.
 * Colors are the 10 Proton Pass vault colors (named after the closest CSS color
 * name to keep the variable names stable). Vault icon ids + labels + their
 * Lucide components live in `src/components/vault/vault-lucide-icons.ts`.
 */

export interface VaultColor {
  /** Stable id — persisted on the VaultDef. Never rename. */
  id: string;
  /** Human-readable label for the picker. */
  label: string;
  /** Hex value used inline + as the matching CSS variable. */
  hex: string;
}

/**
 * The 10 Proton Pass vault colors. Ids mirror the color names so CSS vars
 * (`--vault-heliotrope` etc.) line up 1:1 with the picker.
 */
export const VAULT_COLORS: VaultColor[] = [
  { id: "heliotrope", label: "Heliotrope", hex: "#A779FF" },
  { id: "mauvelous", label: "Mauvelous", hex: "#F29292" },
  { id: "marigold", label: "Marigold", hex: "#F7D775" },
  { id: "de-york", label: "De York", hex: "#91C799" },
  { id: "jordy-blue", label: "Jordy Blue", hex: "#92B3F2" },
  { id: "lavender-magenta", label: "Lavender Magenta", hex: "#EB8DD6" },
  { id: "chestnut-rose", label: "Chestnut Rose", hex: "#CD5A6F" },
  { id: "porsche", label: "Porsche", hex: "#E4A367" },
  { id: "mercury", label: "Mercury", hex: "#E6E6E6" },
  { id: "water-leaf", label: "Water Leaf", hex: "#9EE2E6" },
];

/** Default color used when creating a vault without an explicit choice. */
export const DEFAULT_VAULT_COLOR = VAULT_COLORS[0].id; // heliotrope

/**
 * Resolve a vault color id to its hex value. Falls back to the default
 * (heliotrope) so a stale id from an older LCKED version never crashes the UI.
 */
export function vaultColorHex(id: string | null | undefined): string {
  if (!id) return VAULT_COLORS[0].hex;
  const c = VAULT_COLORS.find((v) => v.id === id);
  return c ? c.hex : VAULT_COLORS[0].hex;
}
