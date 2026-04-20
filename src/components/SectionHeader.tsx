"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/InfoTooltip";

interface SectionHeaderTooltip {
  id: string;
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  align?: "left" | "right";
}

interface LinkAction {
  kind: "link";
  href: string;
  label?: string;
}

interface ButtonAction {
  kind: "button";
  onClick: () => void;
  label: string;
  icon?: ReactNode;
}

export interface SectionHeaderProps {
  title: ReactNode;
  /** Optional icon rendered inline before the title text. */
  icon?: ReactNode;
  tooltip?: SectionHeaderTooltip;
  action?: LinkAction | ButtonAction;
  className?: string;
}

const ACTION_CLASS =
  "inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 shrink-0";

export function SectionHeader({
  title,
  icon,
  tooltip,
  action,
  className,
}: SectionHeaderProps) {
  const heading = (
    <h2
      className={cn(
        "font-heading text-lg font-semibold text-slate-800 dark:text-slate-100",
        icon && "flex items-center gap-2"
      )}
    >
      {icon}
      {title}
    </h2>
  );

  const actionEl = action ? (
    action.kind === "link" ? (
      <Link href={action.href} className={ACTION_CLASS}>
        {action.label ?? "Manage"} <ArrowRight size={13} aria-hidden="true" />
      </Link>
    ) : (
      <button type="button" onClick={action.onClick} className={ACTION_CLASS}>
        {action.icon}
        {action.label}
      </button>
    )
  ) : null;

  return (
    <div
      className={cn(
        "mb-4",
        tooltip
          ? "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
          : "flex items-center justify-between",
        className
      )}
    >
      {tooltip ? (
        <div className="flex items-start gap-2 min-w-0">
          {heading}
          <InfoTooltip
            id={tooltip.id}
            label={tooltip.label}
            isOpen={tooltip.isOpen}
            onToggle={tooltip.onToggle}
            iconSize="sm"
            align={tooltip.align}
          >
            {tooltip.children}
          </InfoTooltip>
        </div>
      ) : (
        heading
      )}
      {actionEl}
    </div>
  );
}
