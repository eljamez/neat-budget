"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BudgetCard } from "@/components/BudgetCard";
import { formatCurrency, formatMonth, getCurrentMonth } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { redirect } from "next/navigation";

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hi, {user.firstName ?? "there"}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">{formatMonth(selectedMonth)}</p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm text-gray-500">Total Budget</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalBudget)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm text-gray-500">Total Spent</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm text-gray-500">Remaining</p>
          <p className={`text-2xl font-bold ${totalBudget - totalSpent < 0 ? "text-red-600" : "text-green-600"}`}>
            {formatCurrency(totalBudget - totalSpent)}
          </p>
        </div>
      </div>

      {/* Over-budget Alert */}
      {overBudgetCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="font-medium text-red-800">
              {overBudgetCount} {overBudgetCount === 1 ? "category is" : "categories are"} over budget!
            </p>
            <p className="text-sm text-red-600">Review your spending to stay on track.</p>
          </div>
        </div>
      )}

      {/* Budget Categories */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Budget Categories</h2>
          <Link
            href="/categories"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Manage
          </Link>
        </div>

        {categories === undefined ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 h-32 animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 mb-3">No budget categories yet</p>
            <Link
              href="/categories"
              className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create your first category
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
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
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Recent Transactions</h2>
          <Link
            href="/add-transaction"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            + Add
          </Link>
        </div>

        {transactions === undefined ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 h-14 animate-pulse" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <p className="text-gray-400">No transactions this month</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {transactions.slice(0, 10).map((tx) => {
              const cat = categories?.find((c) => c._id === tx.categoryId);
              return (
                <div key={tx._id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat?.icon ?? "💰"}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{tx.description}</p>
                      <p className="text-xs text-gray-400">
                        {cat?.name} · {tx.date}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">
                    -{formatCurrency(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-200 rounded-xl h-20" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-200 rounded-xl h-32" />
        ))}
      </div>
    </div>
  );
}
