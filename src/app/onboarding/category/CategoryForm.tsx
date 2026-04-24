"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { StepShell, useCelebrate, Celebration } from "../_components";
import { CategoryIllustration } from "../_components/illustrations/CategoryIllustration";
import { TargetDatePicker } from "./TargetDatePicker";
import { onboardingCopy } from "../copy";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function defaultTargetDate(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
}

export function CategoryForm() {
  const router = useRouter();
  const { user } = useUser();
  const { advance, setCategoryId } = useOnboarding(user?.id);
  const celebrate = useCelebrate();

  const groups = useQuery(api.groups.list, {});
  const createGroup = useMutation(api.groups.create);
  const createCategory = useMutation(api.categories.create);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [targetDate, setTargetDate] = useState<Date>(defaultTargetDate);
  const [nameError, setNameError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const copy = onboardingCopy.category;

  const parsedAmount = parseFloat(amount);
  const isAmountValid = amount !== "" && !isNaN(parsedAmount) && parsedAmount > 0;
  const isNameValid = name.trim() !== "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isDateValid = targetDate >= today;
  const isValid = isNameValid && isAmountValid && isDateValid;

  const todayTime = today.getTime();
  const weeksAway = Math.floor((targetDate.getTime() - todayTime) / (7 * 24 * 60 * 60 * 1000));
  const perWeek = isAmountValid && weeksAway >= 1
    ? `$${(parsedAmount / weeksAway).toFixed(2)} per week between now and then.`
    : weeksAway < 1 && isAmountValid
      ? "Less than a week away — almost there."
      : null;

  async function resolveGroupId(): Promise<Id<"groups">> {
    const existing = (groups ?? []).find((g) => g.name === "Expenses");
    if (existing) return existing._id;
    return await createGroup({ name: "Expenses", userId: user?.id });
  }

  async function handleSubmit() {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const groupId = await resolveGroupId();
      const categoryId = await createCategory({
        groupId,
        name: name.trim(),
        monthlyTarget: parsedAmount,
        dueDayOfMonth: targetDate.getDate(),
        userId: user?.id,
      });
      await setCategoryId(categoryId);
      await advance("fund");
      celebrate({ intensity: "medium" });
      router.push("/onboarding/fund");
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
    }
  }

  function validate() {
    let ok = true;
    if (!isNameValid) { setNameError("Category name is required."); ok = false; } else setNameError("");
    if (!isAmountValid) { setAmountError("Enter an amount greater than 0."); ok = false; } else setAmountError("");
    return ok;
  }

  return (
    <>
      <Celebration />
      <StepShell
        title={copy.title}
        subtitle={copy.subtitle}
        illustration={<CategoryIllustration />}
        onNext={handleSubmit}
        nextLabel={copy.submit}
        nextDisabled={!isValid}
        isSubmitting={isSubmitting}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cat-name" className="text-sm font-medium text-stone-700 dark:text-slate-300">
              {copy.nameLabel}
            </label>
            <input
              id="cat-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={copy.namePlaceholder}
              className="rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={isSubmitting}
            />
            {nameError && <p className="text-xs text-red-500">{nameError}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cat-amount" className="text-sm font-medium text-stone-700 dark:text-slate-300">
              {copy.amountLabel}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400 select-none">$</span>
              <input
                id="cat-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="0"
                className="rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-7 pr-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
                disabled={isSubmitting}
              />
            </div>
            {amountError && <p className="text-xs text-red-500">{amountError}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-stone-700 dark:text-slate-300">{copy.dateLabel}</label>
            <TargetDatePicker value={targetDate} onChange={setTargetDate} minDate={today} />
            {perWeek && (
              <p className="text-xs text-teal-600 dark:text-teal-400">That&apos;s about {perWeek}</p>
            )}
          </div>

          <p className="text-xs text-stone-400 dark:text-slate-500 italic">
            We&apos;ll save this as a monthly envelope for the {ordinal(targetDate.getDate())} — so it repeats each month. You can change that later.
          </p>
        </div>
      </StepShell>
    </>
  );
}
