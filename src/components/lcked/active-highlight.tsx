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
 *   - `wasVisibleRef`: tracks whether the highlight was visible in the LAST
 *     committed frame. When the highlight transitions from hidden→visible,
 *     we SNAP (no animation) to the target so it doesn't slide in from (0,0).
 *   - When the highlight is already visible and the target changes (e.g.
 *     selecting a different item, or the list re-renders), we GLIDE from
 *     the current animated position to the new target via the rAF spring.
 *   - `wasVisibleRef` is updated SYNCHRONOUSLY inside `measure()` (not in a
 *     separate useEffect) so there's no 1-frame window where the ref lags
 *     the actual state — that lag caused snap-instead-of-glide and
 *     off-by-a-few-pixels bugs.
 *   - The rAF loop is NOT canceled on activeKey change. It's a persistent
 *     loop that runs whenever there's a target to glide toward. This
 *     prevents the "teleport" bug where canceling + re-scheduling caused
 *     the spring to never start.
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
  // Updated SYNCHRONOUSLY inside measure() — NOT in a separate useEffect —
  // so there's no 1-frame lag that caused snap-instead-of-glide bugs.
  const wasVisibleRef = React.useRef(false);
  // Tracks whether the highlight has EVER been visible in this component's
  // lifetime. The snap-on-first-show behavior only fires when this is false.
  // On subsequent hide→show transitions (e.g. switching to a vault that
  // doesn't have the item, then back), the indicator GLIDES from its last
  // known position instead of snapping — no teleporting.
  const everVisibleRef = React.useRef(false);
  const [visible, setVisible] = React.useState(false);
  // animateRef holds the latest step function so external listeners can
  // kick it without re-binding their own dependencies.
  const animateRef = React.useRef<(() => void) | null>(null);

  // The activeKey is stored in a ref so the MutationObserver / scroll
  // listeners (which don't re-bind on activeKey change) always read the
  // latest value. Updated in an effect (not during render) per React rules.
  const activeKeyRef = React.useRef(activeKey);
  React.useEffect(() => { activeKeyRef.current = activeKey; }, [activeKey]);

  // Measure the active element's rect relative to the container. If not
  // found (or no active key), hide the highlight. Width/height are written
  // IMMEDIATELY (a single layout write per switch) — only `transform` is
  // animated per-frame by the rAF loop.
  const measure = React.useCallback(() => {
    const container = containerRef.current;
    const hl = highlightRef.current;
    const key = activeKeyRef.current;
    if (!key || !container) {
      targetRef.current = null;
      setVisible(false);
      return;
    }
    const selector = `[${selectorAttr}="${CSS.escape(key)}"]`;
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
      // Snap ONLY on the very first appearance (everVisibleRef === false).
      // On subsequent hide→show transitions (e.g. switching to a vault that
      // doesn't have the item, then back), glide from the last known
      // position — posRef still holds the previous position so the rAF
      // spring animates smoothly instead of teleporting.
      if (!everVisibleRef.current) {
        hl.style.transform = `translate(${next.x}px, ${next.y}px)`;
        posRef.current = { x: next.x, y: next.y };
        everVisibleRef.current = true;
      }
      wasVisibleRef.current = true;
    }
    targetRef.current = next;
    setVisible(true);
  }, [containerRef, selectorAttr]);

  // (Re)define the animation step. Per-frame we ONLY write `transform`.
  // This effect runs ONCE (empty deps) — the step function reads from refs
  // so it always has the latest target/position without re-binding.
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

  // Re-measure + kick the animation if it isn't already running.
  const kick = React.useCallback(() => {
    measure();
    if (!rafRef.current && animateRef.current) {
      rafRef.current = requestAnimationFrame(animateRef.current);
    }
  }, [measure]);

  // On activeKey change: measure + start the animation. The rAF loop is
  // NOT canceled here — it's a persistent loop that settles naturally.
  // We only cancel on unmount. A short rAF delay lets the DOM settle
  // after UI transitions (e.g. settings panel closing, vault switch).
  React.useEffect(() => {
    if (!activeKey) {
      // Hide: clear target so the rAF loop stops. Do NOT reset
      // wasVisibleRef or everVisibleRef — the next show should GLIDE
      // from the last known position, not snap (no teleporting).
      targetRef.current = null;
      setVisible(false);
      return;
    }
    // Defer measure by one rAF so the DOM has settled after the
    // activeKey change (e.g. the new vault's items rendered).
    const frame = requestAnimationFrame(() => kick());
    return () => {
      cancelAnimationFrame(frame);
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
  // stays glued to the active row.
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

  // When the highlight re-appears after being hidden (e.g. switching back
  // to a vault that has the item), the DOM element is freshly mounted with
  // transform translate(0,0). Restore the last known position from posRef
  // so the rAF spring glides from the previous position instead of from
  // (0,0) — prevents the "slide from top-left" teleport effect.
  React.useEffect(() => {
    if (visible && everVisibleRef.current && highlightRef.current) {
      const { x, y } = posRef.current;
      highlightRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }
  }, [visible]);

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
