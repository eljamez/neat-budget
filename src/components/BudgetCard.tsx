"use client";

import { formatCurrency } from "@/lib/utils";
import { CATEGORY_ICON_MAP } from "@/lib/icons";

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
  color = "#0d9488",
  icon = "Receipt",
  onEdit,
  onViewTransactions,
}: BudgetCardProps) {
  const remaining = monthlyLimit - spent;
  const rawPercent = monthlyLimit > 0 ? (spent / monthlyLimit) * 100 : 0;
  const displayPercent = Math.min(rawPercent, 100);
  const isOverBudget = spent > monthlyLimit;
  const isWarning = rawPercent >= 80 && !isOverBudget;

  const progressColor = isOverBudget
    ? "#f43f5e"
    : isWarning
    ? "#f59e0b"
    : "#10b981";

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all duration-200 group"
      style={{ borderLeft: `4px solid ${color}`, cursor: onViewTransactions ? "pointer" : "default" }}
      role={onViewTransactions ? "button" : undefined}
      tabIndex={onViewTransactions ? 0 : undefined}
      aria-label={onViewTransactions ? `View transactions for ${name}` : undefined}
      onClick={onViewTransactions}
      onKeyDown={
        onViewTransactions
          ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewTransactions(); } }
          : undefined
      }
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${color}18` }}
            >
              {(() => {
                const IconComp = icon ? CATEGORY_ICON_MAP[icon] : null;
                return IconComp
                  ? <IconComp className="w-5 h-5" style={{ color }} aria-hidden="true" />
                  : <span className="text-xl" aria-hidden="true">{icon}</span>;
              })()}
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 leading-tight">{name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(monthlyLimit)} budget</p>
            </div>
          </div>
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-teal-600 px-2 py-1 rounded-lg hover:bg-teal-50 transition-all"
            >
              Edit
            </button>
          )}
        </div>

        {/* Amount */}
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-2xl font-bold text-slate-900 leading-none">{formatCurrency(spent)}</p>
            <p className="text-xs text-slate-400 mt-1">spent this month</p>
          </div>
          <div className="text-right">
            <p
              className="text-sm font-semibold leading-none"
              style={{ color: progressColor }}
            >
              {isOverBudget
                ? `+${formatCurrency(Math.abs(remaining))} over`
                : `${formatCurrency(remaining)} left`}
            </p>
            <p className="text-xs text-slate-400 mt-1">{Math.round(rawPercent)}% used</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${displayPercent}%`, backgroundColor: progressColor }}
          />
        </div>

        {/* Over budget pill */}
        {isOverBudget && (
          <div role="status" aria-label="Over budget" className="mt-3 inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 text-xs font-medium px-2.5 py-1 rounded-full">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Over budget
          </div>
        )}
        {isWarning && (
          <div role="status" aria-label="Approaching budget limit" className="mt-3 inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 text-xs font-medium px-2.5 py-1 rounded-full">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Almost there
          </div>
        )}
      </div>
    </div>
  );
}
