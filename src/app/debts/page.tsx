"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { DebtManager } from "@/components/DebtManager";
import { DebtMonthlyPaidGlance } from "@/components/DebtMonthlyPaidGlance";
import { DebtPaydownBar } from "@/components/DebtPaydownBar";
import {
  formatCurrency,
  formatAprPercent,
  formatOrdinalDay,
  dateInBudgetMonth,
  getCurrentMonth,
  debtPlannerMonthlyAmount,
  ACCENT_COLOR_FALLBACK,
} from "@/lib/utils";
import { Landmark } from "lucide-react";

export default function DebtsPage() {
  const { user } = useUser();
  const debts = useQuery(api.debts.list, user ? { userId: user.id } : "skip");
  const archiveDebt = useMutation(api.debts.archive);

  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [editId, setEditId] = useState<Id<"debts"> | null>(null);
  const [archiveDebtId, setArchiveDebtId] = useState<Id<"debts"> | null>(null);

  const budgetMonth = getCurrentMonth();
  const sortedDebts = useMemo(() => {
    if (!debts) return [];
    return [...debts].sort((a, b) => {
      const da = a.dueDayOfMonth;
      const db = b.dueDayOfMonth;
      if (da != null && db != null && da >= 1 && da <= 31 && db >= 1 && db <= 31) {
        const ta = dateInBudgetMonth(budgetMonth, da).getTime();
        const tb = dateInBudgetMonth(budgetMonth, db).getTime();
        if (ta !== tb) return ta - tb;
      } else if (da != null && da >= 1 && da <= 31 && (db == null || db < 1 || db > 31)) {
        return -1;
      } else if ((da == null || da < 1 || da > 31) && db != null && db >= 1 && db <= 31) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [debts, budgetMonth]);

  const editDebt = debts?.find((d) => d._id === editId) ?? null;

  if (!user) return null;

  return (
    <div className="w-full space-y-5 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Debts</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Loans and installment balances—sorted by due date. Credit cards live on the Cards page.
          </p>
        </div>
        <button
          type="button"
          disabled={debtModalOpen}
          onClick={() => {
            setEditId(null);
            setDebtModalOpen(true);
          }}
          className="bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 shrink-0 disabled:opacity-50 disabled:pointer-events-none"
        >
          + Add debt
        </button>
      </div>

      {debts === undefined ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-white/10 animate-pulse"
            />
          ))}
        </div>
      ) : debts.length === 0 && !debtModalOpen ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-12 text-center">
          <Landmark className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">No debts tracked yet</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mb-5">
            Add loans here; use Credit cards for revolving balances.
          </p>
          <button
            type="button"
            onClick={() => setDebtModalOpen(true)}
            className="bg-teal-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-teal-700"
          >
            Add your first debt
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {sortedDebts.map((d) => {
            const color = d.color ?? ACCENT_COLOR_FALLBACK.debtCard;
            const apr = formatAprPercent(d.aprPercent);
            const monthlyPlan = debtPlannerMonthlyAmount(d);
            const showMonthlyPlan = monthlyPlan > 0;
            const needsPlanHint = !showMonthlyPlan;
            const dueLabel =
              d.dueDayOfMonth != null && d.dueDayOfMonth >= 1 && d.dueDayOfMonth <= 31
                ? `Due ${formatOrdinalDay(d.dueDayOfMonth)}`
                : "No due day";
            const original =
              d.originalLoanAmount != null && d.originalLoanAmount > 0
                ? d.originalLoanAmount
                : null;

            return (
              <li key={d._id}>
                <div
                  className="rounded-xl border border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900 pl-3 pr-3 py-2.5 sm:py-2 shadow-sm"
                  style={{ borderLeftWidth: 3, borderLeftColor: color }}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${color}18` }}
                      >
                        <Landmark className="w-4 h-4" style={{ color }} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{d.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{dueLabel}</p>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                            {formatCurrency(d.balance)}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">owed</span>
                          {original != null && (
                            <>
                              <span className="text-slate-300 text-sm mx-0.5" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                                {formatCurrency(original)}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">original</span>
                            </>
                          )}
                          {showMonthlyPlan && (
                            <>
                              <span className="text-slate-300 text-sm mx-0.5" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                                {formatCurrency(monthlyPlan)}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">/mo plan</span>
                            </>
                          )}
                          {apr && (
                            <>
                              <span className="text-slate-300 text-sm mx-0.5" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-xs text-slate-500">{apr}</span>
                            </>
                          )}
                        </div>
                        {needsPlanHint && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            For loans and plans, set the monthly payment in Edit; for other debts, set
                            planned paydown or minimum—then add a due day for the Categories timeline.
                          </p>
                        )}
                        <p className="text-[11px] leading-snug">
                          <span className="text-slate-400 dark:text-slate-500 font-medium">Paid:</span>{" "}
                          <DebtMonthlyPaidGlance debtId={d._id} />
                        </p>
                        <DebtPaydownBar
                          debtId={d._id}
                          currentBalance={d.balance}
                          originalLoanAmount={d.originalLoanAmount}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 sm:flex-col sm:items-stretch sm:justify-center sm:min-w-18">
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(d._id);
                          setDebtModalOpen(true);
                        }}
                        className="text-xs sm:text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 px-2.5 py-1.5 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/50 font-medium border border-transparent"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setArchiveDebtId(archiveDebtId === d._id ? null : d._id)
                        }
                        className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-100 dark:border-white/10 sm:border-transparent dark:sm:border-transparent"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                </div>

                {archiveDebtId === d._id && (
                  <div className="mt-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl px-3 py-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <p className="text-sm text-rose-700 dark:text-rose-300">
                      Archive <strong>{d.name}</strong>? It will be hidden from active planning. Balances
                      are unchanged.
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        className="text-sm font-semibold text-white bg-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-700"
                        onClick={async () => {
                          await archiveDebt({ id: d._id, userId: user.id });
                          setArchiveDebtId(null);
                        }}
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        className="text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                        onClick={() => setArchiveDebtId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {debtModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="debt-dialog-title"
          onClick={() => {
            setDebtModalOpen(false);
            setEditId(null);
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="debt-dialog-title" className="font-semibold text-slate-800 dark:text-slate-100 mb-5">
              {editId ? "Edit debt" : "New debt"}
            </h2>
            <DebtManager
              key={editId ?? "new"}
              editDebt={editId ? editDebt : null}
              onSuccess={() => {
                setDebtModalOpen(false);
                setEditId(null);
              }}
              onCancel={() => {
                setDebtModalOpen(false);
                setEditId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
