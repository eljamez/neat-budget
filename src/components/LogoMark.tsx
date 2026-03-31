"use client";

import { useId } from "react";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * The Neat Budget brand mark — mirrors the favicon exactly.
 * Uses useId() so the SVG gradient reference stays unique when the component
 * appears more than once in the DOM (e.g. desktop sidebar + mobile top bar).
 */
export function LogoMark({ size = 32, className }: LogoMarkProps) {
  const gradId = useId();

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="100" height="100" rx="22" fill={`url(#${gradId})`} />

      {/* Wallet body */}
      <rect x="15" y="29" width="70" height="45" rx="9" fill="white" />

      {/* Flap / opening line */}
      <rect x="15" y="46" width="70" height="3.5" rx="1.75" fill="#ccfbf1" />

      {/* Coin slot */}
      <rect x="55" y="36" width="23" height="31" rx="6" fill="#0d9488" />

      {/* Coin outline */}
      <circle
        cx="66.5"
        cy="51.5"
        r="5.5"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
        opacity="0.55"
      />
    </svg>
  );
}
