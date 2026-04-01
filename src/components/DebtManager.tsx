"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { DEBT_TYPE_LABELS, type WritableDebtTypeKey } from "@/lib/utils";
import { CATEGORY_COLORS } from "@/lib/icons";

interface Debt {
  _id: Id<"debts">;
  name: string;
  balance: number;
  debtType: string;
  aprPercent?: number;
  creditor?: string;
  purpose?: string;
  notes?: string;
  minimumPayment?: number;
  dueDayOfMonth?: number;
  plannedMonthlyPayment?: number;
  isAutopay?: boolean;
  color?: string;
}

interface DebtManagerProps {
  editDebt?: Debt | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DebtManager({ editDebt, onSuccess, onCancel }: DebtManagerProps) {
  const { user } = useUser();
  const createDebt = useMutation(api.debts.create);
  const updateDebt = useMutation(api.debts.update);

  const [form, setForm] = useState({
    name: editDebt?.name ?? "",
    balance: editDebt != null ? String(editDebt.balance) : "0",
    debtType: (
      editDebt?.debtType &&
      editDebt.debtType !== "credit_card" &&
      editDebt.debtType in DEBT_TYPE_LABELS
        ? editDebt.debtType
        : "loan"
    ) as WritableDebtTypeKey,
    aprPercent:
      editDebt?.aprPercent !== undefined && editDebt.aprPercent !== null
        ? String(editDebt.aprPercent)
        : "",
    creditor: editDebt?.creditor ?? "",
    purpose: editDebt?.purpose ?? "",
    notes: editDebt?.notes ?? "",
    minimumPayment:
      editDebt?.minimumPayment !== undefined && editDebt.minimumPayment !== null
        ? String(editDebt.minimumPayment)
        : "",
    dueDayOfMonth:
      editDebt?.dueDayOfMonth !== undefined ? String(editDebt.dueDayOfMonth) : "",
    plannedMonthlyPayment:
      editDebt?.plannedMonthlyPayment !== undefined && editDebt.plannedMonthlyPayment !== null
        ? String(editDebt.plannedMonthlyPayment)
        : "",
    isAutopay: editDebt?.isAutopay === true,
    color: editDebt?.color ?? CATEGORY_COLORS[5],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const balance = parseFloat(form.balance);
    if (isNaN(balance) || balance < 0) {
      setError("Enter a valid balance owed (0 or more)");
      return;
    }

    let apr: number | undefined;
    if (form.aprPercent.trim()) {
      const a = parseFloat(form.aprPercent);
      if (isNaN(a) || a < 0 || a > 100) {
        setError("APR must be between 0 and 100 (e.g. 19.99)");
        return;
      }
      apr = a;
    }

    let minPay: number | undefined;
    if (form.minimumPayment.trim()) {
      const m = parseFloat(form.minimumPayment);
      if (isNaN(m) || m < 0) {
        setError("Minimum payment must be a valid amount");
        return;
      }
      minPay = m;
    }

    let dueDay: number | undefined;
    if (form.dueDayOfMonth.trim()) {
      const d = parseInt(form.dueDayOfMonth, 10);
      if (isNaN(d) || d < 1 || d > 31) {
        setError("Due day must be 1–31");
        return;
      }
      dueDay = d;
    }

    let planned: number | undefined;
    if (form.plannedMonthlyPayment.trim()) {
      const p = parseFloat(form.plannedMonthlyPayment);
      if (isNaN(p) || p < 0) {
        setError("Planned monthly payment must be valid");
        return;
      }
      planned = p;
    }

    setLoading(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        balance,
        debtType: form.debtType,
        aprPercent: apr,
        creditor: form.creditor.trim() || undefined,
        purpose: form.purpose.trim() || undefined,
        notes: form.notes.trim() || undefined,
        minimumPayment: minPay,
        dueDayOfMonth: dueDay,
        plannedMonthlyPayment: planned,
        isAutopay: form.isAutopay,
        color: form.color,
      };

      if (editDebt) {
        await updateDebt({ id: editDebt._id, userId: user.id, ...payload });
      } else {
        await createDebt({ userId: user.id, ...payload });
      }
      onSuccess?.();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {editDebt?.debtType === "credit_card" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          This row is a <strong className="font-semibold">legacy credit card</strong> on the debts table.
          Add the real account on <strong className="font-semibold">Credit cards</strong>, then archive this
          debt—or change the type below and save.
        </div>
      )}
      <div>
        <label htmlFor="debt-name" className="block text-sm font-medium text-slate-600 mb-1.5">
          Debt name
        </label>
        <input
          id="debt-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Car loan, SoFi personal"
          maxLength={120}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="debt-type" className="block text-sm font-medium text-slate-600 mb-1.5">
            Type
          </label>
          <select
            id="debt-type"
            value={form.debtType}
            onChange={(e) =>
              setForm({ ...form, debtType: e.target.value as WritableDebtTypeKey })
            }
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          >
            {(
              Object.keys(DEBT_TYPE_LABELS).filter(
                (key): key is WritableDebtTypeKey => key !== "credit_card"
              )
            ).map((key) => (
                <option key={key} value={key}>
                  {DEBT_TYPE_LABELS[key]}
                </option>
              ))}
          </select>
          <p className="text-xs text-slate-400 mt-1.5">
            Credit cards live on the <strong className="text-slate-500">Credit cards</strong> page.
          </p>
        </div>
        <div>
          <label htmlFor="debt-balance" className="block text-sm font-medium text-slate-600 mb-1.5">
            Balance owed ($)
          </label>
          <input
            id="debt-balance"
            type="number"
            step="0.01"
            min="0"
            value={form.balance}
            onChange={(e) => setForm({ ...form, balance: e.target.value })}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="debt-apr" className="block text-sm font-medium text-slate-600 mb-1.5">
            APR % <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="debt-apr"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.aprPercent}
            onChange={(e) => setForm({ ...form, aprPercent: e.target.value })}
            placeholder="e.g. 22.99"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          />
        </div>
        <div>
          <label htmlFor="debt-min" className="block text-sm font-medium text-slate-600 mb-1.5">
            Minimum payment/mo <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="debt-min"
            type="number"
            step="0.01"
            min="0"
            value={form.minimumPayment}
            onChange={(e) => setForm({ ...form, minimumPayment: e.target.value })}
            placeholder="0"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="debt-creditor" className="block text-sm font-medium text-slate-600 mb-1.5">
            Lender
          </label>
          <input
            id="debt-creditor"
            type="text"
            value={form.creditor}
            onChange={(e) => setForm({ ...form, creditor: e.target.value })}
            placeholder="e.g. Chase, SoFi"
            maxLength={120}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          />
        </div>
        <div>
          <label htmlFor="debt-due" className="block text-sm font-medium text-slate-600 mb-1.5">
            Typical due day <span className="text-slate-400 font-normal">(1–31)</span>
          </label>
          <input
            id="debt-due"
            type="number"
            min={1}
            max={31}
            value={form.dueDayOfMonth}
            onChange={(e) => setForm({ ...form, dueDayOfMonth: e.target.value })}
            placeholder="e.g. 15"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
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
            Typical payment is scheduled with the lender (you still track it here).
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="debt-purpose" className="block text-sm font-medium text-slate-600 mb-1.5">
          What it&apos;s for <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          id="debt-purpose"
          type="text"
          value={form.purpose}
          onChange={(e) => setForm({ ...form, purpose: e.target.value })}
          placeholder="e.g. balance transfer, 2021 Civic"
          maxLength={200}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
        />
      </div>

      <div>
        <label htmlFor="debt-planned" className="block text-sm font-medium text-slate-600 mb-1.5">
          Planned monthly paydown <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          id="debt-planned"
          type="number"
          step="0.01"
          min="0"
          value={form.plannedMonthlyPayment}
          onChange={(e) => setForm({ ...form, plannedMonthlyPayment: e.target.value })}
          placeholder="For budget planning"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
        />
      </div>

      <div>
        <label htmlFor="debt-notes" className="block text-sm font-medium text-slate-600 mb-1.5">
          Notes <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="debt-notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          maxLength={500}
          placeholder="Promo rate end date, account number hint, etc."
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors resize-none"
        />
      </div>

      <div>
        <p className="text-sm font-medium text-slate-600 mb-2">Color</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Debt color">
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setForm({ ...form, color })}
              aria-pressed={form.color === color}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                form.color === color
                  ? "border-slate-700 scale-110 ring-2 ring-offset-1 ring-slate-300"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Balance also goes down when you add a transaction and link this debt as a payment. Edit the
        balance here if it doesn&apos;t match your lender.
      </p>

      {error && (
        <p role="alert" className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-teal-700 active:scale-[0.97] disabled:opacity-50 transition-all"
        >
          {loading ? "Saving..." : editDebt ? "Update debt" : "Add debt"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
