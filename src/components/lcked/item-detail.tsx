"use client";

import * as React from "react";
import {
  Pencil,
  Copy,
  Check,
  Trash2,
  Star,
  CopyPlus,
  ExternalLink,
  Globe,
  Mail,
  User,
  Phone,
  MapPin,
  Building2,
  Calendar,
  ShieldOff,
  RotateCcw,
  KeyRound,
  Lock,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useVault, copyWithAutoClear } from "@/store/vault";
import { ItemTypeIcon, ITEM_TYPE_LABELS } from "./item-icons";
import { TOTPDisplay } from "./totp-display";
import { FaviconIcon } from "./favicon-icon";
import { VaultIcon } from "./vaults-sidebar";
import { format } from "date-fns";
import { cn, isEmail } from "@/lib/utils";

/* -------------------- Field Cluster (Proton-style grouping) ----------------- */

/**
 * A group of related fields sharing a single bordered card with 1px dividers
 * between rows. Matches Proton Pass's FieldsetCluster pattern.
 */
function FieldCluster({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-secondary/10 dark:bg-secondary/10">
      {children}
    </div>
  );
}

/** A single field row inside a FieldCluster. */
function FieldRow({
  label,
  value,
  icon: Icon,
  mono = false,
  masked = false,
  copyable = true,
  first,
  onCopy,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  mono?: boolean;
  masked?: boolean;
  copyable?: boolean;
  first?: boolean;
  onCopy?: () => void;
}) {
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const display = masked && !revealed ? "•".repeat(Math.min(value.length || 8, 12)) : value;

  const handleCopy = async () => {
    if (onCopy) { onCopy(); return; }
    if (!value) return;
    try {
      await copyWithAutoClear(value, label);
      setCopied(true);
      toast.success(`${label} copied`, { description: "Auto-clears in 30s" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard access denied");
    }
  };

  if (!value) return null;

  // Click-to-copy on the whole row. Action buttons below call
  // e.stopPropagation() so they don't double-fire handleCopy or trigger
  // unrelated side effects (e.g. reveal/large-type) via bubbling.
  const rowClickable = copyable && !!value;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-secondary/30",
        !first && "border-t border-border/50",
        rowClickable && "cursor-pointer",
      )}
      onClick={rowClickable ? handleCopy : undefined}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</div>
        <div
          className={cn(
            "truncate text-sm text-foreground/90",
            mono && "font-secret",
          )}
          style={mono ? { fontFeatureSettings: '"tnum" 1, "zero" 1' } : undefined}
        >
          {display || "—"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {masked && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setRevealed((r) => !r);
            }}
            aria-label={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? <ShieldOff className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
        )}
        {copyable && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              void handleCopy();
            }}
            aria-label={`Copy ${label}`}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}

/* -------------------- Main Detail Component ----------------- */

export function ItemDetail() {
  const selectedId = useVault((s) => s.selectedId);
  const items = useVault((s) => s.items);
  const vaults = useVault((s) => s.vaults);
  const setEditorOpen = useVault((s) => s.setEditorOpen);
  const toggleFavorite = useVault((s) => s.toggleFavorite);
  const trashItem = useVault((s) => s.trashItem);
  const restoreItem = useVault((s) => s.restoreItem);
  const permanentlyDeleteItem = useVault((s) => s.permanentlyDeleteItem);
  const duplicateItem = useVault((s) => s.duplicateItem);
  const showFavicons = useVault((s) => s.settings.showFavicons);

  const item = items.find((i) => i.id === selectedId);
  const itemVault = item?.vaultId ? vaults.find((v) => v.id === item.vaultId) ?? null : null;

  // Handlers — defined as consts referencing `item` via closure. They're
  // only ever invoked from inside the `item ?` branch, so `item` is
  // guaranteed to be defined when they run.
  const handleTrash = async () => {
    if (!item) return;
    try { await trashItem(item.id); toast.success("Moved to Trash"); }
    catch { toast.error("Could not move to trash"); }
  };
  const handleRestore = async () => {
    if (!item) return;
    try { await restoreItem(item.id); toast.success("Item restored"); }
    catch { toast.error("Could not restore item"); }
  };
  const handlePermanentDelete = async () => {
    if (!item) return;
    try { await permanentlyDeleteItem(item.id); toast.success("Item permanently deleted"); }
    catch { toast.error("Could not delete item"); }
  };
  const handleDuplicate = async () => {
    if (!item) return;
    try { await duplicateItem(item.id); toast.success("Item duplicated"); }
    catch { toast.error("Could not duplicate item"); }
  };

  return (
    // Stable outer container — never unmounts across item switches, so
    // AnimatePresence can crossfade between items (and the empty state)
    // without the wrapper flashing.
    <div className="flex h-full flex-col">
      <AnimatePresence mode="wait">
        {item ? (
          <motion.div
            key={item.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-full flex-col"
          >
            {/* Header */}
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-3.5">
                {/* Favicon for logins (gated by showFavicons setting),
                    type-icon otherwise. */}
                {showFavicons && item.type === "login" && item.details.urls[0] ? (
                  <FaviconIcon
                    url={item.details.urls[0]}
                    size={44}
                    fallback={<ItemTypeIcon type={item.type} size="lg" />}
                  />
                ) : (
                  <ItemTypeIcon type={item.type} size="lg" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className={cn("truncate text-xl font-semibold", item.trashed && "line-through opacity-50")}>
                      {item.name}
                    </h2>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                    <span className="rounded-md bg-secondary/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {ITEM_TYPE_LABELS[item.type]}
                    </span>
                    {itemVault && (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground/80">
                        ·
                        <VaultIcon icon={itemVault.icon} color={itemVault.color} size={22} bare />
                        <span className="font-medium">{itemVault.name}</span>
                      </span>
                    )}
                    {item.trashed && (
                      <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                        Trashed
                      </span>
                    )}
                  </div>
                </div>
                {/* Action buttons */}
                <div className="flex shrink-0 items-center gap-0.5">
                  {item.trashed ? (
                    <>
                      <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleRestore}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-400" aria-label="Delete permanently">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                            <AlertDialogDescription>
                              &ldquo;{item.name}&rdquo; will be permanently erased. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handlePermanentDelete} className="bg-red-500 text-white hover:bg-red-600">
                              Delete forever
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleFavorite(item.id)} aria-label="Toggle favorite" title="Favorite (F)">
                        <Star className={cn("h-4 w-4", item.favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditorOpen(true, item.id)} aria-label="Edit" title="Edit (⌘E)">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleDuplicate} aria-label="Duplicate" title="Duplicate (D)">
                        <CopyPlus className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-400" aria-label="Move to trash" title="Move to trash (⌫)">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Move to trash?</AlertDialogTitle>
                            <AlertDialogDescription>
                              &ldquo;{item.name}&rdquo; will be moved to Trash. You can restore it later or it will be auto-deleted after 30 days.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleTrash}>Move to trash</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="lcked-scroll flex-1 overflow-y-auto px-5 py-4">
              {item.type === "login" && (
                <div className="space-y-4">
                  {/* Credentials cluster — username label + icon switch on
                      whether the value looks like an email. */}
                  <FieldCluster>
                    <FieldRow
                      label={isEmail(item.details.username) ? "Email" : "Username"}
                      value={item.details.username}
                      icon={isEmail(item.details.username) ? Mail : User}
                      first
                    />
                    <FieldRow label="Password" value={item.details.password} mono masked icon={KeyRound} />
                  </FieldCluster>

                  {/* TOTP */}
                  {item.details.totp && <TOTPDisplay secret={item.details.totp} />}

                  {/* Websites */}
                  {item.details.urls.filter(Boolean).length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 px-1">Websites</div>
                      <FieldCluster>
                        {item.details.urls.filter(Boolean).map((url, idx) => (
                          <div key={idx} className={cn("group flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-secondary/30", idx > 0 && "border-t border-border/50")}>
                            <Globe className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                            <a
                              href={url.startsWith("http") ? url : `https://${url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-native-link="true"
                              className="truncate text-sm text-primary hover:underline"
                            >
                              {url}
                            </a>
                            <a
                              href={url.startsWith("http") ? url : `https://${url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-native-link="true"
                              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                              aria-label="Open"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        ))}
                      </FieldCluster>
                    </div>
                  )}

                  {/* Notes */}
                  {item.details.notes && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 px-1">Note</div>
                      <div className="rounded-xl border border-border bg-secondary/10 p-3.5 dark:bg-secondary/10">
                        <p className="whitespace-pre-wrap text-sm text-foreground/80">{item.details.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {item.type === "note" && (
                <div className="rounded-xl border border-border bg-secondary/10 p-4 dark:bg-secondary/10">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{item.details.content}</p>
                </div>
              )}

              {item.type === "card" && (
                <div className="space-y-4">
                  <FieldCluster>
                    <FieldRow label="Cardholder" value={item.details.cardholder} icon={User} first />
                    <FieldRow label="Card number" value={item.details.number} mono masked icon={CreditCard} />
                    <FieldRow label="CVV" value={item.details.cvv} mono masked icon={Lock} />
                    <FieldRow label="Expiry" value={item.details.expiry} mono icon={Calendar} />
                    <FieldRow label="PIN" value={item.details.pin} mono masked icon={KeyRound} />
                  </FieldCluster>
                  {item.details.notes && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 px-1">Note</div>
                      <div className="rounded-xl border border-border bg-secondary/10 p-3.5 dark:bg-secondary/10">
                        <p className="whitespace-pre-wrap text-sm text-foreground/80">{item.details.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {item.type === "identity" && (
                <div className="space-y-4">
                  <FieldCluster>
                    <div className="grid grid-cols-2 divide-x divide-border/50">
                      <FieldRow label="First name" value={item.details.firstName} first />
                      <FieldRow label="Last name" value={item.details.lastName} first />
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-border/50">
                      <FieldRow label="Email" value={item.details.email} icon={Mail} />
                      <FieldRow label="Phone" value={item.details.phone} icon={Phone} />
                    </div>
                    <FieldRow label="Company" value={item.details.company} icon={Building2} />
                  </FieldCluster>
                  <FieldCluster>
                    <FieldRow label="Address" value={item.details.address1} icon={MapPin} first />
                    {item.details.address2 && <FieldRow label="Address line 2" value={item.details.address2} />}
                    <div className="grid grid-cols-2 divide-x divide-border/50">
                      <FieldRow label="City" value={item.details.city} />
                      <FieldRow label="State" value={item.details.state} />
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-border/50">
                      <FieldRow label="ZIP" value={item.details.zip} />
                      <FieldRow label="Country" value={item.details.country} />
                    </div>
                  </FieldCluster>
                  {item.details.notes && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 px-1">Note</div>
                      <div className="rounded-xl border border-border bg-secondary/10 p-3.5 dark:bg-secondary/10">
                        <p className="whitespace-pre-wrap text-sm text-foreground/80">{item.details.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Custom fields */}
              {item.customFields.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 px-1">Custom fields</div>
                  <FieldCluster>
                    {item.customFields.map((cf, idx) => (
                      <FieldRow
                        key={idx}
                        label={cf.name || "Field"}
                        value={cf.value}
                        masked={cf.type === "hidden"}
                        mono={cf.type === "hidden"}
                        first={idx === 0}
                      />
                    ))}
                  </FieldCluster>
                </div>
              )}

              {/* Timestamps */}
              <div className="mt-6 flex items-center gap-4 border-t border-border/40 pt-4 text-[11px] text-muted-foreground/70">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Created {format(new Date(item.createdAt), "MMM d, yyyy")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Updated {format(new Date(item.updatedAt), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-full flex-col items-center justify-center px-6 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/20">
              <Copy className="h-7 w-7 text-muted-foreground/70" />
            </div>
            <h3 className="text-sm font-medium text-foreground/80">Select an item</h3>
            <p className="mt-1.5 max-w-xs text-xs text-muted-foreground/70">
              Pick an item from the list, or press <kbd className="rounded border border-border bg-secondary/30 px-1 font-mono text-[10px]">⌘\</kbd> for commands.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
