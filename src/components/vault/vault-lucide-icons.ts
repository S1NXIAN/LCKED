/**
 * LCKED — Vault icon catalog
 * ---------------------------------------------------------------------------
 * Single source of truth for vault icon ids, picker labels, and their Lucide
 * components. Consumed by `VaultIcon` (swatch glyph), `OrganizeVaultDialog`,
 * and `CreateVaultDialog`'s icon picker grid.
 */
import {
  Banknote,
  Briefcase,
  Building,
  Car,
  Cloud,
  Cpu,
  CreditCard,
  Database,
  Eye,
  Fuel,
  Gift,
  Globe,
  HardDrive,
  Heart,
  Home,
  Key,
  Laptop,
  Lock,
  type LucideIcon,
  Mail,
  Network,
  Phone,
  Plane,
  Server,
  Shield,
  ShoppingCart,
  Smartphone,
  Star,
  User,
  Users,
  Wallet,
} from "lucide-react";

export interface VaultIconDef {
  /** Stable id — persisted on the VaultDef. Never rename. */
  id: string;
  /** Picker label / aria-label. */
  label: string;
  /** Lucide glyph rendered in the swatch + picker. */
  Icon: LucideIcon;
}

/** 30 vault icon ids that cover the common vault use-cases. */
export const VAULT_ICONS: VaultIconDef[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "briefcase", label: "Work", Icon: Briefcase },
  { id: "gift", label: "Gifts", Icon: Gift },
  { id: "shopping-cart", label: "Shopping", Icon: ShoppingCart },
  { id: "heart", label: "Personal", Icon: Heart },
  { id: "star", label: "Favorites", Icon: Star },
  { id: "shield", label: "Security", Icon: Shield },
  { id: "lock", label: "Private", Icon: Lock },
  { id: "key", label: "Keys", Icon: Key },
  { id: "eye", label: "Watch", Icon: Eye },
  { id: "user", label: "Identity", Icon: User },
  { id: "users", label: "Family", Icon: Users },
  { id: "building", label: "Business", Icon: Building },
  { id: "bank", label: "Banking", Icon: Banknote },
  { id: "credit-card", label: "Cards", Icon: CreditCard },
  { id: "wallet", label: "Wallet", Icon: Wallet },
  { id: "plane", label: "Travel", Icon: Plane },
  { id: "car", label: "Vehicle", Icon: Car },
  { id: "fuel", label: "Fuel", Icon: Fuel },
  { id: "globe", label: "Web", Icon: Globe },
  { id: "mail", label: "Email", Icon: Mail },
  { id: "phone", label: "Phone", Icon: Phone },
  { id: "smartphone", label: "Mobile", Icon: Smartphone },
  { id: "laptop", label: "Devices", Icon: Laptop },
  { id: "server", label: "Servers", Icon: Server },
  { id: "cloud", label: "Cloud", Icon: Cloud },
  { id: "database", label: "Data", Icon: Database },
  { id: "hard-drive", label: "Storage", Icon: HardDrive },
  { id: "cpu", label: "Systems", Icon: Cpu },
  { id: "network", label: "Network", Icon: Network },
];

/** Default icon used when creating a vault without an explicit choice. */
export const DEFAULT_VAULT_ICON = VAULT_ICONS[0].id; // home

/** id → Lucide component lookup (derived from VAULT_ICONS). */
export const VAULT_LUCIDE_BY_ID: Record<string, LucideIcon> =
  Object.fromEntries(VAULT_ICONS.map((ic) => [ic.id, ic.Icon]));
