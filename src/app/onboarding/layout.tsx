"use client";

import { useUser } from "@clerk/nextjs";
import { ProgressBar } from "./_components/ProgressBar";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { state } = useOnboarding(user?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#fafaf9] dark:bg-slate-950 overflow-y-auto">
      <div className="w-full max-w-lg mx-auto px-4 py-10 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-medium text-teal-600 dark:text-teal-400 tracking-wide uppercase">
            Neat Budget
          </span>
          <ProgressBar currentStep={state?.step ?? "account"} />
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-stone-100 dark:border-slate-800 p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
