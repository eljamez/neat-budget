"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type StepShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  isSubmitting?: boolean;
  illustration?: ReactNode;
};

export function StepShell({
  title,
  subtitle,
  children,
  onNext,
  nextLabel = "Next",
  nextDisabled = false,
  isSubmitting = false,
  illustration,
}: StepShellProps) {
  return (
    <div className="flex flex-col gap-6">
      {illustration && (
        <div className="flex justify-center">{illustration}</div>
      )}

      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-2xl font-bold text-foreground leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-stone-500 dark:text-slate-400 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-5">{children}</div>

      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || isSubmitting}
          className={cn(
            "mt-2 w-full rounded-xl px-6 py-3 text-sm font-semibold text-white",
            "bg-teal-600 hover:bg-teal-700 active:bg-teal-800",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Saving…
            </span>
          ) : (
            nextLabel
          )}
        </button>
      )}
    </div>
  );
}
