"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FaviconIconProps {
  url: string;
  size?: number;
  className?: string;
  /** React node to render when the favicon fails to load or no URL is provided. */
  fallback?: React.ReactNode;
}

/** Module-level cache: hostname → { ok: boolean, at: number }. Survives
 *  re-renders. Failures expire after 5 minutes (D-33) so a transient network
 *  blip or offline state doesn't permanently blacklist a host. Successes
 *  never expire. */
interface CacheEntry { ok: boolean; at: number; }
const faviconCache = new Map<string, CacheEntry>();
const FAILURE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function hostnameOf(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    const host = u.hostname.toLowerCase();
    if (!host) return null;
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export function FaviconIcon({ url, size = 32, className, fallback }: FaviconIconProps) {
  const host = hostnameOf(url);
  // Derive `failed` synchronously from the cache (with TTL for failures).
  const computeFailed = (h: string | null): boolean => {
    if (!h) return true;
    const entry = faviconCache.get(h);
    if (!entry) return false;
    if (entry.ok) return false;
    // Failure — check TTL.
    if (Date.now() - entry.at > FAILURE_TTL_MS) {
      faviconCache.delete(h); // expired — retry
      return false;
    }
    return true;
  };
  const [failed, setFailed] = React.useState(() => computeFailed(host));

  React.useEffect(() => {
    setFailed(computeFailed(host));
  }, [host]);

  const px = `${size}px`;

  // No host, fetch failed, or cached failure → use the caller's fallback.
  if (!host || failed) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center", className)}
        style={{ width: px, height: px }}
        role="img"
        aria-label={host ? `${host} favicon` : "No URL"}
      >
        {fallback ?? null}
      </span>
    );
  }

  const src = `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;

  return (
    <img
      src={src}
      alt={`${host} favicon`}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        faviconCache.set(host, { ok: false, at: Date.now() });
        setFailed(true);
      }}
      onLoad={() => {
        faviconCache.set(host, { ok: true, at: Date.now() });
      }}
      className={cn("shrink-0 rounded-lg object-contain", className)}
      style={{ width: px, height: px }}
    />
  );
}
