"use client";

import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

interface InfoTooltipProps {
  id: string;
  label: string;
  children: ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
  align?: "left" | "right";
  maxWidth?: string;
  iconSize?: "sm" | "md";
  variant?: "teal" | "slate";
}

export function InfoTooltip({
  id,
  label,
  children,
  isOpen,
  onToggle,
  align = "left",
  maxWidth = "20rem",
  iconSize = "md",
  variant = "slate",
}: InfoTooltipProps) {
  const iconClass = iconSize === "sm" ? "w-4 h-4" : "w-5 h-5 sm:w-[1.35rem] sm:h-[1.35rem]";
  const buttonColorClass =
    variant === "teal"
      ? "text-teal-700/70 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-100 hover:bg-teal-100/80 dark:hover:bg-teal-900/50"
      : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10";

  return (
    <span className="relative shrink-0 group z-10">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "rounded-full p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900",
          buttonColorClass
        )}
        aria-label={label}
        aria-describedby={id}
      >
        <Info className={iconClass} aria-hidden="true" />
      </button>
      <span
        id={id}
        role="tooltip"
        style={{ maxWidth: `min(${maxWidth}, calc(100vw - 2rem))` }}
        className={cn(
          "pointer-events-none absolute top-full mt-1.5 w-max rounded-xl bg-slate-900 px-3.5 py-3 text-xs font-normal leading-relaxed text-white shadow-lg opacity-0 invisible translate-y-0.5 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 z-20",
          align === "right" ? "right-0 text-left" : "left-0",
          isOpen && "opacity-100 visible translate-y-0"
        )}
      >
        {children}
      </span>
    </span>
  );
}
