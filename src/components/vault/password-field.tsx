"use client";

import {
  Check,
  Copy,
  Dice5,
  Eye,
  EyeOff,
  type LucideIcon,
  RefreshCw,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearGeneratorCallback,
  setGeneratorCallback,
} from "@/lib/generator/generator-bridge";
import { useSecretCopy } from "@/lib/use-secret-copy";
import { cn } from "@/lib/utils";
import { useVault } from "@/store/vault";

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
  className?: string;
  inputClassName?: string;
  label?: string;
  /** When false, treat as a plain masked field (no reveal toggle). */
  revealable?: boolean;
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
  className,
  inputClassName,
  label,
  revealable = true,
  icon: Icon,
}: PasswordFieldProps) {
  const [revealed, setRevealed] = React.useState(false);
  const { copied, copy } = useSecretCopy();
  const [countdown, setCountdown] = React.useState<number | null>(null);
  const generatorCallback = React.useRef<((password: string) => void) | null>(
    null,
  );

  // A field that closes (including via auto-lock) must not leave the
  // Generator pointing at it.
  React.useEffect(
    () => () => {
      if (generatorCallback.current) {
        clearGeneratorCallback(generatorCallback.current);
      }
    },
    [],
  );

  const handleGenerate = () => {
    // Open the generator sidebar with a callback that inserts the password
    // into this field when the user clicks "Use this password".
    const cb = (pw: string) => {
      onChange(pw);
      setRevealed(true);
    };
    generatorCallback.current = cb;
    setGeneratorCallback(cb);
    useVault.getState().setGeneratorOpen(true);
  };

  const handleCopy = async () => {
    const ok = await copy(value, label ?? "field");
    if (ok) setCountdown(30);
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
        <label className="text-muted-foreground text-xs font-medium">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <Icon className="text-muted-foreground pointer-events-none absolute left-3 h-4 w-4" />
        )}
        <Input
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          className={cn("font-secret pr-24", Icon && "pl-9", inputClassName)}
        />
        <div className="absolute right-1.5 flex items-center gap-0.5">
          {showGenerate && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-primary h-7 w-7"
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
              className="text-muted-foreground hover:text-foreground h-7 w-7"
              onClick={() => setRevealed((r) => !r)}
              aria-label={revealed ? "Hide" : "Show"}
              title={revealed ? "Hide" : "Show"}
            >
              {revealed ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          )}
          {showCopy && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground h-7 w-7"
              onClick={handleCopy}
              aria-label="Copy"
              title="Copy (auto-clears in 30s)"
            >
              {copied ? (
                <Check className="text-signal-success h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
      {countdown !== null && (
        <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Clipboard clears in {countdown}s
        </div>
      )}
      {showStrength && <PasswordStrengthMeter password={value} />}
    </div>
  );
}
