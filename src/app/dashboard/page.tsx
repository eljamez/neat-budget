"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BudgetCard } from "@/components/BudgetCard";
import { formatCurrency, formatMonth, formatShortDate, getCurrentMonth } from "@/lib/utils";
import { CATEGORY_ICON_MAP } from "@/lib/icons";
import Link from "next/link";
import { useState, useMemo } from "react";
import { redirect } from "next/navigation";
import { CheckCircle2, AlertTriangle, ArrowRight, Plus } from "lucide-react";

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
) {
  if (!categoriesLoaded || totalBudget === 0) return null;
  if (overBudgetCount > 0) return null; // alert strip handles this
  const pct = totalSpent / totalBudget;
  if (totalSpent === 0) return "No spending logged yet this month.";
  if (pct < 0.5) return `You've used ${Math.round(pct * 100)}% of your budget — looking good.`;
  if (pct < 0.8) return `${Math.round(pct * 100)}% of your budget used. Staying on track.`;
  if (pct < 1) return `${Math.round(pct * 100)}% used — keep a close eye this month.`;
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

  type CategoryEntry = NonNullable<typeof categories>[number];
  const categoryMap = useMemo((): Record<string, CategoryEntry> => {
    if (!categories) return {};
    return Object.fromEntries(categories.map((c) => [c._id, c]));
  }, [categories]);

  if (!isLoaded) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    redirect("/sign-in");
  }

  const totalBudget = categories?.reduce((sum, c) => sum + c.monthlyLimit, 0) ?? 0;
  const totalSpent = Object.values(spendingByCategory ?? {}).reduce((a, b) => a + b, 0);
  const overBudgetCount = categories?.filter(
    (c) => (spendingByCategory?.[c._id] ?? 0) > c.monthlyLimit
  ).length ?? 0;

  const overallPercent = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  const categoriesLoaded = categories !== undefined;
  const allOnTrack = categoriesLoaded && (categories?.length ?? 0) > 0 && overBudgetCount === 0 && totalSpent > 0;
  const budgetSubtitle = getBudgetSubtitle(totalBudget, totalSpent, overBudgetCount, categoriesLoaded);

  return (
    <div className="space-y-6 lg:space-y-8 max-w-5xl">
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
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            aria-label="Select month"
            className="flex-1 sm:flex-none border border-slate-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm"
          />
          <Link
            href="/add-transaction"
            className="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={14} aria-hidden="true" />
            Add
          </Link>
        </div>
      </div>

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
              {formatCurrency(totalBudget - totalSpent)} remaining — nice work this month.
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
              {categories.map((cat) => (
                <BudgetCard
                  key={cat._id}
                  name={cat.name}
                  monthlyLimit={cat.monthlyLimit}
                  spent={spendingByCategory?.[cat._id] ?? 0}
                  color={cat.color}
                  icon={cat.icon}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Recent Transactions</h2>
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
              <p className="text-slate-400 text-xs mt-1">No spending logged this month yet.</p>
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
    <div className="space-y-8 max-w-5xl animate-pulse">
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
