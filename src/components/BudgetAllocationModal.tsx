"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency, formatMonth, formatAccountType } from "@/lib/utils";

type AllocationRow = {
  _id: Id<"expenseAllocations">;
  budgetItemId: Id<"budgetItems">;
  accountId: Id<"accounts">;
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
  /** Pre-fills "From account" from the expense row when set */
  defaultAccountId?: Id<"accounts"> | null;
  allocations: AllocationRow[];
  accounts: AccountOption[] | undefined;
}

export function BudgetAllocationModal({
  open,
  onClose,
  userId,
  monthKey,
  budgetItemId,
  expenseName,
  expenseAmount,
  defaultAccountId,
  allocations,
  accounts,
}: BudgetAllocationModalProps) {
  const createAlloc = useMutation(api.expenseAllocations.create);
  const removeAlloc = useMutation(api.expenseAllocations.remove);
  const updateBudgetItem = useMutation(api.budgetItems.update);

  const [accountId, setAccountId] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lines = allocations.filter((a) => a.budgetItemId === budgetItemId);
  const totalSetAside = lines.reduce((s, l) => s + l.amount, 0);
  const remaining = Math.max(0, expenseAmount - totalSetAside);

  const accountsSorted = accounts
    ? [...accounts].sort((a, b) => a.name.localeCompare(b.name))
    : [];

  useEffect(() => {
    if (!open) return;
    setError("");
    setAccountId(defaultAccountId ? String(defaultAccountId) : "");
    setAmountStr(expenseAmount > 0 ? expenseAmount.toFixed(2) : "");
  }, [open, budgetItemId, expenseAmount, defaultAccountId]);

  if (!open) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountStr);
    if (!accountId) {
      setError("Choose an account");
      return;
    }
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
        accountId: accountId as Id<"accounts">,
        amount: amt,
        monthKey,
      });
      await updateBudgetItem({
        id: budgetItemId,
        accountId: accountId as Id<"accounts">,
      });
      const nextTotal = totalSetAside + amt;
      const nextRemaining = Math.max(0, expenseAmount - nextTotal);
      setAmountStr(nextRemaining > 0.005 ? nextRemaining.toFixed(2) : "");
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
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="alloc-modal-title" className="font-semibold text-slate-800 mb-1">
          Set aside cash
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          <span className="font-medium text-slate-700">{expenseName}</span> · {formatMonth(monthKey)} · Bill{" "}
          {formatCurrency(expenseAmount)}
        </p>

        <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2.5 mb-4">
          <p className="text-xs text-teal-900 font-medium">
            {formatCurrency(totalSetAside)} set aside{" "}
            <span className="font-normal text-teal-800/90">
              of {formatCurrency(expenseAmount)}
            </span>
          </p>
          {remaining > 0.005 && (
            <p className="text-[11px] text-teal-800/80 mt-1">
              Up to {formatCurrency(remaining)} more can be assigned for this month.
            </p>
          )}
        </div>

        {lines.length > 0 && (
          <ul className="space-y-2 mb-4">
            {lines.map((line) => {
              const acc = accounts?.find((a) => a._id === line.accountId);
              return (
                <li
                  key={line._id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                >
                  <span className="text-sm text-slate-700 truncate min-w-0">
                    {acc?.name ?? "Account"} · {formatCurrency(line.amount)}
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
            <label htmlFor="alloc-account" className="block text-xs font-medium text-slate-600 mb-1">
              From account
            </label>
            <select
              id="alloc-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white"
            >
              <option value="">Select…</option>
              {accountsSorted.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} ({formatAccountType(a.accountType)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="alloc-amt" className="block text-xs font-medium text-slate-600 mb-1">
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
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-rose-600 bg-rose-50 px-2 py-1.5 rounded-lg">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading || accountsSorted.length === 0}
              className="flex-1 bg-teal-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Add set-aside"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-2 text-sm font-medium"
            >
              Done
            </button>
          </div>
        </form>
        {accountsSorted.length === 0 && (
          <p className="text-xs text-slate-500 mt-3">
            Add an account under Accounts before setting cash aside.
          </p>
        )}
      </div>
    </div>
  );
}
