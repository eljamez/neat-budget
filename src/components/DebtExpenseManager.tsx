"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface DebtExpenseRow {
  _id: Id<"debtExpenses">;
  name: string;
  amount: number;
  dueDate: string;
  note?: string;
}

interface DebtExpenseManagerProps {
  debtId: Id<"debts">;
  editItem?: DebtExpenseRow | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DebtExpenseManager({
  debtId,
  editItem,
  onSuccess,
  onCancel,
}: DebtExpenseManagerProps) {
  const { user } = useUser();
  const createRow = useMutation(api.debtExpenses.create);
  const updateRow = useMutation(api.debtExpenses.update);

  const [form, setForm] = useState({
    name: editItem?.name ?? "",
    amount: editItem != null ? String(editItem.amount) : "",
    dueDate: editItem?.dueDate ?? new Date().toISOString().split("T")[0],
    note: editItem?.note ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!form.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) {
      setError("Choose a valid due date");
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (editItem) {
        await updateRow({
          id: editItem._id,
          userId: user.id,
          name: form.name.trim(),
          amount,
          dueDate: form.dueDate,
          note: form.note.trim() || undefined,
        });
      } else {
        await createRow({
          userId: user.id,
          debtId,
          name: form.name.trim(),
          amount,
          dueDate: form.dueDate,
          note: form.note.trim() || undefined,
        });
      }
      onSuccess?.();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="dexp-name" className="block text-xs font-medium text-slate-600 mb-1">
          Payment / expense name
        </label>
        <input
          id="dexp-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. March minimum, Extra paydown"
          maxLength={100}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="dexp-amt" className="block text-xs font-medium text-slate-600 mb-1">
            Amount ($)
          </label>
          <input
            id="dexp-amt"
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white"
            required
          />
        </div>
        <div>
          <label htmlFor="dexp-due" className="block text-xs font-medium text-slate-600 mb-1">
            Due date
          </label>
          <input
            id="dexp-due"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white"
            required
          />
        </div>
      </div>
      <div>
        <label htmlFor="dexp-note" className="block text-xs font-medium text-slate-600 mb-1">
          Note (optional)
        </label>
        <input
          id="dexp-note"
          type="text"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          maxLength={200}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-teal-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : editItem ? "Update" : "Add scheduled payment"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-2 text-sm font-medium"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
