"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency, formatMonth, formatAccountType } from "@/lib/utils";
import { ExpenseLinkedTransactions } from "@/components/ExpenseLinkedTransactions";

type AllocationRow = {
  _id: Id<"expenseAllocations">;
  budgetItemId: Id<"budgetItems">;
  accountId?: Id<"accounts">;
  amount: number;
};

type AccountOption = {
  _id: Id<"accounts">;
  name: string;
  accountType: string;
};

interface BudgetAllocationModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  monthKey: string;
  budgetItemId: Id<"budgetItems">;
  expenseName: string;
  expenseAmount: number;
  allocations: AllocationRow[];
  /** Used only to label legacy allocation rows that still store `accountId`. */
  accounts?: AccountOption[];
}

export function BudgetAllocationModal({
  open,
  onClose,
  userId,
  monthKey,
  budgetItemId,
  expenseName,
  expenseAmount,
  allocations,
  accounts,
}: BudgetAllocationModalProps) {
  const createAlloc = useMutation(api.expenseAllocations.create);
  const removeAlloc = useMutation(api.expenseAllocations.remove);
  const removeAllForMonth = useMutation(api.expenseAllocations.removeAllForBudgetMonth);
  const [amountStr, setAmountStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearAllLoading, setClearAllLoading] = useState(false);
  const [error, setError] = useState("");

  const lines = allocations.filter((a) => a.budgetItemId === budgetItemId);
  const totalSetAside = lines.reduce((s, l) => s + l.amount, 0);
  const remaining = Math.max(0, expenseAmount - totalSetAside);

  useEffect(() => {
    if (!open) return;
    setError("");
    setAmountStr(expenseAmount > 0 ? expenseAmount.toFixed(2) : "");
  }, [open, budgetItemId, expenseAmount]);

  if (!open) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (amt > remaining + 0.005) {
      setError(`At most ${formatCurrency(remaining)} left to assign`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createAlloc({
        userId,
        budgetItemId,
        amount: amt,
        monthKey,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alloc-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6 dark:bg-slate-900 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="alloc-modal-title" className="font-semibold text-slate-800 mb-1 dark:text-slate-100">
          Fund this bill
        </h2>
        <p className="text-xs text-slate-500 mb-4 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-200">{expenseName}</span> · {formatMonth(monthKey)} · Bill{" "}
          {formatCurrency(expenseAmount)}
        </p>
        <p className="text-[11px] text-slate-500 mb-4 leading-relaxed dark:text-slate-400">
          This sets aside part of your <strong className="text-slate-700 dark:text-slate-300">overall budget cash</strong> for this bill in{" "}
          <strong className="text-slate-700 dark:text-slate-300">{formatMonth(monthKey)}</strong>. It does not change any bank
          balance — those update when you log transactions. Use{" "}
          <strong className="text-slate-700 dark:text-slate-300">Adjust funding</strong> to add or remove lines; mark the bill{" "}
          <strong className="text-slate-700 dark:text-slate-300">paid</strong> on the timeline when it settles.
        </p>

        <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2.5 mb-4 dark:border-teal-800/50 dark:bg-teal-950/40">
          <p className="text-xs text-teal-900 font-medium dark:text-teal-200">
            {formatCurrency(totalSetAside)} funded{" "}
            <span className="font-normal text-teal-800/90 dark:text-teal-300/90">
              of {formatCurrency(expenseAmount)} for this month
            </span>
          </p>
          {remaining > 0.005 && (
            <p className="text-[11px] text-teal-800/80 mt-1 dark:text-teal-400">
              Up to {formatCurrency(remaining)} more can be funded.
            </p>
          )}
        </div>

        <ExpenseLinkedTransactions budgetItemId={budgetItemId} monthKey={monthKey} className="mb-4" />

        {lines.length > 0 && (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              disabled={clearAllLoading}
              onClick={async () => {
                setClearAllLoading(true);
                setError("");
                try {
                  await removeAllForMonth({ userId, budgetItemId, monthKey });
                  onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not clear funding");
                } finally {
                  setClearAllLoading(false);
                }
              }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
            >
              {clearAllLoading ? "Clearing…" : "Remove all funding for this bill"}
            </button>
          </div>
        )}

        {lines.length > 0 && (
          <ul className="space-y-2 mb-4">
            {lines.map((line) => {
              const acc = line.accountId ? accounts?.find((a) => a._id === line.accountId) : undefined;
              const label = acc ? `${acc.name} · ${formatCurrency(line.amount)}` : `Funding · ${formatCurrency(line.amount)}`;
              return (
                <li
                  key={line._id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-white/8 dark:bg-slate-800/50"
                >
                  <span className="text-sm text-slate-700 truncate min-w-0 dark:text-slate-200" title={acc ? formatAccountType(acc.accountType) : undefined}>
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await removeAlloc({ id: line._id, userId });
                      } catch {
                        // surfaced in dev
                      }
                    }}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 shrink-0"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label htmlFor="alloc-amt" className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-400">
              Amount ($)
            </label>
            <input
              id="alloc-amt"
              type="number"
              step="0.01"
              min="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-rose-600 bg-rose-50 px-2 py-1.5 rounded-lg dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading || remaining <= 0.005}
              className="flex-1 bg-teal-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Add funding"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-2 text-sm font-medium hover:bg-slate-200 transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Done
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
