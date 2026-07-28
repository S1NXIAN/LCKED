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
 *   as soon as the active row leaves the visible viewport. No special
 *   visibility math is needed — the indicator simply disappears with the
 *   row, exactly like the item-list does. This is the property the
 *   vaults-sidebar now inherits by sharing this component.
 *
 * On `activeKey` change: measure + start the animation. If the element isn't
 * found in the DOM, `setVisible(false)` and bail. A MutationObserver re-
 * checks when the container DOM changes; a scroll listener + resize listener
 * re-measure so the highlight stays glued to the active row.
 *
 * Props:
 *   - containerRef: the relative-positioned ancestor where the highlight
 *     lives (e.g. the <ul> in item-list, the content wrapper in vaults).
 *   - activeKey:    the key to look up (item id, vault key, …). null/empty
 *     hides the highlight.
 *   - selectorAttr: the data-attribute used to find the active element
 *     (e.g. "data-item-id" or "data-vault-key").
 *   - className:    optional extra classes appended to the highlight element.
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
  const wasVisibleRef = React.useRef(false);
  const [visible, setVisible] = React.useState(false);
  // animateRef holds the latest step function so external listeners can
  // kick it without re-binding their own dependencies.
  const animateRef = React.useRef<(() => void) | null>(null);

  // Measure the active element's rect relative to the container. If not
  // found (or no active key), hide the highlight. Width/height are written
  // IMMEDIATELY (a single layout write per switch) — only `transform` is
  // animated per-frame by the rAF loop.
  const measure = React.useCallback(() => {
    const container = containerRef.current;
    const hl = highlightRef.current;
    if (!activeKey || !container) {
      targetRef.current = null;
      setVisible(false);
      return;
    }
    // NOTE: `querySelector` only searches DESCENDANTS — it does NOT match
    // the container itself. Some callers (e.g. the vaults-sidebar Trash
    // instance) set `containerRef` ON the element that carries the
    // `selectorAttr`. To support both shapes, we match the container first
    // and fall back to a descendant query.
    const selector = `[${selectorAttr}="${CSS.escape(activeKey)}"]`;
    const el = (container.matches(selector)
      ? container
      : container.querySelector<HTMLElement>(selector)) as HTMLElement | null;
    if (!el) {
      targetRef.current = null;
      setVisible(false);
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
      // First activation (or returning from invisible): snap transform to
      // target too, so we don't slide in from (0, 0).
      if (!wasVisibleRef.current) {
        hl.style.transform = `translate(${next.x}px, ${next.y}px)`;
        posRef.current = { x: next.x, y: next.y };
      }
    }
    targetRef.current = next;
    setVisible(true);
  }, [activeKey, containerRef, selectorAttr]);

  // (Re)define the animation step. Per-frame we ONLY write `transform`.
  React.useEffect(() => {
    const step = () => {
      const hl = highlightRef.current;
      const target = targetRef.current;
      if (!hl || !target) {
        rafRef.current = null;
        return;
      }
      const pos = posRef.current;
      // Higher factor = snappier. 0.35 settles in ~10 frames (~160ms).
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
    return () => {
      animateRef.current = null;
    };
  }, []);

  // Track visibility transitions for the snap-on-first-show behaviour.
  React.useEffect(() => {
    wasVisibleRef.current = visible;
  }, [visible]);

  // Re-measure + kick the animation if it isn't already running.
  const kick = React.useCallback(() => {
    measure();
    if (!rafRef.current && animateRef.current) {
      rafRef.current = requestAnimationFrame(animateRef.current);
    }
  }, [measure]);

  // On activeKey change: measure + start the animation. Cancel any in-flight
  // loop on cleanup.
  React.useEffect(() => {
    kick();
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [activeKey, kick]);

  // MutationObserver — re-check when the container DOM changes (items added,
  // removed, reordered by sort, attributes toggled). Uses a rAF delay so the
  // DOM has time to settle after AnimatePresence exit animations.
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        kick();
      });
    });
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [selectorAttr],
    });
    return () => observer.disconnect();
  }, [containerRef, kick, selectorAttr]);

  // Scroll + resize listeners — re-measure + re-animate so the highlight
  // stays glued to the active row. We attach to the nearest scroll ancestor
  // (radix scroll viewport OR the .lcked-scroll wrapper) plus the window.
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scrollContainer =
      container.closest("[data-radix-scroll-area-viewport]") ??
      container.closest(".lcked-scroll") ??
      container.parentElement ??
      null;
    const handler = () => kick();
    scrollContainer?.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler, { passive: true });
    return () => {
      scrollContainer?.removeEventListener("scroll", handler);
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [containerRef, kick]);

  if (!visible) return null;
  return (
    <div
      ref={highlightRef}
      aria-hidden
      className={cn(
        "lcked-active-glow pointer-events-none absolute left-0 top-0 rounded-lg",
        className,
      )}
      style={{ width: 0, height: 0, transform: "translate(0px, 0px)" }}
    />
  );
}
