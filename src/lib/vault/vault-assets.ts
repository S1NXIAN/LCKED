/**
 * LCKED — Vault assets (colors + icons)
 * ---------------------------------------------------------------------------
 * Static catalogs for user-defined vaults (Proton Pass–style colored
 * containers). Each `VaultDef` stores a `color` and `icon` id; this module is
 * the single source of truth that maps those ids to actual values.
 *
 * Colors are the 10 Proton Pass vault colors (named after the closest CSS color
 * name to keep the variable names stable). Icons are 30 ids; the matching
 * Lucide components live in `vault-lucide-icons.ts` (`VAULT_LUCIDE_BY_ID`).
 */

export interface VaultColor {
  /** Stable id — persisted on the VaultDef. Never rename. */
  id: string;
  /** Human-readable label for the picker. */
  label: string;
  /** Hex value used inline + as the matching CSS variable. */
  hex: string;
}

export interface VaultIcon {
  /** Stable id — persisted on the VaultDef. Never rename. */
  id: string;
  /** Picker label. */
  label: string;
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

/** 30 vault icon ids that cover the common vault use-cases. */
export const VAULT_ICONS: VaultIcon[] = [
  { id: "home", label: "Home" },
  { id: "briefcase", label: "Work" },
  { id: "gift", label: "Gifts" },
  { id: "shopping-cart", label: "Shopping" },
  { id: "heart", label: "Personal" },
  { id: "star", label: "Favorites" },
  { id: "shield", label: "Security" },
  { id: "lock", label: "Private" },
  { id: "key", label: "Keys" },
  { id: "eye", label: "Watch" },
  { id: "user", label: "Identity" },
  { id: "users", label: "Family" },
  { id: "building", label: "Business" },
  { id: "bank", label: "Banking" },
  { id: "credit-card", label: "Cards" },
  { id: "wallet", label: "Wallet" },
  { id: "plane", label: "Travel" },
  { id: "car", label: "Vehicle" },
  { id: "fuel", label: "Fuel" },
  { id: "globe", label: "Web" },
  { id: "mail", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "smartphone", label: "Mobile" },
  { id: "laptop", label: "Devices" },
  { id: "server", label: "Servers" },
  { id: "cloud", label: "Cloud" },
  { id: "database", label: "Data" },
  { id: "hard-drive", label: "Storage" },
  { id: "cpu", label: "Systems" },
  { id: "network", label: "Network" },
];

/** Default color + icon used when creating a vault without explicit choices. */
export const DEFAULT_VAULT_COLOR = VAULT_COLORS[0].id; // heliotrope
export const DEFAULT_VAULT_ICON = VAULT_ICONS[0].id; // home

/**
 * Resolve a vault color id to its hex value. Falls back to the default
 * (heliotrope) so a stale id from an older LCKED version never crashes the UI.
 */
export function vaultColorHex(id: string | null | undefined): string {
  if (!id) return VAULT_COLORS[0].hex;
  const c = VAULT_COLORS.find((v) => v.id === id);
  return c ? c.hex : VAULT_COLORS[0].hex;
}
