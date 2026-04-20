"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatAccountType, formatMonth } from "@/lib/utils";
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
  const setFundingTotalForMonth = useMutation(api.expenseAllocations.setTotalForBudgetMonth);
  const upsertActualPaid = useMutation(api.budgetItemMonthOverrides.upsertActualPaid);
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
  const monthAllocations = useQuery(
    api.expenseAllocations.listByUserMonth,
    user && editItem && transactionsMonthKey
      ? { userId: user.id, monthKey: transactionsMonthKey }
      : "skip"
  );
  const monthOverride = useQuery(
    api.budgetItemMonthOverrides.getByBudgetMonth,
    user && editItem && transactionsMonthKey
      ? { userId: user.id, budgetItemId: editItem._id, monthKey: transactionsMonthKey }
      : "skip"
  );
  const fundedThisMonth = useMemo(() => {
    if (!monthAllocations || !editItem) return 0;
    return monthAllocations
      .filter((a) => a.budgetItemId === editItem._id)
      .reduce((s, a) => s + a.amount, 0);
  }, [monthAllocations, editItem]);

  const [monthFundedStr, setMonthFundedStr] = useState("");
  const [actualPaidStr, setActualPaidStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const monthEditorOpen = Boolean(editItem && transactionsMonthKey);
  const monthDataReady =
    !monthEditorOpen ||
    (monthAllocations !== undefined && monthOverride !== undefined);

  useEffect(() => {
    if (!monthEditorOpen || !editItem || !monthDataReady) return;
    setMonthFundedStr(fundedThisMonth.toFixed(2));
    const predicted =
      fundedThisMonth > 0.005 ? fundedThisMonth : editItem.amount;
    const stored = monthOverride?.actualPaidAmount;
    setActualPaidStr((stored ?? predicted).toFixed(2));
  }, [
    monthEditorOpen,
    monthDataReady,
    editItem,
    transactionsMonthKey,
    fundedThisMonth,
    monthOverride,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (monthEditorOpen && !monthDataReady) {
      setError("Still loading this month. Try again in a moment.");
      return;
    }

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
          userId: user.id,
          name: form.name,
          amount,
          paymentDayOfMonth: dueDay,
          accountId: accountIdVal,
          isAutopay: form.isAutopay,
          note: form.note || undefined,
        });
        if (transactionsMonthKey) {
          const fundedRaw = parseFloat(monthFundedStr);
          if (isNaN(fundedRaw) || fundedRaw < 0) {
            setError("Please enter a valid funded amount for this month (0 or more).");
            setLoading(false);
            return;
          }
          await setFundingTotalForMonth({
            userId: user.id,
            budgetItemId: editItem._id,
            monthKey: transactionsMonthKey,
            amount: fundedRaw,
          });
          const actualRaw = parseFloat(actualPaidStr);
          if (isNaN(actualRaw) || actualRaw <= 0) {
            setError("Please enter the actual amount paid (greater than zero).");
            setLoading(false);
            return;
          }
          await upsertActualPaid({
            userId: user.id,
            budgetItemId: editItem._id,
            monthKey: transactionsMonthKey,
            actualPaidAmount: actualRaw,
          });
        }
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
          <label htmlFor="item-name" className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-400">
            Expense name
          </label>
          <input
            id="item-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Rent, Netflix, Electric"
            maxLength={100}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
            required
          />
        </div>

        <div>
          <label htmlFor="item-amount" className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-400">
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
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
            required
          />
        </div>

        <div>
          <label htmlFor="item-due-day" className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-400">
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
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
            required
          />
        </div>

        <div className="col-span-2">
          <label htmlFor="item-account" className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-400">
            Paid from account <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            id="item-account"
            value={form.accountId}
            onChange={(e) => setForm({ ...form, accountId: e.target.value })}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
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
          <label htmlFor="item-note" className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-400">
            Note (optional)
          </label>
          <input
            id="item-note"
            type="text"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="e.g. price went up in March"
            maxLength={200}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
          />
        </div>
      </div>

      {monthEditorOpen ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 space-y-3 dark:border-white/10 dark:bg-slate-800/40">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Timeline month · {formatMonth(transactionsMonthKey!)}
          </p>
          {!monthDataReady ? (
            <p className="text-xs text-slate-500">Loading this month…</p>
          ) : (
            <>
              <div>
                <label
                  htmlFor="item-month-funded"
                  className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-400"
                >
                  Funded for this month ($)
                </label>
                <input
                  id="item-month-funded"
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthFundedStr}
                  onChange={(e) => setMonthFundedStr(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:bg-slate-800"
                />
                <p className="text-[11px] text-slate-500 mt-1 dark:text-slate-400">
                  Cash set aside for this bill in {formatMonth(transactionsMonthKey!)}. Cannot exceed
                  the expected amount above.
                </p>
              </div>
              <div>
                <label
                  htmlFor="item-actual-paid"
                  className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-400"
                >
                  Actual amount paid ($)
                </label>
                <input
                  id="item-actual-paid"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={actualPaidStr}
                  onChange={(e) => setActualPaidStr(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:bg-slate-800"
                />
                <p className="text-[11px] text-slate-500 mt-1 dark:text-slate-400">
                  Defaults to what you funded this month, or the expected bill if nothing is funded
                  yet. Shown on the timeline when this bill is marked paid.
                </p>
              </div>
            </>
          )}
        </div>
      ) : null}

      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 dark:border-white/10 dark:bg-slate-800/40">
        <input
          type="checkbox"
          checked={form.isAutopay}
          onChange={(e) => setForm({ ...form, isAutopay: e.target.checked })}
          className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        />
        <span>
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Auto-pay</span>
          <span className="block text-xs text-slate-500 mt-0.5 dark:text-slate-400">
            This bill is set to draft automatically from your bank or card (you still track it here).
          </span>
        </span>
      </label>

      {/* Preview hint */}
      {!isNaN(dueDayPreview) && form.name && (
        <p className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 dark:bg-teal-950/40 dark:border-teal-800/50 dark:text-teal-300">
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
        <p role="alert" className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || (monthEditorOpen && !monthDataReady)}
          className="flex-1 bg-teal-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-teal-700 active:scale-[0.97] disabled:opacity-50 transition-all"
        >
          {loading ? "Saving..." : editItem ? "Update expense" : "Add expense"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-2 text-sm font-medium hover:bg-slate-200 transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
