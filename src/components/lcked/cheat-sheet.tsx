"use client";

import * as React from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SHORTCUTS, formatBinding, useKeyboardSettings } from "@/lib/keyboard";
import type { ShortcutDef } from "@/lib/keyboard";

const CATEGORY_LABELS: Record<ShortcutDef["category"], string> = {
  global: "Global",
  list: "List navigation",
  detail: "Detail & copy",
  palette: "Command palette",
};

const CATEGORY_ORDER: ShortcutDef["category"][] = ["global", "list", "detail", "palette"];

/**
 * Context-aware keyboard cheat sheet. Press `?` (outside inputs) to open.
 * Lists every shortcut grouped by category with formatted keycaps. Fully
 * screen-reader accessible (real Dialog, not an overlay).
 */
export function CheatSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const bindingFor = useKeyboardSettings((s) => s.bindingFor);

  const grouped = React.useMemo(() => {
    const map = new Map<ShortcutDef["category"], ShortcutDef[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const s of SHORTCUTS) map.get(s.category)!.push(s);
    return map;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription className="sr-only">
            Complete list of LCKED keyboard shortcuts, grouped by category.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="lcked-scroll max-h-[calc(85vh-80px)]">
          <div className="px-5 py-4">
            {CATEGORY_ORDER.map((cat) => {
              const defs = grouped.get(cat) ?? [];
              if (defs.length === 0) return null;
              return (
                <section key={cat} className="mb-5 last:mb-0">
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </h3>
                  <ul className="space-y-1">
                    {defs.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40"
                      >
                        <span className="text-sm text-foreground/90">{s.label}</span>
                        <kbd
                          className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
                          aria-keyshortcuts={bindingFor(s.id)}
                        >
                          {formatBinding(bindingFor(s.id))}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
              Single-key shortcuts are disabled while typing. Disable or remap
              them in Settings → Keyboard.
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
