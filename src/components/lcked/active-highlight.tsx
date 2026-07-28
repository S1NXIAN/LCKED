"use client";

/**
 * LCKED — ActiveHighlight (v2 — clean state machine)
 * ---------------------------------------------------------------------------
 * Shared sliding highlight for the item-list and the vaults-sidebar.
 *
 * The highlight is a single absolutely-positioned div inside `containerRef`.
 * It uses a CSS `transition: opacity` for fade-in/fade-out and a rAF spring
 * (exponential lerp) for the glide. The two animations run independently:
 * opacity is CSS-driven (GPU-composited), position is JS-driven (rAF).
 *
 * ┌─────────┐  target found   ┌───────────┐  opacity→1   ┌─────────┐
 * │ HIDDEN  │ ──────────────► │ FADING_IN │ ───────────► │ VISIBLE │
 * │ op:0    │                 │ op:0→1    │               │ op:1    │
 * └─────────┘                 └───────────┘               └─────────┘
 *      ▲                                                       │
 *      │  opacity→0                                    target │ lost
 *      │                                               ┌──────▼──────┐
 *      └─────────────────────────────────────────────  │ FADING_OUT  │
 *                                                      │ op:1→0      │
 *                                                      └─────────────┘
 *
 * Key design decisions:
 *   • The element is ALWAYS mounted (never `return null`). This avoids
 *     DOM remount costs and enables smooth CSS opacity transitions.
 *   • On the VERY FIRST show (`everVisible === false`), the position
 *     snaps to the target (no glide from 0,0). On every subsequent
 *     show, the position glides from `posRef` (last known position).
 *   • `posRef` is updated every frame by the rAF spring AND by `measure()`
 *     when snapping. It always reflects the current animated position.
 *   • The rAF spring is a persistent loop — it runs whenever there's a
 *     target and the position hasn't settled. It is NOT canceled on
 *     `activeKey` change; it settles naturally.
 *   • `measure()` is called via `kick()` which is triggered by:
 *       - activeKey change (triple rAF delay for DOM settle)
 *       - MutationObserver (rAF delay + 300ms delayed re-check)
 *       - scroll/resize (rAF-throttled)
 *   • `everVisibleRef` prevents re-snapping after the first show. Once
 *     the highlight has been visible, it always glides.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────

type Phase = "hidden" | "fadingIn" | "visible" | "fadingOut";

interface Rect { x: number; y: number; w: number; h: number; }

// ─── Component ────────────────────────────────────────────────────────────

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
  // ─── Refs (mutable, don't trigger re-render) ──────────────────────────
  const hlRef = React.useRef<HTMLDivElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const targetRef = React.useRef<Rect | null>(null);
  const posRef = React.useRef({ x: 0, y: 0 });
  const everVisibleRef = React.useRef(false);
  const phaseRef = React.useRef<Phase>("hidden");
  const activeKeyRef = React.useRef(activeKey);
  const animateRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => { activeKeyRef.current = activeKey; }, [activeKey]);

  // ─── State (triggers re-render for opacity changes) ───────────────────
  const [opacity, setOpacity] = React.useState(0);

  // ─── measure() — find the target element and update targetRef ─────────
  // Returns true if the target was found (indicator should be visible),
  // false if not (indicator should hide).
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

      // Snap ONLY on the very first appearance ever. On all subsequent
      // appearances, glide from posRef (last known position).
      if (!everVisibleRef.current) {
        hl.style.transform = `translate(${next.x}px, ${next.y}px)`;
        posRef.current = { x: next.x, y: next.y };
        everVisibleRef.current = true;
      }
    }

    targetRef.current = next;
    return true;
  }, [containerRef, selectorAttr]);

  // ─── kick() — measure + start the rAF spring if needed ────────────────
  const kick = React.useCallback(() => {
    const found = measure();

    if (found) {
      // Target exists — show the indicator.
      if (phaseRef.current === "hidden" || phaseRef.current === "fadingOut") {
        // Transitioning from hidden → visible. If we've been visible before,
        // restore posRef to the element so we glide from the last position.
        if (everVisibleRef.current && hlRef.current) {
          hlRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
        }
        phaseRef.current = "fadingIn";
      }
      if (phaseRef.current === "fadingIn") {
        phaseRef.current = "visible";
      }
      setOpacity(1);
    } else {
      // Target doesn't exist — hide the indicator.
      if (phaseRef.current === "visible" || phaseRef.current === "fadingIn") {
        phaseRef.current = "fadingOut";
      }
      targetRef.current = null;
      setOpacity(0);
    }

    // Start or continue the rAF spring if we have a target.
    if (targetRef.current && !rafRef.current && animateRef.current) {
      rafRef.current = requestAnimationFrame(animateRef.current);
    }
  }, [measure]);

  // ─── rAF spring step (defined once, reads from refs) ──────────────────
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
      if (settled) {
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    animateRef.current = step;
    return () => { animateRef.current = null; };
  }, []);

  // ─── On activeKey change: triple-rAF + kick ───────────────────────────
  // Triple rAF ensures the DOM has fully painted (AnimatePresence exits,
  // sort reorder, pinned items pushed) before measuring.
  React.useEffect(() => {
    if (!activeKey) {
      // Explicitly hide.
      targetRef.current = null;
      phaseRef.current = "fadingOut";
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

  // ─── MutationObserver: re-measure on DOM changes + delayed catch-up ──
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

  // ─── Scroll + resize: rAF-throttled re-measure ────────────────────────
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

  // ─── Cleanup rAF on unmount ───────────────────────────────────────────
  React.useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // ─── Render (always mounted; opacity drives the fade) ─────────────────
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
