"use client";

import * as React from "react";
import {
  KeyRound,
  StickyNote,
  CreditCard,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ItemType } from "@/lib/types";

export const ITEM_TYPE_ICONS: Record<ItemType, LucideIcon> = {
  login: KeyRound,
  note: StickyNote,
  card: CreditCard,
  identity: UserRound,
};

export const ITEM_TYPE_COLORS: Record<ItemType, string> = {
  login: "text-violet-400",
  note: "text-amber-400",
  card: "text-emerald-400",
  identity: "text-sky-400",
};

const ICONS = ITEM_TYPE_ICONS;

const COLORS: Record<ItemType, string> = {
  login: "from-violet-500/20 to-violet-500/5 text-violet-400",
  note: "from-amber-500/20 to-amber-500/5 text-amber-400",
  card: "from-emerald-500/20 to-emerald-500/5 text-emerald-400",
  identity: "from-sky-500/20 to-sky-500/5 text-sky-400",
};

export function ItemTypeIcon({
  type,
  className,
  size = "md",
}: {
  type: ItemType;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = ICONS[type];
  const dims = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const box =
    size === "sm" ? "h-7 w-7" : size === "lg" ? "h-10 w-10" : "h-9 w-9";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg bg-gradient-to-br ${COLORS[type]} ${box} ${className ?? ""}`}
    >
      <Icon className={dims} />
    </span>
  );
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  login: "Login",
  note: "Secure Note",
  card: "Card",
  identity: "Identity",
};
