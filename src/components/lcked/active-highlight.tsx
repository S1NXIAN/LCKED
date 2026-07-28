"use client";

/**
 * LCKED — ActiveHighlight
 * ---------------------------------------------------------------------------
 * Shared sliding highlight used by BOTH the item-list and the vaults-sidebar.
 *
 * Renders a single persistent highlight element ONCE inside a `relative`
 * positioned container (`containerRef`). Slides toward the active element's
 * bounding box via a requestAnimationFrame spring (exponential lerp, factor
 * 0.35). Uses the `animateRef` pattern — the latest step function is stashed
 * in a ref so external listeners (scroll, MutationObserver, resize) can
 * always kick the loop without re-binding.
 *
 * WHY THIS IS "STICKY" / CLIPPED (the item-list behaviour):
 *   The highlight is `position: absolute` inside `containerRef`, and
 *   `containerRef` itself lives INSIDE the scrolling content. When the user
 *   scrolls, `containerRef` (and the highlight with it) scrolls naturally
 *   with the content, and the scroll area's `overflow` clips the highlight
 *   as soon as the active row leaves the visible viewport.
 *
 * Animation logic:
 *   - `everVisibleRef`: the snap-on-first-show behavior fires ONLY on the
 *     very first appearance. On subsequent hide→show transitions, the
 *     indicator glides from its last known position.
 *   - `wasVisibleRef` / `everVisibleRef` are NOT reset when hiding — they
 *     persist so the next show glides instead of snapping.
 *   - The rAF loop is persistent — NOT canceled on activeKey change.
 *   - A DOUBLE rAF (two consecutive requestAnimationFrame calls) is used on
 *     activeKey change to ensure the DOM has fully painted before measuring.
 *     A single rAF fires before paint; a double rAF guarantees the first
 *     paint has completed and the layout is stable (pinned items sorted,
 *     AnimatePresence exits done, etc).
 *   - Fade-in/fade-out: instead of unmounting when hidden, the element
 *     stays mounted with opacity:0 and a CSS transition for a smooth fade.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

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
  const highlightRef = React.useRef<HTMLDivElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const targetRef = React.useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  // Current animated position — tracked in a ref so the per-frame step only
  // writes `transform` (NO getBoundingClientRect reads = no layout thrash).
  const posRef = React.useRef({ x: 0, y: 0 });
  // Tracks whether the highlight was visible in the last committed frame.
  const wasVisibleRef = React.useRef(false);
  // Tracks whether the highlight has EVER been visible in this component's
  // lifetime. The snap-on-first-show behavior only fires when this is false.
  const everVisibleRef = React.useRef(false);
  // `mounted` ensures the element is always in the DOM (for CSS transitions).
  // `opacity` controls the fade-in/fade-out.
  const [mounted] = React.useState(true);
  const [opacity, setOpacity] = React.useState(0);
  // animateRef holds the latest step function so external listeners can
  // kick it without re-binding their own dependencies.
  const animateRef = React.useRef<(() => void) | null>(null);

  // The activeKey is stored in a ref so the MutationObserver / scroll
  // listeners (which don't re-bind on activeKey change) always read the
  // latest value.
  const activeKeyRef = React.useRef(activeKey);
  React.useEffect(() => { activeKeyRef.current = activeKey; }, [activeKey]);

  // Measure the active element's rect relative to the container. If not
  // found (or no active key), hide the highlight (fade out). Width/height
  // are written IMMEDIATELY — only `transform` is animated per-frame.
  const measure = React.useCallback(() => {
    const container = containerRef.current;
    const hl = highlightRef.current;
    const key = activeKeyRef.current;
    if (!key || !container) {
      targetRef.current = null;
      setOpacity(0);
      return;
    }
    const selector = `[${selectorAttr}="${CSS.escape(key)}"]`;
    const el = (container.matches(selector)
      ? container
      : container.querySelector<HTMLElement>(selector)) as HTMLElement | null;
    if (!el) {
      targetRef.current = null;
      setOpacity(0);
      return;
    }
    const r = el.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    const next = {
      x: r.left - cr.left,
      y: r.top - cr.top,
      w: r.width,
      h: r.height,
    };
    if (hl) {
      hl.style.width = `${next.w}px`;
      hl.style.height = `${next.h}px`;
      // Snap ONLY on the very first appearance (everVisibleRef === false).
      if (!everVisibleRef.current) {
        hl.style.transform = `translate(${next.x}px, ${next.y}px)`;
        posRef.current = { x: next.x, y: next.y };
        everVisibleRef.current = true;
      }
      wasVisibleRef.current = true;
    }
    targetRef.current = next;
    setOpacity(1);
  }, [containerRef, selectorAttr]);

  // (Re)define the animation step. Per-frame we ONLY write `transform`.
  // This effect runs ONCE (empty deps).
  React.useEffect(() => {
    const step = () => {
      const hl = highlightRef.current;
      const target = targetRef.current;
      if (!hl || !target) {
        rafRef.current = null;
        return;
      }
      const pos = posRef.current;
      const FACTOR = 0.35;
      const nx = pos.x + (target.x - pos.x) * FACTOR;
      const ny = pos.y + (target.y - pos.y) * FACTOR;
      const settled =
        Math.abs(target.x - nx) < 0.5 && Math.abs(target.y - ny) < 0.5;
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

  // Re-measure + kick the animation if it isn't already running.
  const kick = React.useCallback(() => {
    measure();
    if (!rafRef.current && animateRef.current) {
      rafRef.current = requestAnimationFrame(animateRef.current);
    }
  }, [measure]);

  // On activeKey change: use a TRIPLE rAF to ensure the DOM has fully
  // painted and AnimatePresence animations have started before measuring.
  // A single rAF fires before paint; a double rAF guarantees the first
  // paint completed; a triple rAF also catches the frame where
  // AnimatePresence's exit animations finish and the final sort order is
  // committed. This prevents the "off by a few pixels" bug when switching
  // vaults where the item's position changes due to pinned/favorited items
  // pushing it down.
  React.useEffect(() => {
    if (!activeKey) {
      targetRef.current = null;
      setOpacity(0);
      return;
    }
    let frame2 = 0;
    let frame3 = 0;
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        frame3 = requestAnimationFrame(() => kick());
      });
    });
    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
      cancelAnimationFrame(frame3);
    };
  }, [activeKey, kick]);

  // MutationObserver — re-check when the container DOM changes. Uses a
  // rAF delay so the DOM has time to settle. A second delayed kick (300ms)
  // catches AnimatePresence exit animations that complete after the initial
  // mutation — these change item positions without triggering a new mutation.
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let pending = false;
    let delayedTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        kick();
      });
      // Schedule a delayed re-measure to catch post-animation layout shifts.
      if (delayedTimer) clearTimeout(delayedTimer);
      delayedTimer = setTimeout(() => kick(), 300);
    });
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [selectorAttr],
    });
    return () => {
      observer.disconnect();
      if (delayedTimer) clearTimeout(delayedTimer);
    };
  }, [containerRef, kick, selectorAttr]);

  // Scroll + resize listeners — throttled via rAF.
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scrollContainer =
      container.closest("[data-radix-scroll-area-viewport]") ??
      container.closest(".lcked-scroll") ??
      container.parentElement ??
      null;
    let scrollPending = false;
    const handler = () => {
      if (scrollPending) return;
      scrollPending = true;
      requestAnimationFrame(() => {
        scrollPending = false;
        kick();
      });
    };
    scrollContainer?.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler, { passive: true });
    return () => {
      scrollContainer?.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [containerRef, kick]);

  // Cancel any in-flight rAF on unmount.
  React.useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // When the highlight re-appears (opacity goes 0→1), restore posRef
  // position to the element so the rAF spring glides from the last
  // known position instead of from (0,0).
  React.useEffect(() => {
    if (opacity === 1 && everVisibleRef.current && highlightRef.current) {
      const { x, y } = posRef.current;
      highlightRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }
  }, [opacity]);

  // The element is ALWAYS mounted (never returns null). Opacity controls
  // the fade-in/fade-out via a CSS transition. This avoids the DOM
  // remount that caused teleporting and enables smooth fades.
  if (!mounted) return null;
  return (
    <div
      ref={highlightRef}
      aria-hidden
      className={cn(
        "lcked-active-glow pointer-events-none absolute left-0 top-0 rounded-lg transition-opacity duration-200 ease-out",
        className,
      )}
      style={{ width: 0, height: 0, transform: "translate(0px, 0px)", opacity }}
    />
  );
}
