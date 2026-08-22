"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DiamondMarkProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

/**
 * Spin state machine:
 *  - `idle`        : no animation, transform locked to rotate(45deg)
 *  - `spinning`    : animation = lcked-spin-3x 1.5s linear infinite (looping)
 *  - `completing`  : SAME animation string as `spinning` (so React does not
 *                    touch the inline style and the browser keeps the loop
 *                    running). We listen for the next `animationiteration`
 *                    event (fires at the loop boundary, transform = rotate(45deg))
 *                    and flip back to `idle` — removing the animation and
 *                    setting `transform: rotate(45deg)` is visually identical,
 *                    so there is no visible jump.
 *
 * The keyframes go from rotate(45deg) → rotate(1125deg) (1080° = 3 full turns,
 * 45° mod 360° at both ends → seamless loop).
 */
type SpinState = "idle" | "spinning" | "completing";

function dispatchDiamondSpin(el: Element | null) {
  if (!el || typeof window === "undefined") return;
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  window.dispatchEvent(
    new CustomEvent("lcked:diamond-spin", { detail: { x, y } }),
  );
}

export function DiamondMark({ className, size = 64, glow = false }: DiamondMarkProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [spin, setSpin] = React.useState<SpinState>("idle");
  const completingRef = React.useRef(false);

  const handleEnter = () => {
    completingRef.current = false;
    setSpin("spinning");
    // Push the dot field away from the icon's current position on spin start.
    dispatchDiamondSpin(svgRef.current);
  };

  const handleLeave = () => {
    if (completingRef.current) return;
    if (spin === "idle") return;
    // Don't stop immediately — let the current loop finish first.
    completingRef.current = true;
    setSpin("completing");
  };

  // On `completing`, wait for the next loop boundary then drop to idle.
  React.useEffect(() => {
    if (spin !== "completing") return;
    const el = svgRef.current;
    if (!el) return;
    const onIter = () => {
      completingRef.current = false;
      setSpin("idle");
    };
    el.addEventListener("animationiteration", onIter);
    return () => el.removeEventListener("animationiteration", onIter);
  }, [spin]);

  // While `spinning`, keep pushing the dot field on every loop boundary —
  // creates a continuous repulsion rhythm tied to the spin cadence.
  React.useEffect(() => {
    if (spin !== "spinning") return;
    const el = svgRef.current;
    if (!el) return;
    const onIter = () => dispatchDiamondSpin(el);
    el.addEventListener("animationiteration", onIter);
    return () => el.removeEventListener("animationiteration", onIter);
  }, [spin]);

  const groupStyle: React.CSSProperties = {
    transformOrigin: "32px 32px",
    transformBox: "view-box",
  };
  if (spin === "idle") {
    groupStyle.transform = "rotate(45deg)";
  } else {
    // Identical string for `spinning` and `completing` so React's style diff
    // does not reset the running animation.
    groupStyle.animation = "lcked-spin-3x 1.5s cubic-bezier(0.25, 0.1, 0.25, 1) infinite";
  }

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        glow && "drop-shadow-[0_0_18px_color-mix(in_oklab,currentColor_35%,transparent)]",
        className,
      )}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lcked-facet" x1="20" y1="8" x2="44" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.65" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="lcked-light" x1="32" y1="8" x2="32" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.4" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g style={groupStyle}>
        <rect x="13" y="13" width="38" height="38" rx="5" fill="url(#lcked-facet)" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
        <rect x="13" y="13" width="38" height="22" rx="5" fill="url(#lcked-light)" />
        <line x1="13" y1="32" x2="51" y2="32" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
        <line x1="32" y1="13" x2="32" y2="51" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
      </g>

      <g fill="currentColor">
        <circle cx="32" cy="27" r="4.5" />
        <path d="M32 29.5 L29 42 L35 42 Z" />
      </g>
      <circle cx="32" cy="27" r="1.8" fill="#000000" fillOpacity="0.85" />

      <style>{`
        @keyframes lcked-spin-3x {
          from { transform: rotate(45deg); }
          to   { transform: rotate(1125deg); }
        }
      `}</style>
    </svg>
  );
}
