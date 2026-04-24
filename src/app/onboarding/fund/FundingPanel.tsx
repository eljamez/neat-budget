"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { StepShell, useCelebrate, Celebration } from "../_components";
import { FundIllustration } from "../_components/illustrations/FundIllustration";
import { MoneyFlowAnimation } from "./MoneyFlowAnimation";
import { onboardingCopy } from "../copy";

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function localMonthKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function FundingPanel() {
  const router = useRouter();
  const { user } = useUser();
  const { state, isLoading: stateLoading, advance } = useOnboarding(user?.id);
  const celebrate = useCelebrate();

  const setFundedForMonth = useMutation(api.categories.setFundedForMonth);
  const updateCategory = useMutation(api.categories.update);

  const accounts = useQuery(api.accounts.list, user ? { userId: user.id } : "skip");
  const monthKey = localMonthKey();
  const monthlyProgress = useQuery(api.categories.getMonthlyProgress, user ? { month: monthKey, userId: user.id } : "skip");

  const account = accounts?.find((a) => a._id === state?.accountId);
  const categoryProgress = monthlyProgress?.find((c) => c.category._id === state?.categoryId);
  const category = categoryProgress?.category;
  const monthlyTarget = category?.monthlyTarget ?? 0;

  const maxSlider = Math.min(account?.balance ?? 0, monthlyTarget);
  const [sliderValue, setSliderValue] = useState<number | null>(null);
  const effectiveValue = sliderValue ?? maxSlider;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [animRunning, setAnimRunning] = useState(false);

  const copy = onboardingCopy.fund;

  const handleAnimComplete = useCallback(async () => {
    setAnimRunning(false);
    celebrate({ intensity: "medium" });
    await advance("transaction");
    router.push("/onboarding/transaction");
  }, [celebrate, advance, router]);

  const isLoading = stateLoading || !accounts || !monthlyProgress;

  async function handleFund() {
    if (!state?.categoryId || !state?.accountId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await setFundedForMonth({ id: state.categoryId, monthKey, funded: true, userId: user?.id });
      await updateCategory({ id: state.categoryId, paymentAccountId: state.accountId, userId: user?.id });
      setAnimRunning(true);
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-5 h-5 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!account || !category) {
    return (
      <div className="flex justify-center py-12 text-sm text-stone-400">
        Could not load your account or category. Try refreshing.
      </div>
    );
  }

  const fillPct = monthlyTarget > 0 ? Math.min(100, (effectiveValue / monthlyTarget) * 100) : 0;
  const availableAfter = account.balance - effectiveValue;

  return (
    <>
      <Celebration />
      <StepShell
        title={copy.title}
        subtitle={copy.subtitle}
        illustration={<FundIllustration />}
        onNext={handleFund}
        nextLabel={`Fund ${formatCurrency(effectiveValue)}`}
        nextDisabled={isSubmitting || effectiveValue <= 0}
        isSubmitting={isSubmitting}
      >
        <div className="flex flex-col gap-5">
          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Account card */}
            <div className="rounded-2xl border border-stone-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-1">
              <p className="text-xs font-medium text-stone-400 dark:text-slate-500 uppercase tracking-wide">From</p>
              <p className="font-semibold text-stone-800 dark:text-slate-100">{account.name}</p>
              <p className="text-sm text-stone-600 dark:text-slate-300">{formatCurrency(account.balance)}</p>
              <p className="text-xs text-stone-400 dark:text-slate-500 mt-1">
                Available after this: <span className="font-medium text-stone-600 dark:text-slate-300">{formatCurrency(availableAfter)}</span>
              </p>
              <p className="text-xs text-stone-400 dark:text-slate-500 italic mt-1">{copy.realityCheck}</p>
            </div>

            {/* Category card */}
            <div className="rounded-2xl border border-stone-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-2">
              <p className="text-xs font-medium text-stone-400 dark:text-slate-500 uppercase tracking-wide">Assign to</p>
              <p className="font-semibold text-stone-800 dark:text-slate-100">{category.name}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-stone-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full transition-all duration-150"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
                <span className="text-xs text-stone-500 dark:text-slate-400 whitespace-nowrap">
                  {formatCurrency(effectiveValue)} / {formatCurrency(monthlyTarget)}
                </span>
              </div>
            </div>
          </div>

          {/* Slider */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-stone-700 dark:text-slate-300">
              How much to assign: <span className="text-teal-600 dark:text-teal-400 font-semibold">{formatCurrency(effectiveValue)}</span>
            </label>
            <input
              type="range"
              min={0}
              max={maxSlider}
              step={1}
              value={effectiveValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              className="w-full accent-teal-600"
              disabled={isSubmitting}
            />
            <div className="flex justify-between text-xs text-stone-400 dark:text-slate-500">
              <span>$0</span>
              <span>{formatCurrency(maxSlider)}</span>
            </div>
          </div>

          {animRunning && <MoneyFlowAnimation running={animRunning} onComplete={handleAnimComplete} />}
        </div>
      </StepShell>
    </>
  );
}
