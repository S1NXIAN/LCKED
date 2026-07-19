"use client";

import * as React from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Dice5,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copyWithAutoClear, setGeneratorCallback, useVault } from "@/store/vault";
import type { GeneratorOptions } from "@/lib/types";
import { PasswordStrengthMeter } from "./password-strength-meter";

interface PasswordFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Show the inline strength meter. */
  showStrength?: boolean;
  /** Show the dice/generate button. */
  showGenerate?: boolean;
  /** Show the copy button (default true). */
  showCopy?: boolean;
  /** Generator options to use for the inline dice button. */
  generatorOptions?: GeneratorOptions;
  className?: string;
  inputClassName?: string;
  label?: string;
  /** When false, treat as a plain masked field (no reveal toggle). */
  revealable?: boolean;
  /** Disable auto-copy clear countdown (used for non-sensitive fields). */
  noAutoClear?: boolean;
  icon?: LucideIcon;
}

/**
 * Reusable sensitive input with:
 *  • reveal/hide toggle,
 *  • inline password generator (dice button),
 *  • one-click copy with 30-second auto-clear + countdown badge.
 */
export function PasswordField({
  value,
  onChange,
  placeholder,
  showStrength = false,
  showGenerate = true,
  showCopy = true,
  generatorOptions,
  className,
  inputClassName,
  label,
  revealable = true,
  noAutoClear = false,
  icon: Icon,
}: PasswordFieldProps) {
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [countdown, setCountdown] = React.useState<number | null>(null);

  const handleGenerate = () => {
    // Open the generator sidebar with a callback that inserts the password
    // into this field when the user clicks "Use this password".
    setGeneratorCallback((pw: string) => {
      onChange(pw);
      setRevealed(true);
    });
    useVault.getState().setGeneratorOpen(true);
  };

  const handleCopy = async () => {
    if (!value) return;
    try {
      if (noAutoClear) {
        await navigator.clipboard.writeText(value);
      } else {
        await copyWithAutoClear(value, label ?? "field");
      }
      setCopied(true);
      if (!noAutoClear) {
        setCountdown(30);
      }
      toast.success("Copied", {
        description: noAutoClear ? undefined : "Auto-clears in 30s",
      });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard access denied");
    }
  };

  // Countdown ticker for the auto-clear badge.
  React.useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
        )}
        <Input
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          className={cn(
            "font-secret pr-24",
            Icon && "pl-9",
            inputClassName,
          )}
        />
        <div className="absolute right-1.5 flex items-center gap-0.5">
          {showGenerate && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={handleGenerate}
              aria-label="Generate password"
              title="Generate password"
            >
              <Dice5 className="h-4 w-4" />
            </Button>
          )}
          {revealable && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setRevealed((r) => !r)}
              aria-label={revealed ? "Hide" : "Show"}
              title={revealed ? "Hide" : "Show"}
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          )}
          {showCopy && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              aria-label="Copy"
              title="Copy (auto-clears in 30s)"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
      {countdown !== null && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Clipboard clears in {countdown}s
        </div>
      )}
      {showStrength && <PasswordStrengthMeter password={value} />}
    </div>
  );
}
