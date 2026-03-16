"use client";

import { formatCurrency, getProgressColor, getProgressTextColor } from "@/lib/utils";

interface BudgetCardProps {
  name: string;
  monthlyLimit: number;
  spent: number;
  color?: string;
  icon?: string;
  onEdit?: () => void;
  onViewTransactions?: () => void;
}

export function BudgetCard({
  name,
  monthlyLimit,
  spent,
  color = "#6366f1",
  icon = "💰",
  onEdit,
  onViewTransactions,
}: BudgetCardProps) {
  const remaining = monthlyLimit - spent;
  const percent = monthlyLimit > 0 ? Math.min((spent / monthlyLimit) * 100, 100) : 0;
  const isOverBudget = spent > monthlyLimit;

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onViewTransactions}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-semibold text-gray-800">{name}</h3>
            <p className="text-sm text-gray-500">{formatCurrency(monthlyLimit)} / month</p>
          </div>
        </div>
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1 rounded hover:bg-gray-100"
          >
            Edit
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Spent: {formatCurrency(spent)}</span>
          <span className={getProgressTextColor(percent)}>
            {isOverBudget
              ? `Over by ${formatCurrency(Math.abs(remaining))}`
              : `${formatCurrency(remaining)} left`}
          </span>
        </div>

        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${getProgressColor(percent)}`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <p className="text-xs text-gray-400 text-right">{Math.round(percent)}% used</p>
      </div>

      {isOverBudget && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600 font-medium">
          Over budget! Consider reducing spending.
        </div>
      )}
    </div>
  );
}
