"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BudgetCard } from "@/components/BudgetCard";
import { ExpenseTimeline, buildPlannerRows } from "@/components/ExpenseTimeline";
import {
  formatCurrency,
  formatMonth,
  formatShortDate,
  getCurrentMonth,
  shiftMonth,
  sumBudgetItemsByCategory,
  formatDebtType,
  formatAprPercent,
  formatCreditCardUsageMode,
  accountIsAssetForAvailability,
  formatAccountType,
  bucketMonthlyFundingCap,
  asOfDateForBudgetView,
} from "@/lib/utils";
import { BucketFundingModal } from "@/components/BucketFundingModal";
import type { Id } from "../../../convex/_generated/dataModel";
import { CATEGORY_ICON_MAP } from "@/lib/icons";
import { useTransactionModal } from "@/components/TransactionModalProvider";
import Link from "next/link";
import { useState, useMemo } from "react";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  CreditCard,
  Landmark,
  Receipt,
  Boxes,
} from "lucide-react";
import type { Bucket } from "@/types/bucket";

const BUCKET_PERIOD_LABEL: Record<Bucket["period"], string> = {
  weekly: "week",
  biweekly: "two weeks",
  monthly: "month",
  quarterly: "quarter",
  yearly: "year",
};

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function getBudgetSubtitle(
  totalBudget: number,
  totalSpent: number,
  overBudgetCount: number,
  categoriesLoaded: boolean,
  selectedMonth: string,
) {
  if (!categoriesLoaded || totalBudget === 0) return null;
  if (overBudgetCount > 0) return null; // alert strip handles this
  const pct = totalSpent / totalBudget;
  const isCalendarMonth = selectedMonth === getCurrentMonth();
  const monthLabel = formatMonth(selectedMonth);
  if (totalSpent === 0) {
    return isCalendarMonth
      ? "No spending logged yet this month."
      : `No spending logged for ${monthLabel} yet.`;
  }
  if (pct < 0.5) {
    return isCalendarMonth
      ? `You've used ${Math.round(pct * 100)}% of your budget — looking good.`
      : `${Math.round(pct * 100)}% of your ${monthLabel} budget used — looking good.`;
  }
  if (pct < 0.8) {
    return isCalendarMonth
      ? `${Math.round(pct * 100)}% of your budget used. Staying on track.`
      : `${Math.round(pct * 100)}% of your ${monthLabel} budget used. Staying on track.`;
  }
  if (pct < 1) {
    return isCalendarMonth
      ? `${Math.round(pct * 100)}% used — keep a close eye this month.`
      : `${Math.round(pct * 100)}% of ${monthLabel} budget used — keep a close eye.`;
  }
  return null;
}

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { openAddTransaction, openEditTransaction } = useTransactionModal();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [bucketFundOpen, setBucketFundOpen] = useState<{
    id: Id<"buckets">;
    name: string;
    monthlyFundingCap: number;
    spendTarget: number;
    defaultAccountId: Id<"accounts"> | null;
  } | null>(null);

  const categories = useQuery(
    api.categories.list,
    user ? { userId: user.id } : "skip"
  );

  const spendingByCategory = useQuery(
    api.transactions.getMonthlySpendingByCategory,
    user ? { userId: user.id, month: selectedMonth } : "skip"
  );

  const transactions = useQuery(
    api.transactions.list,
    user ? { userId: user.id, month: selectedMonth } : "skip"
  );

  const allBudgetItems = useQuery(
    api.budgetItems.listByUser,
    user ? { userId: user.id } : "skip"
  );

  const accounts = useQuery(
    api.accounts.list,
    user ? { userId: user.id } : "skip"
  );

  const debts = useQuery(api.debts.list, user ? { userId: user.id } : "skip");
  const creditCards = useQuery(api.creditCards.list, user ? { userId: user.id } : "skip");

  const bucketFundingsMonth = useQuery(
    api.bucketMonthFundings.listByUserMonth,
    user ? { userId: user.id, monthKey: selectedMonth } : "skip"
  );

  const asOfDate = useMemo(() => asOfDateForBudgetView(selectedMonth), [selectedMonth]);
  const availability = useQuery(
    api.budgetItems.getAvailableBalance,
    user ? { userId: user.id, date: asOfDate } : "skip"
  );

  const availByAccountId = useMemo(() => {
    if (!availability?.byAccount) return {};
    return Object.fromEntries(
      availability.byAccount.map((a) => [
        a.accountId as string,
        { funded: a.funded, available: a.available },
      ])
    );
  }, [availability]);

  const buckets = useQuery(api.buckets.getBuckets, user ? { userId: user.id } : "skip");

  type CategoryEntry = NonNullable<typeof categories>[number];
  const categoryMap = useMemo((): Record<string, CategoryEntry> => {
    if (!categories) return {};
    return Object.fromEntries(categories.map((c) => [c._id, c]));
  }, [categories]);

  type AccountEntry = NonNullable<typeof accounts>[number];
  const accountMap = useMemo((): Record<string, AccountEntry> => {
    if (!accounts) return {};
    return Object.fromEntries(accounts.map((a) => [a._id, a]));
  }, [accounts]);

  type DebtEntry = NonNullable<typeof debts>[number];
  const debtMap = useMemo((): Record<string, DebtEntry> => {
    if (!debts) return {};
    return Object.fromEntries(debts.map((d) => [d._id, d]));
  }, [debts]);

  type CardEntry = NonNullable<typeof creditCards>[number];
  const cardMap = useMemo((): Record<string, CardEntry> => {
    if (!creditCards) return {};
    return Object.fromEntries(creditCards.map((c) => [c._id, c]));
  }, [creditCards]);

  type BudgetItemEntry = NonNullable<typeof allBudgetItems>[number];
  const budgetItemMap = useMemo((): Record<string, BudgetItemEntry> => {
    if (!allBudgetItems) return {};
    return Object.fromEntries(allBudgetItems.map((b) => [b._id, b]));
  }, [allBudgetItems]);

  const plannedByCategory = useMemo(() => {
    if (!allBudgetItems) return {};
    return sumBudgetItemsByCategory(allBudgetItems);
  }, [allBudgetItems]);

  const fundedByBucketId = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of bucketFundingsMonth ?? []) {
      const k = f.bucketId as string;
      m[k] = (m[k] ?? 0) + f.amount;
    }
    return m;
  }, [bucketFundingsMonth]);

  const plannerRows = useMemo(
    () => buildPlannerRows(allBudgetItems, debts, creditCards),
    [allBudgetItems, debts, creditCards]
  );

  const sortedBuckets = useMemo(() => {
    if (!buckets) return [];
    return [...buckets].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [buckets]);

  const categoryBudgetCap = (categoryId: string) =>
    plannedByCategory[categoryId] ?? 0;

  if (!isLoaded) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    redirect("/sign-in");
  }

  const totalBudget =
    categories?.reduce((sum, c) => sum + categoryBudgetCap(c._id), 0) ?? 0;
  const totalSpent = Object.values(spendingByCategory ?? {}).reduce((a, b) => a + b, 0);
  const overBudgetCount =
    categories?.filter(
      (c) =>
        (spendingByCategory?.[c._id] ?? 0) > categoryBudgetCap(c._id)
    ).length ?? 0;

  const overallPercent = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  const categoriesLoaded = categories !== undefined;
  const allOnTrack = categoriesLoaded && (categories?.length ?? 0) > 0 && overBudgetCount === 0 && totalSpent > 0;
  const budgetSubtitle = getBudgetSubtitle(
    totalBudget,
    totalSpent,
    overBudgetCount,
    categoriesLoaded,
    selectedMonth,
  );
  const viewingCalendarMonth = selectedMonth === getCurrentMonth();
  const spentPeriodLabel = viewingCalendarMonth
    ? "spent this month"
    : `spent in ${formatMonth(selectedMonth)}`;

  return (
    <div className="w-full space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
            Good {getTimeOfDay()}, {user.firstName ?? "there"}
          </h1>
          {budgetSubtitle
            ? <p className="text-slate-500 text-sm mt-0.5">{budgetSubtitle}</p>
            : <p className="text-slate-500 text-sm mt-0.5">{formatMonth(selectedMonth)}</p>
          }
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
              className="p-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors border-r border-slate-100"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Select month"
              className="min-w-0 flex-1 sm:w-38 border-0 bg-transparent px-2 py-2 text-sm text-slate-700 text-center focus:ring-0 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
              className="p-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors border-l border-slate-100"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
          {!viewingCalendarMonth && (
            <button
              type="button"
              onClick={() => setSelectedMonth(getCurrentMonth())}
              className="text-sm font-medium text-teal-600 hover:text-teal-700 px-2 py-1 rounded-lg hover:bg-teal-50 transition-colors"
            >
              This month
            </button>
          )}
          <button
            type="button"
            onClick={openAddTransaction}
            className="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={14} aria-hidden="true" />
            Add
          </button>
        </div>
      </div>

      {/* Accounts: hero balance + funded vs still available to earmark (detail lives under Accounts) */}
      {accounts !== undefined && accounts.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-linear-to-br from-slate-50/95 via-white to-teal-50/35 shadow-sm p-5 sm:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-5 sm:mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Your accounts</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-snug">
                Balances for {formatMonth(selectedMonth)}.{" "}
                <span className="text-slate-600 font-medium">Funded</span> is cash you&apos;ve earmarked from that account
                (bills + buckets).{" "}
                <span className="text-slate-600 font-medium">Available</span> is what&apos;s still unassigned in that
                balance.
              </p>
            </div>
            <Link
              href="/accounts"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 shrink-0 rounded-lg px-2 py-1 -mr-2 hover:bg-teal-50/80 transition-colors"
            >
              All accounts <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {accounts.map((acc) => {
              const av = availByAccountId[acc._id];
              const funded = av?.funded ?? 0;
              const isAsset = accountIsAssetForAvailability(acc.accountType);
              const unallocated =
                isAsset && av?.available != null ? av.available : isAsset ? acc.balance - funded : null;
              const pctOfBalance =
                isAsset && acc.balance > 0.005
                  ? Math.min(100, (funded / acc.balance) * 100)
                  : isAsset && acc.balance <= 0.005 && funded > 0.005
                    ? 100
                    : 0;
              return (
                <div
                  key={acc._id}
                  className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white px-5 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md hover:border-slate-300/90"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate text-base">{acc.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium uppercase tracking-wide">
                        {formatAccountType(acc.accountType)}
                      </p>
                    </div>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700 ring-1 ring-teal-600/10">
                      <Landmark className="h-5 w-5" aria-hidden="true" />
                    </div>
                  </div>

                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Balance</p>
                  <p className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 tabular-nums leading-none">
                    {formatCurrency(acc.balance)}
                  </p>

                  {isAsset && unallocated !== null ? (
                    <>
                      <div className="mt-5 h-2 rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-200/60">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-teal-500 to-teal-400 transition-[width] duration-500 ease-out"
                          style={{ width: `${pctOfBalance}%` }}
                          title={`${Math.round(pctOfBalance)}% of balance is funded`}
                        />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-teal-50/80 border border-teal-100/90 px-3.5 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800/80">Funded</p>
                          <p className="mt-1 text-lg font-bold tabular-nums text-teal-950">{formatCurrency(funded)}</p>
                          <p className="text-[10px] text-teal-700/80 mt-1 leading-snug">
                            Earmarked (bills from funded date + buckets)
                          </p>
                        </div>
                        <div
                          className={`rounded-xl border px-3.5 py-3 ${
                            unallocated < -0.005
                              ? "bg-rose-50/90 border-rose-100"
                              : "bg-emerald-50/80 border-emerald-100/90"
                          }`}
                        >
                          <p
                            className={`text-[11px] font-semibold uppercase tracking-wide ${
                              unallocated < -0.005 ? "text-rose-800/85" : "text-emerald-800/80"
                            }`}
                          >
                            Available
                          </p>
                          <p
                            className={`mt-1 text-lg font-bold tabular-nums ${
                              unallocated < -0.005 ? "text-rose-950" : "text-emerald-950"
                            }`}
                          >
                            {formatCurrency(unallocated)}
                          </p>
                          <p
                            className={`text-[10px] mt-1 leading-snug ${
                              unallocated < -0.005 ? "text-rose-700/85" : "text-emerald-700/80"
                            }`}
                          >
                            {unallocated < -0.005 ? "Over-earmarked vs balance" : "Left to assign"}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="mt-5 text-sm text-slate-500 leading-relaxed">
                      Liability balance — funding math applies to cash accounts. Use{" "}
                      <Link href="/accounts" className="font-medium text-teal-700 hover:text-teal-800 underline-offset-2 hover:underline">
                        Accounts
                      </Link>{" "}
                      to edit details.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {categories !== undefined && categories.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 items-start">
          <div className="lg:col-span-2 w-full min-w-0 space-y-4">
            <div className="rounded-xl border border-teal-100 bg-linear-to-r from-teal-50/90 to-slate-50/80 px-4 py-3 text-sm shadow-sm">
              <p className="font-semibold text-teal-950 tracking-tight">{formatMonth(selectedMonth)}</p>
              <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                Bills are ordered by <strong className="font-semibold text-slate-700">when funds must be ready</strong>.{" "}
                <strong className="font-semibold text-slate-700">Bank ✓</strong> = pay-from account set.{" "}
                <strong className="font-semibold text-slate-700">Reserved</strong> = marked funded (counts against Available from that date).{" "}
                <strong className="font-semibold text-slate-700">Earmarked</strong> = cash lines toward the bill this month.{" "}
                <strong className="font-semibold text-slate-700">Paid</strong> = settled (checkmark).
                Card and loan rows are planned payments — fund from cash, then mark paid when done.
              </p>
            </div>
            {allBudgetItems === undefined || debts === undefined || creditCards === undefined ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-white rounded-xl border border-slate-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <ExpenseTimeline
                items={plannerRows}
                categories={categories}
                budgetMonth={selectedMonth}
                userId={user.id}
                debts={debts}
              />
            )}
          </div>

          <aside className="lg:col-span-1 w-full min-w-0">
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 sticky top-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="font-semibold text-slate-800 text-sm">Buckets</h2>
                <Link
                  href="/buckets"
                  className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium shrink-0"
                >
                  Manage <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug mb-3">
                Spending vs targets for {formatMonth(selectedMonth)}. Set a monthly fill amount on each bucket to cap how
                much you earmark; <span className="font-medium text-slate-600">funded</span> is separate from spent. Link a
                category to track spend.
              </p>
              {buckets === undefined ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-xl bg-slate-50 animate-pulse" />
                  ))}
                </div>
              ) : sortedBuckets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-6 text-center">
                  <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-xs text-slate-600 font-medium">No buckets yet</p>
                  <p className="text-[11px] text-slate-500 mt-1 mb-3">Create envelopes for discretionary spending.</p>
                  <Link
                    href="/buckets"
                    className="inline-flex text-xs font-medium text-teal-600 hover:text-teal-700"
                  >
                    Add buckets →
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2.5 max-h-[min(70vh,36rem)] overflow-y-auto pr-0.5 -mr-0.5">
                  {sortedBuckets.map((b) => {
                    const accent = b.color ?? "#0d9488";
                    const spent =
                      b.categoryId != null ? (spendingByCategory?.[b.categoryId] ?? 0) : 0;
                    const isMonthly = b.period === "monthly";
                    const fundedEnvelope = fundedByBucketId[b._id] ?? 0;
                    const fillCap = bucketMonthlyFundingCap(b);
                    const envelopeLeft =
                      isMonthly && fillCap > 0.005
                        ? Math.max(0, fillCap - fundedEnvelope)
                        : null;
                    const remaining = isMonthly ? b.targetAmount - spent : null;
                    const pct =
                      isMonthly && b.targetAmount > 0
                        ? Math.min((spent / b.targetAmount) * 100, 100)
                        : 0;
                    const over = isMonthly && remaining !== null && remaining < 0;
                    const openBucketFund = () => {
                      const firstChecking = accounts?.find((x) => x.accountType === "checking");
                      const firstAsset = accounts?.find((x) => accountIsAssetForAvailability(x.accountType));
                      const def = firstChecking ?? firstAsset;
                      setBucketFundOpen({
                        id: b._id,
                        name: b.name,
                        monthlyFundingCap: fillCap,
                        spendTarget: b.targetAmount,
                        defaultAccountId: b.paymentAccountId ?? def?._id ?? null,
                      });
                    };
                    return (
                      <li
                        key={b._id}
                        className="rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5"
                        style={{ borderLeft: `3px solid ${accent}` }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-slate-800 text-sm leading-tight truncate">{b.name}</p>
                          <span className="text-[10px] uppercase tracking-wide text-slate-400 shrink-0">
                            /{BUCKET_PERIOD_LABEL[b.period]}
                          </span>
                        </div>
                        {!b.categoryId ? (
                          <p className="text-[11px] text-amber-700/90 mt-1.5">
                            Link a category to see spending for this month.
                          </p>
                        ) : null}
                        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                          <span className="text-slate-500">Spent</span>
                          <span className="text-slate-900 font-semibold tabular-nums text-right">
                            {formatCurrency(spent)}
                          </span>
                          <span className="text-slate-500">Target</span>
                          <span className="text-slate-700 font-medium tabular-nums text-right">
                            {formatCurrency(b.targetAmount)}
                          </span>
                          {isMonthly ? (
                            <>
                              <span className="text-slate-500">Funded</span>
                              <span className="text-indigo-800 font-semibold tabular-nums text-right">
                                {formatCurrency(fundedEnvelope)}
                              </span>
                              <span className="text-slate-500">Fill cap (mo)</span>
                              <span className="text-slate-700 font-medium tabular-nums text-right">
                                {formatCurrency(fillCap)}
                              </span>
                              <span className="text-slate-500">Left to fund</span>
                              <span
                                className={`font-semibold tabular-nums text-right ${
                                  envelopeLeft !== null && envelopeLeft > 0.005
                                    ? "text-amber-700"
                                    : "text-emerald-700"
                                }`}
                              >
                                {formatCurrency(envelopeLeft ?? 0)}
                              </span>
                              <span className="text-slate-500">Left (vs spend)</span>
                              <span
                                className={`font-semibold tabular-nums text-right ${
                                  over ? "text-rose-600" : "text-emerald-700"
                                }`}
                              >
                                {formatCurrency(remaining!)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-slate-500 col-span-2 text-[10px] leading-snug pt-0.5">
                                Month funding applies to monthly buckets only; spend shown is this calendar month.
                              </span>
                            </>
                          )}
                        </div>
                        {isMonthly && fillCap > 0.005 ? (
                          <button
                            type="button"
                            onClick={openBucketFund}
                            className="mt-2 w-full rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
                          >
                            Fund bucket
                          </button>
                        ) : null}
                        {isMonthly && b.targetAmount > 0 ? (
                          <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-400" : "bg-teal-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        {/* Monthly Budget */}
        <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm" style={{ borderLeft: "3px solid #0d9488" }}>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">Monthly Budget</p>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(totalBudget)}</p>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>{Math.round(overallPercent)}% used</span>
              <span>{formatCurrency(totalBudget - totalSpent)} left</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-teal-500 transition-all duration-500"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Total Spent */}
        <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">Total Spent</p>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(totalSpent)}</p>
          <p className="text-sm text-slate-400 mt-3">
            across {categories?.length ?? 0} categories
          </p>
        </div>

        {/* Remaining */}
        <div
          className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm"
          style={{ borderLeft: `3px solid ${totalBudget - totalSpent < 0 ? "#f43f5e" : "#10b981"}` }}
        >
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">Remaining</p>
          <p className={`text-3xl font-bold ${totalBudget - totalSpent < 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {formatCurrency(Math.abs(totalBudget - totalSpent))}
          </p>
          <p className={`text-sm mt-3 ${totalBudget - totalSpent < 0 ? "text-rose-400" : "text-emerald-400"}`}>
            {totalBudget - totalSpent < 0 ? "over budget" : "available to spend"}
          </p>
        </div>
      </div>

      {creditCards !== undefined && creditCards.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600" aria-hidden="true" />
              Credit cards
            </h2>
            <Link
              href="/credit-cards"
              className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Manage <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {creditCards.map((c) => {
              const apr = formatAprPercent(c.aprPercent);
              return (
                <div
                  key={c._id}
                  className="rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3"
                  style={{ borderLeft: `3px solid ${c.color ?? "#4f46e5"}` }}
                >
                  <p className="text-xs text-slate-500 font-medium truncate">{c.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {formatCreditCardUsageMode(c.usageMode)}
                  </p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums mt-1">
                    {formatCurrency(c.balance)}
                  </p>
                  {apr && <p className="text-xs text-slate-500 mt-1">{apr}</p>}
                  {c.plannedMonthlyPayment != null && c.plannedMonthlyPayment > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Plan {formatCurrency(c.plannedMonthlyPayment)}/mo
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {debts !== undefined && debts.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Debts & loans</h2>
            <Link
              href="/debts"
              className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Manage <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {debts.map((d) => {
              const apr = formatAprPercent(d.aprPercent);
              return (
                <div
                  key={d._id}
                  className="rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3"
                  style={{ borderLeft: `3px solid ${d.color ?? "#64748b"}` }}
                >
                  <p className="text-xs text-slate-500 font-medium truncate">{d.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{formatDebtType(d.debtType)}</p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums mt-1">
                    {formatCurrency(d.balance)}
                  </p>
                  {apr && <p className="text-xs text-slate-500 mt-1">{apr}</p>}
                  {d.plannedMonthlyPayment != null && d.plannedMonthlyPayment > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Plan {formatCurrency(d.plannedMonthlyPayment)}/mo
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Budget status strip */}
      {overBudgetCount > 0 ? (
        <div role="alert" className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-4" style={{ animation: "slide-up-fade-in 0.3s ease-out" }}>
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-rose-800">
              {overBudgetCount} {overBudgetCount === 1 ? "category" : "categories"} over budget
            </p>
            <p className="text-sm text-rose-500 mt-0.5">Review your spending to stay on track.</p>
          </div>
          <Link href="/categories" className="inline-flex items-center gap-1 text-sm font-medium text-rose-600 hover:text-rose-700 flex-shrink-0">
            View <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      ) : allOnTrack ? (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center gap-3" style={{ animation: "slide-up-fade-in 0.35s ease-out" }}>
          <CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-teal-800 text-sm">Every category is on track</p>
            <p className="text-xs text-teal-600 mt-0.5">
              {viewingCalendarMonth
                ? `${formatCurrency(totalBudget - totalSpent)} remaining — nice work this month.`
                : `${formatCurrency(totalBudget - totalSpent)} remaining for ${formatMonth(selectedMonth)}.`}
            </p>
          </div>
        </div>
      ) : null}

      {/* Two-column layout: categories + transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:gap-6">
        {/* Budget Categories */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Budget Categories</h2>
            <Link href="/categories" className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium">
              Manage <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>

          {categories === undefined ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl h-32 animate-pulse border border-slate-100" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
              <p className="text-slate-700 font-medium mb-1">Set up your first category</p>
              <p className="text-slate-400 text-sm mb-4">Define where your money goes — rent, food, fun — then start tracking.</p>
              <Link href="/categories" className="bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 active:scale-[0.97] transition-all">
                Create your first category
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => {
                const planned = plannedByCategory[cat._id] ?? 0;
                return (
                  <BudgetCard
                    key={cat._id}
                    name={cat.name}
                    monthlyLimit={planned}
                    spent={spendingByCategory?.[cat._id] ?? 0}
                    color={cat.color}
                    icon={cat.icon}
                    spentPeriodLabel={spentPeriodLabel}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">
              Transactions · {formatMonth(selectedMonth)}
            </h2>
            <button
              type="button"
              onClick={openAddTransaction}
              className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              <Plus size={13} aria-hidden="true" /> Add
            </button>
          </div>

          {transactions === undefined ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-xl h-14 animate-pulse border border-slate-100" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
              <p className="text-slate-600 text-sm font-medium">Fresh start</p>
              <p className="text-slate-400 text-xs mt-1">
                {viewingCalendarMonth
                  ? "No spending logged this month yet."
                  : `No transactions in ${formatMonth(selectedMonth)} yet.`}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {transactions.slice(0, 12).map((tx, i) => {
                const cat = tx.categoryId ? categoryMap[tx.categoryId] : undefined;
                const bi = tx.budgetItemId ? budgetItemMap[tx.budgetItemId] : undefined;
                const cardOnly = !cat && tx.creditCardId;
                const debtOnly = !cat && tx.debtId;
                const accentColor =
                  cat?.color ?? (cardOnly ? "#4f46e5" : debtOnly ? "#475569" : "#0d9488");
                const accentBg = `${accentColor}18`;
                return (
                  <button
                    type="button"
                    key={tx._id}
                    onClick={() => openEditTransaction(tx)}
                    className={`flex w-full text-left items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset ${
                      i < Math.min(transactions.length, 12) - 1 ? "border-b border-slate-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        aria-hidden="true"
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: accentBg }}
                      >
                        {cat ? (
                          (() => {
                            const iconName = cat.icon;
                            const IconComp = iconName ? CATEGORY_ICON_MAP[iconName] : null;
                            const color = cat.color ?? "#0d9488";
                            return IconComp
                              ? <IconComp className="w-4 h-4" style={{ color }} />
                              : <span className="text-sm">{iconName ?? "💰"}</span>;
                          })()
                        ) : cardOnly ? (
                          <CreditCard className="w-4 h-4" style={{ color: accentColor }} aria-hidden="true" />
                        ) : debtOnly ? (
                          <Landmark className="w-4 h-4" style={{ color: accentColor }} aria-hidden="true" />
                        ) : (
                          <Receipt className="w-4 h-4" style={{ color: accentColor }} aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{tx.description}</p>
                        <p className="text-xs text-slate-500">{formatShortDate(tx.date)}</p>
                        {(() => {
                          const parts: string[] = [];
                          if (tx.accountId && accountMap[tx.accountId]) {
                            parts.push(accountMap[tx.accountId].name);
                          }
                          if (bi) {
                            parts.push(bi.name);
                          }
                          if (tx.debtId && debtMap[tx.debtId]) {
                            parts.push(`Pay toward ${debtMap[tx.debtId].name} (loan)`);
                          }
                          const ccId = tx.creditCardId;
                          if (ccId && cardMap[ccId]) {
                            parts.push(`Pay toward ${cardMap[ccId].name} (card)`);
                          }
                          const note = tx.note?.trim();
                          if (note) parts.push(note);
                          return parts.length > 0 ? (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{parts.join(" · ")}</p>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 ml-2 flex-shrink-0">
                      {formatCurrency(tx.amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {bucketFundOpen && user ? (
        <BucketFundingModal
          open
          onClose={() => setBucketFundOpen(null)}
          userId={user.id}
          monthKey={selectedMonth}
          bucketId={bucketFundOpen.id}
          bucketName={bucketFundOpen.name}
          monthlyFundingCap={bucketFundOpen.monthlyFundingCap}
          spendTarget={bucketFundOpen.spendTarget}
          defaultAccountId={bucketFundOpen.defaultAccountId}
          fundings={bucketFundingsMonth ?? []}
          accounts={accounts?.map((a) => ({
            _id: a._id,
            name: a.name,
            accountType: a.accountType,
          }))}
        />
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="w-full space-y-8 animate-pulse">
      <div className="h-8 bg-slate-200 rounded-xl w-56" />
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-teal-200 rounded-2xl h-28" />
        <div className="bg-slate-200 rounded-2xl h-28" />
        <div className="bg-slate-200 rounded-2xl h-28" />
      </div>
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="bg-slate-200 rounded-2xl h-32" />)}
        </div>
        <div className="col-span-2 bg-slate-200 rounded-2xl h-64" />
      </div>
    </div>
  );
}
