"use client";

import {
  CheckSquare,
  CopyPlus,
  KeyRound,
  Link2,
  Mail,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  Square,
  Star,
  Trash2,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { VaultItem } from "@/lib/types";
import { cn, isEmail } from "@/lib/utils";

import { FaviconIcon } from "../favicon-icon";
import { ItemTypeIcon } from "../item-icons";
import { VaultIcon } from "../vault-icon";

function subtitle(item: VaultItem): string {
  switch (item.type) {
    case "login":
      return item.details.username || item.details.urls[0] || "—";
    case "note":
      return (item.details.content || "Empty note").replace(/\n/g, " ").trim();
    case "card":
      return (
        item.details.brand ||
        item.details.number
          .slice(-4)
          .padStart(item.details.number.length, "•") ||
        "—"
      );
    case "identity":
      return (
        [item.details.firstName, item.details.lastName]
          .filter(Boolean)
          .join(" ") ||
        item.details.email ||
        "—"
      );
  }
}

/**
 * The per-item row, extracted so it can carry its own ContextMenu without
 * forcing the parent map to re-render every row when one is right-clicked.
 */
export function ItemRow({
  item,
  active,
  checked,
  multiSelect,
  isTrashView,
  hoverItemActions,
  blurEmailMode,
  vaults,
  dragIds,
  onPick,
  onRestore,
  onPermanentDelete,
  onCopyField,
  onToggleFavorite,
  onTogglePin,
  onEdit,
  onTrash,
  onCopyToVault,
}: {
  item: VaultItem;
  active: boolean;
  checked: boolean;
  multiSelect: boolean;
  isTrashView: boolean;
  hoverItemActions: boolean;
  blurEmailMode: "off" | "hover" | "full";
  /** The current vault filter id ("all" | "favorites" | "trash" | vaultId). */
  activeVaultId: string;
  /** All user-defined vaults — for the "Copy to vault" submenu. */
  vaults: { id: string; name: string; icon: string; color: string }[];
  /** IDs to move when this row is dragged. In multi-select mode, if this row
   *  is selected, ALL selected IDs are moved. If not selected, just this one
   *  (and it's added to the selection first). Single-select: just this id. */
  dragIds: string[];
  onPick: () => void;
  onToggleSelected: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
  onCopyField: (value: string | undefined, label: string) => void;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onTrash: () => void;
  /** Duplicate the item into a target vault. The copy is a fully independent
   *  record — deleting it does NOT affect the original. */
  onCopyToVault: (vaultId: string) => void;
}) {
  // Per-item context menu — wraps the button so left-click still picks the
  // item, and right-click opens the context menu with copy/edit/etc.
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={(e) => {
            // Only respond to left-clicks (button === 0). Right-clicks
            // (button === 2) open the context menu — we must NOT fire onPick
            // here, otherwise the selection change re-renders the list and
            // the context menu loses its anchor / closes immediately.
            if (e.button !== 0) return;
            onPick();
          }}
          onContextMenu={(e) => {
            // Prevent the list-level ContextMenu from also firing when
            // right-clicking an item row — only the item's own ContextMenu
            // should open.
            e.stopPropagation();
          }}
          role="option"
          aria-selected={active || checked}
          // Always draggable — multi-select drag carries all selected IDs.
          draggable
          onDragStart={(e) => {
            // Multi-select drag: carry ALL selected IDs as a JSON array.
            // Single-select drag: carry just this item's id.
            if (dragIds.length > 1) {
              e.dataTransfer.setData(
                "text/lcked-items",
                JSON.stringify(dragIds),
              );
            }
            e.dataTransfer.setData("text/lcked-item", item.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          className={cn(
            "group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
            active ? "text-accent-foreground" : "hover:bg-muted/60",
            checked && "bg-accent/60",
          )}
        >
          {/* Multi-select checkbox OR favicon/type-icon */}
          {multiSelect ? (
            <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center">
              {checked ? (
                <CheckSquare className="text-primary h-5 w-5" />
              ) : (
                <Square className="text-muted-foreground h-5 w-5" />
              )}
            </span>
          ) : item.type === "login" && item.details.urls[0] ? (
            <FaviconIcon
              url={item.details.urls[0]}
              size={28}
              className="relative z-10"
              fallback={
                <ItemTypeIcon
                  type={item.type}
                  size="sm"
                  className="relative z-10"
                />
              }
            />
          ) : (
            <ItemTypeIcon
              type={item.type}
              size="sm"
              className="relative z-10"
            />
          )}

          <div className="relative z-10 min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "truncate text-sm font-medium",
                  item.trashed && "line-through opacity-60",
                )}
              >
                {item.name}
              </span>
              {/* Pin icon — shown when pinned AND not trashed. Sits before the
                                    favorite star so both can coexist gracefully. */}
              {item.pinned && !item.trashed && (
                <Pin className="fill-primary/20 text-primary h-3 w-3 shrink-0" />
              )}
              {item.favorite && !item.trashed && (
                <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
              )}
            </div>
            <div
              className={cn(
                "text-muted-foreground truncate text-xs",
                // Privacy blur for email/username subtitles. Login subtitles
                // are always the username (often an email); identity subtitles
                // may be a name OR an email. We blur both for consistency.
                //  - "hover": blurred by default, reveals on row hover OR when
                //    the row is the active selection.
                //  - "full":  always blurred — even on hover. Reveal only in
                //    the detail pane (handled there).
                // The blur uses CSS filter (GPU-composited) + a 200ms transition
                // so the reveal is smooth. Lightweight: no JS, no re-render.
                blurEmailMode !== "off" &&
                  (item.type === "login" || item.type === "identity") &&
                  "lcked-email-blur",
                blurEmailMode === "hover" && "lcked-email-blur--hoverable",
                blurEmailMode === "hover" &&
                  (active || checked) &&
                  "lcked-email-blur--revealed",
              )}
            >
              {subtitle(item)}
            </div>
          </div>

          {/* Type badge OR trash hover actions */}
          {isTrashView ? (
            <div
              className={cn(
                "relative z-10 flex shrink-0 items-center gap-0.5 transition-opacity",
                hoverItemActions
                  ? "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                  : "opacity-100",
              )}
            >
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
                aria-label="Restore"
                title="Restore"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground h-7 w-7 hover:text-signal-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onPermanentDelete();
                }}
                aria-label="Delete permanently"
                title="Delete permanently"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {item.type === "login" && (
          <>
            <ContextMenuItem
              onSelect={() =>
                onCopyField(
                  item.details.username,
                  isEmail(item.details.username) ? "Email" : "Username",
                )
              }
              disabled={!item.details.username}
            >
              {isEmail(item.details.username) ? (
                <Mail className="h-3.5 w-3.5" />
              ) : (
                <User className="h-3.5 w-3.5" />
              )}
              {isEmail(item.details.username) ? "Copy email" : "Copy username"}
            </ContextMenuItem>
            {item.details.password && (
              <ContextMenuItem
                onSelect={() => onCopyField(item.details.password, "Password")}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Copy password
              </ContextMenuItem>
            )}
            {item.details.urls[0] && (
              <ContextMenuItem
                onSelect={() => onCopyField(item.details.urls[0], "URL")}
              >
                <Link2 className="h-3.5 w-3.5" />
                Copy URL
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
          </>
        )}
        {!isTrashView && (
          <ContextMenuItem onSelect={onToggleFavorite}>
            <Star className="h-3.5 w-3.5" />
            {item.favorite ? "Unfavorite" : "Favorite"}
          </ContextMenuItem>
        )}
        {!isTrashView && (
          <ContextMenuItem onSelect={onTogglePin}>
            {item.pinned ? (
              <PinOff className="h-3.5 w-3.5" />
            ) : (
              <Pin className="h-3.5 w-3.5" />
            )}
            {item.pinned ? "Unpin" : "Pin to top"}
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </ContextMenuItem>
        {/* Copy to vault — creates a fully independent duplicate of the item
                        in the target vault. The copy gets its own ID, so deleting it
                        never affects the original (and vice versa). Shown in all non-trash
                        views as long as there's at least one vault to copy to. */}
        {!isTrashView && vaults.length > 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <CopyPlus className="h-3.5 w-3.5" />
                Copy to vault
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                {vaults.map((v) => (
                  <ContextMenuItem
                    key={v.id}
                    onSelect={() => onCopyToVault(v.id)}
                  >
                    <VaultIcon icon={v.icon} color={v.color} size={16} />
                    <span className="truncate">{v.name}</span>
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}
        {!isTrashView && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onSelect={onTrash}>
              <Trash2 className="h-3.5 w-3.5" />
              Move to trash
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
