"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateTotp, resolveTotpParams, looksLikeTotp, type TotpParams } from "@/lib/totp";
import { copyWithAutoClear } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

interface TOTPDisplayProps {
  secret: string;
  compact?: boolean;
}

/**
 * Renders a live-updating 6-digit TOTP code with a circular countdown ring
 * and one-click copy. Falls back to a hint when the secret is malformed.
 */
export function TOTPDisplay({ secret, compact = false }: TOTPDisplayProps) {
  const params = React.useMemo<TotpParams | null>(() => resolveTotpParams(secret), [secret]);

  const [code, setCode] = React.useState<string>("");
  const [remaining, setRemaining] = React.useState(30);
  const [period, setPeriod] = React.useState(30);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState(false);
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!params || !looksLikeTotp(params.secret)) {
      setError(Boolean(params));
      setCode("");
      return;
    }
    setPeriod(params.period);
    let active = true;
    const tick = async () => {
      const res = await generateTotp(params);
      if (!active) return;
      if (!res) {
        if (params) setError(true);
        return;
      }
      setError(false);
      setCode(res.code);
      setRemaining(res.remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [params]);

  // Cleanup the copied-state timer on unmount.
  React.useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  if (!params) return null;

  if (error) {
    return (
      <div className="text-xs text-amber-500">
        TOTP secret looks invalid — check the format.
      </div>
    );
  }

  const progress = remaining / period; // 1 → 0

  const handleCopy = async () => {
    if (!code) return;
    try {
      await copyWithAutoClear(code, "totp");
      setCopied(true);
      toast.success("Code copied", { description: "Auto-clears in 30s" });
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard access denied");
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-2 rounded-md bg-muted px-2 py-1 font-secret text-sm font-semibold tracking-wider hover:bg-accent"
        title="Copy code (auto-clears in 30s)"
        aria-label={code ? `Copy verification code ${code}` : "Copy verification code"}
      >
        <span className="text-primary">{code || "••••••"}</span>
        {copied ? (
          <Check className="h-3 w-3 text-emerald-400" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCopy}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCopy(); } }}
      className="group flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      title="Click to copy (auto-clears in 30s)"
      aria-label={code ? `Copy verification code ${code}` : "Copy verification code"}
    >
      <div className="relative h-11 w-11 shrink-0">
        <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44">
          <circle
            cx="22"
            cy="22"
            r="19"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-muted"
          />
          <circle
            cx="22"
            cy="22"
            r="19"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className={cn(
              "transition-colors duration-300",
              remaining <= 5 ? "text-red-400" : "text-primary",
            )}
            strokeDasharray={2 * Math.PI * 19}
            strokeDashoffset={2 * Math.PI * 19 * (1 - progress)}
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
          {remaining}
        </span>
      </div>
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Verification code
        </div>
        <div className="font-secret text-2xl font-bold tracking-[0.2em] text-foreground">
          {code || "------"}
        </div>
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={(e) => { e.stopPropagation(); handleCopy(); }}
        className="h-9 w-9"
        aria-label="Copy verification code"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
