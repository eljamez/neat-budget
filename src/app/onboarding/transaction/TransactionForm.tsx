"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { useCelebrate, Celebration } from "../_components";
import { StepShell } from "../_components";
import { TransactionIllustration } from "../_components/illustrations/TransactionIllustration";
import { LoopRecap } from "./LoopRecap";
import { CalendarPicker } from "./CalendarPicker";
import { onboardingCopy } from "../copy";
import type { Id } from "../../../../convex/_generated/dataModel";

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentMonthKey(): string {
  return todayIso().slice(0, 7);
}

export function TransactionForm() {
  const router = useRouter();
  const { user } = useUser();
  const { state, complete } = useOnboarding(user?.id);
  const celebrate = useCelebrate();

  const [amountRaw, setAmountRaw] = useState("");
  const [date, setDate] = useState(todayIso);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createTransaction = useMutation(api.transactions.create);

  const accounts = useQuery(api.accounts.list, user ? { userId: user.id } : "skip");
  const monthlyProgress = useQuery(
    api.categories.getMonthlyProgress,
    user ? { month: currentMonthKey(), userId: user.id } : "skip"
  );

  const accountId = state?.accountId as Id<"accounts"> | undefined;
  const categoryId = state?.categoryId as Id<"categories"> | undefined;

  const account = accounts?.find((a) => a._id === accountId);
  const categoryProgress = monthlyProgress?.find((p) => p.category._id === categoryId);

  const accountName = account?.name ?? "Account";
  const accountBalance = account?.balance ?? 0;
  const categoryName = categoryProgress?.category.name ?? "Category";
  const categoryMonthlyTarget = categoryProgress?.target ?? 0;

  const amount = parseFloat(amountRaw);
  const amountValid = Number.isFinite(amount) && amount > 0;
  const overBudget = amountValid && amount > categoryMonthlyTarget;
  const formValid = amountValid && date.length === 10;

  const copy = onboardingCopy.transaction;

  async function handleSubmit() {
    if (!formValid || !accountId || !categoryId) return;
    setIsSubmitting(true);
    try {
      await createTransaction({
        amount,
        date,
        categoryId,
        accountId,
        userId: user?.id,
      });
      celebrate({ intensity: "big" });
      await complete();
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to create transaction", err);
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Celebration />
      <StepShell
        title={copy.title}
        subtitle={copy.subtitle}
        illustration={<TransactionIllustration />}
        onNext={handleSubmit}
        nextLabel={copy.submit}
        nextDisabled={!formValid}
        isSubmitting={isSubmitting}
      >
        <div className="flex flex-col gap-4">
          <LoopRecap
            accountName={accountName}
            accountBalance={accountBalance}
            categoryName={categoryName}
            categoryMonthlyTarget={categoryMonthlyTarget}
            pendingAmount={amountValid ? amount : 0}
          />

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tx-amount" className="text-sm font-medium text-stone-700 dark:text-slate-300">
              {copy.amountLabel}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-stone-400 dark:text-slate-500 pointer-events-none">
                $
              </span>
              <input
                id="tx-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-4 py-3 text-sm text-foreground placeholder:text-stone-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            {overBudget && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                That&apos;s more than you assigned — that&apos;s ok, just heads up.
              </p>
            )}
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-stone-700 dark:text-slate-300">
              {copy.dateLabel}
            </label>
            <CalendarPicker value={date} onChange={setDate} />
          </div>
        </div>
      </StepShell>
    </>
  );
}
