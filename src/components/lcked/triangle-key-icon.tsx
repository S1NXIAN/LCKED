"use client";

import { cn } from "@/lib/utils";

/**
 * LCKED — Triangle Key brand mark
 * ---------------------------------------------------------------------------
 * A triangle (vault/apex) containing a key. On hover, the key changes color
 * from muted to the primary accent — a subtle, satisfying brand interaction.
 * Used as the main LCKED icon in the sidebar brand and lock screens.
 */

interface TriangleKeyIconProps {
  className?: string;
  size?: number;
}

export function TriangleKeyIcon({ className, size = 40 }: TriangleKeyIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("group transition-colors", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lcked-tri-grad" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Triangle outline — the vault/apex */}
      <path
        d="M24 6 L42 40 L6 40 Z"
        stroke="url(#lcked-tri-grad)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="var(--primary)"
        fillOpacity="0.08"
      />
      {/* Key — centered inside the triangle. Changes color on hover. */}
      <g className="transition-colors duration-200" style={{ color: "var(--muted-foreground)" }}>
        {/* Key ring */}
        <circle
          cx="20"
          cy="22"
          r="5"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          className="group-hover:[stroke:var(--primary)] transition-[stroke] duration-200"
        />
        {/* Key shaft */}
        <path
          d="M24 26 L31 26 M29 26 L29 30 M31 26 L31 29"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="group-hover:[stroke:var(--primary)] transition-[stroke] duration-200"
        />
      </g>
    </svg>
  );
}
