"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import dynamic from "next/dynamic";

const ExpenseTimeline = dynamic(
  () => import("@/components/ExpenseTimeline").then((m) => ({ default: m.ExpenseTimeline })),
  {
    loading: () => (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-white/10 animate-pulse" />
        ))}
      </div>
    ),
    ssr: false,
  }
);
import {
  cn,
  formatCurrency,
  formatMonth,
  formatShortDate,
  getCurrentMonth,
  shiftMonth,
  formatDebtType,
  formatAprPercent,
  formatCreditCardUsageMode,
  accountIsAssetForAvailability,
  formatAccountType,
  debtPlannerMonthlyAmount,
  ACCENT_COLOR_FALLBACK,
} from "@/lib/utils";
import { SectionHeader } from "@/components/SectionHeader";


import { useTransactionModal } from "@/components/TransactionModalProvider";
import Link from "next/link";
import { useState, useMemo, useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  CreditCard,
  Landmark,
  Receipt,
  Zap,
} from "lucide-react";
import { buildPlannerRows, type PlannerRow } from "@/lib/planner";
import type { Id } from "../../../convex/_generated/dataModel";

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const CONFETTI_COLORS = [
  "#0d9488", "#14b8a6", "#3b82f6", "#f59e0b",
  "#ec4899", "#10b981", "#f97316", "#6366f1",
];
function seededUnit(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
const CONFETTI_PIECES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  tx: (seededUnit(i + 3) - 0.5) * 180,
  ty: -(seededUnit(i + 17) * 80 + 30),
  rot: seededUnit(i + 31) * 720 - 360,
  delay: seededUnit(i + 41) * 0.18,
  duration: 0.5 + seededUnit(i + 53) * 0.3,
  w: 5 + seededUnit(i + 67) * 6,
  h: 3 + seededUnit(i + 79) * 3,
}));

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { openAddTransaction, openEditTransaction } = useTransactionModal();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [showConfetti, setShowConfetti] = useState(false);
  const [autoFunding, setAutoFunding] = useState(false);
  const setCategoryFunded = useMutation(api.categories.setFundedForMonth);
  const setDebtFunded = useMutation(api.debts.setFundedForMonth);
  const setCardFunded = useMutation(api.creditCards.setFundedForMonth);
  const categoriesFirstLoadedRef = useRef(false);
  const prevAllOnTrackRef = useRef(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const groups = useQuery(api.groups.list, user ? { userId: user.id } : "skip");

  const monthlyProgress = useQuery(
    api.categories.getMonthlyProgress,
    user ? { userId: user.id, month: selectedMonth } : "skip"
  );

  const transactions = useQuery(
    api.transactions.list,
    user ? { userId: user.id, month: selectedMonth } : "skip"
  );

  const accounts = useQuery(api.accounts.list, user ? { userId: user.id } : "skip");
  const debts = useQuery(api.debts.list, user ? { userId: user.id } : "skip");
  const creditCards = useQuery(api.creditCards.list, user ? { userId: user.id } : "skip");

  const paidAmountByDebtId = useMemo((): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const tx of transactions ?? []) {
      if (tx.debtId) m[tx.debtId as string] = (m[tx.debtId as string] ?? 0) + tx.amount;
    }
    return m;
  }, [transactions]);

  const paidAmountByCCId = useMemo((): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const tx of transactions ?? []) {
      if (tx.creditCardId) m[tx.creditCardId as string] = (m[tx.creditCardId as string] ?? 0) + tx.amount;
    }
    return m;
  }, [transactions]);

  const plannerRows = useMemo(() => {
    const baseRows = buildPlannerRows([], debts, creditCards);
    const enrichedBaseRows = baseRows.map((row) => {
      if (row.rowKind === "debt") {
        const paidAmount = paidAmountByDebtId[row.debtId as string] ?? 0;
        return { ...row, hasPaidTransaction: paidAmount > 0, paidAmount };
      }
      if (row.rowKind === "creditCard") {
        const paidAmount = paidAmountByCCId[row.creditCardId as string] ?? 0;
        return { ...row, hasPaidTransaction: paidAmount > 0, paidAmount };
      }
      return row;
    });
    const categoryRows: PlannerRow[] = (monthlyProgress ?? [])
      .filter((p) => p.category.dueDayOfMonth != null)
      .map((p) => ({
        rowKind: "category" as const,
        categoryId: p.category._id as Id<"categories">,
        groupId: p.category.groupId as string | undefined,
        name: p.category.name,
        monthlyTarget: p.category.monthlyTarget ?? 0,
        paymentDayOfMonth: p.category.dueDayOfMonth!,
        markedPaidForMonth: p.category.markedPaidForMonth,
        fundedForMonth: p.fundedForMonth,
        accentColor: p.category.color,
        icon: p.category.icon,
        isAutopay: p.category.isAutopay,
        paymentAccountId: p.category.paymentAccountId as Id<"accounts"> | undefined,
        hasConfiguredDueDay: true,
        spent: p.spent,
      }));
    return [...enrichedBaseRows, ...categoryRows];
  }, [monthlyProgress, debts, creditCards, paidAmountByDebtId, paidAmountByCCId]);

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

  // Aggregate category progress data
  const totalSpent = useMemo(
    () => (monthlyProgress ?? []).reduce((s, p) => s + p.spent, 0),
    [monthlyProgress]
  );
  const overBudgetCount = useMemo(
    () =>
      (monthlyProgress ?? []).filter(
        (p) => p.target !== null && p.spent > p.target
      ).length,
    [monthlyProgress]
  );

  // Funded = items explicitly marked funded for the selected month
  const totalFunded = useMemo(() => {
    const catFunded = (monthlyProgress ?? [])
      .filter((p) => p.fundedForMonth === selectedMonth)
      .reduce((s, p) => s + (p.target ?? 0), 0);
    const debtFunded = (debts ?? [])
      .filter((d) => d.fundedForMonth === selectedMonth)
      .reduce((s, d) => s + debtPlannerMonthlyAmount(d), 0);
    const ccFunded = (creditCards ?? [])
      .filter((c) => c.fundedForMonth === selectedMonth)
      .reduce((s, c) => {
        const planned = c.plannedMonthlyPayment ?? 0;
        return s + (planned > 0 ? planned : (c.minimumPayment ?? 0));
      }, 0);
    return catFunded + debtFunded + ccFunded;
  }, [monthlyProgress, debts, creditCards, selectedMonth]);

  const fundedItemCount = useMemo(() => {
    const cats = (monthlyProgress ?? []).filter((p) => p.fundedForMonth === selectedMonth).length;
    const ds = (debts ?? []).filter((d) => d.fundedForMonth === selectedMonth).length;
    const ccs = (creditCards ?? []).filter((c) => c.fundedForMonth === selectedMonth).length;
    return cats + ds + ccs;
  }, [monthlyProgress, debts, creditCards, selectedMonth]);

  // Paid = all money out for the month (all transactions)
  const totalPaid = useMemo(
    () => (transactions ?? []).reduce((s, tx) => s + tx.amount, 0),
    [transactions]
  );

  const groupNameById = useMemo(() => {
    if (!groups) return {} as Record<string, string>;
    return Object.fromEntries(groups.map((g) => [g._id as string, g.name]));
  }, [groups]);

  const cashAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter((a) => accountIsAssetForAvailability(a.accountType));
  }, [accounts]);

  const totalCashBalance = useMemo(
    () => cashAccounts.reduce((sum, a) => sum + a.balance, 0),
    [cashAccounts]
  );

  const totalTarget = useMemo(
    () => (monthlyProgress ?? []).reduce((s, p) => s + (p.target ?? 0), 0),
    [monthlyProgress]
  );

  // Confetti when all categories go on-track
  useEffect(() => {
    if (monthlyProgress === undefined) return;
    const hasCategories = monthlyProgress.length > 0;
    const onTrack = hasCategories && overBudgetCount === 0 && totalSpent > 0;
    if (!categoriesFirstLoadedRef.current) {
      categoriesFirstLoadedRef.current = true;
      prevAllOnTrackRef.current = onTrack;
      return;
    }
    if (onTrack && !prevAllOnTrackRef.current && !prefersReducedMotion) {
      const t = setTimeout(() => {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2800);
      }, 0);
      prevAllOnTrackRef.current = true;
      return () => clearTimeout(t);
    }
    prevAllOnTrackRef.current = onTrack;
  }, [monthlyProgress, overBudgetCount, totalSpent, prefersReducedMotion]);

  async function handleAutoFund() {
    if (!user || autoFunding) return;
    setAutoFunding(true);
    try {
      const promises: Promise<unknown>[] = [];

      for (const p of monthlyProgress ?? []) {
        if (p.fundedForMonth === selectedMonth) continue;
        if (!p.category.monthlyTarget || p.category.monthlyTarget <= 0) continue;
        promises.push(
          setCategoryFunded({ id: p.category._id, userId: user.id, monthKey: selectedMonth, funded: true })
        );
      }

      for (const d of debts ?? []) {
        if (d.fundedForMonth === selectedMonth) continue;
        const amount = d.plannedMonthlyPayment ?? d.minimumPayment ?? 0;
        if (amount <= 0) continue;
        promises.push(
          setDebtFunded({ id: d._id, userId: user.id, monthKey: selectedMonth, funded: true })
        );
      }

      for (const c of creditCards ?? []) {
        if (c.fundedForMonth === selectedMonth) continue;
        const amount = c.plannedMonthlyPayment ?? c.minimumPayment ?? 0;
        if (amount <= 0) continue;
        promises.push(
          setCardFunded({ id: c._id, userId: user.id, monthKey: selectedMonth, funded: true })
        );
      }

      await Promise.all(promises);
    } finally {
      setAutoFunding(false);
    }
  }

  if (!isLoaded) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    redirect("/sign-in");
  }

  const allOnTrack =
    (monthlyProgress?.length ?? 0) > 0 && overBudgetCount === 0 && totalSpent > 0;
  const viewingCalendarMonth = selectedMonth === getCurrentMonth();
  const remainingToPay = totalFunded > 0 ? totalFunded - totalPaid : null;

  return (
    <div className="w-full space-y-6 lg:space-y-8">
      {/* Header */}
      <header className="relative overflow-hidden">
        {/* Confetti fires here when everything goes on-track */}
        {showConfetti && (
          <div className="pointer-events-none absolute top-1/2 left-10 z-0" aria-hidden="true">
            {CONFETTI_PIECES.map((p) => (
              <div
                key={p.id}
                className="absolute rounded-sm"
                style={{
                  backgroundColor: p.color,
                  width: p.w,
                  height: p.h,
                  top: 0,
                  left: 0,
                  "--tx": `${p.tx}px`,
                  "--ty": `${p.ty}px`,
                  "--rot": `${p.rot}deg`,
                  animation: `confetti-fly ${p.duration}s ease-out ${p.delay}s both`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}
        <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Good {getTimeOfDay()}, {user.firstName ?? "there"}
          </h1>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {/* Month nav */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
                className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 px-1 tabular-nums">
                {formatMonth(selectedMonth)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
                className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
              {!viewingCalendarMonth && (
                <button
                  type="button"
                  onClick={() => setSelectedMonth(getCurrentMonth())}
                  className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 px-2 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors"
                >
                  Today
                </button>
              )}
            </div>
            {/* Status badge */}
            {overBudgetCount > 0 ? (
              <Link
                href="/categories"
                className="inline-flex items-center gap-1 text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-2 py-1 rounded-full border border-rose-200 dark:border-rose-800/60 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors"
              >
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                {overBudgetCount} over budget
              </Link>
            ) : allOnTrack ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 px-2 py-1 rounded-full border border-teal-200 dark:border-teal-800/60">
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                On track
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* Summary chips */}
      <section aria-labelledby="dashboard-summary-heading">
        <h2 id="dashboard-summary-heading" className="sr-only">Budget summary</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* Cash + Fund All */}
          <div className="bg-teal-50/80 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-800/50 rounded-xl px-3 py-2.5 flex flex-col items-center gap-1.5">
            <div className="text-center">
              <p className="text-teal-700 dark:text-teal-300 font-bold text-sm sm:text-base tabular-nums">
                {accounts !== undefined ? formatCurrency(totalCashBalance) : "—"}
              </p>
              <p className="text-teal-600/70 dark:text-teal-600 text-xs">Cash</p>
            </div>
            <button
              type="button"
              onClick={handleAutoFund}
              disabled={autoFunding}
              title="Mark all bills and categories as funded for this month"
              className="inline-flex items-center gap-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors w-full justify-center"
            >
              {autoFunding ? (
                <span>…</span>
              ) : (
                <Zap className="w-3 h-3" aria-hidden="true" />
              )}
              Fund All
            </button>
          </div>
          {/* Budgeted */}
          <div className="bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-white/8 rounded-xl px-3 py-2.5 text-center">
            <p className="text-slate-800 dark:text-slate-100 font-bold text-sm sm:text-base tabular-nums">
              {monthlyProgress !== undefined && debts !== undefined && creditCards !== undefined
                ? formatCurrency(totalFunded)
                : "—"}
            </p>
            <p className="text-slate-500 dark:text-slate-500 text-xs mt-0.5">Budgeted</p>
          </div>
          {/* Spent */}
          <div className={`rounded-xl px-3 py-2.5 text-center border ${
            overBudgetCount > 0
              ? "bg-rose-50/80 dark:bg-rose-950/60 border-rose-200/80 dark:border-rose-800/50"
              : "bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-white/8"
          }`}>
            <p className={`font-bold text-sm sm:text-base tabular-nums ${
              overBudgetCount > 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-800 dark:text-slate-100"
            }`}>
              {transactions !== undefined ? formatCurrency(totalPaid) : "—"}
            </p>
            <p className={`text-xs mt-0.5 ${
              overBudgetCount > 0
                ? "text-rose-500/70 dark:text-rose-700"
                : "text-slate-500 dark:text-slate-500"
            }`}>
              {overBudgetCount > 0 ? `Spent · ${overBudgetCount} over` : "Spent"}
            </p>
          </div>
        </div>
      </section>

      {/* Timeline: categories + debts + credit cards (full width) */}
      {(plannerRows.length > 0 || (monthlyProgress?.length ?? 0) > 0) && (
        <div className="w-full space-y-4">
          {monthlyProgress === undefined || debts === undefined || creditCards === undefined ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-white/10 animate-pulse" />
              ))}
            </div>
          ) : (
            <ExpenseTimeline
              items={plannerRows}
              categories={[]}
              budgetMonth={selectedMonth}
              userId={user.id}
              debts={debts}
              creditCards={creditCards}
              categoryProgress={monthlyProgress?.filter((p) => !p.category.dueDayOfMonth) ?? []}
              groupNameById={groupNameById}
            />
          )}
        </div>
      )}

      {/* No categories yet */}
      {monthlyProgress !== undefined && (monthlyProgress?.length ?? 0) === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-8 text-center">
          <p className="text-slate-700 dark:text-slate-200 font-medium mb-1">Set up your first budget group</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mb-4">
            Create groups and categories to track where your money goes each month.
          </p>
          <Link
            href="/categories"
            className="bg-teal-600 dark:bg-teal-500 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 dark:hover:bg-teal-400 active:scale-[0.97] transition-all"
          >
            Set up budget
          </Link>
        </div>
      )}

      {/* Transactions */}
      <div>
        <div>
          <SectionHeader
            title={`Transactions · ${formatMonth(selectedMonth)}`}
            action={{
              kind: "button",
              onClick: openAddTransaction,
              label: "Add",
              icon: <Plus size={13} aria-hidden="true" />,
            }}
          />

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
                const cardOnly = !tx.categoryId && tx.creditCardId;
                const debtOnly = !tx.categoryId && tx.debtId;
                const accentColor =
                  cardOnly
                    ? ACCENT_COLOR_FALLBACK.creditCard
                    : debtOnly
                      ? ACCENT_COLOR_FALLBACK.debt
                      : ACCENT_COLOR_FALLBACK.category;
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
                        {cardOnly ? (
                          <CreditCard className="w-4 h-4" style={{ color: accentColor }} aria-hidden="true" />
                        ) : debtOnly ? (
                          <Landmark className="w-4 h-4" style={{ color: accentColor }} aria-hidden="true" />
                        ) : (
                          <Receipt className="w-4 h-4" style={{ color: accentColor }} aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0">
                        {(() => {
                          let label = tx.description;
                          if (!tx.categoryId) {
                            if (tx.debtId && debtMap[tx.debtId] && (!label || label === "Payment")) {
                              label = `Loan payment · ${debtMap[tx.debtId].name}`;
                            } else if (tx.creditCardId && cardMap[tx.creditCardId] && (!label || label === "Payment")) {
                              label = `Card payment · ${cardMap[tx.creditCardId].name}`;
                            }
                          }
                          return <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{label}</p>;
                        })()}
                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatShortDate(tx.date)}</p>
                        {(() => {
                          const parts: string[] = [];
                          if (tx.accountId && accountMap[tx.accountId]) {
                            parts.push(accountMap[tx.accountId].name);
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

      {/* Accounts */}
      {accounts !== undefined && accounts.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 p-5 shadow-sm w-full">
          <SectionHeader title="Your accounts" action={{ kind: "link", href: "/accounts" }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((acc) => {
              const isAsset = accountIsAssetForAvailability(acc.accountType);
              const accentClass =
                acc.accountType === "credit_card"
                  ? "border-l-indigo-600"
                  : isAsset
                    ? "border-l-teal-600"
                    : "border-l-slate-500";
              return (
                <div
                  key={acc._id}
                  className={cn("rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/90 dark:bg-slate-800/50 px-4 py-4 border-l-[3px]", accentClass)}
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
                  {!isAsset && (
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      Liability — not included in the cash total.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Credit Cards */}
      {creditCards !== undefined && creditCards.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 p-5 shadow-sm">
          <SectionHeader
            title="Credit cards"
            icon={<CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />}
            action={{ kind: "link", href: "/credit-cards" }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {creditCards.map((c) => {
              const apr = formatAprPercent(c.aprPercent);
              return (
                <div
                  key={c._id}
                  className="rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/90 dark:bg-slate-800/50 px-4 py-4"
                  style={{ borderLeft: `3px solid ${c.color ?? ACCENT_COLOR_FALLBACK.creditCard}` }}
                >
                  <div className="mb-2 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate text-sm sm:text-base">{c.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatCreditCardUsageMode(c.usageMode)}
                    </p>
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Balance</p>
                  <p className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none">
                    {formatCurrency(c.balance)}
                  </p>
                  {apr && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{apr}</p>}
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

      {/* Debts */}
      {debts !== undefined && debts.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 p-5 shadow-sm">
          <SectionHeader title="Debts & loans" action={{ kind: "link", href: "/debts" }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {debts.map((d) => {
              const apr = formatAprPercent(d.aprPercent);
              const planMo = debtPlannerMonthlyAmount(d);
              return (
                <div
                  key={d._id}
                  className="rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/90 dark:bg-slate-800/50 px-4 py-4"
                  style={{ borderLeft: `3px solid ${d.color ?? ACCENT_COLOR_FALLBACK.debtCard}` }}
                >
                  <div className="mb-2 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate text-sm sm:text-base">{d.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{formatDebtType(d.debtType)}</p>
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Balance</p>
                  <p className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none">
                    {formatCurrency(d.balance)}
                  </p>
                  {apr && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{apr}</p>}
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
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="w-full space-y-8 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-xl w-56" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-teal-200 dark:bg-teal-900/50 rounded-2xl h-28" />
        <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl h-28" />
        <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl h-28" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-200 dark:bg-slate-700 rounded-2xl h-32" />
          ))}
        </div>
        <div className="lg:col-span-2 bg-slate-200 dark:bg-slate-700 rounded-2xl h-64" />
      </div>
    </div>
  );
}
