"use client";

/**
 * LCKED — ActiveHighlight (v3 — edge-glide)
 * ---------------------------------------------------------------------------
 * Shared sliding highlight for the item-list and the vaults-sidebar.
 *
 * Animation strategy:
 *   • When the target appears (or reappears after being hidden), the
 *     highlight starts from the NEAREST EDGE of the container (top wall
 *     if the target is in the top half, bottom wall if in the bottom half)
 *     and glides to the target position. This is simpler and more
 *     predictable than gliding from the last known position, which could
 *     be stale or off-screen and cause visual teleporting.
 *   • When the target moves within the same view (e.g., selecting a
 *     different item), the highlight glides from its current position
 *     to the new target — smooth, natural.
 *   • When the target disappears (item not in current vault), the
 *     highlight fades out (opacity 1→0 via CSS transition).
 *   • When the target reappears (switching back to a vault that has the
 *     item), the highlight fades in from the nearest edge — no teleport.
 *
 * The element is ALWAYS mounted. Opacity drives the fade via CSS
 * `transition: opacity 0.2s`. Position is driven by a rAF spring
 * (exponential lerp, factor 0.35).
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface Rect { x: number; y: number; w: number; h: number; }

export function ActiveHighlight<T extends HTMLElement = HTMLElement>({
  containerRef,
  activeKey,
  selectorAttr,
  className,
}: {
  containerRef: React.RefObject<T | null>;
  activeKey: string | null;
  selectorAttr: string;
  className?: string;
}) {
  const hlRef = React.useRef<HTMLDivElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const targetRef = React.useRef<Rect | null>(null);
  const posRef = React.useRef({ x: 0, y: 0 });
  const everVisibleRef = React.useRef(false);
  const wasHiddenRef = React.useRef(true); // true = target was not found last measure
  const activeKeyRef = React.useRef(activeKey);
  const animateRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => { activeKeyRef.current = activeKey; }, [activeKey]);

  const [opacity, setOpacity] = React.useState(0);

  // ─── measure() — find target, set start position if transitioning ─────
  const measure = React.useCallback((): boolean => {
    const container = containerRef.current;
    const hl = hlRef.current;
    const key = activeKeyRef.current;
    if (!key || !container) return false;

    const selector = `[${selectorAttr}="${CSS.escape(key)}"]`;
    const el = (container.matches(selector)
      ? container
      : container.querySelector<HTMLElement>(selector)) as HTMLElement | null;
    if (!el) return false;

    const r = el.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    const next: Rect = {
      x: r.left - cr.left,
      y: r.top - cr.top,
      w: r.width,
      h: r.height,
    };

    if (hl) {
      hl.style.width = `${next.w}px`;
      hl.style.height = `${next.h}px`;

      if (!everVisibleRef.current) {
        // Very first appearance: snap to target.
        hl.style.transform = `translate(${next.x}px, ${next.y}px)`;
        posRef.current = { x: next.x, y: next.y };
        everVisibleRef.current = true;
      } else if (wasHiddenRef.current) {
        // Reappearing after being hidden: start from the nearest edge.
        // Top wall = y=0, bottom wall = y = container height.
        const containerH = cr.height;
        const startY = next.y < containerH / 2 ? -next.h : containerH;
        hl.style.transform = `translate(${next.x}px, ${startY}px)`;
        posRef.current = { x: next.x, y: startY };
      }
      // If not hidden (target moved within view), posRef stays at the
      // current animated position — the spring glides naturally.
    }

    targetRef.current = next;
    wasHiddenRef.current = false;
    return true;
  }, [containerRef, selectorAttr]);

  // ─── kick() — measure + start/continue the rAF spring ─────────────────
  const kick = React.useCallback(() => {
    const found = measure();

    if (found) {
      setOpacity(1);
    } else {
      wasHiddenRef.current = true;
      targetRef.current = null;
      setOpacity(0);
    }

    if (targetRef.current && !rafRef.current && animateRef.current) {
      rafRef.current = requestAnimationFrame(animateRef.current);
    }
  }, [measure]);

  // ─── rAF spring step ──────────────────────────────────────────────────
  React.useEffect(() => {
    const step = () => {
      const hl = hlRef.current;
      const target = targetRef.current;
      if (!hl || !target) {
        rafRef.current = null;
        return;
      }
      const pos = posRef.current;
      const FACTOR = 0.35;
      const nx = pos.x + (target.x - pos.x) * FACTOR;
      const ny = pos.y + (target.y - pos.y) * FACTOR;
      const settled = Math.abs(target.x - nx) < 0.5 && Math.abs(target.y - ny) < 0.5;
      pos.x = settled ? target.x : nx;
      pos.y = settled ? target.y : ny;
      hl.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      if (settled) { rafRef.current = null; return; }
      rafRef.current = requestAnimationFrame(step);
    };
    animateRef.current = step;
    return () => { animateRef.current = null; };
  }, []);

  // ─── On activeKey change: triple-rAF + kick ───────────────────────────
  React.useEffect(() => {
    if (!activeKey) {
      wasHiddenRef.current = true;
      targetRef.current = null;
      setOpacity(0);
      return;
    }
    let f2 = 0, f3 = 0;
    const f1 = requestAnimationFrame(() => {
      f2 = requestAnimationFrame(() => {
        f3 = requestAnimationFrame(() => kick());
      });
    });
    return () => { cancelAnimationFrame(f1); cancelAnimationFrame(f2); cancelAnimationFrame(f3); };
  }, [activeKey, kick]);

  // ─── MutationObserver ─────────────────────────────────────────────────
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let pending = false;
    let delayed: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; kick(); });
      if (delayed) clearTimeout(delayed);
      delayed = setTimeout(() => kick(), 300);
    });
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: [selectorAttr] });
    return () => { observer.disconnect(); if (delayed) clearTimeout(delayed); };
  }, [containerRef, kick, selectorAttr]);

  // ─── Scroll + resize ──────────────────────────────────────────────────
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scrollEl = container.closest("[data-radix-scroll-area-viewport]") ?? container.closest(".lcked-scroll") ?? container.parentElement;
    let p = false;
    const handler = () => {
      if (p) return;
      p = true;
      requestAnimationFrame(() => { p = false; kick(); });
    };
    scrollEl?.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler, { passive: true });
    return () => { scrollEl?.removeEventListener("scroll", handler); window.removeEventListener("resize", handler); };
  }, [containerRef, kick]);

  // ─── Cleanup ──────────────────────────────────────────────────────────
  React.useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return (
    <div
      ref={hlRef}
      aria-hidden
      className={cn(
        "lcked-active-glow pointer-events-none absolute left-0 top-0 rounded-lg transition-opacity duration-200 ease-out",
        className,
      )}
      style={{ width: 0, height: 0, transform: "translate(0px, 0px)", opacity }}
    />
  );
}
