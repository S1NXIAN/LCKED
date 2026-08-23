"use client";

import * as React from "react";

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  baseR: number;
  sx: number;
  sy: number;
}

interface DotFieldProps {
  className?: string;
  linkDistance?: number;
  pointerRadius?: number;
  scatterRadius?: number;
}

function DotFieldInner({
  className,
  linkDistance = 120,
  pointerRadius = 180,
  scatterRadius = 200,
}: DotFieldProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dotsRef = React.useRef<Dot[]>([]);
  const pointerRef = React.useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });
  const rafRef = React.useRef<number>(0);
  const sizeRef = React.useRef<{ w: number; h: number; dpr: number }>({
    w: 0,
    h: 0,
    dpr: 1,
  });
  // Cached foreground color (D-26). getComputedStyle forces a layout reflow;
  // calling it 60×/sec janks the whole page. We read it once + re-read when
  // next-themes swaps the <html> class attribute.
  const fgColorRef = React.useRef<string>("rgba(200,200,255,0.4)");
  // Cached canvas bounding rect for pointer events (D-29).
  const rectRef = React.useRef<DOMRect | null>(null);

  const readFgColor = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const fg = getComputedStyle(document.documentElement)
      .getPropertyValue("--foreground")
      .trim();
    fgColorRef.current = fg || "rgba(200,200,255,0.4)";
  }, []);

  const initDots = React.useCallback((w: number, h: number) => {
    const count = Math.min(80, Math.floor((w * h) / 18000));
    const dots: Dot[] = [];
    for (let i = 0; i < count; i++) {
      const baseR = 1 + Math.random() * 1.5;
      dots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: baseR,
        baseR,
        sx: 0,
        sy: 0,
      });
    }
    dotsRef.current = dots;
  }, []);

  const resize = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w === 0 || h === 0) return; // parent is display:none — ResizeObserver will catch the re-show
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const prev = sizeRef.current;
    sizeRef.current = { w, h, dpr };
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Only reinitialize dots if the WIDTH changed significantly (>50px) or
    // this is the first init. Height changes (from typing → strength meter
    // appearing/disappearing) must NOT respawn dots — that's the re-render
    // bug. Instead, dots stay in place and just clip naturally.
    if (prev.w === 0 || Math.abs(w - prev.w) > 50) {
      initDots(w, h);
    }
    rectRef.current = canvas.getBoundingClientRect();
  }, [initDots]);

  const animateRef = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    animateRef.current = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { w, h } = sizeRef.current;
      const dots = dotsRef.current;
      const pointer = pointerRef.current;
      const fgColor = fgColorRef.current; // cached — no per-frame getComputedStyle
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        d.sx *= 0.92;
        d.sy *= 0.92;
        d.x += d.vx + d.sx;
        d.y += d.vy + d.sy;
        if (d.x < -20) d.x = w + 20;
        if (d.x > w + 20) d.x = -20;
        if (d.y < -20) d.y = h + 20;
        if (d.y > h + 20) d.y = -20;
        d.r += (d.baseR - d.r) * 0.1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = fgColor;
        ctx.globalAlpha = 0.35;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.strokeStyle = fgColor;
      ctx.lineWidth = 0.5;
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x,
            dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < linkDistance) {
            ctx.globalAlpha = (1 - dist / linkDistance) * 0.15;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
      }

      if (pointer.active) {
        for (let i = 0; i < dots.length; i++) {
          const d = dots[i];
          const dx = d.x - pointer.x,
            dy = d.y - pointer.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < pointerRadius) {
            ctx.globalAlpha = (1 - dist / pointerRadius) * 0.5;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = fgColor;
            ctx.globalAlpha = (1 - dist / pointerRadius) * 0.6;
            ctx.fill();
          }
        }
        const grad = ctx.createRadialGradient(
          pointer.x,
          pointer.y,
          0,
          pointer.x,
          pointer.y,
          pointerRadius * 0.5,
        );
        grad.addColorStop(0, fgColor);
        grad.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, pointerRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(animateRef.current);
    };
  }, [linkDistance, pointerRadius]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Read the initial foreground color + cache the rect.
    readFgColor();
    resize();
    rectRef.current = canvas.getBoundingClientRect();

    // prefers-reduced-motion (D-28): render one static frame, no rAF loop.
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReduced) {
      rafRef.current = requestAnimationFrame(animateRef.current);
    } else {
      // Draw one static frame so the canvas isn't blank.
      animateRef.current();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

    const handleResize = () => {
      resize();
      rectRef.current = canvas.getBoundingClientRect();
    };
    // ResizeObserver (D-27): catches parent display:none → visible transitions
    // that window.resize misses (e.g. loading → vault view).
    // DEBOUNCED: the setup form changes height on every keystroke (strength
    // meter, error text). Without debouncing, ResizeObserver fires dozens of
    // times per second, causing the dots to flicker. We wait 150ms after the
    // last resize event before calling resize(), which filters out all the
    // intermediate height changes. The canvas just clips naturally in the
    // meantime — no visual jump.
    let roTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (roTimer) clearTimeout(roTimer);
      roTimer = setTimeout(() => {
        resize();
        rectRef.current = canvas.getBoundingClientRect();
      }, 150);
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const handleMove = (e: PointerEvent) => {
      const rect = rectRef.current ?? canvas.getBoundingClientRect();
      pointerRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };
    const handleLeave = () => {
      pointerRef.current.active = false;
    };
    const handleClick = (e: PointerEvent) => {
      const rect = rectRef.current ?? canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left,
        cy = e.clientY - rect.top;
      for (const d of dotsRef.current) {
        const dx = d.x - cx,
          dy = d.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < scatterRadius && dist > 0) {
          const force = (1 - dist / scatterRadius) * 15;
          d.sx += (dx / dist) * force;
          d.sy += (dy / dist) * force;
          d.r = d.baseR * 2.5;
        }
      }
    };
    // Push dots away from a spinning DiamondMark icon. The icon dispatches a
    // `lcked:diamond-spin` CustomEvent with viewport-relative {x,y} coords
    // (icon center) on mouseenter and again at each loop boundary.
    const handleSpin = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        { x: number; y: number } | undefined;
      if (!detail) return;
      const rect = rectRef.current ?? canvas.getBoundingClientRect();
      const cx = detail.x - rect.left;
      const cy = detail.y - rect.top;
      for (const d of dotsRef.current) {
        const dx = d.x - cx,
          dy = d.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < scatterRadius && dist > 0) {
          const force = (1 - dist / scatterRadius) * 18;
          d.sx += (dx / dist) * force;
          d.sy += (dy / dist) * force;
          d.r = d.baseR * 2.5;
        }
      }
    };
    const handleVisibility = () => {
      if (document.hidden) cancelAnimationFrame(rafRef.current);
      else if (!prefersReduced)
        rafRef.current = requestAnimationFrame(animateRef.current);
    };
    // Re-read the foreground color when next-themes swaps <html> class (D-26).
    const themeObserver = new MutationObserver(() => {
      readFgColor();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("resize", handleResize);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerdown", handleClick);
    window.addEventListener("lcked:diamond-spin", handleSpin);
    document.addEventListener("pointerleave", handleLeave);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (roTimer) clearTimeout(roTimer);
      ro.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerdown", handleClick);
      window.removeEventListener("lcked:diamond-spin", handleSpin);
      document.removeEventListener("pointerleave", handleLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [resize, readFgColor, scatterRadius]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ pointerEvents: "auto" }}
    />
  );
}

// Memoize so parent re-renders (e.g. typing in the setup form) don't re-run
// this component's function body. The canvas animation is driven entirely by
// refs + effects with stable deps, so skipping re-renders prevents any chance
// of visual jitter.
export const DotField = React.memo(DotFieldInner);
