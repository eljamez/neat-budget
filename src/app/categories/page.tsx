"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  formatMonth,
  getCurrentMonth,
  sumBudgetItemsByCategory,
  CREDIT_CARD_USAGE_LABELS,
  budgetItemPaidFromLabel,
  formatAccountType,
  calendarDaysFromTo,
  dateInBudgetMonth,
  startOfLocalDay,
  expenseFundingLevel,
  expenseHasPayFromAccount,
} from "@/lib/utils";
import { CATEGORY_ICON_MAP } from "@/lib/icons";
import {
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  Calendar,
  Clock,
  GripVertical,
  CreditCard,
  CheckCircle2,
  Circle,
  Landmark,
  Star,
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
  markedPaidForMonth?: string;
  status?: "unfunded" | "funded" | "paid";
  fundedDate?: number;
  paidDate?: number;
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
  budgetMonth,
  dragState,
  onExpenseDragStart,
  onExpenseDragEnd,
}: {
  category: Category;
  color: string;
  budgetMonth: string;
  dragState: ExpenseDragState | null;
  onExpenseDragStart: (itemId: Id<"budgetItems">, fromCategoryId: Id<"categories">) => void;
  onExpenseDragEnd: () => void;
}) {
  const { user } = useUser();
  const archiveItem = useMutation(api.budgetItems.archive);
  const setPaidForMonth = useMutation(api.budgetItems.setPaidForMonth);
  const fundExpense = useMutation(api.budgetItems.fundExpense);
  const updateExpenseRow = useMutation(api.budgetItems.update);
  const expenses = useQuery(api.budgetItems.listByCategory, {
    categoryId: category._id,
  });
  const accounts = useQuery(api.accounts.list, user ? { userId: user.id } : "skip");
  const allocations = useQuery(
    api.expenseAllocations.listByUserMonth,
    user ? { userId: user.id, monthKey: budgetMonth } : "skip"
  );
  const allocatedByBudgetId = useMemo(() => {
    if (!allocations) return {};
    const m: Record<string, number> = {};
    for (const a of allocations) {
      const k = a.budgetItemId as string;
      m[k] = (m[k] ?? 0) + a.amount;
    }
    return m;
  }, [allocations]);
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
  const [paidTogglePendingId, setPaidTogglePendingId] = useState<Id<"budgetItems"> | null>(null);
  const [autopayTogglePendingId, setAutopayTogglePendingId] =
    useState<Id<"budgetItems"> | null>(null);
  const [accountSelectPendingId, setAccountSelectPendingId] =
    useState<Id<"budgetItems"> | null>(null);
  const [fundExpensePendingId, setFundExpensePendingId] =
    useState<Id<"budgetItems"> | null>(null);

  const todayStart = startOfLocalDay(new Date());

  const handleArchive = async (id: Id<"budgetItems">) => {
    await archiveItem({ id });
    setArchivePendingId(null);
  };

  return (
    <div className="mt-1 ml-4 border-l-2 pl-4" style={{ borderColor: `${color}40` }}>
      {expenses === undefined ? (
        <div className="py-2 space-y-1">
          {[1, 2].map((i) => (
            <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {expenses.length === 0 && !showForm && (
            <p className="text-xs text-slate-400 py-2">
              No expenses yet — add recurring bills below, or drag one here from another category.
            </p>
          )}

          <div className="space-y-1 py-1">
            {expenses.map((item) => {
              const dueStart = dateInBudgetMonth(budgetMonth, item.paymentDayOfMonth);
              const daysUntilDue = calendarDaysFromTo(todayStart, dueStart);
              const isUrgent = daysUntilDue >= 0 && daysUntilDue <= 3;
              const isDragging = dragState?.itemId === item._id;
              const isPaidForMonth = item.markedPaidForMonth === budgetMonth;
              const isPast = !isPaidForMonth && daysUntilDue < 0;
              const paidFromLabel = budgetItemPaidFromLabel(item, accountMap);
              const setAsideTotal = allocatedByBudgetId[item._id] ?? 0;
              const earmarkLevel = expenseFundingLevel(item.amount, setAsideTotal);
              const accountFunded = expenseHasPayFromAccount(item);
              const isOverAllocated =
                item.amount > 0.005 && setAsideTotal > item.amount + 0.005;
              const isReserved = item.status === "funded" && !isPaidForMonth;

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
                    className={`flex items-center gap-1.5 rounded-xl px-2 py-2 border group transition-colors cursor-grab active:cursor-grabbing select-none ${
                      isPaidForMonth
                        ? "bg-emerald-50/60 border-emerald-200/85 ring-1 ring-emerald-200/40 hover:border-emerald-300/90"
                        : isReserved
                        ? "bg-emerald-50/45 border-emerald-200/80 ring-1 ring-emerald-200/35 hover:border-emerald-300/85"
                        : isOverAllocated
                        ? "bg-white border-slate-100 hover:border-slate-200 ring-2 ring-amber-400/65 ring-offset-2 ring-offset-white"
                        : !accountFunded
                        ? "bg-white border-amber-100/90 hover:border-amber-200/90"
                        : "bg-white border-slate-100 hover:border-slate-200"
                    } ${isDragging ? "opacity-60 ring-2 ring-teal-300" : ""}`}
                  >
                    <button
                      type="button"
                      draggable={false}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setPaidTogglePendingId(item._id);
                        try {
                          await setPaidForMonth({
                            id: item._id,
                            monthKey: budgetMonth,
                            paid: !isPaidForMonth,
                          });
                        } finally {
                          setPaidTogglePendingId(null);
                        }
                      }}
                      disabled={paidTogglePendingId === item._id}
                      aria-pressed={isPaidForMonth}
                      aria-label={
                        isPaidForMonth
                          ? `Mark ${item.name} not paid for ${formatMonth(budgetMonth)}`
                          : `Mark ${item.name} paid for ${formatMonth(budgetMonth)}`
                      }
                      className={`flex-shrink-0 p-1 rounded-lg transition-colors disabled:opacity-50 ${
                        isPaidForMonth
                          ? "text-emerald-600 hover:bg-emerald-100/80"
                          : "text-slate-300 hover:text-teal-600 hover:bg-teal-50"
                      }`}
                    >
                      {isPaidForMonth ? (
                        <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <Circle className="w-5 h-5" aria-hidden="true" />
                      )}
                    </button>
                    <GripVertical
                      className="w-4 h-4 text-slate-300 flex-shrink-0 group-hover:text-slate-400"
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800">{item.name}</span>
                        <span className="text-sm font-semibold text-slate-600">
                          {formatCurrency(item.amount)}
                        </span>
                        {isUrgent && !isPast && (
                          <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md">
                            Needed soon
                          </span>
                        )}
                        {isPast && (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                            Due date passed
                          </span>
                        )}
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
                        {isReserved && (
                          <span
                            className="text-[10px] font-semibold bg-emerald-200/90 text-emerald-950 px-1.5 py-0.5 rounded-md"
                            title="Marked funded — reduces Available from funded date until paid"
                          >
                            Reserved
                          </span>
                        )}
                        {accountFunded &&
                          !isPaidForMonth &&
                          item.status !== "funded" &&
                          user && (
                            <button
                              type="button"
                              draggable={false}
                              onClick={async (e) => {
                                e.stopPropagation();
                                setFundExpensePendingId(item._id);
                                try {
                                  await fundExpense({ id: item._id, userId: user.id });
                                } finally {
                                  setFundExpensePendingId(null);
                                }
                              }}
                              disabled={fundExpensePendingId === item._id}
                              title="Reserve the full bill amount from today"
                              className="text-[10px] font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200 px-1.5 py-0.5 rounded-md hover:bg-emerald-100/90 disabled:opacity-50"
                            >
                              Reserve
                            </button>
                          )}
                        {earmarkLevel === "full" && !isPaidForMonth && !isReserved && (
                          <span
                            className="text-[10px] font-semibold bg-sky-100 text-sky-900 px-1.5 py-0.5 rounded-md"
                            title="Bill amount fully earmarked this month"
                          >
                            Earmarked
                          </span>
                        )}
                        {earmarkLevel === "partial" && !isPaidForMonth && (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/90 px-1.5 py-0.5 rounded-md">
                            Partly earmarked
                          </span>
                        )}
                        {isPaidForMonth && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded-md">
                            <Star
                              className="h-3 w-3 fill-emerald-500 text-emerald-600"
                              aria-hidden="true"
                            />
                            Paid
                          </span>
                        )}
                        {isOverAllocated && !isPaidForMonth && (
                          <span className="text-[10px] font-semibold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-md">
                            Over-earmarked
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
                        const v = e.target.value;
                        setAccountSelectPendingId(item._id);
                        try {
                          await updateExpenseRow({
                            id: item._id,
                            accountId: v === "" ? null : (v as Id<"accounts">),
                          });
                        } finally {
                          setAccountSelectPendingId(null);
                        }
                      }}
                      aria-label={`Paid from account for ${item.name}`}
                      className="max-w-[9.5rem] shrink-0 rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-1 text-[11px] font-medium text-slate-700 disabled:opacity-50 sm:max-w-[11rem] sm:text-xs"
                    >
                      <option value="">Account…</option>
                      {accountsSorted.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.name} ({formatAccountType(a.accountType)})
                        </option>
                      ))}
                    </select>
                    <label
                      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50/90 px-2 py-1.5"
                      title="Bill is on auto-pay with the payee"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={item.isAutopay === true}
                        disabled={autopayTogglePendingId === item._id}
                        onChange={async (e) => {
                          e.stopPropagation();
                          setAutopayTogglePendingId(item._id);
                          try {
                            await updateExpenseRow({
                              id: item._id,
                              isAutopay: e.target.checked,
                            });
                          } finally {
                            setAutopayTogglePendingId(null);
                          }
                        }}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                        aria-label={`Auto-pay for ${item.name}`}
                      />
                      <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
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
                        className="text-xs text-teal-600 hover:text-teal-700 px-2 py-1 rounded-lg hover:bg-teal-50 transition-colors font-medium"
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
                        className="text-xs text-slate-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {archivePendingId === item._id && (
                    <div className="mt-1 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-rose-700">
                        Remove <strong>{item.name}</strong>?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleArchive(item._id)}
                          className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setArchivePendingId(null)}
                          className="text-xs text-slate-600 bg-white hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
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
            <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-600 mb-3">
                {editExpense ? "Edit expense" : "New expense"}
              </p>
              <BudgetItemManager
                key={editExpense?._id ?? "new"}
                categoryId={category._id}
                editItem={editExpense}
                transactionsMonthKey={budgetMonth}
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

const DEBTS_PLANNER_COLOR = "#475569";
const CREDIT_CARDS_PLANNER_COLOR = "#4f46e5";

interface CreditCardListDoc {
  _id: Id<"creditCards">;
  name: string;
  plannedMonthlyPayment?: number;
  dueDayOfMonth?: number;
  markedPaidForMonth?: string;
  color?: string;
  isAutopay?: boolean;
  usageMode: string;
}

function CreditCardsMonthlySection({
  cards,
  budgetMonth,
  userId,
}: {
  cards: CreditCardListDoc[] | undefined;
  budgetMonth: string;
  userId: string;
}) {
  const setCardPaidForMonth = useMutation(api.creditCards.setPaidForMonth);
  const [paidTogglePendingId, setPaidTogglePendingId] = useState<Id<"creditCards"> | null>(
    null
  );
  const todayStart = startOfLocalDay(new Date());

  const planned = (cards ?? []).filter(
    (c) =>
      (c.plannedMonthlyPayment ?? 0) > 0 &&
      c.dueDayOfMonth != null &&
      c.dueDayOfMonth >= 1 &&
      c.dueDayOfMonth <= 31
  );

  if (cards === undefined) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-2.5">
        <div className="h-20 animate-pulse bg-slate-50 m-3 rounded-xl" />
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-2.5"
      style={{ borderLeft: `3px solid ${CREDIT_CARDS_PLANNER_COLOR}` }}
    >
      <div className="px-4 py-3.5 flex items-center gap-3 border-b border-slate-50">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${CREDIT_CARDS_PLANNER_COLOR}18` }}
        >
          <CreditCard
            className="w-5 h-5"
            style={{ color: CREDIT_CARDS_PLANNER_COLOR }}
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800">Credit cards</p>
          <p className="text-sm text-slate-500">
            Planned payments from your card list. Mark each card as paying off vs using for bills on the
            Cards page.
          </p>
        </div>
      </div>
      <div className="px-4 pb-4 pt-3">
        {planned.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">
            No planned card payments yet. On{" "}
            <Link href="/credit-cards" className="text-teal-600 font-medium hover:underline">
              Credit cards
            </Link>
            , set payment amount and due day.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {planned.map((c) => {
              const color = c.color ?? CREDIT_CARDS_PLANNER_COLOR;
              const isPaidForMonth = c.markedPaidForMonth === budgetMonth;
              const dueDay = c.dueDayOfMonth ?? 1;
              const daysUntilPayment = calendarDaysFromTo(
                todayStart,
                dateInBudgetMonth(budgetMonth, dueDay)
              );
              const isPast = !isPaidForMonth && daysUntilPayment < 0;
              const isUrgent = daysUntilPayment >= 0 && daysUntilPayment <= 3;
              const usageShort =
                c.usageMode === "paying_off"
                  ? CREDIT_CARD_USAGE_LABELS.paying_off
                  : CREDIT_CARD_USAGE_LABELS.active_use;

              return (
                <li key={c._id}>
                  <div
                    className={`flex items-center gap-2 rounded-xl px-2 py-2 border ${
                      isPaidForMonth
                        ? "bg-teal-50/60 border-teal-100/80"
                        : "bg-white border-slate-100"
                    } select-none`}
                    style={{ borderLeftWidth: 3, borderLeftColor: color }}
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        setPaidTogglePendingId(c._id);
                        try {
                          await setCardPaidForMonth({
                            id: c._id,
                            userId,
                            monthKey: budgetMonth,
                            paid: !isPaidForMonth,
                          });
                        } finally {
                          setPaidTogglePendingId(null);
                        }
                      }}
                      disabled={paidTogglePendingId === c._id}
                      aria-pressed={isPaidForMonth}
                      className={`shrink-0 p-1 rounded-lg transition-colors disabled:opacity-50 ${
                        isPaidForMonth
                          ? "text-teal-600 hover:bg-teal-100/80"
                          : "text-slate-300 hover:text-teal-600 hover:bg-teal-50"
                      }`}
                    >
                      {isPaidForMonth ? (
                        <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <Circle className="w-5 h-5" aria-hidden="true" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800">{c.name}</span>
                        <span className="text-sm font-semibold text-slate-600">
                          {formatCurrency(c.plannedMonthlyPayment ?? 0)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                            c.usageMode === "paying_off"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {usageShort}
                        </span>
                        {c.isAutopay && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                            Auto-pay
                          </span>
                        )}
                        {isUrgent && !isPast && (
                          <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md">
                            Due soon
                          </span>
                        )}
                        {isPast && (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                            Due date passed
                          </span>
                        )}
                        {isPaidForMonth && (
                          <span className="text-[10px] font-semibold bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded-md">
                            Paid
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          Due {ordinal(c.dueDayOfMonth ?? 0)}
                        </span>
                        <Link
                          href="/credit-cards"
                          className="text-xs text-teal-600 font-medium hover:underline"
                        >
                          Edit on Credit cards
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

interface DebtListDoc {
  _id: Id<"debts">;
  name: string;
  plannedMonthlyPayment?: number;
  dueDayOfMonth?: number;
  markedPaidForMonth?: string;
  color?: string;
  isAutopay?: boolean;
}

function DebtsMonthlySection({
  debts,
  budgetMonth,
  userId,
}: {
  debts: DebtListDoc[] | undefined;
  budgetMonth: string;
  userId: string;
}) {
  const setDebtPaidForMonth = useMutation(api.debts.setPaidForMonth);
  const [paidTogglePendingId, setPaidTogglePendingId] = useState<Id<"debts"> | null>(null);
  const todayStart = startOfLocalDay(new Date());

  const planned = (debts ?? []).filter(
    (d) =>
      (d.plannedMonthlyPayment ?? 0) > 0 &&
      d.dueDayOfMonth != null &&
      d.dueDayOfMonth >= 1 &&
      d.dueDayOfMonth <= 31
  );

  if (debts === undefined) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-2.5">
        <div className="h-20 animate-pulse bg-slate-50 m-3 rounded-xl" />
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-2.5"
      style={{ borderLeft: `3px solid ${DEBTS_PLANNER_COLOR}` }}
    >
      <div className="px-4 py-3.5 flex items-center gap-3 border-b border-slate-50">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${DEBTS_PLANNER_COLOR}18` }}
        >
          <Landmark className="w-5 h-5" style={{ color: DEBTS_PLANNER_COLOR }} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800">Debts</p>
          <p className="text-sm text-slate-500">
            Planned monthly payments from your loans list (not budget categories).
          </p>
        </div>
      </div>
      <div className="px-4 pb-4 pt-3">
        {planned.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">
            No planned payments yet. On the{" "}
            <Link href="/debts" className="text-teal-600 font-medium hover:underline">
              Debts
            </Link>{" "}
            page, set <strong className="font-semibold text-slate-600">planned monthly paydown</strong> and a{" "}
            <strong className="font-semibold text-slate-600">due day</strong> for each loan.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {planned.map((d) => {
              const color = d.color ?? DEBTS_PLANNER_COLOR;
              const isPaidForMonth = d.markedPaidForMonth === budgetMonth;
              const dueDay = d.dueDayOfMonth ?? 1;
              const daysUntilPayment = calendarDaysFromTo(
                todayStart,
                dateInBudgetMonth(budgetMonth, dueDay)
              );
              const isPast = !isPaidForMonth && daysUntilPayment < 0;
              const isUrgent = daysUntilPayment >= 0 && daysUntilPayment <= 3;

              return (
                <li key={d._id}>
                  <div
                    className={`flex items-center gap-2 rounded-xl px-2 py-2 border ${
                      isPaidForMonth
                        ? "bg-teal-50/60 border-teal-100/80"
                        : "bg-white border-slate-100"
                    } select-none`}
                    style={{ borderLeftWidth: 3, borderLeftColor: color }}
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        setPaidTogglePendingId(d._id);
                        try {
                          await setDebtPaidForMonth({
                            id: d._id,
                            userId,
                            monthKey: budgetMonth,
                            paid: !isPaidForMonth,
                          });
                        } finally {
                          setPaidTogglePendingId(null);
                        }
                      }}
                      disabled={paidTogglePendingId === d._id}
                      aria-pressed={isPaidForMonth}
                      className={`flex-shrink-0 p-1 rounded-lg transition-colors disabled:opacity-50 ${
                        isPaidForMonth
                          ? "text-teal-600 hover:bg-teal-100/80"
                          : "text-slate-300 hover:text-teal-600 hover:bg-teal-50"
                      }`}
                    >
                      {isPaidForMonth ? (
                        <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <Circle className="w-5 h-5" aria-hidden="true" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800">{d.name}</span>
                        <span className="text-sm font-semibold text-slate-600">
                          {formatCurrency(d.plannedMonthlyPayment ?? 0)}
                        </span>
                        {d.isAutopay && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                            Auto-pay
                          </span>
                        )}
                        {isUrgent && !isPast && (
                          <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md">
                            Due soon
                          </span>
                        )}
                        {isPast && (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                            Due date passed
                          </span>
                        )}
                        {isPaidForMonth && (
                          <span className="text-[10px] font-semibold bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded-md">
                            Paid
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          Due {ordinal(d.dueDayOfMonth ?? 0)}
                        </span>
                        <Link
                          href="/debts"
                          className="text-xs text-teal-600 font-medium hover:underline"
                        >
                          Edit on Debts
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
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
  const debts = useQuery(api.debts.list, user ? { userId: user.id } : "skip");
  const creditCards = useQuery(api.creditCards.list, user ? { userId: user.id } : "skip");
  const archiveCategory = useMutation(api.categories.archive);
  const updateExpense = useMutation(api.budgetItems.update);

  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [archivePendingId, setArchivePendingId] = useState<Id<"categories"> | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const categoryListSigRef = useRef<string | null>(null);
  const [expenseDrag, setExpenseDrag] = useState<ExpenseDragState | null>(null);
  const [dropHighlightCategoryId, setDropHighlightCategoryId] = useState<Id<"categories"> | null>(
    null
  );
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false);
  const [newExpenseCategoryId, setNewExpenseCategoryId] = useState<Id<"categories"> | null>(
    null
  );

  const budgetMonth = getCurrentMonth();

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
    const pending = expenseDrag;
    setExpenseDrag(null);
    setDropHighlightCategoryId(null);
    if (!pending || pending.fromCategoryId === targetCatId) return;
    try {
      await updateExpense({ id: pending.itemId, categoryId: targetCatId });
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

  useEffect(() => {
    if (!categories) return;
    if (categories.length === 0) {
      categoryListSigRef.current = null;
      setExpandedCategories(new Set());
      return;
    }
    const sig = categories
      .map((c) => c._id)
      .sort()
      .join("|");
    const prevSig = categoryListSigRef.current;
    const prevIds = prevSig ? new Set(prevSig.split("|")) : null;
    categoryListSigRef.current = sig;

    setExpandedCategories((prev) => {
      if (!prevIds) {
        return new Set(categories.map((c) => c._id));
      }
      const next = new Set(prev);
      for (const c of categories) {
        if (!prevIds.has(c._id)) {
          next.add(c._id);
        }
      }
      for (const id of next) {
        if (!categories.some((c) => c._id === id)) {
          next.delete(id);
        }
      }
      return next;
    });
  }, [categories]);

  const toggleExpand = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleEdit = (cat: Category) => {
    setEditCategory(cat);
    setShowForm(true);
  };

  const handleArchiveConfirm = async () => {
    if (!archivePendingId) return;
    await archiveCategory({ id: archivePendingId });
    setArchivePendingId(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditCategory(null);
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
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage budget groups and recurring expenses. Drag an expense onto another category to move it.{" "}
            <Link href="/dashboard" className="text-teal-600 font-medium hover:text-teal-700">
              Dashboard
            </Link>{" "}
            has the month timeline, set-asides, and account availability.
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
                  className="inline-flex items-center justify-center gap-1.5 border border-teal-200 bg-white text-teal-800 text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-50 active:scale-[0.97] transition-all shadow-sm w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  New expense
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowForm(true);
                  setEditCategory(null);
                }}
                className="bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 active:scale-[0.97] transition-all shadow-sm w-full sm:w-auto"
              >
                + New Category
              </button>
            </div>
          )}
        </div>
      </div>

      {categories !== undefined && categories.length > 0 && (
        <div className="rounded-xl border border-teal-100 bg-linear-to-r from-teal-50/90 to-slate-50/80 px-4 py-3 text-sm shadow-sm">
          <p className="font-semibold text-teal-950 tracking-tight">{formatMonth(budgetMonth)}</p>
          <p className="text-slate-600 text-xs mt-1 leading-relaxed">
            Recurring expenses below are for this month; <strong className="font-semibold text-slate-700">Credit cards</strong>{" "}
            and <strong className="font-semibold text-slate-700">Debts</strong> at the bottom list planned
            payments. Tap the circle when you&apos;ve paid—checkmarks reset next calendar month. Open the{" "}
            <Link href="/dashboard" className="text-teal-700 font-semibold hover:underline">
              dashboard
            </Link>{" "}
            for the bill timeline and cash set-asides.
          </p>
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-5">
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
            <div key={i} className="bg-white rounded-2xl border border-slate-100 h-18 animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-500 mb-1 font-medium">No categories yet</p>
          <p className="text-slate-500 text-sm mb-5">Create budget categories to start tracking your spending</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-teal-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-teal-700 active:scale-[0.97] transition-all"
          >
            Create your first category
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {categories.map((cat) => {
            const isExpanded = expandedCategories.has(cat._id);
            const color = cat.color ?? "#0d9488";
            const plannedSum = plannedByCategory[cat._id] ?? 0;

            const showDropRing =
              expenseDrag &&
              dropHighlightCategoryId === cat._id &&
              expenseDrag.fromCategoryId !== cat._id;

            return (
              <div key={cat._id}>
                <div
                  className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-shadow ${
                    showDropRing ? "ring-2 ring-teal-400 ring-offset-2" : ""
                  }`}
                  style={{ borderLeft: `3px solid ${color}` }}
                  onDragOver={(e) => handleCategoryDragOver(e, cat._id)}
                  onDragLeave={handleCategoryDragLeave}
                  onDrop={(e) => handleCategoryDrop(e, cat._id)}
                >
                  {/* Category header row */}
                  <div className="px-4 py-3.5 flex items-center justify-between group hover:bg-slate-50 transition-colors">
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
                        <p className="font-semibold text-slate-800">{cat.name}</p>
                        <p className="text-sm text-slate-500">
                          {formatCurrency(plannedSum)} / month from expenses
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Sum of recurring expenses in this category
                        </p>
                      </div>
                      <div className="ml-2 text-slate-400 flex-shrink-0">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4" aria-hidden="true" />
                          : <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        }
                      </div>
                    </button>

                    <div className="flex gap-1 flex-shrink-0 ml-2">
                      <button
                        onClick={() => handleEdit(cat)}
                        className="text-sm text-teal-600 hover:text-teal-700 px-3 py-2 lg:py-1.5 rounded-lg hover:bg-teal-50 transition-colors font-medium min-h-[2.75rem] lg:min-h-0 flex items-center"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setArchivePendingId(archivePendingId === cat._id ? null : cat._id)}
                        aria-expanded={archivePendingId === cat._id}
                        className="text-sm text-slate-500 hover:text-rose-600 px-3 py-2 lg:py-1.5 rounded-lg hover:bg-rose-50 transition-colors min-h-[2.75rem] lg:min-h-0 flex items-center"
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
                        budgetMonth={budgetMonth}
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
                    className="mt-1 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <p className="text-sm text-rose-700">
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
                        className="text-sm font-medium text-slate-600 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <CreditCardsMonthlySection
            cards={creditCards}
            budgetMonth={budgetMonth}
            userId={user.id}
          />
          <DebtsMonthlySection debts={debts} budgetMonth={budgetMonth} userId={user.id} />
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
            className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="new-expense-dialog-title" className="font-semibold text-slate-800 mb-4">
              New expense
            </h2>
            <div className="mb-4">
              <label htmlFor="new-expense-category" className="block text-xs font-medium text-slate-600 mb-1.5">
                Category
              </label>
              <select
                id="new-expense-category"
                value={newExpenseCategoryId}
                onChange={(e) => setNewExpenseCategoryId(e.target.value as Id<"categories">)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
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
