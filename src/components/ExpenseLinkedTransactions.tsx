"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { formatCurrency, formatMonth, formatShortDate } from "@/lib/utils";
import { useTransactionModal } from "@/components/TransactionModalProvider";
import { Pencil } from "lucide-react";

export function ExpenseLinkedTransactions({
  budgetItemId,
  monthKey,
  className = "",
}: {
  budgetItemId: Id<"budgetItems">;
  /** When set, only `YYYY-MM` transactions are listed */
  monthKey?: string;
  className?: string;
}) {
  const { openEditTransaction } = useTransactionModal();
  const txs = useQuery(api.transactions.listByBudgetItem, {
    budgetItemId,
    month: monthKey,
  });

  if (txs === undefined) {
    return (
      <div className={className}>
        <p className="text-xs font-semibold text-slate-600 mb-2">Logged payments</p>
        <div className="h-14 bg-slate-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="text-xs font-semibold text-slate-600 mb-2">
        Logged payments
        {monthKey ? (
          <span className="font-normal text-slate-500"> · {formatMonth(monthKey)}</span>
        ) : null}
      </p>
      {txs.length === 0 ? (
        <p className="text-xs text-slate-400 leading-relaxed">
          {monthKey
            ? `No payments for this expense in ${formatMonth(monthKey)}.`
            : "No payments logged for this expense yet."}
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-44 overflow-y-auto overscroll-contain pr-0.5">
          {txs.map((tx) => (
            <li
              key={tx._id}
              className="flex items-stretch gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 tabular-nums">
                  {formatCurrency(tx.amount)}
                </p>
                <p className="text-[11px] text-slate-500">{formatShortDate(tx.date)}</p>
                {tx.note?.trim() ? (
                  <p className="text-[11px] text-slate-400 truncate mt-0.5" title={tx.note}>
                    {tx.note}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => openEditTransaction(tx)}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-teal-700 hover:bg-teal-50 hover:border-teal-200 transition-colors self-center"
              >
                <Pencil className="w-3 h-3 shrink-0" aria-hidden="true" />
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
