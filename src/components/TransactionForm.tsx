"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/utils";

interface TransactionFormProps {
  onSuccess?: () => void;
  defaultCategoryId?: Id<"categories">;
}

export function TransactionForm({ onSuccess, defaultCategoryId }: TransactionFormProps) {
  const { user } = useUser();
  const categories = useQuery(api.categories.list, {
    userId: user?.id ?? "",
  });
  const accounts = useQuery(
    api.accounts.list,
    user?.id ? { userId: user.id } : "skip"
  );
  const debts = useQuery(api.debts.list, user?.id ? { userId: user.id } : "skip");
  const creditCards = useQuery(api.creditCards.list, user?.id ? { userId: user.id } : "skip");
  const createTransaction = useMutation(api.transactions.create);

  const [form, setForm] = useState({
    categoryId: defaultCategoryId ?? "",
    accountId: "",
    debtId: "",
    creditCardId: "",
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    note: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.categoryId) {
      setError("Please select a category");
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await createTransaction({
        userId: user.id,
        categoryId: form.categoryId as Id<"categories">,
        amount,
        description: form.description,
        date: form.date,
        note: form.note || undefined,
        accountId: form.accountId
          ? (form.accountId as Id<"accounts">)
          : undefined,
        debtId: form.debtId ? (form.debtId as Id<"debts">) : undefined,
        creditCardId: form.creditCardId
          ? (form.creditCardId as Id<"creditCards">)
          : undefined,
      });
      setForm({
        categoryId: defaultCategoryId ?? "",
        accountId: "",
        debtId: "",
        creditCardId: "",
        amount: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
        note: "",
      });
      onSuccess?.();
    } catch (err) {
      setError("Failed to add transaction. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="tx-category" className="block text-sm font-medium text-slate-600 mb-1.5">
          Category
        </label>
        <select
          id="tx-category"
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          required
        >
          <option value="">Select a category...</option>
          {categories?.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {accounts !== undefined && accounts.length > 0 && (
        <div>
          <label htmlFor="tx-account" className="block text-sm font-medium text-slate-600 mb-1.5">
            Paid from <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            id="tx-account"
            value={form.accountId}
            onChange={(e) => setForm({ ...form, accountId: e.target.value })}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          >
            <option value="">Don&apos;t link — balance won&apos;t change</option>
            {accounts.map((acc) => (
              <option key={acc._id} value={acc._id}>
                {acc.name} · {formatCurrency(acc.balance)}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1.5">
            Linking updates that account&apos;s balance for this expense (checking goes down; credit card
            owed amount goes up).
          </p>
        </div>
      )}

      {creditCards !== undefined && creditCards.length > 0 && (
        <div>
          <label htmlFor="tx-cc" className="block text-sm font-medium text-slate-600 mb-1.5">
            Pay toward credit card <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            id="tx-cc"
            value={form.creditCardId}
            onChange={(e) =>
              setForm({
                ...form,
                creditCardId: e.target.value,
                debtId: e.target.value ? "" : form.debtId,
              })
            }
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          >
            <option value="">None — not a card payment</option>
            {creditCards.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} · owed {formatCurrency(c.balance)}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1.5">
            Reduces that card&apos;s balance. Can&apos;t combine with a loan/debt payment on the same
            transaction.
          </p>
        </div>
      )}

      {debts !== undefined && debts.length > 0 && (
        <div>
          <label htmlFor="tx-debt" className="block text-sm font-medium text-slate-600 mb-1.5">
            Pay toward loan / debt <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            id="tx-debt"
            value={form.debtId}
            onChange={(e) =>
              setForm({
                ...form,
                debtId: e.target.value,
                creditCardId: e.target.value ? "" : form.creditCardId,
              })
            }
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          >
            <option value="">None — not a loan payment</option>
            {debts.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} · owed {formatCurrency(d.balance)}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1.5">
            Reduces that debt&apos;s balance. Pick a category so your budget reflects the payment.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="tx-amount" className="block text-sm font-medium text-slate-600 mb-1.5">
          Amount ($)
        </label>
        <input
          id="tx-amount"
          type="number"
          step="0.01"
          min="0.01"
          max="9999999"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          placeholder="0.00"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          required
        />
      </div>

      <div>
        <label htmlFor="tx-description" className="block text-sm font-medium text-slate-600 mb-1.5">
          Description
        </label>
        <input
          id="tx-description"
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="e.g. Grocery run, Netflix subscription..."
          maxLength={200}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          required
        />
      </div>

      <div>
        <label htmlFor="tx-date" className="block text-sm font-medium text-slate-600 mb-1.5">
          Date
        </label>
        <input
          id="tx-date"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          required
        />
      </div>

      <div>
        <label htmlFor="tx-note" className="block text-sm font-medium text-slate-600 mb-1.5">
          Note (optional)
        </label>
        <textarea
          id="tx-note"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="Any additional details..."
          rows={2}
          maxLength={500}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors resize-none"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-teal-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-teal-700 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
      >
        {loading ? "Adding..." : "Add Transaction"}
      </button>
    </form>
  );
}
