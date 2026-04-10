"use client";

import { formatCurrency, ACCENT_COLOR_FALLBACK, cn } from "@/lib/utils";
import { CATEGORY_ICON_MAP } from "@/lib/icons";

interface BudgetCardProps {
  name: string;
  /** Monthly cap from recurring expenses in this category (sum of budget items). */
  monthlyLimit: number;
  spent: number;
  color?: string;
  icon?: string;
  /** When set, shown under the title instead of a single budget line. */
  budgetBreakdown?: { manualExtra: number; fromPlannedExpenses: number };
  /** e.g. "spent this month" or "spent in April 2026" when the dashboard month differs from today */
  spentPeriodLabel?: string;
  onEdit?: () => void;
  onViewTransactions?: () => void;
}

export function BudgetCard({
  name,
  monthlyLimit,
  spent,
  color = ACCENT_COLOR_FALLBACK.category,
  icon = "Receipt",
  budgetBreakdown,
  spentPeriodLabel = "spent this month",
  onEdit,
  onViewTransactions,
}: BudgetCardProps) {
  const remaining = monthlyLimit - spent;
  const rawPercent = monthlyLimit > 0 ? (spent / monthlyLimit) * 100 : 0;
  const displayPercent = Math.min(rawPercent, 100);
  const isOverBudget = spent > monthlyLimit;
  const isWarning = rawPercent >= 80 && !isOverBudget;

  const progressColor = isOverBudget
    ? ACCENT_COLOR_FALLBACK.danger
    : isWarning
    ? ACCENT_COLOR_FALLBACK.warning
    : ACCENT_COLOR_FALLBACK.success;

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-white/10 overflow-hidden hover:shadow-md dark:hover:border-white/15 transition-all duration-200 group"
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
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
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
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 leading-tight">{name}</h3>
              {budgetBreakdown ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  <span className="font-medium text-slate-500 dark:text-slate-400">{formatCurrency(monthlyLimit)} total</span>
                  {" · "}
                  {formatCurrency(budgetBreakdown.fromPlannedExpenses)} expenses +{" "}
                  {formatCurrency(budgetBreakdown.manualExtra)} extra
                </p>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatCurrency(monthlyLimit)} budget</p>
              )}
            </div>
          </div>
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 px-2 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-all"
            >
              Edit
            </button>
          )}
        </div>

        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">{formatCurrency(spent)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{spentPeriodLabel}</p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "text-sm font-semibold leading-none",
                isOverBudget && "text-rose-600 dark:text-rose-400",
                isWarning && "text-amber-700 dark:text-amber-400",
                !isOverBudget && !isWarning && "text-emerald-700 dark:text-emerald-400"
              )}
            >
              {isOverBudget
                ? `+${formatCurrency(Math.abs(remaining))} over`
                : `${formatCurrency(remaining)} left`}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{Math.round(rawPercent)}% used</p>
          </div>
        </div>

        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${displayPercent}%`, backgroundColor: progressColor }}
          />
        </div>

        {isOverBudget && (
          <div role="status" aria-label="Over budget" className="mt-3 inline-flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-medium px-2.5 py-1 rounded-full border border-rose-100/80 dark:border-rose-800/50">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-rose-400 animate-pulse" />
            Over budget
          </div>
        )}
        {isWarning && (
          <div role="status" aria-label="Approaching budget limit" className="mt-3 inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-100/80 dark:border-amber-800/50">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
            Almost there
          </div>
        )}
      </div>
    </div>
  );
}
