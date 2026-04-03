"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { Bucket, BucketPeriod } from "@/types/bucket";
import { formatAccountType } from "@/lib/utils";

const PERIOD_OPTIONS: { value: BucketPeriod; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every two weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

interface BucketManagerProps {
  editBucket?: Bucket | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function BucketManager({ editBucket, onSuccess, onCancel }: BucketManagerProps) {
  const { user } = useUser();
  const categories = useQuery(api.categories.list, user ? { userId: user.id } : "skip");
  const accounts = useQuery(api.accounts.list, user ? { userId: user.id } : "skip");
  const createBucket = useMutation(api.buckets.createBucket);
  const updateBucket = useMutation(api.buckets.updateBucket);

  const [form, setForm] = useState({
    name: editBucket?.name ?? "",
    targetAmount: editBucket != null ? String(editBucket.targetAmount) : "",
    period: (editBucket?.period ?? "monthly") as BucketPeriod,
    rollover: editBucket?.rollover ?? false,
    categoryId: (editBucket?.categoryId ?? "") as string,
    note: editBucket?.note ?? "",
    monthlyFillGoal:
      editBucket?.monthlyFillGoal != null && editBucket.monthlyFillGoal >= 0
        ? String(editBucket.monthlyFillGoal)
        : "",
    paymentAccountId: editBucket?.paymentAccountId ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const target = parseFloat(form.targetAmount);
    if (isNaN(target) || target < 0) {
      setError("Enter a valid target amount (0 or more)");
      return;
    }

    let monthlyFill: number | undefined;
    if (form.period === "monthly" && form.monthlyFillGoal.trim()) {
      const m = parseFloat(form.monthlyFillGoal);
      if (isNaN(m) || m < 0) {
        setError("Monthly fill amount must be 0 or more");
        return;
      }
      monthlyFill = m;
    }

    setLoading(true);
    setError("");
    try {
      const categoryId = form.categoryId
        ? (form.categoryId as Id<"categories">)
        : undefined;

      if (editBucket) {
        await updateBucket({
          id: editBucket._id,
          userId: user.id,
          name: form.name,
          targetAmount: target,
          period: form.period,
          rollover: form.rollover,
          categoryId: categoryId ?? null,
          note: form.note.trim(),
          monthlyFillGoal:
            form.period === "monthly"
              ? form.monthlyFillGoal.trim()
                ? monthlyFill
                : null
              : null,
          paymentAccountId:
            form.paymentAccountId === ""
              ? null
              : (form.paymentAccountId as Id<"accounts">),
        });
      } else {
        await createBucket({
          userId: user.id,
          name: form.name,
          targetAmount: target,
          period: form.period,
          rollover: form.rollover,
          ...(categoryId ? { categoryId } : {}),
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
          ...(form.period === "monthly" && monthlyFill !== undefined ? { monthlyFillGoal: monthlyFill } : {}),
          ...(form.paymentAccountId
            ? { paymentAccountId: form.paymentAccountId as Id<"accounts"> }
            : {}),
        });
      }
      onSuccess?.();
    } catch {
      setError("Could not save this bucket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="bucket-name" className="block text-sm font-medium text-slate-600 mb-1.5">
          Bucket name
        </label>
        <input
          id="bucket-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Groceries, Fun money"
          maxLength={120}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          required
        />
      </div>

      <div>
        <label htmlFor="bucket-target" className="block text-sm font-medium text-slate-600 mb-1.5">
          Target amount ($)
        </label>
        <input
          id="bucket-target"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={form.targetAmount}
          onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
          placeholder="0.00"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          required
        />
        <p className="text-xs text-slate-400 mt-1.5">
          Spending progress against this amount is tracked per period in the app; this is a goal, not
          a fixed bill.
        </p>
      </div>

      {form.period === "monthly" && (
        <div>
          <label
            htmlFor="bucket-monthly-fill"
            className="block text-sm font-medium text-slate-600 mb-1.5"
          >
            Monthly fill cap ($) <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="bucket-monthly-fill"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.monthlyFillGoal}
            onChange={(e) => setForm({ ...form, monthlyFillGoal: e.target.value })}
            placeholder={`If empty, fill cap matches target (${form.targetAmount || "0"})`}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            Max cash you plan to earmark from your accounts for this bucket each month. Can differ from
            the spending target above.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="bucket-pay-acct" className="block text-sm font-medium text-slate-600 mb-1.5">
          Default fund from <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <select
          id="bucket-pay-acct"
          value={form.paymentAccountId}
          onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}
          disabled={accounts === undefined}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors disabled:opacity-60"
        >
          <option value="">None — choose when funding</option>
          {(accounts ?? [])
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((a) => (
              <option key={a._id} value={a._id}>
                {a.name} ({formatAccountType(a.accountType)})
              </option>
            ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="bucket-period" className="block text-sm font-medium text-slate-600 mb-1.5">
            Period
          </label>
          <select
            id="bucket-period"
            value={form.period}
            onChange={(e) =>
              setForm({ ...form, period: e.target.value as BucketPeriod })
            }
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.rollover}
              onChange={(e) => setForm({ ...form, rollover: e.target.checked })}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm font-medium text-slate-700">Roll over unused balance</span>
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="bucket-category" className="block text-sm font-medium text-slate-600 mb-1.5">
          Link to category (optional)
        </label>
        <select
          id="bucket-category"
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          disabled={categories === undefined}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors disabled:opacity-60"
        >
          <option value="">None</option>
          {(categories ?? []).map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="bucket-note" className="block text-sm font-medium text-slate-600 mb-1.5">
          Note (optional)
        </label>
        <textarea
          id="bucket-note"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          rows={2}
          maxLength={500}
          placeholder="Any context for future you…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors resize-y min-h-[4rem]"
        />
      </div>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="bg-teal-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Saving…" : editBucket ? "Save changes" : "Create bucket"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
