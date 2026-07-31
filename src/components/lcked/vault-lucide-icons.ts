/**
 * LCKED — Shared vault-icon → Lucide component map
 * ---------------------------------------------------------------------------
 * Single source of truth for the vault-icon id → Lucide component lookup.
 * Mirrors `VAULT_ICONS` in `src/lib/vault-assets.ts` 1:1 — keep both in sync
 * when adding a new vault icon. Consumed by `VaultsSidebar` (rendered inside
 * the colored swatch) and `CreateVaultDialog` (rendered as a raw glyph in the
 * picker grid).
 */
import {
  Home,
  Briefcase,
  Gift,
  ShoppingCart,
  Heart,
  Star,
  Shield,
  Lock,
  Key,
  Eye,
  User,
  Users,
  Building,
  Banknote,
  CreditCard,
  Wallet,
  Plane,
  Car,
  Fuel,
  Globe,
  Mail,
  Phone,
  Smartphone,
  Laptop,
  Server,
  Cloud,
  Database,
  HardDrive,
  Cpu,
  Network,
} from "lucide-react";

export const VAULT_LUCIDE_BY_ID: Record<string, LucideIcon> = {
  home: Home,
  briefcase: Briefcase,
  gift: Gift,
  "shopping-cart": ShoppingCart,
  heart: Heart,
  star: Star,
  shield: Shield,
  lock: Lock,
  key: Key,
  eye: Eye,
  user: User,
  users: Users,
  building: Building,
  bank: Banknote,
  "credit-card": CreditCard,
  wallet: Wallet,
  plane: Plane,
  car: Car,
  fuel: Fuel,
  globe: Globe,
  mail: Mail,
  phone: Phone,
  smartphone: Smartphone,
  laptop: Laptop,
  server: Server,
  cloud: Cloud,
  database: Database,
  "hard-drive": HardDrive,
  cpu: Cpu,
  network: Network,
};
