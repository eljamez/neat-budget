"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  CREDIT_CARD_USAGE_LABELS,
  type CreditCardUsageModeKey,
  formatAccountType,
} from "@/lib/utils";
import { CATEGORY_COLORS } from "@/lib/icons";

interface CreditCard {
  _id: Id<"creditCards">;
  name: string;
  balance: number;
  usageMode: string;
  aprPercent?: number;
  creditor?: string;
  purpose?: string;
  notes?: string;
  minimumPayment?: number;
  dueDayOfMonth?: number;
  plannedMonthlyPayment?: number;
  creditLimit?: number;
  isAutopay?: boolean;
  color?: string;
  paymentAccountId?: Id<"accounts">;
}

interface CreditCardManagerProps {
  editCard?: CreditCard | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreditCardManager({ editCard, onSuccess, onCancel }: CreditCardManagerProps) {
  const { user } = useUser();
  const accounts = useQuery(api.accounts.list, user ? { userId: user.id } : "skip");
  const createCard = useMutation(api.creditCards.create);
  const updateCard = useMutation(api.creditCards.update);

  const [form, setForm] = useState({
    name: editCard?.name ?? "",
    balance: editCard != null ? String(editCard.balance) : "0",
    usageMode: (editCard?.usageMode &&
    editCard.usageMode in CREDIT_CARD_USAGE_LABELS
      ? editCard.usageMode
      : "active_use") as CreditCardUsageModeKey,
    aprPercent:
      editCard?.aprPercent !== undefined && editCard.aprPercent !== null
        ? String(editCard.aprPercent)
        : "",
    creditor: editCard?.creditor ?? "",
    purpose: editCard?.purpose ?? "",
    notes: editCard?.notes ?? "",
    minimumPayment:
      editCard?.minimumPayment !== undefined && editCard.minimumPayment !== null
        ? String(editCard.minimumPayment)
        : "",
    dueDayOfMonth:
      editCard?.dueDayOfMonth !== undefined ? String(editCard.dueDayOfMonth) : "",
    plannedMonthlyPayment:
      editCard?.plannedMonthlyPayment !== undefined && editCard.plannedMonthlyPayment !== null
        ? String(editCard.plannedMonthlyPayment)
        : "",
    creditLimit:
      editCard?.creditLimit !== undefined && editCard.creditLimit !== null
        ? String(editCard.creditLimit)
        : "",
    isAutopay: editCard?.isAutopay === true,
    color: editCard?.color ?? CATEGORY_COLORS[3],
    paymentAccountId: editCard?.paymentAccountId ?? "",
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

    let creditLimit: number | undefined;
    if (form.creditLimit.trim()) {
      const c = parseFloat(form.creditLimit);
      if (isNaN(c) || c < 0) {
        setError("Credit limit must be a valid amount");
        return;
      }
      creditLimit = c;
    }

    setLoading(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        balance,
        usageMode: form.usageMode,
        aprPercent: apr,
        creditor: form.creditor.trim() || undefined,
        purpose: form.purpose.trim() || undefined,
        notes: form.notes.trim() || undefined,
        minimumPayment: minPay,
        dueDayOfMonth: dueDay,
        plannedMonthlyPayment: planned,
        creditLimit,
        isAutopay: form.isAutopay,
        color: form.color,
      };

      if (editCard) {
        await updateCard({
          id: editCard._id,
          userId: user.id,
          ...payload,
          paymentAccountId:
            form.paymentAccountId === "" ? null : (form.paymentAccountId as Id<"accounts">),
        });
      } else {
        await createCard({
          userId: user.id,
          ...payload,
          ...(form.paymentAccountId
            ? { paymentAccountId: form.paymentAccountId as Id<"accounts"> }
            : {}),
        });
      }
      onSuccess?.();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="cc-name" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
          Card name
        </label>
        <input
          id="cc-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Chase Sapphire, Amex Gold"
          maxLength={120}
          className={inputClass}
          required
        />
      </div>

      <div>
        <label htmlFor="cc-usage" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
          Budget intent
        </label>
        <select
          id="cc-usage"
          value={form.usageMode}
          onChange={(e) =>
            setForm({ ...form, usageMode: e.target.value as CreditCardUsageModeKey })
          }
          className={inputClass}
        >
          {(Object.keys(CREDIT_CARD_USAGE_LABELS) as CreditCardUsageModeKey[]).map((key) => (
            <option key={key} value={key}>
              {CREDIT_CARD_USAGE_LABELS[key]}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
          <strong className="text-slate-500 dark:text-slate-400">Using for bills</strong> — you charge expenses and pay the
          card. <strong className="text-slate-500 dark:text-slate-400">Paying off</strong> — you&apos;re focused on clearing a balance
          (still link payments when you pay the issuer).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cc-balance" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            Balance owed ($)
          </label>
          <input
            id="cc-balance"
            type="number"
            step="0.01"
            min="0"
            value={form.balance}
            onChange={(e) => setForm({ ...form, balance: e.target.value })}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="cc-limit" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            Credit limit ($) <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="cc-limit"
            type="number"
            step="0.01"
            min="0"
            value={form.creditLimit}
            onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
            placeholder="Total line"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cc-apr" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            APR % <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="cc-apr"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.aprPercent}
            onChange={(e) => setForm({ ...form, aprPercent: e.target.value })}
            placeholder="e.g. 22.99"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="cc-min" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            Minimum payment/mo <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="cc-min"
            type="number"
            step="0.01"
            min="0"
            value={form.minimumPayment}
            onChange={(e) => setForm({ ...form, minimumPayment: e.target.value })}
            placeholder="0"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cc-creditor" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            Issuer
          </label>
          <input
            id="cc-creditor"
            type="text"
            value={form.creditor}
            onChange={(e) => setForm({ ...form, creditor: e.target.value })}
            placeholder="e.g. Chase, Amex"
            maxLength={120}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="cc-due" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            Typical due day <span className="text-slate-400 font-normal">(1–31)</span>
          </label>
          <input
            id="cc-due"
            type="number"
            min={1}
            max={31}
            value={form.dueDayOfMonth}
            onChange={(e) => setForm({ ...form, dueDayOfMonth: e.target.value })}
            placeholder="e.g. 15"
            className={inputClass}
          />
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/50 px-3 py-3">
        <input
          type="checkbox"
          checked={form.isAutopay}
          onChange={(e) => setForm({ ...form, isAutopay: e.target.checked })}
          className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
        />
        <span>
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Auto-pay</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Statement or minimum is set to auto-pay with the issuer (you still track it here).
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="cc-pay-from" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
          Pay card bill from <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <select
          id="cc-pay-from"
          value={form.paymentAccountId}
          onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}
          disabled={accounts === undefined}
          className={`${inputClass} disabled:opacity-60`}
        >
          <option value="">Not set — choose when logging payment</option>
          {(accounts ?? [])
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((a) => (
              <option key={a._id} value={a._id}>
                {a.name} ({formatAccountType(a.accountType)})
              </option>
            ))}
        </select>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
          Checking or savings you use to pay this issuer — not the card&apos;s balance account.
        </p>
      </div>

      <div>
        <label htmlFor="cc-purpose" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
          Note <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          id="cc-purpose"
          type="text"
          value={form.purpose}
          onChange={(e) => setForm({ ...form, purpose: e.target.value })}
          placeholder="e.g. travel points, 0% promo"
          maxLength={200}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="cc-planned" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
          Planned monthly payment <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          id="cc-planned"
          type="number"
          step="0.01"
          min="0"
          value={form.plannedMonthlyPayment}
          onChange={(e) => setForm({ ...form, plannedMonthlyPayment: e.target.value })}
          placeholder="Paydown or amount to pay toward the bill"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="cc-notes" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
          Notes <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="cc-notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          maxLength={500}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Color</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Card color">
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

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Balance also goes down when you add a transaction and link this card as a payment. Edit the
        balance here to match your issuer.
      </p>

      {error && (
        <p role="alert" className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-teal-700 active:scale-[0.97] disabled:opacity-50 transition-all"
        >
          {loading ? "Saving..." : editCard ? "Update card" : "Add card"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
