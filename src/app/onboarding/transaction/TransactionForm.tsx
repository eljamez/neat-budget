"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { useCelebrate, Celebration } from "../_components";
import { StepShell } from "../_components";
import { TransactionIllustration } from "../_components/illustrations/TransactionIllustration";
import { LoopRecap } from "./LoopRecap";
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

  const [description, setDescription] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [date, setDate] = useState(todayIso);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const descRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    descRef.current?.focus();
  }, []);

  const createTransaction = useMutation(api.transactions.create);

  const accounts = useQuery(api.accounts.list, user ? { userId: user.id } : "skip");
  const monthlyProgress = useQuery(
    api.categories.getMonthlyProgress,
    user ? { month: currentMonthKey(), userId: user.id } : "skip"
  );

  const accountId = state?.accountId as Id<"accounts"> | undefined;
  const categoryId = state?.categoryId as Id<"categories"> | undefined;

  const account = accounts?.find((a) => a._id === accountId);
  const categoryProgress = monthlyProgress?.find(
    (p) => p.category._id === categoryId
  );

  const accountName = account?.name ?? "Account";
  const accountBalance = account?.balance ?? 0;
  const categoryName = categoryProgress?.category.name ?? "Category";
  const categoryMonthlyTarget = categoryProgress?.target ?? 0;

  const amount = parseFloat(amountRaw);
  const amountValid = Number.isFinite(amount) && amount > 0;
  const overEnvelope = amountValid && amount > categoryMonthlyTarget;
  const formValid =
    description.trim().length > 0 &&
    amountValid &&
    date.length === 10;

  const copy = onboardingCopy.transaction;

  async function handleSubmit() {
    if (!formValid || !accountId || !categoryId) return;
    setIsSubmitting(true);
    try {
      await createTransaction({
        amount,
        note: description.trim(),
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

  const chipClass =
    "rounded-lg bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 px-3 py-2 text-sm text-stone-500 dark:text-slate-400";

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
        <LoopRecap
          accountName={accountName}
          accountBalance={accountBalance}
          categoryName={categoryName}
          categoryMonthlyTarget={categoryMonthlyTarget}
          pendingAmount={amountValid ? amount : 0}
        />

        {/* Payee / description */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="tx-description"
            className="text-sm font-medium text-stone-700 dark:text-slate-300"
          >
            {copy.payeeLabel}
          </label>
          <input
            id="tx-description"
            ref={descRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Landlord"
            required
            className="w-full rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-foreground placeholder:text-stone-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="tx-amount"
            className="text-sm font-medium text-stone-700 dark:text-slate-300"
          >
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
              required
              className="w-full rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-4 py-3 text-sm text-foreground placeholder:text-stone-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          {overEnvelope && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              You&apos;ll be over this envelope — that&apos;s ok, just heads up.
            </p>
          )}
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="tx-date"
            className="text-sm font-medium text-stone-700 dark:text-slate-300"
          >
            {copy.dateLabel}
          </label>
          <input
            id="tx-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Locked chips */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-stone-400 dark:text-slate-500 uppercase tracking-wide">
              Account
            </span>
            <div className={chipClass}>{accountName}</div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-stone-400 dark:text-slate-500 uppercase tracking-wide">
              Category
            </span>
            <div className={chipClass}>{categoryName}</div>
          </div>
        </div>
      </StepShell>
    </>
  );
}
