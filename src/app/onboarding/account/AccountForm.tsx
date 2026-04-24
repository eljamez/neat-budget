"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { StepShell, useCelebrate, Celebration } from "../_components";
import { AccountIllustration } from "../_components/illustrations/AccountIllustration";
import { onboardingCopy } from "../copy";

export function AccountForm() {
  const router = useRouter();
  const { user } = useUser();
  const { advance, setAccountId } = useOnboarding(user?.id);
  const createAccount = useMutation(api.accounts.create);
  const celebrate = useCelebrate();

  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [nameError, setNameError] = useState("");
  const [balanceError, setBalanceError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const copy = onboardingCopy.account;

  function validate() {
    let ok = true;
    if (!name.trim()) {
      setNameError("Account name is required.");
      ok = false;
    } else {
      setNameError("");
    }
    const parsed = parseFloat(balance);
    if (balance === "" || isNaN(parsed) || parsed < 0) {
      setBalanceError("Enter a valid balance (0 or more).");
      ok = false;
    } else {
      setBalanceError("");
    }
    return ok;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const id = await createAccount({
        name: name.trim(),
        balance: Math.round(parseFloat(balance) * 100) / 100,
        accountType: "checking",
        userId: user?.id,
      });
      await setAccountId(id);
      await advance("category");
      celebrate({ intensity: "small" });
      router.push("/onboarding/category");
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
    }
  }

  const isValid = name.trim() !== "" && balance !== "" && parseFloat(balance) >= 0 && !isNaN(parseFloat(balance));

  return (
    <>
      <Celebration />
      <StepShell
        title={copy.title}
        subtitle={copy.subtitle}
        illustration={<AccountIllustration />}
        onNext={handleSubmit}
        nextLabel={copy.submit}
        nextDisabled={!isValid}
        isSubmitting={isSubmitting}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="account-name" className="text-sm font-medium text-stone-700 dark:text-slate-300">
              {copy.nameLabel}
            </label>
            <input
              id="account-name"
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
            <label htmlFor="account-balance" className="text-sm font-medium text-stone-700 dark:text-slate-300">
              {copy.balanceLabel}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400 select-none">$</span>
              <input
                id="account-balance"
                type="number"
                min="0"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="0"
                className="rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-7 pr-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
                disabled={isSubmitting}
              />
            </div>
            <p className="text-xs text-stone-400 dark:text-slate-500">{copy.balanceHint}</p>
            {balanceError && <p className="text-xs text-red-500">{balanceError}</p>}
          </div>

          <p className="text-xs text-stone-400 dark:text-slate-500 italic">{copy.hint}</p>
        </div>
      </StepShell>
    </>
  );
}
