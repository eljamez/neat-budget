"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/utils";

export interface TransactionFormProps {
  onSuccess?: () => void;
  /** Preselect e.g. `category:${id}`, `debt:${id}`, or `cc:${id}` */
  defaultPayee?: string;
  /** When set, the form saves changes to this row instead of creating one. */
  editTransaction?: Doc<"transactions">;
}

export function TransactionForm({
  onSuccess,
  defaultPayee,
  editTransaction,
}: TransactionFormProps) {
  const { user } = useUser();
  const groups = useQuery(api.groups.list, user?.id ? { userId: user.id } : "skip");
  const categories = useQuery(api.categories.list, user?.id ? { userId: user.id } : "skip");
  const accounts = useQuery(api.accounts.list, user?.id ? { userId: user.id } : "skip");
  const debts = useQuery(api.debts.list, user?.id ? { userId: user.id } : "skip");
  const creditCards = useQuery(api.creditCards.list, user?.id ? { userId: user.id } : "skip");
  const createTransaction = useMutation(api.transactions.create);
  const updateTransaction = useMutation(api.transactions.update);

  const [payeeKey, setPayeeKey] = useState(defaultPayee ?? "");
  const [form, setForm] = useState({
    accountId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    note: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editTransaction) return;
    const payee = editTransaction.categoryId
      ? `category:${editTransaction.categoryId}`
      : editTransaction.debtId
        ? `debt:${editTransaction.debtId}`
        : editTransaction.creditCardId
          ? `cc:${editTransaction.creditCardId}`
          : "";
    setPayeeKey(payee);
    setForm({
      accountId: editTransaction.accountId ?? "",
      amount: String(editTransaction.amount),
      date: editTransaction.date,
      note: editTransaction.note ?? "",
    });
    setError("");
  }, [editTransaction]);

  useEffect(() => {
    if (editTransaction) return;
    let acc = "";
    if (payeeKey.startsWith("category:")) {
      const id = payeeKey.slice("category:".length);
      const c = categories?.find((x) => x._id === id);
      acc = c?.paymentAccountId ? String(c.paymentAccountId) : "";
    } else if (payeeKey.startsWith("debt:")) {
      const id = payeeKey.slice("debt:".length);
      const d = debts?.find((x) => x._id === id);
      acc = d?.paymentAccountId ? String(d.paymentAccountId) : "";
    } else if (payeeKey.startsWith("cc:")) {
      const id = payeeKey.slice("cc:".length);
      const c = creditCards?.find((x) => x._id === id);
      acc = c?.paymentAccountId ? String(c.paymentAccountId) : "";
    }
    setForm((f) => (f.accountId === acc ? f : { ...f, accountId: acc }));
  }, [payeeKey, editTransaction, categories, debts, creditCards]);

  const groupNameById = useMemo(() => {
    if (!groups) return {} as Record<string, string>;
    return Object.fromEntries(groups.map((g) => [g._id, g.name]));
  }, [groups]);

  const payeeOptions = useMemo(() => {
    type Opt = { value: string; label: string; group: string };
    const out: Opt[] = [];

    if (categories?.length) {
      const activeCategories = [...categories].filter((c) => !c.isArchived);
      for (const cat of activeCategories) {
        const groupName = cat.groupId ? (groupNameById[cat.groupId as string] ?? "Other") : "Other";
        out.push({
          value: `category:${cat._id}`,
          label: cat.monthlyTarget
            ? `${cat.name} · ${formatCurrency(cat.monthlyTarget)}/mo`
            : cat.name,
          group: groupName,
        });
      }
    }

    if (creditCards?.length) {
      for (const c of creditCards.filter((x) => !x.isArchived)) {
        out.push({
          value: `cc:${c._id}`,
          label: `${c.name} · owed ${formatCurrency(c.balance)}`,
          group: "Credit card payments",
        });
      }
    }

    if (debts?.length) {
      for (const d of debts.filter((x) => !x.isArchived)) {
        out.push({
          value: `debt:${d._id}`,
          label: `${d.name} · owed ${formatCurrency(d.balance)}`,
          group: "Loan / debt payments",
        });
      }
    }

    out.sort((a, b) => {
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      return a.label.localeCompare(b.label);
    });
    return out;
  }, [categories, creditCards, debts, groupNameById]);

  const groupedSelect = useMemo(() => {
    const groupKeys: string[] = [];
    const byGroup = new Map<string, typeof payeeOptions>();
    for (const o of payeeOptions) {
      if (!byGroup.has(o.group)) {
        byGroup.set(o.group, []);
        groupKeys.push(o.group);
      }
      byGroup.get(o.group)!.push(o);
    }
    return groupKeys.map((g) => ({ group: g, options: byGroup.get(g)! }));
  }, [payeeOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let categoryId: Id<"categories"> | undefined;
    let debtId: Id<"debts"> | undefined;
    let creditCardId: Id<"creditCards"> | undefined;

    if (payeeKey.startsWith("category:")) {
      categoryId = payeeKey.slice("category:".length) as Id<"categories">;
    } else if (payeeKey.startsWith("debt:")) {
      debtId = payeeKey.slice("debt:".length) as Id<"debts">;
    } else if (payeeKey.startsWith("cc:")) {
      creditCardId = payeeKey.slice("cc:".length) as Id<"creditCards">;
    } else {
      setError("Choose a category, card, or loan for this transaction");
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
      const note = form.note.trim() ? form.note.trim() : undefined;
      const accountId = form.accountId ? (form.accountId as Id<"accounts">) : undefined;
      if (editTransaction) {
        await updateTransaction({
          id: editTransaction._id,
          userId: user.id,
          amount,
          date: form.date,
          note,
          accountId,
          categoryId,
          debtId,
          creditCardId,
        });
      } else {
        await createTransaction({
          userId: user.id,
          amount,
          date: form.date,
          note,
          accountId,
          categoryId,
          debtId,
          creditCardId,
        });
        setPayeeKey(defaultPayee ?? "");
        setForm({
          accountId: "",
          amount: "",
          date: new Date().toISOString().split("T")[0],
          note: "",
        });
      }
      onSuccess?.();
    } catch {
      setError(
        editTransaction
          ? "Failed to update transaction. Please try again."
          : "Failed to add transaction. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const noPayees =
    (categories?.filter((x) => !x.isArchived).length ?? 0) === 0 &&
    (creditCards?.filter((x) => !x.isArchived).length ?? 0) === 0 &&
    (debts?.filter((x) => !x.isArchived).length ?? 0) === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="tx-date" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
          Date
        </label>
        <input
          id="tx-date"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors"
          required
        />
      </div>

      {accounts !== undefined && accounts.length > 0 && (
        <div>
          <label htmlFor="tx-account" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            Paid from <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            id="tx-account"
            value={form.accountId}
            onChange={(e) => setForm({ ...form, accountId: e.target.value })}
            className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors"
          >
            <option value="">Don&apos;t link — balance won&apos;t change</option>
            {accounts.map((acc) => (
              <option key={acc._id} value={acc._id}>
                {acc.name} · {formatCurrency(acc.balance)}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
            Linking updates that account&apos;s balance (checking goes down; credit card balance owed
            goes up when it&apos;s a card account).
          </p>
        </div>
      )}

      <div>
        <label htmlFor="tx-payee" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
          Category
        </label>
        {noPayees ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5">
            Add a budget category, a debt, or a credit card first — then you can log spending here.
          </p>
        ) : (
          <select
            id="tx-payee"
            value={payeeKey}
            onChange={(e) => setPayeeKey(e.target.value)}
            className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            required
          >
            <option value="">Select a category, card, or loan…</option>
            {groupedSelect.map(({ group, options }) => (
              <optgroup key={group} label={group}>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      <div>
        <label htmlFor="tx-amount" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
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
          className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors"
          required
        />
      </div>

      <div>
        <label htmlFor="tx-note" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
          Note <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="tx-note"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="Anything you want to remember about this payment…"
          rows={2}
          maxLength={500}
          className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors resize-none"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || noPayees}
        className="w-full bg-teal-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-teal-700 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
      >
        {loading
          ? editTransaction
            ? "Saving..."
            : "Adding..."
          : editTransaction
            ? "Save changes"
            : "Add Transaction"}
      </button>
    </form>
  );
}
