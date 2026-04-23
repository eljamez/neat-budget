"use client";

import type { OnboardingStep } from "@/lib/onboarding/useOnboarding";

const STEPS: OnboardingStep[] = ["account", "category", "fund", "transaction"];
const STEP_LABELS = ["Account", "Category", "Fund", "Transaction"];

const STEP_INDEX: Record<OnboardingStep, number> = {
  account: 0,
  category: 1,
  fund: 2,
  transaction: 3,
  done: 4,
};

export function ProgressBar({ currentStep }: { currentStep: OnboardingStep }) {
  const currentIdx = STEP_INDEX[currentStep];

  return (
    <div className="flex items-center gap-2" role="progressbar" aria-label="Onboarding progress" aria-valuenow={currentIdx} aria-valuemin={0} aria-valuemax={4}>
      {STEPS.map((step, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;

        return (
          <div key={step} className="flex flex-col items-center gap-1">
            <div
              className={[
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                isCompleted
                  ? "bg-teal-600"
                  : isCurrent
                    ? "bg-teal-600 scale-125 motion-safe:animate-pulse"
                    : "bg-stone-200 dark:bg-slate-700",
              ].join(" ")}
              aria-label={`Step ${i + 1}: ${STEP_LABELS[i]}${isCompleted ? " (completed)" : isCurrent ? " (current)" : ""}`}
            />
          </div>
        );
      })}
    </div>
  );
}
