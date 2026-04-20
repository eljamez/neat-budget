"use client";

import { useState, useMemo } from "react";
import type { DragEvent } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { CategoryManager } from "@/components/CategoryManager";
import { BudgetItemManager } from "@/components/BudgetItemManager";
import {
  formatCurrency,
  sumBudgetItemsByCategory,
  budgetItemPaidFromLabel,
  formatAccountType,
  expenseHasPayFromAccount,
  ACCENT_COLOR_FALLBACK,
} from "@/lib/utils";
import { CATEGORY_ICON_MAP } from "@/lib/icons";
import {
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  Calendar,
  GripVertical,
  CreditCard,
} from "lucide-react";

interface Category {
  _id: Id<"categories">;
  name: string;
  color?: string;
  icon?: string;
}

interface BudgetExpense {
  _id: Id<"budgetItems">;
  categoryId: Id<"categories">;
  name: string;
  amount: number;
  paymentDayOfMonth: number;
  accountId?: Id<"accounts">;
  paidFrom?: string;
  isAutopay?: boolean;
  note?: string;
}

type ExpenseDragState = {
  itemId: Id<"budgetItems">;
  fromCategoryId: Id<"categories">;
};

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function CategoryExpensesSection({
  category,
  color,
  dragState,
  onExpenseDragStart,
  onExpenseDragEnd,
}: {
  category: Category;
  color: string;
  dragState: ExpenseDragState | null;
  onExpenseDragStart: (itemId: Id<"budgetItems">, fromCategoryId: Id<"categories">) => void;
  onExpenseDragEnd: () => void;
}) {
  const { user } = useUser();
  const archiveItem = useMutation(api.budgetItems.archive);
  const updateExpenseRow = useMutation(api.budgetItems.update);
  const expenses = useQuery(
    api.budgetItems.listByCategory,
    user ? { categoryId: category._id, userId: user.id } : "skip"
  );
  const accounts = useQuery(api.accounts.list, user ? { userId: user.id } : "skip");
  const expensesSortedByDueDay = useMemo(() => {
    if (!expenses) return [];
    return [...expenses].sort((a, b) => {
      if (a.paymentDayOfMonth !== b.paymentDayOfMonth) {
        return a.paymentDayOfMonth - b.paymentDayOfMonth;
      }
      return a.name.localeCompare(b.name);
    });
  }, [expenses]);
  const accountsSorted = useMemo(
    () =>
      accounts ? [...accounts].sort((a, b) => a.name.localeCompare(b.name)) : [],
    [accounts]
  );
  const accountMap = useMemo((): Record<string, { name: string }> => {
    if (!accounts) return {};
    return Object.fromEntries(accounts.map((a) => [a._id, { name: a.name }]));
  }, [accounts]);
  const [showForm, setShowForm] = useState(false);
  const [editExpense, setEditExpense] = useState<BudgetExpense | null>(null);
  const [archivePendingId, setArchivePendingId] = useState<Id<"budgetItems"> | null>(null);
  const [autopayTogglePendingId, setAutopayTogglePendingId] =
    useState<Id<"budgetItems"> | null>(null);
  const [accountSelectPendingId, setAccountSelectPendingId] =
    useState<Id<"budgetItems"> | null>(null);

  const handleArchive = async (id: Id<"budgetItems">) => {
    if (!user) return;
    await archiveItem({ id, userId: user.id });
    setArchivePendingId(null);
  };

  return (
    <div className="mt-1 ml-4 border-l-2 pl-4" style={{ borderColor: `${color}40` }}>
      {expenses === undefined ? (
        <div className="py-2 space-y-1">
          {[1, 2].map((i) => (
            <div key={i} className="h-9 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {expenses.length === 0 && !showForm && (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-2">
              No expenses yet — add recurring bills below, or drag one here from another category.
            </p>
          )}

          <div className="space-y-1 py-1">
            {expensesSortedByDueDay.map((item) => {
              const isDragging = dragState?.itemId === item._id;
              const paidFromLabel = budgetItemPaidFromLabel(item, accountMap);
              const accountFunded = expenseHasPayFromAccount(item);

              return (
                <div key={item._id}>
                  <div
                    draggable
                    aria-grabbed={isDragging}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", item._id);
                      e.dataTransfer.effectAllowed = "move";
                      onExpenseDragStart(item._id, category._id);
                    }}
                    onDragEnd={onExpenseDragEnd}
                    className={`flex items-center gap-1.5 rounded-xl px-2 py-2 border border-slate-100 dark:border-white/10 bg-white dark:bg-slate-800/80 hover:border-slate-200/90 dark:hover:border-white/15 group transition-colors cursor-grab active:cursor-grabbing select-none ${
                      isDragging ? "opacity-60 ring-2 ring-teal-300 dark:ring-teal-600" : ""
                    }`}
                  >
                    <GripVertical
                      className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0 group-hover:text-slate-400 dark:group-hover:text-slate-500"
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.name}</span>
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                          {formatCurrency(item.amount)}
                        </span>
                        {accountFunded ? (
                          <span
                            className="text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200/90 px-1.5 py-0.5 rounded-md"
                            title={`Pay-from: ${paidFromLabel ?? "linked account"}`}
                          >
                            Bank ✓
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded-md"
                            title="Choose a bank account in the dropdown on this row"
                          >
                            No bank
                          </span>
                        )}
                        {item.isAutopay && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                            Auto-pay
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="w-3 h-3" aria-hidden="true" />
                          Due {ordinal(item.paymentDayOfMonth)}
                        </span>
                        {paidFromLabel && (
                          <span className="flex items-center gap-1 text-xs text-slate-400 min-w-0">
                            <CreditCard className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                            <span className="truncate">{paidFromLabel}</span>
                          </span>
                        )}
                        {item.note && (
                          <span className="text-xs text-slate-400 italic truncate">{item.note}</span>
                        )}
                      </div>
                    </div>
                    <select
                      value={item.accountId ?? ""}
                      disabled={accountSelectPendingId === item._id || accounts === undefined}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={async (e) => {
                        e.stopPropagation();
                        if (!user) return;
                        const v = e.target.value;
                        setAccountSelectPendingId(item._id);
                        try {
                          await updateExpenseRow({
                            id: item._id,
                            userId: user.id,
                            accountId: v === "" ? null : (v as Id<"accounts">),
                          });
                        } finally {
                          setAccountSelectPendingId(null);
                        }
                      }}
                      aria-label={`Paid from account for ${item.name}`}
                      className="max-w-[9.5rem] shrink-0 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 py-1 pl-2 pr-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50 sm:max-w-[11rem] sm:text-xs"
                    >
                      <option value="">Account…</option>
                      {accountsSorted.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.name} ({formatAccountType(a.accountType)})
                        </option>
                      ))}
                    </select>
                    <label
                      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-100 dark:border-white/10 bg-slate-50/90 dark:bg-slate-800/80 px-2 py-1.5"
                      title="Bill is on auto-pay with the payee"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={item.isAutopay === true}
                        disabled={autopayTogglePendingId === item._id}
                        onChange={async (e) => {
                          e.stopPropagation();
                          if (!user) return;
                          setAutopayTogglePendingId(item._id);
                          try {
                            await updateExpenseRow({
                              id: item._id,
                              userId: user.id,
                              isAutopay: e.target.checked,
                            });
                          } finally {
                            setAutopayTogglePendingId(null);
                          }
                        }}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                        aria-label={`Auto-pay for ${item.name}`}
                      />
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        Auto-pay
                      </span>
                    </label>
                    <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        draggable={false}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditExpense(item as BudgetExpense);
                          setShowForm(true);
                        }}
                        className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 px-2 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors font-medium"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        draggable={false}
                        onClick={(e) => {
                          e.stopPropagation();
                          setArchivePendingId(archivePendingId === item._id ? null : item._id);
                        }}
                        className="text-xs text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        Archive
                      </button>
                    </div>
                  </div>

                  {archivePendingId === item._id && (
                    <div className="mt-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-rose-700 dark:text-rose-300">
                        Archive <strong>{item.name}</strong>? It will be hidden from active planning.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleArchive(item._id)}
                          className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Archive
                        </button>
                        <button
                          type="button"
                          onClick={() => setArchivePendingId(null)}
                          className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {showForm ? (
            <div className="mt-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">
                {editExpense ? "Edit expense" : "New expense"}
              </p>
              <BudgetItemManager
                key={editExpense?._id ?? "new"}
                categoryId={category._id}
                editItem={editExpense}
                onSuccess={() => {
                  setShowForm(false);
                  setEditExpense(null);
                }}
                onCancel={() => {
                  setShowForm(false);
                  setEditExpense(null);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-2 flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-medium py-1.5 px-2 rounded-lg hover:bg-teal-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Add expense
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const { user } = useUser();
  const categories = useQuery(
    api.categories.list,
    user ? { userId: user.id } : "skip"
  );
  const allBudgetItems = useQuery(
    api.budgetItems.listByUser,
    user ? { userId: user.id } : "skip"
  );
  const archiveCategory = useMutation(api.categories.archive);
  const updateExpense = useMutation(api.budgetItems.update);

  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [archivePendingId, setArchivePendingId] = useState<Id<"categories"> | null>(null);
  const [categoryExpansionOverrides, setCategoryExpansionOverrides] = useState<
    Record<string, boolean>
  >({});
  const [expenseDrag, setExpenseDrag] = useState<ExpenseDragState | null>(null);
  const [dropHighlightCategoryId, setDropHighlightCategoryId] = useState<Id<"categories"> | null>(
    null
  );
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false);
  const [newExpenseCategoryId, setNewExpenseCategoryId] = useState<Id<"categories"> | null>(
    null
  );

  const handleCategoryDragOver = (e: DragEvent<HTMLDivElement>, catId: Id<"categories">) => {
    if (!expenseDrag) return;
    if (expenseDrag.fromCategoryId === catId) {
      setDropHighlightCategoryId(null);
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropHighlightCategoryId(catId);
  };

  const handleCategoryDragLeave = (e: DragEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as Node | null;
    if (!related || !e.currentTarget.contains(related)) {
      setDropHighlightCategoryId(null);
    }
  };

  const handleCategoryDrop = async (e: DragEvent<HTMLDivElement>, targetCatId: Id<"categories">) => {
    e.preventDefault();
    if (!user) return;
    const pending = expenseDrag;
    setExpenseDrag(null);
    setDropHighlightCategoryId(null);
    if (!pending || pending.fromCategoryId === targetCatId) return;
    try {
      await updateExpense({ id: pending.itemId, userId: user.id, categoryId: targetCatId });
    } catch {
      // Convex surfaces errors in dev; no extra UI for now
    }
  };

  const handleExpenseDragStart = (itemId: Id<"budgetItems">, fromCategoryId: Id<"categories">) => {
    setExpenseDrag({ itemId, fromCategoryId });
  };

  const handleExpenseDragEnd = () => {
    setExpenseDrag(null);
    setDropHighlightCategoryId(null);
  };

  const expandedCategories = useMemo(() => {
    if (!categories) return new Set<Id<"categories">>();
    const next = new Set(categories.map((c) => c._id));
    for (const [id, isExpanded] of Object.entries(categoryExpansionOverrides)) {
      if (!categories.some((c) => c._id === (id as Id<"categories">))) continue;
      const categoryId = id as Id<"categories">;
      if (isExpanded) {
        next.add(categoryId);
      } else {
        next.delete(categoryId);
      }
    }
    return next;
  }, [categories, categoryExpansionOverrides]);

  const toggleExpand = (id: Id<"categories">) => {
    const currentlyExpanded = expandedCategories.has(id);
    setCategoryExpansionOverrides((prev) => ({
      ...prev,
      [id]: !currentlyExpanded,
    }));
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditCategory(null);
    if (categories && categories.length > 0) {
      const newest = categories[categories.length - 1];
      setCategoryExpansionOverrides((prev) => ({
        ...prev,
        [newest._id]: true,
      }));
    }
  };

  const handleNewCategory = () => {
    setShowForm(true);
    setEditCategory(null);
    setCategoryExpansionOverrides((prev) => {
      const next = { ...prev };
      if (categories) {
        for (const c of categories) {
          next[c._id] = expandedCategories.has(c._id);
        }
      }
      return next;
    });
  };

  const handleEdit = (cat: Category) => {
    setEditCategory(cat);
    setShowForm(true);
  };

  const handleArchiveConfirm = async () => {
    if (!archivePendingId || !user) return;
    await archiveCategory({ id: archivePendingId, userId: user.id });
    setArchivePendingId(null);
  };

  const plannedByCategory = useMemo(() => {
    if (!allBudgetItems) return {};
    return sumBudgetItemsByCategory(allBudgetItems);
  }, [allBudgetItems]);

  if (!user) return null;

  return (
    <div className="w-full max-w-none space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-slate-100">Categories</h1>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
            Your budget groups and recurring bills—amounts and due days apply every month. Drag an expense onto
            another category to move it. Use the{" "}
            <Link
              href="/dashboard"
              className="text-teal-600 dark:text-teal-400 font-medium hover:text-teal-700 dark:hover:text-teal-300"
            >
              dashboard
            </Link>{" "}
            to pick a month, fund bills, and work the timeline (including cards and loans).
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end shrink-0">
          {!showForm && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end w-full sm:w-auto">
              {categories !== undefined && categories.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setNewExpenseCategoryId(categories[0]._id);
                    setShowNewExpenseModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 border border-teal-200 dark:border-teal-800/60 bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-200 text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-950/50 active:scale-[0.97] transition-all shadow-sm w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  New expense
                </button>
              )}
              <button
                type="button"
                onClick={handleNewCategory}
                className="bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 active:scale-[0.97] transition-all shadow-sm w-full sm:w-auto"
              >
                + New Category
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6">
          <h2 className="font-heading font-semibold text-slate-800 dark:text-slate-100 mb-5">
            {editCategory ? "Edit Category" : "New Category"}
          </h2>
          <CategoryManager
            editCategory={editCategory}
            onSuccess={handleFormSuccess}
            onCancel={() => { setShowForm(false); setEditCategory(null); }}
          />
        </div>
      )}

      {/* Category List */}
      {categories === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-white/10 h-18 animate-pulse"
            />
          ))}
        </div>
      ) : categories.length === 0 && !showForm ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-12 text-center">
          <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-500 dark:text-slate-400 mb-1 font-medium">No categories yet</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
            Create budget categories to start tracking your spending
          </p>
          <button
            onClick={handleNewCategory}
            className="bg-teal-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-teal-700 active:scale-[0.97] transition-all"
          >
            Create your first category
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {categories.map((cat) => {
            const isExpanded = expandedCategories.has(cat._id);
            const color = cat.color ?? ACCENT_COLOR_FALLBACK.category;
            const plannedSum = plannedByCategory[cat._id] ?? 0;

            const showDropRing =
              expenseDrag &&
              dropHighlightCategoryId === cat._id &&
              expenseDrag.fromCategoryId !== cat._id;

            return (
              <div key={cat._id}>
                <div
                  className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden transition-shadow ${
                    showDropRing ? "ring-2 ring-teal-400 ring-offset-2 dark:ring-offset-slate-950" : ""
                  }`}
                  style={{ borderLeft: `3px solid ${color}` }}
                  onDragOver={(e) => handleCategoryDragOver(e, cat._id)}
                  onDragLeave={handleCategoryDragLeave}
                  onDrop={(e) => handleCategoryDrop(e, cat._id)}
                >
                  {/* Category header row */}
                  <div className="px-4 py-3.5 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <button
                      onClick={() => toggleExpand(cat._id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      aria-expanded={isExpanded}
                    >
                      <div
                        aria-hidden="true"
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${color}18` }}
                      >
                        {(() => {
                          const iconName = cat.icon;
                          const IconComp = iconName ? CATEGORY_ICON_MAP[iconName] : null;
                          return IconComp
                            ? <IconComp className="w-5 h-5" style={{ color }} />
                            : <span className="text-xl">{iconName ?? "💰"}</span>;
                        })()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{cat.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {formatCurrency(plannedSum)} / month from expenses
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          Sum of recurring expenses in this category
                        </p>
                      </div>
                      <div className="ml-2 text-slate-400 dark:text-slate-500 flex-shrink-0">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4" aria-hidden="true" />
                          : <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        }
                      </div>
                    </button>

                    <div className="flex gap-1 flex-shrink-0 ml-2">
                      <button
                        onClick={() => handleEdit(cat)}
                        className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 px-3 py-2 lg:py-1.5 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors font-medium min-h-[2.75rem] lg:min-h-0 flex items-center"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setArchivePendingId(archivePendingId === cat._id ? null : cat._id)}
                        aria-expanded={archivePendingId === cat._id}
                        className="text-sm text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 px-3 py-2 lg:py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors min-h-[2.75rem] lg:min-h-0 flex items-center"
                      >
                        Archive
                      </button>
                    </div>
                  </div>

                  {/* Expanded expenses section */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <CategoryExpensesSection
                        category={cat}
                        color={color}
                        dragState={expenseDrag}
                        onExpenseDragStart={handleExpenseDragStart}
                        onExpenseDragEnd={handleExpenseDragEnd}
                      />
                    </div>
                  )}
                </div>

                {archivePendingId === cat._id && (
                  <div
                    role="region"
                    aria-label={`Confirm archive for ${cat.name}`}
                    className="mt-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <p className="text-sm text-rose-700 dark:text-rose-300">
                      Archive <strong>{cat.name}</strong>? It will no longer appear in your dashboard.
                    </p>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={handleArchiveConfirm}
                        className="text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Archive
                      </button>
                      <button
                        onClick={() => setArchivePendingId(null)}
                        className="text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showNewExpenseModal && categories && categories.length > 0 && newExpenseCategoryId && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-expense-dialog-title"
          onClick={() => setShowNewExpenseModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="new-expense-dialog-title" className="font-semibold text-slate-800 dark:text-slate-100 mb-4">
              New expense
            </h2>
            <div className="mb-4">
              <label
                htmlFor="new-expense-category"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Category
              </label>
              <select
                id="new-expense-category"
                value={newExpenseCategoryId}
                onChange={(e) => setNewExpenseCategoryId(e.target.value as Id<"categories">)}
                className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors"
              >
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <BudgetItemManager
              key={newExpenseCategoryId}
              categoryId={newExpenseCategoryId}
              onSuccess={() => setShowNewExpenseModal(false)}
              onCancel={() => setShowNewExpenseModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
