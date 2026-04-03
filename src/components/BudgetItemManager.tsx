"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatAccountType } from "@/lib/utils";
import { ExpenseLinkedTransactions } from "@/components/ExpenseLinkedTransactions";

interface BudgetExpense {
  _id: Id<"budgetItems">;
  name: string;
  amount: number;
  paymentDayOfMonth: number;
  accountId?: Id<"accounts">;
  paidFrom?: string;
  isAutopay?: boolean;
  note?: string;
}

interface BudgetItemManagerProps {
  categoryId: Id<"categories">;
  editItem?: BudgetExpense | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  /** When editing, list payments for this calendar month (`YYYY-MM`). */
  transactionsMonthKey?: string;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function BudgetItemManager({
  categoryId,
  editItem,
  onSuccess,
  onCancel,
  transactionsMonthKey,
}: BudgetItemManagerProps) {
  const { user } = useUser();
  const createItem = useMutation(api.budgetItems.create);
  const updateItem = useMutation(api.budgetItems.update);
  const accounts = useQuery(
    api.accounts.list,
    user ? { userId: user.id } : "skip"
  );
  const accountsSorted = useMemo(
    () =>
      accounts ? [...accounts].sort((a, b) => a.name.localeCompare(b.name)) : [],
    [accounts]
  );

  const [form, setForm] = useState({
    name: editItem?.name ?? "",
    amount: editItem?.amount?.toString() ?? "",
    paymentDayOfMonth: editItem?.paymentDayOfMonth?.toString() ?? "",
    accountId: editItem?.accountId ?? "",
    isAutopay: editItem?.isAutopay === true,
    note: editItem?.note ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amount = parseFloat(form.amount);
    const dueDay = parseInt(form.paymentDayOfMonth, 10);

    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
      setError("Due day must be between 1 and 31");
      return;
    }

    setLoading(true);
    setError("");
    const accountIdVal =
      form.accountId === ""
        ? editItem
          ? null
          : undefined
        : (form.accountId as Id<"accounts">);
    try {
      if (editItem) {
        await updateItem({
          id: editItem._id,
          name: form.name,
          amount,
          paymentDayOfMonth: dueDay,
          accountId: accountIdVal,
          isAutopay: form.isAutopay,
          note: form.note || undefined,
        });
      } else {
        await createItem({
          userId: user.id,
          categoryId,
          name: form.name,
          amount,
          paymentDayOfMonth: dueDay,
          accountId: accountIdVal === null ? undefined : accountIdVal,
          isAutopay: form.isAutopay ? true : undefined,
          note: form.note || undefined,
        });
      }
      onSuccess?.();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const dueDayPreview = parseInt(form.paymentDayOfMonth, 10);

  return (
    <div className="space-y-4">
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label htmlFor="item-name" className="block text-xs font-medium text-slate-600 mb-1">
            Expense name
          </label>
          <input
            id="item-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Rent, Netflix, Electric"
            maxLength={100}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
            required
          />
        </div>

        <div>
          <label htmlFor="item-amount" className="block text-xs font-medium text-slate-600 mb-1">
            Expected Amount ($)
          </label>
          <input
            id="item-amount"
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
            required
          />
        </div>

        <div>
          <label htmlFor="item-due-day" className="block text-xs font-medium text-slate-600 mb-1">
            Due (day of month)
          </label>
          <input
            id="item-due-day"
            type="number"
            min="1"
            max="31"
            value={form.paymentDayOfMonth}
            onChange={(e) => setForm({ ...form, paymentDayOfMonth: e.target.value })}
            placeholder="1–31"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
            required
          />
        </div>

        <div className="col-span-2">
          <label htmlFor="item-account" className="block text-xs font-medium text-slate-600 mb-1">
            Paid from account <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            id="item-account"
            value={form.accountId}
            onChange={(e) => setForm({ ...form, accountId: e.target.value })}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          >
            <option value="">Not set</option>
            {accountsSorted.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name} ({formatAccountType(a.accountType)})
              </option>
            ))}
          </select>
          {accounts !== undefined && accounts.length === 0 && (
            <p className="text-xs text-slate-500 mt-1.5">
              No accounts yet —{" "}
              <Link href="/accounts" className="text-teal-600 font-medium hover:text-teal-700">
                add one
              </Link>{" "}
              to pick where this bill is paid from.
            </p>
          )}
        </div>

        <div className="col-span-2">
          <label htmlFor="item-note" className="block text-xs font-medium text-slate-600 mb-1">
            Note (optional)
          </label>
          <input
            id="item-note"
            type="text"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="e.g. price went up in March"
            maxLength={200}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          />
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
        <input
          type="checkbox"
          checked={form.isAutopay}
          onChange={(e) => setForm({ ...form, isAutopay: e.target.checked })}
          className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        />
        <span>
          <span className="block text-sm font-medium text-slate-700">Auto-pay</span>
          <span className="block text-xs text-slate-500 mt-0.5">
            This bill is set to draft automatically from your bank or card (you still track it here).
          </span>
        </span>
      </label>

      {/* Preview hint */}
      {!isNaN(dueDayPreview) && form.name && (
        <p className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">
          <strong>{form.name}</strong> — due on the <strong>{ordinal(dueDayPreview)}</strong>
          {form.accountId ? (
            <>
              {" "}
              from{" "}
              <strong>
                {accountsSorted.find((a) => a._id === form.accountId)?.name ?? "selected account"}
              </strong>
            </>
          ) : null}
          .
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-teal-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-teal-700 active:scale-[0.97] disabled:opacity-50 transition-all"
        >
          {loading ? "Saving..." : editItem ? "Update expense" : "Add expense"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-2 text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
    {editItem ? (
      <ExpenseLinkedTransactions
        budgetItemId={editItem._id}
        monthKey={transactionsMonthKey}
        className="pt-1"
      />
    ) : null}
    </div>
  );
}
