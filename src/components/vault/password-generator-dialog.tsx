"use client";

/**
 * LCKED — Password Generator (right sidebar)
 * ---------------------------------------------------------------------------
 * Slides in from the right. When opened from a password field (via
 * setGeneratorCallback), shows a "Use this password" button that inserts
 * the generated password into the field. When opened standalone (sidebar),
 * shows a "Copy" button instead.
 */

import { ArrowRight, Check, Copy, Dice5, RefreshCw } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  generatePassphrase,
  generatePassword,
} from "@/lib/generator/generator";
import {
  consumeGeneratorCallback,
  hasGeneratorCallback,
  setGeneratorCallback,
} from "@/lib/generator/generator-bridge";
import { useSecretCopy } from "@/lib/use-secret-copy";
import { cn } from "@/lib/utils";
import { useVault } from "@/store/vault";

import { PasswordStrengthMeter } from "./password-strength-meter";

export function PasswordGeneratorDialog() {
  const open = useVault((s) => s.generatorOpen);
  const setOpen = useVault((s) => s.setGeneratorOpen);
  const options = useVault((s) => s.settings.generator);
  const updateGenerator = useVault((s) => s.updateGenerator);

  const [password, setPassword] = React.useState("");
  const { copied, copy } = useSecretCopy();
  const [mode, setMode] = React.useState<"random" | "passphrase">("random");
  const [wordCount, setWordCount] = React.useState(4);
  const [hasCallback, setHasCallback] = React.useState(false);

  const regenerate = React.useCallback(() => {
    if (mode === "random") {
      setPassword(generatePassword(options));
    } else {
      setPassword(generatePassphrase(wordCount, "-"));
    }
  }, [mode, options, wordCount]);

  // Regenerate whenever the dialog opens or options change. Debounced so
  // dragging the Length slider doesn't flicker the password on every step (D-3).
  React.useEffect(() => {
    if (!open) return;
    setHasCallback(hasGeneratorCallback());
    const timer = setTimeout(() => regenerate(), 120);
    return () => clearTimeout(timer);
  }, [open, regenerate]);

  const handleCopy = async () => {
    await copy(password, "Password");
  };

  const handleUse = () => {
    if (!password) return;
    if (consumeGeneratorCallback(password)) {
      setOpen(false);
      toast.success("Password inserted");
    } else {
      // No callback — copy instead.
      void handleCopy();
    }
  };

  const handleClose = () => {
    // Null the callback WITHOUT firing it (D-1). The old code called
    // `consumeGeneratorCallback("")` which fired the callback with an empty
    // string, wiping the source password field. Setting `null` leaves the
    // source field untouched.
    setGeneratorCallback(null);
    setOpen(false);
  };

  const atLeastOneSet =
    options.uppercase ||
    options.lowercase ||
    options.numbers ||
    options.symbols;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <SheetContent
        side="right"
        className="border-border bg-background w-full gap-0 overflow-hidden border-l p-0 sm:max-w-[454px] [&>button[data-slot=dialog-close]]:hidden"
      >
        {/* Header — title only. No close X, no copy/use button (those live in
            the footer now). The radix Sheet's built-in close button is hidden
            via the [&>button[data-slot=dialog-close]]:hidden class above. */}
        <SheetHeader className="border-border flex-row items-center justify-center border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <Dice5 className="text-primary h-4 w-4" />
            Generator
          </SheetTitle>
          <SheetDescription className="sr-only">
            Generate a cryptographically secure password.
          </SheetDescription>
        </SheetHeader>

        {/* Body */}
        <div className="lcked-scroll flex-1 space-y-5 overflow-y-auto p-4">
          {/* Mode toggle */}
          <div className="border-border bg-muted/30 flex rounded-lg border p-1">
            {(["random", "passphrase"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-center text-xs font-medium capitalize transition-colors duration-100",
                  mode === m
                    ? "bg-card text-foreground ring-border shadow-sm ring-1"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                {m === "random" ? "Random" : "Passphrase"}
              </button>
            ))}
          </div>

          {/* Output — large, monospace. No regenerate button here — the
              footer already has a Regenerate button. */}
          <div className="border-border bg-secondary/20 dark:bg-secondary/20 overflow-hidden rounded-lg border p-4">
            <div
              className="font-secret text-xl leading-snug font-medium tracking-wide break-all"
              style={{ fontFeatureSettings: '"tnum" 1, "zero" 1' }}
            >
              {password || "—"}
            </div>
          </div>

          {mode === "random" ? (
            <PasswordStrengthMeter password={password} />
          ) : (
            <p className="text-muted-foreground text-xs">
              Memorable words are easier to type while retaining strong entropy.
            </p>
          )}

          {/* Controls */}
          {mode === "random" ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground text-xs">
                    Length
                  </Label>
                  <span className="font-secret text-primary text-sm font-semibold">
                    {options.length}
                  </span>
                </div>
                <Slider
                  value={[options.length]}
                  min={4}
                  max={64}
                  step={1}
                  onValueChange={(v) => updateGenerator({ length: v[0] })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ToggleRow
                  label="A–Z Uppercase"
                  checked={options.uppercase}
                  onChange={(v) => updateGenerator({ uppercase: v })}
                />
                <ToggleRow
                  label="a–z Lowercase"
                  checked={options.lowercase}
                  onChange={(v) => updateGenerator({ lowercase: v })}
                />
                <ToggleRow
                  label="0–9 Numbers"
                  checked={options.numbers}
                  onChange={(v) => updateGenerator({ numbers: v })}
                />
                <ToggleRow
                  label="!@# Symbols"
                  checked={options.symbols}
                  onChange={(v) => updateGenerator({ symbols: v })}
                />
              </div>
              <ToggleRow
                label="Avoid ambiguous characters (0/O, 1/l/I)"
                checked={options.avoidAmbiguous}
                onChange={(v) => updateGenerator({ avoidAmbiguous: v })}
              />
              {!atLeastOneSet && (
                <p className="text-xs text-signal-warning">
                  Enable at least one character set.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground text-xs">Words</Label>
                <span className="font-secret text-primary text-sm font-semibold">
                  {wordCount}
                </span>
              </div>
              <Slider
                value={[wordCount]}
                min={3}
                max={8}
                step={1}
                onValueChange={(v) => setWordCount(v[0])}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-border flex gap-2 border-t px-4 py-3">
          <Button variant="outline" className="flex-1" onClick={regenerate}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate
          </Button>
          {hasCallback ? (
            <Button className="flex-1" onClick={handleUse} disabled={!password}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Use this password
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={handleCopy}
              disabled={!password}
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copy
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="border-border/60 bg-secondary/20 hover:bg-secondary/40 dark:bg-secondary/20 flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
