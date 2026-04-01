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
  categoryMonthlyBudgetTotal,
  formatDebtType,
  formatAprPercent,
  formatCreditCardUsageMode,
  accountIsAssetForAvailability,
  formatAccountType,
} from "@/lib/utils";
import { CATEGORY_ICON_MAP } from "@/lib/icons";
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
} from "lucide-react";

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
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

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

  const allocationsMonth = useQuery(
    api.expenseAllocations.listByUserMonth,
    user ? { userId: user.id, monthKey: selectedMonth } : "skip"
  );

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

  const plannedByCategory = useMemo(() => {
    if (!allBudgetItems) return {};
    return sumBudgetItemsByCategory(allBudgetItems);
  }, [allBudgetItems]);

  const allocatedFromAccount = useMemo(() => {
    const m: Record<string, number> = {};
    if (!allocationsMonth) return m;
    for (const a of allocationsMonth) {
      m[a.accountId] = (m[a.accountId] ?? 0) + a.amount;
    }
    return m;
  }, [allocationsMonth]);

  const plannerRows = useMemo(
    () => buildPlannerRows(allBudgetItems, debts, creditCards),
    [allBudgetItems, debts, creditCards]
  );

  const categoryBudgetCap = (manual: number, categoryId: string) =>
    categoryMonthlyBudgetTotal(manual, plannedByCategory[categoryId] ?? 0);

  if (!isLoaded) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    redirect("/sign-in");
  }

  const totalBudget =
    categories?.reduce(
      (sum, c) => sum + categoryBudgetCap(c.monthlyLimit, c._id),
      0
    ) ?? 0;
  const totalSpent = Object.values(spendingByCategory ?? {}).reduce((a, b) => a + b, 0);
  const overBudgetCount =
    categories?.filter(
      (c) =>
        (spendingByCategory?.[c._id] ?? 0) > categoryBudgetCap(c.monthlyLimit, c._id)
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
          <Link
            href="/add-transaction"
            className="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={14} aria-hidden="true" />
            Add
          </Link>
        </div>
      </div>

      {/* Accounts: balance, set-asides for selected month, available to assign */}
      {accounts !== undefined && accounts.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-800">Cash & set-asides</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Money marked for upcoming bills in {formatMonth(selectedMonth)}. Available = balance
                minus set-asides (checking, savings, cash).
              </p>
            </div>
            <Link
              href="/accounts"
              className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium shrink-0"
            >
              Accounts <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {accounts.map((acc) => {
              const setAside = allocatedFromAccount[acc._id] ?? 0;
              const isAsset = accountIsAssetForAvailability(acc.accountType);
              const available = isAsset ? acc.balance - setAside : null;
              return (
                <div
                  key={acc._id}
                  className="rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3"
                >
                  <p className="text-xs text-slate-500 font-medium truncate">{acc.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{formatAccountType(acc.accountType)}</p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums mt-1">
                    {formatCurrency(acc.balance)}
                  </p>
                  <p className="text-xs text-slate-600 mt-2">
                    Set aside:{" "}
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {formatCurrency(setAside)}
                    </span>
                  </p>
                  {isAsset && available !== null ? (
                    <p
                      className={`text-xs font-semibold mt-1 tabular-nums ${
                        available < 0 ? "text-rose-600" : "text-emerald-700"
                      }`}
                    >
                      Available: {formatCurrency(available)}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">Card / loan balance — not “available” cash</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {categories !== undefined && categories.length > 0 && (
        <div className="rounded-xl border border-teal-100 bg-linear-to-r from-teal-50/90 to-slate-50/80 px-4 py-3 text-sm shadow-sm">
          <p className="font-semibold text-teal-950 tracking-tight">{formatMonth(selectedMonth)}</p>
          <p className="text-slate-600 text-xs mt-1 leading-relaxed">
            Bills below are ordered by <strong className="font-semibold text-slate-700">when funds must be ready</strong>.
            Use <strong className="font-semibold text-slate-700">Set aside</strong> to earmark cash from an account for each
            expense. Credit card and loan lines show planned payments — allocate from cash accounts when you pay them.
          </p>
        </div>
      )}

      {categories !== undefined && categories.length > 0 && (
        <div className="w-full min-w-0">
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
            />
          )}
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
                const cap = categoryMonthlyBudgetTotal(cat.monthlyLimit, planned);
                return (
                  <BudgetCard
                    key={cat._id}
                    name={cat.name}
                    monthlyLimit={cap}
                    spent={spendingByCategory?.[cat._id] ?? 0}
                    color={cat.color}
                    icon={cat.icon}
                    spentPeriodLabel={spentPeriodLabel}
                    budgetBreakdown={{
                      manualExtra: cat.monthlyLimit,
                      fromPlannedExpenses: planned,
                    }}
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
            <Link href="/add-transaction" className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium">
              <Plus size={13} aria-hidden="true" /> Add
            </Link>
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
                const cat = categoryMap[tx.categoryId];
                return (
                  <div
                    key={tx._id}
                    className={`flex items-center justify-between px-4 py-3 ${
                      i < Math.min(transactions.length, 12) - 1 ? "border-b border-slate-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        aria-hidden="true"
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: cat?.color ? `${cat.color}18` : "#0d948818" }}
                      >
                        {(() => {
                          const iconName = cat?.icon;
                          const IconComp = iconName ? CATEGORY_ICON_MAP[iconName] : null;
                          const color = cat?.color ?? "#0d9488";
                          return IconComp
                            ? <IconComp className="w-4 h-4" style={{ color }} />
                            : <span className="text-sm">{iconName ?? "💰"}</span>;
                        })()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{tx.description}</p>
                        <p className="text-xs text-slate-500">{formatShortDate(tx.date)}</p>
                        {(() => {
                          const parts: string[] = [];
                          if (tx.accountId && accountMap[tx.accountId]) {
                            parts.push(accountMap[tx.accountId].name);
                          }
                          if (tx.debtId && debtMap[tx.debtId]) {
                            parts.push(`Pay toward ${debtMap[tx.debtId].name} (loan)`);
                          }
                          const ccId = tx.creditCardId;
                          if (ccId && cardMap[ccId]) {
                            parts.push(`Pay toward ${cardMap[ccId].name} (card)`);
                          }
                          return parts.length > 0 ? (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{parts.join(" · ")}</p>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 ml-2 flex-shrink-0">
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
