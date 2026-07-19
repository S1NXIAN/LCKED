/**
 * LCKED — Vault assets (colors + icons)
 * ---------------------------------------------------------------------------
 * Static catalogs for user-defined vaults (Proton Pass–style colored
 * containers). Each `VaultDef` stores a `color` and `icon` id; this module is
 * the single source of truth that maps those ids to actual values.
 *
 * Colors are the 10 Proton Pass vault colors (named after the closest CSS color
 * name to keep the variable names stable). Icons are 30 Lucide icon names so
 * the UI can render them via the dynamic <LucideIcon> shim without shipping
 * every icon bundle.
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
  /** Lucide icon name (matches the export name in lucide-react). */
  lucide: string;
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

/** 30 Lucide icon names that cover the common vault use-cases. */
export const VAULT_ICONS: VaultIcon[] = [
  { id: "home", lucide: "Home", label: "Home" },
  { id: "briefcase", lucide: "Briefcase", label: "Work" },
  { id: "gift", lucide: "Gift", label: "Gifts" },
  { id: "shopping-cart", lucide: "ShoppingCart", label: "Shopping" },
  { id: "heart", lucide: "Heart", label: "Personal" },
  { id: "star", lucide: "Star", label: "Favorites" },
  { id: "shield", lucide: "Shield", label: "Security" },
  { id: "lock", lucide: "Lock", label: "Private" },
  { id: "key", lucide: "Key", label: "Keys" },
  { id: "eye", lucide: "Eye", label: "Watch" },
  { id: "user", lucide: "User", label: "Identity" },
  { id: "users", lucide: "Users", label: "Family" },
  { id: "building", lucide: "Building", label: "Business" },
  { id: "bank", lucide: "Banknote", label: "Banking" },
  { id: "credit-card", lucide: "CreditCard", label: "Cards" },
  { id: "wallet", lucide: "Wallet", label: "Wallet" },
  { id: "plane", lucide: "Plane", label: "Travel" },
  { id: "car", lucide: "Car", label: "Vehicle" },
  { id: "fuel", lucide: "Fuel", label: "Fuel" },
  { id: "globe", lucide: "Globe", label: "Web" },
  { id: "mail", lucide: "Mail", label: "Email" },
  { id: "phone", lucide: "Phone", label: "Phone" },
  { id: "smartphone", lucide: "Smartphone", label: "Mobile" },
  { id: "laptop", lucide: "Laptop", label: "Devices" },
  { id: "server", lucide: "Server", label: "Servers" },
  { id: "cloud", lucide: "Cloud", label: "Cloud" },
  { id: "database", lucide: "Database", label: "Data" },
  { id: "hard-drive", lucide: "HardDrive", label: "Storage" },
  { id: "cpu", lucide: "Cpu", label: "Systems" },
  { id: "network", lucide: "Network", label: "Network" },
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

/** Resolve a vault color label. */
export function vaultColorLabel(id: string | null | undefined): string {
  if (!id) return VAULT_COLORS[0].label;
  const c = VAULT_COLORS.find((v) => v.id === id);
  return c ? c.label : VAULT_COLORS[0].label;
}

/**
 * Resolve a vault icon id to a Lucide icon name. Falls back to "Home" so a
 * stale id never crashes the dynamic <LucideIcon> renderer.
 */
export function vaultIconName(id: string | null | undefined): string {
  if (!id) return VAULT_ICONS[0].lucide;
  const i = VAULT_ICONS.find((v) => v.id === id);
  return i ? i.lucide : VAULT_ICONS[0].lucide;
}

/** Resolve a vault icon label. */
export function vaultIconLabel(id: string | null | undefined): string {
  if (!id) return VAULT_ICONS[0].label;
  const i = VAULT_ICONS.find((v) => v.id === id);
  return i ? i.label : VAULT_ICONS[0].label;
}
