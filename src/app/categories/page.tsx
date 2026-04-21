"use client";

import { useState, useMemo, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  formatCurrency,
  getCurrentMonth,
  shiftMonth,
  formatMonth,
  ACCENT_COLOR_FALLBACK,
} from "@/lib/utils";
import { CATEGORY_ICON_MAP, CATEGORY_COLORS } from "@/lib/icons";
import {
  FolderOpen,
  Plus,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type Group = {
  _id: Id<"groups">;
  name: string;
  color?: string;
  icon?: string;
};

type CategoryProgress = {
  category: {
    _id: Id<"categories">;
    name: string;
    groupId?: Id<"groups">;
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
  spent: number;
  target: number | null;
  remaining: number | null;
};

// ── Group modal ───────────────────────────────────────────────────────────────

function GroupModal({
  editGroup,
  onSuccess,
  onClose,
}: {
  editGroup: Group | null;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const { user } = useUser();
  const createGroup = useMutation(api.groups.create);
  const updateGroup = useMutation(api.groups.update);

  const [name, setName] = useState(editGroup?.name ?? "");
  const [color, setColor] = useState(editGroup?.color ?? ACCENT_COLOR_FALLBACK.category);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setLoading(true);
    setError("");
    try {
      if (editGroup) {
        await updateGroup({ id: editGroup._id, userId: user.id, name: name.trim(), color });
      } else {
        await createGroup({ userId: user.id, name: name.trim(), color });
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
      aria-labelledby="group-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl w-full max-w-md p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="group-modal-title" className="font-heading font-semibold text-slate-800 dark:text-slate-100 mb-5">
          {editGroup ? "Edit group" : "New group"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Name
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Housing, Food & Drink"
              maxLength={80}
              required
              className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Color</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Group color">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-pressed={color === c}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c
                      ? "border-slate-700 dark:border-slate-200 scale-110 ring-2 ring-offset-1 ring-slate-300 dark:ring-slate-500 dark:ring-offset-slate-900"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Saving…" : editGroup ? "Save changes" : "Create group"}
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

// ── Category modal ────────────────────────────────────────────────────────────

function CategoryModal({
  groups,
  defaultGroupId,
  editProgress,
  onSuccess,
  onClose,
}: {
  groups: Group[];
  defaultGroupId: Id<"groups"> | null;
  editProgress: CategoryProgress | null;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const { user } = useUser();
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);
  const accounts = useQuery(api.accounts.list, user ? { userId: user.id } : "skip");

  const editCat = editProgress?.category;
  const [name, setName] = useState(editCat?.name ?? "");
  const [groupId, setGroupId] = useState<Id<"groups"> | "">(
    editCat?.groupId ?? defaultGroupId ?? (groups[0]?._id ?? "")
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
    if (!user || !name.trim() || !groupId) return;
    const target = monthlyTarget.trim() ? parseFloat(monthlyTarget) : undefined;
    if (target !== undefined && (isNaN(target) || target < 0)) {
      setError("Monthly target must be a positive number");
      return;
    }
    const dueDayParsed = dueDay.trim() ? parseInt(dueDay, 10) : undefined;
    if (dueDayParsed !== undefined && (isNaN(dueDayParsed) || dueDayParsed < 1 || dueDayParsed > 31)) {
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
          userId: user.id,
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
          userId: user.id,
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
      aria-labelledby="category-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="category-modal-title" className="font-heading font-semibold text-slate-800 dark:text-slate-100 mb-5">
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
              {groups.map((g) => (
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
              Monthly target <span className="font-normal text-slate-400">(optional)</span>
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
                rollover ? "text-teal-600 dark:text-teal-400" : "text-slate-300 dark:text-slate-600"
              )}
              aria-pressed={rollover}
            >
              {rollover ? <ToggleRight aria-hidden="true" /> : <ToggleLeft aria-hidden="true" />}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Due day <span className="font-normal text-slate-400">(optional)</span>
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
              Pay from account <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <select
              value={paymentAccountId}
              onChange={(e) => setPaymentAccountId(e.target.value)}
              className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            >
              <option value="">— none —</option>
              {(accounts ?? []).filter((a) => !a.isArchived).map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} ({formatCurrency(a.balance)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Note <span className="font-normal text-slate-400">(optional)</span>
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

// ── Progress bar ──────────────────────────────────────────────────────────────

function CategoryProgressBar({
  spent,
  target,
  color,
  isPaid,
}: {
  spent: number;
  target: number | null;
  color: string;
  isPaid?: boolean;
}) {
  if (target === null || target <= 0) return null;
  const pct = isPaid ? 100 : Math.min((spent / target) * 100, 100);
  const over = !isPaid && spent > target;
  return (
    <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          isPaid ? "bg-emerald-500" : over ? "bg-rose-500" : pct >= 80 ? "bg-amber-400" : "bg-teal-500"
        )}
        style={{ width: `${pct}%`, backgroundColor: !isPaid && !over ? color : undefined }}
      />
    </div>
  );
}

// ── Group section ─────────────────────────────────────────────────────────────

function GroupSection({
  group,
  items,
  month,
  onEditGroup,
  onArchiveGroup,
  onAddCategory,
  onEditCategory,
  onArchiveCategory,
}: {
  group: Group;
  items: CategoryProgress[];
  month: string;
  onEditGroup: (g: Group) => void;
  onArchiveGroup: (g: Group) => void;
  onAddCategory: (groupId: Id<"groups">) => void;
  onEditCategory: (p: CategoryProgress) => void;
  onArchiveCategory: (p: CategoryProgress) => void;
}) {
  const color = group.color ?? ACCENT_COLOR_FALLBACK.category;
  const totalTarget = items.reduce((s, p) => s + (p.target ?? 0), 0);
  const totalSpent = items.reduce((s, p) => s + p.spent, 0);

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {/* Group header */}
      <div className="px-4 py-3.5 flex items-center justify-between gap-3 border-b border-slate-50 dark:border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}18` }}
            aria-hidden="true"
          >
            {(() => {
              const IconComp = group.icon ? CATEGORY_ICON_MAP[group.icon] : null;
              return IconComp
                ? <IconComp className="w-5 h-5" style={{ color }} />
                : <span className="text-lg">📁</span>;
            })()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{group.name}</p>
            {totalTarget > 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {formatCurrency(totalSpent)} of {formatCurrency(totalTarget)} target
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onAddCategory(group._id)}
            className="flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 px-2 py-1.5 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/50 font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Add</span>
          </button>
          <button
            type="button"
            onClick={() => onEditGroup(group)}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/8 font-medium transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onArchiveGroup(group)}
            className="text-sm text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            Archive
          </button>
        </div>
      </div>

      {/* Category rows */}
      <div className="divide-y divide-slate-50 dark:divide-white/5">
        {items.length === 0 ? (
          <div className="px-4 py-4 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              No categories yet —{" "}
              <button
                type="button"
                onClick={() => onAddCategory(group._id)}
                className="text-teal-600 dark:text-teal-400 font-medium hover:underline"
              >
                add one
              </button>
            </p>
          </div>
        ) : (
          items.map((p) => {
            const catColor = p.category.color ?? color;
            const isPaid = p.category.markedPaidForMonth === month;
            const over = !isPaid && p.target !== null && p.spent > p.target;
            const IconComp = p.category.icon ? CATEGORY_ICON_MAP[p.category.icon] : null;
            return (
              <div
                key={p.category._id}
                className="px-4 py-3 flex items-center gap-3"
              >
                {/* Icon */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${catColor}18` }}
                  aria-hidden="true"
                >
                  {IconComp
                    ? <IconComp className="w-4 h-4" style={{ color: catColor }} />
                    : <span className="text-sm">💰</span>}
                </div>

                {/* Name + progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                        {p.category.name}
                      </p>
                      {isPaid && (
                        <span className="shrink-0 rounded-md border border-emerald-200/80 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-950/45 dark:text-emerald-300">
                          Paid
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      "text-sm font-semibold tabular-nums shrink-0",
                      over
                        ? "text-rose-600 dark:text-rose-400"
                        : isPaid
                          ? "text-emerald-600 dark:text-emerald-400"
                          : p.target !== null
                            ? "text-slate-700 dark:text-slate-200"
                            : "text-slate-500 dark:text-slate-400"
                    )}>
                      {formatCurrency(p.spent)}
                      {p.target !== null && (
                        <span className="font-normal text-slate-400 dark:text-slate-500">
                          {" "}/ {formatCurrency(p.target)}
                        </span>
                      )}
                    </p>
                  </div>
                  <CategoryProgressBar spent={p.spent} target={p.target} color={catColor} isPaid={isPaid} />
                  {p.category.rollover && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Rolls over</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEditCategory(p)}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 px-2 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/50 font-medium transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onArchiveCategory(p)}
                    className="text-xs text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    Archive
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Group total progress bar */}
      {totalTarget > 0 && (
        <div className="px-4 pb-3 pt-1">
          <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min((totalSpent / totalTarget) * 100, 100)}%`,
                backgroundColor: totalSpent > totalTarget ? "#f43f5e" : color,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { user } = useUser();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  // Modals
  const [groupModal, setGroupModal] = useState<{ edit: Group | null } | null>(null);
  const [categoryModal, setCategoryModal] = useState<{
    defaultGroupId: Id<"groups"> | null;
    edit: CategoryProgress | null;
  } | null>(null);

  // Archive confirms
  const [archiveGroupId, setArchiveGroupId] = useState<Id<"groups"> | null>(null);
  const [archiveCategoryId, setArchiveCategoryId] = useState<Id<"categories"> | null>(null);

  const archiveGroup = useMutation(api.groups.archive);
  const archiveCategory = useMutation(api.categories.archive);
  const ensureDefaultGroup = useMutation(api.groups.ensureDefault);

  const groups = useQuery(api.groups.list, user ? { userId: user.id } : "skip");

  useEffect(() => {
    if (!user) return;
    void ensureDefaultGroup({ userId: user.id });
  }, [ensureDefaultGroup, user]);
  const monthlyProgress = useQuery(
    api.categories.getMonthlyProgress,
    user ? { userId: user.id, month: selectedMonth } : "skip"
  );

  const progressByGroupId = useMemo(() => {
    const m = new Map<string, CategoryProgress[]>();
    for (const p of monthlyProgress ?? []) {
      const gid = p.category.groupId as string | undefined;
      if (!gid) continue;
      if (!m.has(gid)) m.set(gid, []);
      m.get(gid)!.push(p as CategoryProgress);
    }
    return m;
  }, [monthlyProgress]);

  const totalTarget = useMemo(
    () => (monthlyProgress ?? []).reduce((s, p) => s + (p.target ?? 0), 0),
    [monthlyProgress]
  );
  const totalSpent = useMemo(
    () => (monthlyProgress ?? []).reduce((s, p) => s + p.spent, 0),
    [monthlyProgress]
  );

  if (!user) return null;

  const viewingCurrentMonth = selectedMonth === getCurrentMonth();

  return (
    <div className="w-full max-w-none space-y-5 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-slate-100">Categories</h1>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
            Monthly targets and spending by category.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start">
          <button
            type="button"
            onClick={() => setGroupModal({ edit: null })}
            className="text-sm font-medium text-slate-600 dark:text-slate-300 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/8 transition-colors"
          >
            + New group
          </button>
          <button
            type="button"
            onClick={() => setCategoryModal({ defaultGroupId: null, edit: null })}
            className="bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 active:scale-[0.97] transition-all shadow-sm"
          >
            + New category
          </button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm overflow-hidden dark:[color-scheme:dark]">
          <button
            type="button"
            onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
            className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-100 transition-colors border-r border-slate-100 dark:border-white/10"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            aria-label="Select month"
            className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-sm text-slate-700 dark:text-slate-200 text-center focus:ring-0 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
            className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-100 transition-colors border-l border-slate-100 dark:border-white/10"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {!viewingCurrentMonth && (
          <button
            type="button"
            onClick={() => setSelectedMonth(getCurrentMonth())}
            className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 px-2 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors"
          >
            This month
          </button>
        )}
        {totalTarget > 0 && (
          <div className="ml-auto text-right">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
              {formatCurrency(totalSpent)}{" "}
              <span className="font-normal text-slate-400 dark:text-slate-500">
                of {formatCurrency(totalTarget)}
              </span>
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {formatMonth(selectedMonth)}
            </p>
          </div>
        )}
      </div>

      {/* Groups list */}
      {groups === undefined || monthlyProgress === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-white/10 h-32 animate-pulse"
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-12 text-center">
          <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-700 dark:text-slate-200 mb-1 font-medium">No categories yet</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mb-5">
            Add a category like Groceries or Rent to start tracking your spending.
          </p>
          <button
            type="button"
            onClick={() => setCategoryModal({ defaultGroupId: null, edit: null })}
            className="bg-teal-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-teal-700 active:scale-[0.97] transition-all"
          >
            Add your first category
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group._id}>
              {archiveGroupId === group._id && (
                <div
                  role="region"
                  aria-label={`Confirm archive ${group.name}`}
                  className="mb-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                >
                  <p className="text-sm text-rose-700 dark:text-rose-300">
                    Archive <strong>{group.name}</strong>? It will no longer appear in your budget.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        await archiveGroup({ id: group._id, userId: user.id });
                        setArchiveGroupId(null);
                      }}
                      className="text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => setArchiveGroupId(null)}
                      className="text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {archiveCategoryId && progressByGroupId.get(group._id as string)?.some((p) => p.category._id === archiveCategoryId) && (
                <div
                  role="region"
                  aria-label="Confirm archive category"
                  className="mb-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                >
                  <p className="text-sm text-rose-700 dark:text-rose-300">
                    Archive this category? It will be hidden from tracking.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        if (archiveCategoryId) {
                          await archiveCategory({ id: archiveCategoryId, userId: user.id });
                        }
                        setArchiveCategoryId(null);
                      }}
                      className="text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => setArchiveCategoryId(null)}
                      className="text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <GroupSection
                group={group as Group}
                items={progressByGroupId.get(group._id as string) ?? []}
                month={selectedMonth}
                onEditGroup={(g) => setGroupModal({ edit: g })}
                onArchiveGroup={(g) => setArchiveGroupId(g._id)}
                onAddCategory={(gid) => setCategoryModal({ defaultGroupId: gid, edit: null })}
                onEditCategory={(p) => setCategoryModal({ defaultGroupId: p.category.groupId ?? null, edit: p })}
                onArchiveCategory={(p) => setArchiveCategoryId(p.category._id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Group modal */}
      {groupModal !== null && (
        <GroupModal
          editGroup={groupModal.edit}
          onSuccess={() => setGroupModal(null)}
          onClose={() => setGroupModal(null)}
        />
      )}

      {/* Category modal */}
      {categoryModal !== null && groups && (
        <CategoryModal
          groups={groups as Group[]}
          defaultGroupId={categoryModal.defaultGroupId}
          editProgress={categoryModal.edit}
          onSuccess={() => setCategoryModal(null)}
          onClose={() => setCategoryModal(null)}
        />
      )}
    </div>
  );
}
