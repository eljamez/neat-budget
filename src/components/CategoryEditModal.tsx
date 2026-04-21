"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ToggleLeft, ToggleRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type CategoryProgressForEdit = {
  category: {
    _id: Id<"categories">;
    name: string;
    groupId?: Id<"groups"> | string | null;
    monthlyTarget?: number;
    rollover?: boolean;
    color?: string;
    icon?: string;
    note?: string;
    dueDayOfMonth?: number;
    paymentAccountId?: string;
    isAutopay?: boolean;
    markedPaidForMonth?: string;
  };
  spent?: number;
  target?: number | null;
  remaining?: number | null;
};

interface CategoryEditModalProps {
  /** Pass null to create a new category. */
  editProgress: CategoryProgressForEdit | null;
  defaultGroupId?: Id<"groups"> | null;
  onSuccess: () => void;
  onClose: () => void;
}

export function CategoryEditModal({
  editProgress,
  defaultGroupId,
  onSuccess,
  onClose,
}: CategoryEditModalProps) {
  const { user } = useUser();
  const userId = user?.id;

  const groups = useQuery(api.groups.list, userId ? { userId } : "skip");
  const accounts = useQuery(api.accounts.list, userId ? { userId } : "skip");
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);

  const editCat = editProgress?.category;

  const resolvedDefaultGroupId =
    editCat?.groupId ??
    defaultGroupId ??
    (groups?.[0]?._id ?? null);

  const [name, setName] = useState(editCat?.name ?? "");
  const [groupId, setGroupId] = useState<Id<"groups"> | "">(
    resolvedDefaultGroupId as Id<"groups"> | ""
  );
  const [monthlyTarget, setMonthlyTarget] = useState(
    editCat?.monthlyTarget != null ? String(editCat.monthlyTarget) : ""
  );
  const [rollover, setRollover] = useState(editCat?.rollover ?? false);
  const [note, setNote] = useState(editCat?.note ?? "");
  const [dueDay, setDueDay] = useState(
    editCat?.dueDayOfMonth != null ? String(editCat.dueDayOfMonth) : ""
  );
  const [paymentAccountId, setPaymentAccountId] = useState<string>(
    editCat?.paymentAccountId ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !name.trim() || !groupId) return;
    const target = monthlyTarget.trim() ? parseFloat(monthlyTarget) : undefined;
    if (target !== undefined && (isNaN(target) || target < 0)) {
      setError("Monthly target must be a positive number");
      return;
    }
    const dueDayParsed = dueDay.trim() ? parseInt(dueDay, 10) : undefined;
    if (
      dueDayParsed !== undefined &&
      (isNaN(dueDayParsed) || dueDayParsed < 1 || dueDayParsed > 31)
    ) {
      setError("Due day must be between 1 and 31");
      return;
    }
    const resolvedPaymentAccountId = paymentAccountId
      ? (paymentAccountId as Id<"accounts">)
      : undefined;
    setLoading(true);
    setError("");
    try {
      if (editCat) {
        await updateCategory({
          id: editCat._id,
          userId,
          name: name.trim(),
          groupId: groupId as Id<"groups">,
          monthlyTarget: target,
          rollover,
          note: note.trim() || undefined,
          dueDayOfMonth: dueDayParsed,
          paymentAccountId: resolvedPaymentAccountId,
        });
      } else {
        await createCategory({
          userId,
          groupId: groupId as Id<"groups">,
          name: name.trim(),
          monthlyTarget: target,
          rollover,
          note: note.trim() || undefined,
          dueDayOfMonth: dueDayParsed,
          paymentAccountId: resolvedPaymentAccountId,
        });
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-edit-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="category-edit-modal-title"
          className="font-heading font-semibold text-slate-800 dark:text-slate-100 mb-5"
        >
          {editCat ? "Edit category" : "New category"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Group
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value as Id<"groups">)}
              required
              className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            >
              {(groups ?? []).map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Name
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rent, Groceries"
              maxLength={80}
              required
              className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Monthly target{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monthlyTarget}
              onChange={(e) => setMonthlyTarget(e.target.value)}
              placeholder="0.00"
              className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Monthly spending goal for this category.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Rollover</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Carry unused balance forward each month
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRollover((r) => !r)}
              className={cn(
                "shrink-0 text-2xl transition-colors",
                rollover
                  ? "text-teal-600 dark:text-teal-400"
                  : "text-slate-300 dark:text-slate-600"
              )}
              aria-pressed={rollover}
            >
              {rollover ? (
                <ToggleRight aria-hidden="true" />
              ) : (
                <ToggleLeft aria-hidden="true" />
              )}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Due day{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="number"
              min="1"
              max="31"
              step="1"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              placeholder="e.g. 15"
              className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Day of month payment is due — shows on the timeline when set.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Pay from account{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <select
              value={paymentAccountId}
              onChange={(e) => setPaymentAccountId(e.target.value)}
              className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            >
              <option value="">— none —</option>
              {(accounts ?? [])
                .filter((a) => !a.isArchived)
                .map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name} ({formatCurrency(a.balance)})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Note{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Any notes about this category…"
              className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors resize-none"
            />
          </div>
          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading || !name.trim() || !groupId}
              className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Saving…" : editCat ? "Save changes" : "Create category"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
