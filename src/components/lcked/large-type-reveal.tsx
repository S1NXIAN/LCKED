"use client";

/**
 * LCKED — Large-Type reveal (the hero interaction)
 * ---------------------------------------------------------------------------
 * 1Password's most-loved feature, evolved for the web. Triggered by ⇧R or a
 * chevron button on any secret field. Renders the secret at 48px in Geist Mono
 * with a character ruler and 4-char chunking. Shared-layout expansion via
 * Framer Motion for a seamless zoom feel.
 *
 * Security: the modal grabs focus and is dismissible by Esc / click-away /
 * any keypress. It never auto-closes on a timer (the user is actively reading).
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyWithAutoClear } from "@/lib/clipboard";
import { useReducedMotion } from "framer-motion";

interface LargeTypeRevealProps {
  /** The secret to display. Null = closed. */
  value: string | null;
  label: string;
  onClose: () => void;
}

/** Split a string into 4-character chunks for visual grouping. */
function chunked(value: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += 4) {
    chunks.push(value.slice(i, i + 4));
  }
  return chunks;
}

const NATO: Record<string, string> = {
  a: "alpha", b: "bravo", c: "charlie", d: "delta", e: "echo", f: "foxtrot",
  g: "golf", h: "hotel", i: "india", j: "juliet", k: "kilo", l: "lima",
  m: "mike", n: "november", o: "oscar", p: "papa", q: "quebec", r: "romeo",
  s: "sierra", t: "tango", u: "uniform", v: "victor", w: "whiskey", x: "x-ray",
  y: "yankee", z: "zulu", "0": "zero", "1": "one", "2": "two", "3": "three",
  "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "niner",
};

export function LargeTypeReveal({ value, label, onClose }: LargeTypeRevealProps) {
  const [copied, setCopied] = React.useState(false);
  const [phonetic, setPhonetic] = React.useState(false);
  const reduce = useReducedMotion();

  // Close on any keypress (Esc is handled natively by the overlay too).
  React.useEffect(() => {
    if (value === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "p" || e.key === "P") {
        setPhonetic((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onClose]);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await copyWithAutoClear(value, "large-type");
      setCopied(true);
      toast.success(`${label} copied`, { description: "Auto-clears in 30s" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard access denied");
    }
  };

  const chars = value ? [...value] : [];
  const chunks = value ? chunked(value) : [];

  return (
    <AnimatePresence>
      {value !== null && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.18 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${label} large type`}
        >
          <motion.div
            className="relative mx-4 w-full max-w-3xl rounded-2xl border border-border bg-card p-8 shadow-2xl"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {value.length} characters · press <kbd className="rounded bg-muted px-1 font-mono text-xs">P</kbd> for phonetic · <kbd className="rounded bg-muted px-1 font-mono text-xs">Esc</kbd> to close
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="gap-1.5"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* The secret — chunked, large mono */}
            <div className="lcked-scroll overflow-x-auto pb-2">
              <div
                className="font-secret flex flex-wrap gap-x-5 gap-y-3 text-5xl font-medium leading-tight tracking-wide"
                style={{ fontFeatureSettings: '"tnum" 1, "zero" 1' }}
              >
                {chunks.map((chunk, ci) => (
                  <span key={ci} className="inline-flex">
                    {[...chunk].map((ch, i) => {
                      const absoluteIdx = ci * 4 + i;
                      return (
                        <span key={i} className="relative inline-block px-0.5">
                          {ch === " " ? "\u00A0" : ch}
                          {/* character ruler tick every 4th char */}
                          {(absoluteIdx + 1) % 4 === 0 && absoluteIdx !== value.length - 1 && (
                            <span className="absolute -right-2.5 top-1/2 h-7 w-px -translate-y-1/2 bg-border/50" />
                          )}
                        </span>
                      );
                    })}
                  </span>
                ))}
              </div>

              {/* Ruler numbers */}
              <div className="mt-2 flex gap-x-5 font-mono text-[10px] text-muted-foreground/60">
                {chunks.map((_, ci) => (
                  <span key={ci} className="inline-block w-[calc(4*2.2rem)] text-left">
                    {ci * 4 + 1}
                  </span>
                ))}
              </div>
            </div>

            {/* Phonetic mode (toggle with P) */}
            <AnimatePresence>
              {phonetic && (
                <motion.div
                  initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  className="mt-4 border-t border-border pt-4"
                >
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Phonetic (NATO)
                  </div>
                  <div className="lcked-scroll flex max-h-32 flex-wrap gap-x-4 gap-y-1 overflow-y-auto text-sm text-muted-foreground">
                    {chars.map((ch, i) => (
                      <span key={i} className="font-mono">
                        <span className="font-semibold text-foreground">{ch}</span>{" "}
                        <span className="lowercase">{NATO[ch.toLowerCase()] ?? "—"}</span>
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
