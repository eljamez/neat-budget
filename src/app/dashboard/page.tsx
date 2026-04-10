"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BudgetCard } from "@/components/BudgetCard";
import { ExpenseTimeline, buildPlannerRows } from "@/components/ExpenseTimeline";
import {
  cn,
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
  debtPlannerMonthlyAmount,
  ACCENT_COLOR_FALLBACK,
} from "@/lib/utils";
import { BucketFundingModal } from "@/components/BucketFundingModal";
import { MonthFundingModal } from "@/components/MonthFundingModal";
import type { Id } from "../../../convex/_generated/dataModel";
import { CATEGORY_ICON_MAP } from "@/lib/icons";
import { useTransactionModal } from "@/components/TransactionModalProvider";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
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
  Info,
  Sparkles,
  Pencil,
  CircleAlert,
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

/**
 * Short status beside the greeting. Spending % uses cash on hand when available,
 * otherwise planned category totals (alert strip handles category overspend).
 */
function getHeaderMoodMessage(
  cashBudget: number,
  categoryPlannedTotal: number,
  totalSpent: number,
  overBudgetCount: number,
  categoriesLoaded: boolean,
  selectedMonth: string,
) {
  if (!categoriesLoaded) return null;
  if (overBudgetCount > 0) return null;
  const denom = cashBudget > 0.005 ? cashBudget : categoryPlannedTotal;
  if (denom < 0.005) return null;
  const pct = totalSpent / denom;
  const isCalendarMonth = selectedMonth === getCurrentMonth();
  const monthLabel = formatMonth(selectedMonth);
  if (totalSpent === 0) {
    return isCalendarMonth
      ? "No spending logged yet this month."
      : `No spending logged for ${monthLabel} yet.`;
  }
  if (pct < 0.5) {
    return isCalendarMonth
      ? `${Math.round(pct * 100)}% of cash spent — looking good.`
      : `${Math.round(pct * 100)}% of ${monthLabel} cash spent — looking good.`;
  }
  if (pct < 0.8) {
    return isCalendarMonth
      ? `${Math.round(pct * 100)}% of cash spent — staying on track.`
      : `${Math.round(pct * 100)}% of ${monthLabel} cash — staying on track.`;
  }
  if (pct < 1) {
    return isCalendarMonth
      ? `${Math.round(pct * 100)}% of cash spent — keep a close eye.`
      : `${Math.round(pct * 100)}% of ${monthLabel} cash — keep a close eye.`;
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
  } | null>(null);
  const [monthFundingOpen, setMonthFundingOpen] = useState(false);
  const [autoFundPending, setAutoFundPending] = useState(false);
  const [fundingNotice, setFundingNotice] = useState<string | null>(null);
  const [openHelpTooltip, setOpenHelpTooltip] = useState<"timeline" | "buckets" | "accounts" | null>(
    null
  );

  const autoFundMonth = useMutation(api.autoFundMonth.run);

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

  const cashAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter((a) => accountIsAssetForAvailability(a.accountType));
  }, [accounts]);

  const totalCashAccountBalance = useMemo(
    () => cashAccounts.reduce((sum, a) => sum + a.balance, 0),
    [cashAccounts]
  );

  useEffect(() => {
    setFundingNotice(null);
  }, [selectedMonth]);

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

  const cashBudgetAmount =
    accounts !== undefined
      ? availability !== undefined
        ? availability.totalCash
        : totalCashAccountBalance
      : null;
  const headerTotalFunded =
    availability !== undefined ? availability.totalFunded : null;
  const headerAvailableToFund =
    cashBudgetAmount !== null && availability !== undefined
      ? availability.availableToFund
      : null;
  const headerOverFunded =
    headerAvailableToFund !== null && headerAvailableToFund < -0.005;

  const cashPercentUsed =
    cashBudgetAmount !== null && cashBudgetAmount > 0.005
      ? (totalSpent / cashBudgetAmount) * 100
      : 0;
  const cashOverallPercent = Math.min(cashPercentUsed, 100);
  const cashAfterSpent =
    cashBudgetAmount !== null ? cashBudgetAmount - totalSpent : null;

  const categoriesLoaded = categories !== undefined;
  const allOnTrack = categoriesLoaded && (categories?.length ?? 0) > 0 && overBudgetCount === 0 && totalSpent > 0;
  const headerMood = getHeaderMoodMessage(
    cashBudgetAmount ?? 0,
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
      <header className="-mx-5 px-5 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between w-full">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Good {getTimeOfDay()}, {user.firstName ?? "there"}
                </h1>
                {headerMood ? (
                  <span className="text-base sm:text-lg text-slate-500 dark:text-slate-400 font-medium leading-snug max-w-prose">
                    {headerMood}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
              <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm overflow-hidden dark:[color-scheme:dark]">
                <button
                  type="button"
                  onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
                  className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-100 transition-colors border-r border-slate-100 dark:border-white/10"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                </button>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  aria-label="Select month"
                  className="min-w-0 flex-1 sm:w-38 border-0 bg-transparent px-2 py-2.5 text-base text-slate-700 dark:text-slate-200 text-center focus:ring-0 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
                  className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-100 transition-colors border-l border-slate-100 dark:border-white/10"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              {!viewingCalendarMonth && (
                <button
                  type="button"
                  onClick={() => setSelectedMonth(getCurrentMonth())}
                  className="text-base font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 px-2 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors"
                >
                  This month
                </button>
              )}
            </div>
          </div>
        </header>

      <section
        className="w-full min-w-0"
        aria-labelledby="dashboard-budget-summary-heading"
      >
        <h2 id="dashboard-budget-summary-heading" className="sr-only">
          Budget, funded, and left to fund
        </h2>
        {cashBudgetAmount === null ? (
          <p className="text-slate-400 dark:text-slate-500 italic text-base">
            Loading account balances…
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
              <div
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 p-5 sm:p-6 shadow-sm"
                style={{ borderLeft: `3px solid ${ACCENT_COLOR_FALLBACK.successStrong}` }}
              >
                <p className="text-slate-400 dark:text-slate-500 text-sm font-semibold uppercase tracking-widest mb-3">
                  Budget
                </p>
                <p className="text-4xl sm:text-5xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(cashBudgetAmount)}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  {cashAccounts.length} {cashAccounts.length === 1 ? "account" : "accounts"}
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 p-5 sm:p-6 shadow-sm">
                <p className="text-slate-400 dark:text-slate-500 text-sm font-semibold uppercase tracking-widest mb-3">
                  Funded
                </p>
                <p
                  className={cn(
                    "text-4xl sm:text-5xl font-bold tracking-tight tabular-nums",
                    headerTotalFunded === null
                      ? "text-slate-400 dark:text-slate-500"
                      : headerOverFunded
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {headerTotalFunded === null ? "—" : formatCurrency(headerTotalFunded)}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  Bills &amp; buckets (not paid yet)
                </p>
              </div>
              <div
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 p-5 sm:p-6 shadow-sm"
                style={{
                  borderLeft: `3px solid ${
                    headerAvailableToFund === null
                      ? ACCENT_COLOR_FALLBACK.success
                      : headerOverFunded
                        ? ACCENT_COLOR_FALLBACK.danger
                        : ACCENT_COLOR_FALLBACK.success
                  }`,
                }}
              >
                <p className="text-slate-400 dark:text-slate-500 text-sm font-semibold uppercase tracking-widest mb-3">
                  Left to fund
                </p>
                <p
                  className={cn(
                    "text-4xl sm:text-5xl font-bold tracking-tight tabular-nums",
                    headerAvailableToFund === null
                      ? "text-slate-400 dark:text-slate-500"
                      : headerOverFunded
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {headerAvailableToFund === null ? "—" : formatCurrency(headerAvailableToFund)}
                </p>
                <p
                  className={cn(
                    "text-base mt-3",
                    headerAvailableToFund === null
                      ? "text-slate-400 dark:text-slate-500"
                      : headerOverFunded
                        ? "text-rose-400 dark:text-rose-300"
                        : "text-emerald-400 dark:text-emerald-500"
                  )}
                >
                  {headerAvailableToFund === null
                    ? "Loading funding…"
                    : headerOverFunded
                      ? "Over-funded vs cash"
                      : "Still unassigned"}
                </p>
              </div>
            </div>
            {fundingNotice ? (
              <p className="text-sm text-teal-900 dark:text-teal-100 bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-800/60 rounded-xl px-3 py-2.5">
                {fundingNotice}
              </p>
            ) : null}
            <div className="rounded-2xl border border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <button
                  type="button"
                  disabled={autoFundPending || !user}
                  onClick={() => {
                    if (!user) return;
                    setFundingNotice(null);
                    setAutoFundPending(true);
                    void (async () => {
                      try {
                        const r = await autoFundMonth({
                          userId: user.id,
                          monthKey: selectedMonth,
                        });
                        if (r.message) {
                          setFundingNotice(r.message);
                        } else if (r.totalAdded > 0.005) {
                          const parts: string[] = [];
                          if (r.billsTouched > 0) {
                            parts.push(
                              `${r.billsTouched} bill${r.billsTouched === 1 ? "" : "s"}`
                            );
                          }
                          if (r.bucketsTouched > 0) {
                            parts.push(
                              `${r.bucketsTouched} bucket${r.bucketsTouched === 1 ? "" : "s"}`
                            );
                          }
                          setFundingNotice(
                            `Auto-funded ${formatCurrency(r.totalAdded)} (${parts.join(", ")}). Remaining to assign: ${formatCurrency(Math.max(0, r.remainingAvailable))}.`
                          );
                        } else {
                          setFundingNotice(
                            "Nothing was added — you may already be fully funded for this month, or there is no cash left to assign."
                          );
                        }
                      } catch (e) {
                        setFundingNotice(
                          e instanceof Error ? e.message : "Could not auto-fund this month."
                        );
                      } finally {
                        setAutoFundPending(false);
                      }
                    })();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/90 dark:bg-teal-950/50 px-3 py-2 text-sm font-semibold text-teal-900 dark:text-teal-100 shadow-sm hover:bg-teal-100/90 dark:hover:bg-teal-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {autoFundPending ? "Funding…" : "Auto-fund month"}
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-snug">
                  Fills bills (by due date) then monthly buckets, up to cash on hand. Does not mark
                  anything paid.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMonthFundingOpen(true)}
                className="text-sm sm:text-base font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 rounded-lg px-1 py-1 hover:bg-teal-50/80 dark:hover:bg-teal-950/50 transition-colors text-left sm:text-right shrink-0"
              >
                View &amp; remove funding for {formatMonth(selectedMonth)} →
              </button>
            </div>
          </div>
        )}
      </section>

      {categories !== undefined && categories.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 items-start">
          <div className="lg:col-span-2 w-full min-w-0 space-y-4">
            <div className="rounded-xl border border-teal-100 dark:border-teal-900/40 bg-linear-to-r from-teal-50/90 to-slate-50/80 dark:from-teal-950/50 dark:to-slate-900/80 px-4 py-3.5 sm:px-5 sm:py-4 shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-teal-950 dark:text-teal-100">
                  {formatMonth(selectedMonth)}
                </h2>
                <span className="relative shrink-0 group z-10">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenHelpTooltip((prev) => (prev === "timeline" ? null : "timeline"))
                    }
                    className="rounded-full p-1 text-teal-700/70 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-100 hover:bg-teal-100/80 dark:hover:bg-teal-900/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                    aria-label="How the bill timeline works"
                    aria-describedby="timeline-help-tooltip"
                    aria-expanded={openHelpTooltip === "timeline"}
                    aria-controls="timeline-help-tooltip"
                  >
                    <Info className="w-5 h-5 sm:w-[1.35rem] sm:h-[1.35rem]" aria-hidden="true" />
                  </button>
                  <span
                    id="timeline-help-tooltip"
                    role="tooltip"
                    className={cn(
                      "pointer-events-none absolute left-0 top-full mt-1.5 w-[min(22rem,calc(100vw-2rem))] rounded-xl bg-slate-900 px-3.5 py-3 text-xs font-normal leading-relaxed text-white shadow-lg opacity-0 invisible translate-y-0.5 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 z-20",
                      openHelpTooltip === "timeline" && "opacity-100 visible translate-y-0"
                    )}
                  >
                    Bills are ordered by{" "}
                    <span className="font-semibold text-white">when funds must be ready</span>. Row colors:{" "}
                    <span className="font-semibold text-rose-300">red</span> = waiting (not funded),{" "}
                    <span className="font-semibold text-amber-200">yellow</span> = funded or ready,{" "}
                    <span className="font-semibold text-emerald-300">green</span> = paid.{" "}
                    <span className="font-semibold text-teal-200">Bank ✓</span> = pay-from account set. Select rows to fund
                    many bills at once, or tap{" "}
                    <span className="font-semibold text-white">Waiting</span> /{" "}
                    <span className="font-semibold text-white">Partly funded</span> on a row to fund the remainder, or clear funding with the toolbar or the{" "}
                    <span className="font-semibold text-white">minus</span> icon on each row. Row menu →{" "}
                    <span className="font-semibold text-white">Fund / adjust amount</span> for custom amounts. Funding is separate from marking paid.
                  </span>
                </span>
              </div>
            </div>
            {allBudgetItems === undefined || debts === undefined || creditCards === undefined ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-white/10 animate-pulse" />
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
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Buckets</h2>
                  <span className="relative shrink-0 group z-10">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenHelpTooltip((prev) => (prev === "buckets" ? null : "buckets"))
                      }
                      className="rounded-full p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                      aria-label="How buckets work this month"
                      aria-describedby="buckets-help-tooltip"
                      aria-expanded={openHelpTooltip === "buckets"}
                      aria-controls="buckets-help-tooltip"
                    >
                      <Info className="w-5 h-5 sm:w-[1.35rem] sm:h-[1.35rem]" aria-hidden="true" />
                    </button>
                    <span
                      id="buckets-help-tooltip"
                      role="tooltip"
                      className={cn(
                        "pointer-events-none absolute right-0 top-full mt-1.5 w-[min(20rem,calc(100vw-2rem))] rounded-xl bg-slate-900 px-3.5 py-3 text-xs font-normal leading-relaxed text-white text-left shadow-lg opacity-0 invisible translate-y-0.5 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 z-20",
                        openHelpTooltip === "buckets" && "opacity-100 visible translate-y-0"
                      )}
                    >
                      Spending vs targets for{" "}
                      <span className="font-semibold text-white">{formatMonth(selectedMonth)}</span>. Set a monthly fill
                      amount on each bucket to cap how much you fund;{" "}
                      <span className="font-semibold text-teal-200">funded</span> is separate from spent. Link a category to
                      track spend.
                    </span>
                  </span>
                </div>
                <Link
                  href="/buckets"
                  className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-semibold shrink-0 rounded-lg px-1.5 py-1 hover:bg-teal-50/80 dark:hover:bg-teal-950/50 transition-colors"
                >
                  Manage <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
              {buckets === undefined ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-[4.5rem] rounded-lg bg-slate-50 dark:bg-slate-800/60 animate-pulse" />
                  ))}
                </div>
              ) : sortedBuckets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 dark:border-white/15 px-3 py-6 text-center">
                  <Boxes className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">No buckets yet</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 mb-3">Create envelopes for discretionary spending.</p>
                  <Link
                    href="/buckets"
                    className="inline-flex text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
                  >
                    Add buckets →
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {sortedBuckets.map((b) => {
                    const accent = b.color ?? ACCENT_COLOR_FALLBACK.category;
                    const spent =
                      b.categoryId != null ? (spendingByCategory?.[b.categoryId] ?? 0) : 0;
                    const isMonthly = b.period === "monthly";
                    const fundedEnvelope = fundedByBucketId[b._id] ?? 0;
                    const fillCap = bucketMonthlyFundingCap(b);
                    const inBucketNow = Math.max(0, fundedEnvelope - spent);
                    const canMonthFund = isMonthly && fillCap > 0.005;
                    const fundedForMonth =
                      canMonthFund && fundedEnvelope + 0.005 >= fillCap;
                    const needsCategory = !b.categoryId;
                    const openBucketFund = () => {
                      setBucketFundOpen({
                        id: b._id,
                        name: b.name,
                        monthlyFundingCap: fillCap,
                        spendTarget: b.targetAmount,
                      });
                    };
                    return (
                      <li
                        key={b._id}
                        className="rounded-lg border border-slate-200/90 bg-slate-100 px-2.5 py-2.5 transition-colors dark:border-white/10 dark:bg-slate-800/80"
                        style={{ borderLeftWidth: 3, borderLeftColor: accent }}
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {fundedForMonth && canMonthFund ? (
                                <span className="inline-flex shrink-0 text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                  <span className="sr-only">
                                    Funded for {formatMonth(selectedMonth)}
                                  </span>
                                </span>
                              ) : null}
                              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                                {b.name}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {needsCategory ? (
                                <span className="relative z-10 group/alert">
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-amber-600 transition-colors hover:bg-amber-500/15 dark:text-amber-400 dark:hover:bg-amber-500/10"
                                    aria-label="Link a category on the Buckets page to track spending in this envelope"
                                  >
                                    <CircleAlert className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                  <span
                                    role="tooltip"
                                    className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 w-[min(16rem,calc(100vw-2rem))] rounded-lg bg-slate-900 px-3 py-2 text-left text-[11px] font-normal leading-snug text-white shadow-lg opacity-0 invisible translate-y-0.5 transition-all duration-150 group-hover/alert:opacity-100 group-hover/alert:visible group-hover/alert:translate-y-0"
                                  >
                                    Link a category on the Buckets page so spending subtracts from this
                                    envelope.
                                  </span>
                                </span>
                              ) : null}
                              <Link
                                href={`/buckets?edit=${b._id}`}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
                                aria-label={`Edit ${b.name}`}
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              </Link>
                              {canMonthFund && !fundedForMonth ? (
                                <button
                                  type="button"
                                  onClick={openBucketFund}
                                  className="rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 dark:border-indigo-700/50 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                                >
                                  Fund
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <p className="text-3xl sm:text-[2rem] font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-50 leading-none">
                            {formatCurrency(inBucketNow)}
                          </p>
                          <div className="flex items-end justify-between gap-2 pt-0.5">
                            <div className="min-w-0 flex-1">
                              {!isMonthly && b.categoryId ? (
                                <p className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                                  Spent {formatCurrency(spent)} this month
                                </p>
                              ) : null}
                            </div>
                            <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-600 dark:text-slate-300 text-right leading-snug">
                              {formatCurrency(fillCap)}
                              {isMonthly ? (
                                <span className="font-medium text-slate-500 dark:text-slate-400">
                                  /month
                                </span>
                              ) : (
                                <span className="font-medium text-slate-500 dark:text-slate-400">
                                  {" "}
                                  per {BUCKET_PERIOD_LABEL[b.period]}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Accounts: below timeline; balances + link to Accounts page */}
      {accounts !== undefined && accounts.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-linear-to-br from-slate-50/95 via-white to-teal-50/35 dark:from-slate-950/90 dark:via-slate-900 dark:to-teal-950/25 shadow-sm p-5 sm:p-6 w-full">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-5 sm:mb-6">
            <div className="flex items-start gap-2 min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Your accounts</h2>
              <span className="relative shrink-0 group z-10">
                <button
                  type="button"
                  onClick={() =>
                    setOpenHelpTooltip((prev) => (prev === "accounts" ? null : "accounts"))
                  }
                  className="rounded-full p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                  aria-label="How account balances work with your budget"
                  aria-describedby="accounts-help-tooltip"
                  aria-expanded={openHelpTooltip === "accounts"}
                  aria-controls="accounts-help-tooltip"
                >
                  <Info className="w-4 h-4" aria-hidden="true" />
                </button>
                <span
                  id="accounts-help-tooltip"
                  role="tooltip"
                  className={cn(
                    "pointer-events-none absolute left-0 top-full mt-1.5 w-[min(20rem,calc(100vw-2rem))] rounded-xl bg-slate-900 px-3.5 py-3 text-xs font-normal leading-relaxed text-white shadow-lg opacity-0 invisible translate-y-0.5 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 z-20",
                    openHelpTooltip === "accounts" && "opacity-100 visible translate-y-0"
                  )}
                >
                  Balances update when you log transactions. The dashboard <span className="font-semibold text-teal-200">budget</span>{" "}
                  is the sum of these asset balances. <span className="font-semibold text-teal-200">Funding</span> for{" "}
                  <span className="font-semibold text-white">{formatMonth(selectedMonth)}</span> is capped by that total.
                </span>
              </span>
            </div>
            <Link
              href="/accounts"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 shrink-0 rounded-lg px-2 py-1 -mr-2 hover:bg-teal-50/80 dark:hover:bg-teal-950/50 transition-colors"
            >
              All accounts <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {accounts.map((acc) => {
              const isAsset = accountIsAssetForAvailability(acc.accountType);
              return (
                <div
                  key={acc._id}
                  className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)] transition-shadow hover:shadow-md hover:border-slate-300/90 dark:hover:border-white/15"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate text-sm sm:text-base">{acc.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium uppercase tracking-wide">
                        {formatAccountType(acc.accountType)}
                      </p>
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-400 ring-1 ring-teal-600/10 dark:ring-teal-500/20">
                      <Landmark className="h-4 w-4" aria-hidden="true" />
                    </div>
                  </div>

                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Balance</p>
                  <p className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none">
                    {formatCurrency(acc.balance)}
                  </p>

                  {!isAsset ? (
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <Link href="/accounts" className="font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 underline-offset-2 hover:underline">
                        Accounts
                      </Link>
                      <span className="text-slate-400 dark:text-slate-500"> · liability</span>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hero Stats — cash budget vs spending; category targets live in Budget Categories below */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 p-5 sm:p-6 shadow-sm" style={{ borderLeft: `3px solid ${ACCENT_COLOR_FALLBACK.successStrong}` }}>
          <p className="text-slate-400 dark:text-slate-500 text-sm font-semibold uppercase tracking-widest mb-3">Cash budget</p>
          <p className="text-4xl sm:text-5xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
            {cashBudgetAmount !== null ? formatCurrency(cashBudgetAmount) : "—"}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Same as header: combined asset account balances.
          </p>
          <div className="mt-4">
            <div className="flex justify-between text-sm text-slate-400 dark:text-slate-500 mb-1.5">
              <span>
                {cashBudgetAmount !== null && cashBudgetAmount > 0.005
                  ? `${Math.round(cashPercentUsed)}% of cash spent`
                  : "—"}
              </span>
              <span>
                {cashAfterSpent !== null
                  ? `${formatCurrency(cashAfterSpent)} cash left`
                  : "—"}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${cashOverallPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 p-5 sm:p-6 shadow-sm">
          <p className="text-slate-400 dark:text-slate-500 text-sm font-semibold uppercase tracking-widest mb-3">Total Spent</p>
          <p className="text-4xl sm:text-5xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(totalSpent)}
          </p>
          <p className="text-base text-slate-400 dark:text-slate-500 mt-3">
            across {categories?.length ?? 0} categories
          </p>
        </div>

        <div
          className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 p-5 sm:p-6 shadow-sm"
          style={{
            borderLeft: `3px solid ${
              cashAfterSpent !== null && cashAfterSpent < -0.005
                ? ACCENT_COLOR_FALLBACK.danger
                : ACCENT_COLOR_FALLBACK.success
            }`,
          }}
        >
          <p className="text-slate-400 dark:text-slate-500 text-sm font-semibold uppercase tracking-widest mb-3">Cash after spending</p>
          <p
            className={`text-4xl sm:text-5xl font-bold tracking-tight tabular-nums ${
              cashAfterSpent !== null && cashAfterSpent < -0.005 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {cashAfterSpent !== null ? formatCurrency(Math.abs(cashAfterSpent)) : "—"}
          </p>
          <p
            className={`text-base mt-3 ${
              cashAfterSpent !== null && cashAfterSpent < -0.005 ? "text-rose-400 dark:text-rose-300" : "text-emerald-400 dark:text-emerald-500"
            }`}
          >
            {cashAfterSpent === null
              ? "—"
              : cashAfterSpent < -0.005
                ? "spent more than cash on hand"
                : "left in accounts this month"}
          </p>
        </div>
      </div>

      {creditCards !== undefined && creditCards.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              Credit cards
            </h2>
            <Link
              href="/credit-cards"
              className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
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
                  className="rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/90 dark:bg-slate-800/50 px-4 py-3"
                  style={{ borderLeft: `3px solid ${c.color ?? ACCENT_COLOR_FALLBACK.creditCard}` }}
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{c.name}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {formatCreditCardUsageMode(c.usageMode)}
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                    {formatCurrency(c.balance)}
                  </p>
                  {apr && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{apr}</p>}
                  {c.plannedMonthlyPayment != null && c.plannedMonthlyPayment > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Debts & loans</h2>
            <Link
              href="/debts"
              className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
            >
              Manage <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {debts.map((d) => {
              const apr = formatAprPercent(d.aprPercent);
              const planMo = debtPlannerMonthlyAmount(d);
              return (
                <div
                  key={d._id}
                  className="rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/90 dark:bg-slate-800/50 px-4 py-3"
                  style={{ borderLeft: `3px solid ${d.color ?? ACCENT_COLOR_FALLBACK.debtCard}` }}
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{d.name}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatDebtType(d.debtType)}</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                    {formatCurrency(d.balance)}
                  </p>
                  {apr && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{apr}</p>}
                  {planMo > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Plan {formatCurrency(planMo)}/mo
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
        <div role="alert" className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl p-4 flex items-center gap-4" style={{ animation: "slide-up-fade-in 0.3s ease-out" }}>
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-rose-800 dark:text-rose-200">
              {overBudgetCount} {overBudgetCount === 1 ? "category" : "categories"} over budget
            </p>
            <p className="text-sm text-rose-500 dark:text-rose-400 mt-0.5">Review your spending to stay on track.</p>
          </div>
          <Link href="/categories" className="inline-flex items-center gap-1 text-sm font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex-shrink-0">
            View <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      ) : allOnTrack ? (
        <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 rounded-2xl p-4 flex items-center gap-3" style={{ animation: "slide-up-fade-in 0.35s ease-out" }}>
          <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-teal-800 dark:text-teal-200 text-sm">Every category is on track</p>
            <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">
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
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Budget Categories</h2>
            <Link href="/categories" className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium">
              Manage <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>

          {categories === undefined ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-800/80 rounded-2xl h-32 animate-pulse border border-slate-100 dark:border-white/10" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-8 text-center">
              <p className="text-slate-700 dark:text-slate-200 font-medium mb-1">Set up your first category</p>
              <p className="text-slate-400 dark:text-slate-500 text-sm mb-4">Define where your money goes — rent, food, fun — then start tracking.</p>
              <Link href="/categories" className="bg-teal-600 dark:bg-teal-500 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 dark:hover:bg-teal-400 active:scale-[0.97] transition-all">
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
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">
              Transactions · {formatMonth(selectedMonth)}
            </h2>
            <button
              type="button"
              onClick={openAddTransaction}
              className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
            >
              <Plus size={13} aria-hidden="true" /> Add
            </button>
          </div>

          {transactions === undefined ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-800/80 rounded-xl h-14 animate-pulse border border-slate-100 dark:border-white/10" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-6 text-center">
              <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">Fresh start</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                {viewingCalendarMonth
                  ? "No spending logged this month yet."
                  : `No transactions in ${formatMonth(selectedMonth)} yet.`}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
              {transactions.slice(0, 12).map((tx, i) => {
                const cat = tx.categoryId ? categoryMap[tx.categoryId] : undefined;
                const bi = tx.budgetItemId ? budgetItemMap[tx.budgetItemId] : undefined;
                const cardOnly = !cat && tx.creditCardId;
                const debtOnly = !cat && tx.debtId;
                const accentColor =
                  cat?.color ??
                  (cardOnly
                    ? ACCENT_COLOR_FALLBACK.creditCard
                    : debtOnly
                      ? ACCENT_COLOR_FALLBACK.debt
                      : ACCENT_COLOR_FALLBACK.category);
                const accentBg = `${accentColor}18`;
                return (
                  <button
                    type="button"
                    key={tx._id}
                    onClick={() => openEditTransaction(tx)}
                    className={`flex w-full text-left items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50/90 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset ${
                      i < Math.min(transactions.length, 12) - 1 ? "border-b border-slate-50 dark:border-white/10" : ""
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
                            const color = cat.color ?? ACCENT_COLOR_FALLBACK.category;
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
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{tx.description}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatShortDate(tx.date)}</p>
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
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{parts.join(" · ")}</p>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 ml-2 flex-shrink-0">
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
          fundings={bucketFundingsMonth ?? []}
          accounts={accounts?.map((a) => ({
            _id: a._id,
            name: a.name,
            accountType: a.accountType,
          }))}
        />
      ) : null}

      {user ? (
        <MonthFundingModal
          open={monthFundingOpen}
          onClose={() => setMonthFundingOpen(false)}
          userId={user.id}
          monthKey={selectedMonth}
        />
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="w-full space-y-8 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-xl w-56" />
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-teal-200 dark:bg-teal-900/50 rounded-2xl h-28" />
        <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl h-28" />
        <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl h-28" />
      </div>
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-200 dark:bg-slate-700 rounded-2xl h-32" />
          ))}
        </div>
        <div className="col-span-2 bg-slate-200 dark:bg-slate-700 rounded-2xl h-64" />
      </div>
    </div>
  );
}
