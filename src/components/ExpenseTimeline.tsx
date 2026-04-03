"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  formatCurrency,
  formatMonth,
  CREDIT_CARD_USAGE_LABELS,
  budgetItemPaidFromLabel,
  calendarDaysFromTo,
  dateInBudgetMonth,
  startOfLocalDay,
  expenseFundingLevel,
  expenseHasPayFromAccount,
} from "@/lib/utils";
import { CATEGORY_ICON_MAP } from "@/lib/icons";
import { BudgetItemManager } from "@/components/BudgetItemManager";
import { BudgetAllocationModal } from "@/components/BudgetAllocationModal";
import { DebtManager } from "@/components/DebtManager";
import {
  CheckCircle2,
  Circle,
  CreditCard,
  Landmark,
  MoreVertical,
  PiggyBank,
} from "lucide-react";

export interface TimelineCategory {
  _id: Id<"categories">;
  name: string;
  color?: string;
  icon?: string;
}

export interface TimelineExpense {
  _id: Id<"budgetItems">;
  categoryId: Id<"categories">;
  name: string;
  amount: number;
  paymentDayOfMonth: number;
  paidFrom?: string;
  accountId?: Id<"accounts">;
  markedPaidForMonth?: string;
  status?: "unfunded" | "funded" | "paid";
  fundedDate?: number;
  paidDate?: number;
  isAutopay?: boolean;
  note?: string;
}

export type PlannerBudgetRow = TimelineExpense & { rowKind: "budget" };

export type PlannerDebtRow = {
  rowKind: "debt";
  debtId: Id<"debts">;
  name: string;
  amount: number;
  paymentDayOfMonth: number;
  markedPaidForMonth?: string;
  accentColor?: string;
  isAutopay?: boolean;
  paymentAccountId?: Id<"accounts">;
  /** False when due day was defaulted for timeline placement — user should set on Debts page. */
  hasConfiguredDueDay?: boolean;
};

export type PlannerCreditCardRow = {
  rowKind: "creditCard";
  creditCardId: Id<"creditCards">;
  name: string;
  amount: number;
  paymentDayOfMonth: number;
  markedPaidForMonth?: string;
  accentColor?: string;
  isAutopay?: boolean;
  usageMode: "paying_off" | "active_use";
  paymentAccountId?: Id<"accounts">;
  hasConfiguredDueDay?: boolean;
};

export type PlannerRow = PlannerBudgetRow | PlannerDebtRow | PlannerCreditCardRow;

function rowKey(row: PlannerRow): string {
  if (row.rowKind === "budget") return `b:${row._id}`;
  if (row.rowKind === "creditCard") return `cc:${row.creditCardId}`;
  return `d:${row.debtId}`;
}

function rowSortOrder(row: PlannerRow): number {
  if (row.rowKind === "budget") return 0;
  if (row.rowKind === "creditCard") return 1;
  return 2;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function TimelineRowActionsMenu({
  rowKey,
  menuOpenKey,
  setMenuOpenKey,
  children,
}: {
  rowKey: string;
  menuOpenKey: string | null;
  setMenuOpenKey: (key: string | null) => void;
  children: ReactNode;
}) {
  const open = menuOpenKey === rowKey;
  return (
    <div className="relative shrink-0" data-timeline-row-menu>
      <button
        type="button"
        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpenKey(open ? null : rowKey);
        }}
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Open row actions</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-0.5 min-w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

interface ExpenseTimelineProps {
  items: PlannerRow[];
  categories: TimelineCategory[];
  budgetMonth: string;
  userId: string;
  /** Full debt records so timeline rows can open the same edit flow as the Debts page. */
  debts?: Doc<"debts">[];
}

export function ExpenseTimeline({
  items,
  categories,
  budgetMonth,
  userId,
  debts,
}: ExpenseTimelineProps) {
  const archiveItem = useMutation(api.budgetItems.archive);
  const updateBudgetItem = useMutation(api.budgetItems.update);
  const setBudgetPaidForMonth = useMutation(api.budgetItems.setPaidForMonth);
  const fundExpenseMutation = useMutation(api.budgetItems.fundExpense);
  const setDebtPaidForMonth = useMutation(api.debts.setPaidForMonth);
  const setCreditCardPaidForMonth = useMutation(api.creditCards.setPaidForMonth);

  const allocations = useQuery(api.expenseAllocations.listByUserMonth, {
    userId,
    monthKey: budgetMonth,
  });

  const allocatedByBudgetId = useMemo(() => {
    if (!allocations) return {};
    const m: Record<string, number> = {};
    for (const a of allocations) {
      const k = a.budgetItemId as string;
      m[k] = (m[k] ?? 0) + a.amount;
    }
    return m;
  }, [allocations]);

  const accounts = useQuery(api.accounts.list, { userId });
  const accountMap = useMemo((): Record<string, { name: string }> => {
    if (!accounts) return {};
    return Object.fromEntries(accounts.map((a) => [a._id, { name: a.name }]));
  }, [accounts]);

  const todayStart = startOfLocalDay(new Date());
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c._id, c])),
    [categories]
  );

  const groupedByDueDay = useMemo(() => {
    if (!items.length) return [];
    const map = new Map<number, PlannerRow[]>();
    for (const item of items) {
      const d = item.paymentDayOfMonth;
      const list = map.get(d) ?? [];
      list.push(item);
      map.set(d, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, list]) => ({
        day,
        items: [...list].sort((a, b) => {
          const oa = rowSortOrder(a);
          const ob = rowSortOrder(b);
          if (oa !== ob) return oa - ob;
          return a.name.localeCompare(b.name);
        }),
      }));
  }, [items]);

  const [editTarget, setEditTarget] = useState<TimelineExpense | null>(null);
  const [editDebtId, setEditDebtId] = useState<Id<"debts"> | null>(null);
  const [archivePendingId, setArchivePendingId] = useState<Id<"budgetItems"> | null>(null);
  const [paidTogglePendingKey, setPaidTogglePendingKey] = useState<string | null>(null);
  const [autopayTogglePendingId, setAutopayTogglePendingId] =
    useState<Id<"budgetItems"> | null>(null);
  const [allocationTarget, setAllocationTarget] = useState<TimelineExpense | null>(null);
  const [fundExpensePendingId, setFundExpensePendingId] =
    useState<Id<"budgetItems"> | null>(null);
  const [rowMenuKey, setRowMenuKey] = useState<string | null>(null);

  useEffect(() => {
    if (rowMenuKey == null) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-timeline-row-menu]")) return;
      setRowMenuKey(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [rowMenuKey]);

  const handleArchive = async (id: Id<"budgetItems">) => {
    await archiveItem({ id });
    setArchivePendingId(null);
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-10 text-center">
        <p className="text-slate-600 text-sm font-medium">Nothing on the timeline this month</p>
        <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
          Add recurring expenses under a category, or set planned payments on credit cards and debts.
        </p>
      </div>
    );
  }

  const DEBTS_SECTION_COLOR = "#475569";
  const CREDIT_CARDS_SECTION_COLOR = "#4f46e5";

  return (
    <div className="relative w-full min-w-0">
      <div className="absolute left-[8px] sm:left-[11px] top-3 bottom-3 w-px bg-slate-200" aria-hidden="true" />

      <ol className="space-y-6 w-full min-w-0">
        {groupedByDueDay.map(({ day, items: dayItems }) => {
          const dueDateStart = dateInBudgetMonth(budgetMonth, day);
          const deltaNeeded = calendarDaysFromTo(todayStart, dueDateStart);
          const isToday = deltaNeeded === 0;
          const isPast = deltaNeeded < 0;
          let rel: string | null = null;
          if (isToday) rel = "Today";
          else if (deltaNeeded === 1) rel = "Tomorrow";
          else if (deltaNeeded > 1) rel = `In ${deltaNeeded} days`;
          else if (deltaNeeded === -1) rel = "Yesterday";
          else if (deltaNeeded < -1) rel = `${Math.abs(deltaNeeded)} days ago`;

          return (
            <li key={day} className="relative pl-9 sm:pl-10 w-full min-w-0">
              <div
                className={`absolute left-0 top-0.5 flex h-[18px] w-[18px] sm:h-[22px] sm:w-[22px] items-center justify-center rounded-full border-2 bg-white ${
                  isToday
                    ? "border-teal-500 shadow-[0_0_0_3px_rgba(20,184,166,0.2)]"
                    : isPast
                    ? "border-slate-200"
                    : "border-teal-300"
                }`}
                aria-hidden="true"
              >
                <span
                  className={`text-[9px] sm:text-[10px] font-bold tabular-nums ${
                    isToday ? "text-teal-700" : isPast ? "text-slate-400" : "text-teal-600"
                  }`}
                >
                  {day}
                </span>
              </div>

              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm">
                <h3 className="font-semibold text-slate-800">Due {ordinal(day)}</h3>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-400">{formatMonth(budgetMonth)}</span>
                {rel && (
                  <>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span
                      className={
                        isToday
                          ? "text-teal-700 font-medium"
                          : isPast
                          ? "text-slate-400"
                          : "text-slate-500"
                      }
                    >
                      {rel}
                    </span>
                  </>
                )}
              </div>

              <ul className="space-y-1.5 w-full min-w-0">
                {dayItems.map((item) => {
                  const rk = rowKey(item);

                  if (item.rowKind === "creditCard") {
                    const color = item.accentColor ?? CREDIT_CARDS_SECTION_COLOR;
                    const bankLinked = expenseHasPayFromAccount({
                      paymentAccountId: item.paymentAccountId,
                    });
                    const isPaidForMonth = item.markedPaidForMonth === budgetMonth;
                    const paymentStart = dateInBudgetMonth(budgetMonth, item.paymentDayOfMonth);
                    const deltaPayment = calendarDaysFromTo(todayStart, paymentStart);
                    const isDuePast = !isPaidForMonth && deltaPayment < 0;
                    const usageLabel =
                      item.usageMode === "paying_off"
                        ? CREDIT_CARD_USAGE_LABELS.paying_off
                        : CREDIT_CARD_USAGE_LABELS.active_use;
                    const payFromCc =
                      item.paymentAccountId && accountMap[item.paymentAccountId]
                        ? `Pay from ${accountMap[item.paymentAccountId].name}`
                        : null;
                    const metaParts = [
                      item.hasConfiguredDueDay === false
                        ? `Due ${ordinal(item.paymentDayOfMonth)} (placeholder — set on Cards)`
                        : null,
                      item.isAutopay ? "Autopay" : null,
                      usageLabel,
                      payFromCc,
                    ].filter(Boolean);
                    const metaLine = metaParts.join(" · ");
                    const ccSubline = [
                      !bankLinked ? "No bank linked" : null,
                      metaLine || null,
                      isDuePast ? "Past due" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <li key={rk} className="w-full min-w-0">
                        <div
                          className={`group/row flex w-full min-w-0 items-center gap-1.5 sm:gap-2 rounded-lg border py-1 pl-1 pr-1.5 sm:pr-2 shadow-sm transition-colors ${
                            isPaidForMonth
                              ? "bg-teal-50/45 border-teal-100/90"
                              : !bankLinked
                              ? "bg-white border-amber-100/90"
                              : "bg-white border-slate-100"
                          }`}
                          style={{ borderLeftWidth: 3, borderLeftColor: color }}
                        >
                          <button
                            type="button"
                            onClick={async () => {
                              setPaidTogglePendingKey(rk);
                              try {
                                await setCreditCardPaidForMonth({
                                  id: item.creditCardId,
                                  userId,
                                  monthKey: budgetMonth,
                                  paid: !isPaidForMonth,
                                });
                              } finally {
                                setPaidTogglePendingKey(null);
                              }
                            }}
                            disabled={paidTogglePendingKey === rk}
                            aria-pressed={isPaidForMonth}
                            title={
                              isPaidForMonth
                                ? `Paid for ${formatMonth(budgetMonth)} — click to clear`
                                : `Mark as paid — payment settled this month`
                            }
                            aria-label={
                              isPaidForMonth
                                ? `Mark ${item.name} payment not paid for ${formatMonth(budgetMonth)}`
                                : `Mark ${item.name} payment paid for ${formatMonth(budgetMonth)}`
                            }
                            className={`shrink-0 rounded-md p-0.5 transition-colors disabled:opacity-50 ${
                              isPaidForMonth
                                ? "text-teal-600 hover:bg-teal-100/80"
                                : "text-slate-300 hover:text-teal-600 hover:bg-teal-50"
                            }`}
                          >
                            {isPaidForMonth ? (
                              <CheckCircle2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" aria-hidden="true" />
                            ) : (
                              <Circle className="w-4 h-4 sm:w-[18px] sm:h-[18px]" aria-hidden="true" />
                            )}
                          </button>

                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${CREDIT_CARDS_SECTION_COLOR}26` }}
                            title="Credit cards"
                          >
                            <CreditCard
                              className="w-3 h-3"
                              style={{ color: CREDIT_CARDS_SECTION_COLOR }}
                              aria-hidden="true"
                            />
                          </div>

                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="truncate text-xs font-medium text-slate-800 sm:text-sm">
                              {item.name}
                              <span className="font-normal text-slate-400"> · payment</span>
                            </div>
                            {ccSubline ? (
                              <p className="truncate text-[10px] leading-snug text-slate-500" title={ccSubline}>
                                {ccSubline}
                              </p>
                            ) : null}
                          </div>

                          <span className="shrink-0 tabular-nums text-xs sm:text-sm font-semibold text-slate-800">
                            {formatCurrency(item.amount)}
                          </span>

                          <TimelineRowActionsMenu
                            rowKey={rk}
                            menuOpenKey={rowMenuKey}
                            setMenuOpenKey={setRowMenuKey}
                          >
                            <Link
                              href="/credit-cards"
                              role="menuitem"
                              className="block px-3 py-1.5 text-left text-sm font-medium text-teal-700 hover:bg-teal-50"
                              onClick={() => setRowMenuKey(null)}
                            >
                              Credit cards
                            </Link>
                          </TimelineRowActionsMenu>
                        </div>
                      </li>
                    );
                  }

                  if (item.rowKind === "debt") {
                    const color = item.accentColor ?? DEBTS_SECTION_COLOR;
                    const bankLinked = expenseHasPayFromAccount({
                      paymentAccountId: item.paymentAccountId,
                    });
                    const isPaidForMonth = item.markedPaidForMonth === budgetMonth;
                    const paymentStart = dateInBudgetMonth(budgetMonth, item.paymentDayOfMonth);
                    const deltaPayment = calendarDaysFromTo(todayStart, paymentStart);
                    const isDuePast = !isPaidForMonth && deltaPayment < 0;
                    const payFromDebt =
                      item.paymentAccountId && accountMap[item.paymentAccountId]
                        ? `Pay from ${accountMap[item.paymentAccountId].name}`
                        : null;
                    const metaParts = [
                      item.hasConfiguredDueDay === false
                        ? `Due ${ordinal(item.paymentDayOfMonth)} (placeholder — set on Debts)`
                        : null,
                      item.isAutopay ? "Autopay" : null,
                      payFromDebt,
                      item.amount <= 0.005 ? "Add planned paydown ($)" : null,
                    ].filter(Boolean);
                    const metaLine = metaParts.join(" · ");
                    const debtSubline = [
                      !bankLinked ? "No bank linked" : null,
                      metaLine || null,
                      isDuePast ? "Past due" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    const debtEditable = debts?.some((d) => d._id === item.debtId);

                    return (
                      <li key={rk} className="w-full min-w-0">
                        <div
                          className={`group/row flex w-full min-w-0 items-center gap-1.5 sm:gap-2 rounded-lg border py-1 pl-1 pr-1.5 sm:pr-2 shadow-sm transition-colors ${
                            isPaidForMonth
                              ? "bg-teal-50/45 border-teal-100/90"
                              : !bankLinked
                              ? "bg-white border-amber-100/90"
                              : "bg-white border-slate-100"
                          }`}
                          style={{ borderLeftWidth: 3, borderLeftColor: color }}
                        >
                          <button
                            type="button"
                            onClick={async () => {
                              setPaidTogglePendingKey(rk);
                              try {
                                await setDebtPaidForMonth({
                                  id: item.debtId,
                                  userId,
                                  monthKey: budgetMonth,
                                  paid: !isPaidForMonth,
                                });
                              } finally {
                                setPaidTogglePendingKey(null);
                              }
                            }}
                            disabled={paidTogglePendingKey === rk}
                            aria-pressed={isPaidForMonth}
                            title={
                              isPaidForMonth
                                ? `Paid for ${formatMonth(budgetMonth)} — click to clear`
                                : `Mark as paid — payment settled this month`
                            }
                            aria-label={
                              isPaidForMonth
                                ? `Mark ${item.name} payment not paid for ${formatMonth(budgetMonth)}`
                                : `Mark ${item.name} payment paid for ${formatMonth(budgetMonth)}`
                            }
                            className={`shrink-0 rounded-md p-0.5 transition-colors disabled:opacity-50 ${
                              isPaidForMonth
                                ? "text-teal-600 hover:bg-teal-100/80"
                                : "text-slate-300 hover:text-teal-600 hover:bg-teal-50"
                            }`}
                          >
                            {isPaidForMonth ? (
                              <CheckCircle2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" aria-hidden="true" />
                            ) : (
                              <Circle className="w-4 h-4 sm:w-[18px] sm:h-[18px]" aria-hidden="true" />
                            )}
                          </button>

                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${DEBTS_SECTION_COLOR}26` }}
                            title="Debts"
                          >
                            <Landmark
                              className="w-3 h-3"
                              style={{ color: DEBTS_SECTION_COLOR }}
                              aria-hidden="true"
                            />
                          </div>

                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="truncate text-xs font-medium text-slate-800 sm:text-sm">
                              {item.name}
                              <span className="font-normal text-slate-400"> · payment</span>
                            </div>
                            {debtSubline ? (
                              <p className="truncate text-[10px] leading-snug text-slate-500" title={debtSubline}>
                                {debtSubline}
                              </p>
                            ) : null}
                          </div>

                          <span className="shrink-0 tabular-nums text-xs sm:text-sm font-semibold text-slate-800">
                            {formatCurrency(item.amount)}
                          </span>

                          <TimelineRowActionsMenu
                            rowKey={rk}
                            menuOpenKey={rowMenuKey}
                            setMenuOpenKey={setRowMenuKey}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              disabled={!debtEditable}
                              className="block w-full px-3 py-1.5 text-left text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
                              onClick={() => {
                                if (!debtEditable) return;
                                setEditDebtId(item.debtId);
                                setRowMenuKey(null);
                              }}
                            >
                              Edit
                            </button>
                            <Link
                              href="/debts"
                              role="menuitem"
                              className="block px-3 py-1.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
                              onClick={() => setRowMenuKey(null)}
                            >
                              Debts page
                            </Link>
                          </TimelineRowActionsMenu>
                        </div>
                      </li>
                    );
                  }

                  if (item.rowKind !== "budget") {
                    return null;
                  }
                  const cat = categoryMap[item.categoryId];
                  const color = cat?.color ?? "#0d9488";
                  const iconName = cat?.icon;
                  const IconComp = iconName ? CATEGORY_ICON_MAP[iconName] : null;
                  const isPaidForMonth = item.markedPaidForMonth === budgetMonth;
                  const paymentStart = dateInBudgetMonth(budgetMonth, item.paymentDayOfMonth);
                  const deltaPayment = calendarDaysFromTo(todayStart, paymentStart);
                  const isDuePast = !isPaidForMonth && deltaPayment < 0;
                  const setAsideTotal = allocatedByBudgetId[item._id] ?? 0;
                  const earmarkLevel = expenseFundingLevel(item.amount, setAsideTotal);
                  const accountFunded = expenseHasPayFromAccount(item);
                  const isOverAllocated =
                    item.amount > 0.005 && setAsideTotal > item.amount + 0.005;
                  const isReserved =
                    item.status === "funded" && !isPaidForMonth;

                  const paidFromResolved = budgetItemPaidFromLabel(item, accountMap);
                  const metaLine = [
                    item.isAutopay ? "Autopay" : null,
                    paidFromResolved ?? null,
                    item.note ? item.note : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const budgetSubline = [
                    !accountFunded ? "No bank linked" : null,
                    metaLine || null,
                    isReserved ? "Reserved" : null,
                    earmarkLevel === "full" && !isPaidForMonth && !isReserved ? "Earmarked" : null,
                    earmarkLevel === "partial" && !isPaidForMonth ? "Partly funded" : null,
                    isOverAllocated && !isPaidForMonth ? "Over-funded" : null,
                    isDuePast ? "Past due" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <li key={rk} className="w-full min-w-0">
                      <div
                        className={`group/row flex w-full min-w-0 items-center gap-1.5 sm:gap-2 rounded-lg border py-1 pl-1 pr-1.5 sm:pr-2 shadow-sm transition-colors ${
                          isPaidForMonth
                            ? "bg-emerald-50/55 border-emerald-200/85 ring-1 ring-emerald-200/45"
                            : isReserved
                            ? "bg-emerald-50/40 border-emerald-200/80 ring-1 ring-emerald-200/35"
                            : isOverAllocated
                            ? "bg-white border-slate-100 ring-2 ring-amber-400/65 ring-offset-2 ring-offset-white"
                            : !accountFunded
                            ? "bg-white border-amber-100/90"
                            : "bg-white border-slate-100"
                        }`}
                        style={{ borderLeftWidth: 3, borderLeftColor: color }}
                      >
                        <button
                          type="button"
                          onClick={async () => {
                            setPaidTogglePendingKey(rk);
                            try {
                              await setBudgetPaidForMonth({
                                id: item._id,
                                monthKey: budgetMonth,
                                paid: !isPaidForMonth,
                              });
                            } finally {
                              setPaidTogglePendingKey(null);
                            }
                          }}
                          disabled={paidTogglePendingKey === rk}
                          aria-pressed={isPaidForMonth}
                          title={
                            isPaidForMonth
                              ? `Paid for ${formatMonth(budgetMonth)} — click to clear`
                              : `Mark as paid — bill settled this month`
                          }
                          aria-label={
                            isPaidForMonth
                              ? `Mark ${item.name} not paid for ${formatMonth(budgetMonth)}`
                              : `Mark ${item.name} paid for ${formatMonth(budgetMonth)}`
                          }
                          className={`shrink-0 rounded-md p-0.5 transition-colors disabled:opacity-50 ${
                            isPaidForMonth
                              ? "text-emerald-600 hover:bg-emerald-100/80"
                              : "text-slate-300 hover:text-teal-600 hover:bg-teal-50"
                          }`}
                        >
                          {isPaidForMonth ? (
                            <CheckCircle2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" aria-hidden="true" />
                          ) : (
                            <Circle className="w-4 h-4 sm:w-[18px] sm:h-[18px]" aria-hidden="true" />
                          )}
                        </button>

                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${color}26` }}
                          title={cat?.name ?? "Category"}
                          aria-label={cat?.name ?? "Category"}
                        >
                          {IconComp ? (
                            <IconComp className="w-3 h-3" style={{ color }} aria-hidden="true" />
                          ) : (
                            <span className="text-[10px] leading-none" aria-hidden="true">
                              {iconName ?? "💰"}
                            </span>
                          )}
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-0 overflow-hidden">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 sm:text-sm">
                              {item.name}
                            </span>
                            {(() => {
                              const aside = allocatedByBudgetId[item._id] ?? 0;
                              const overFunded = item.amount > 0.005 && aside > item.amount + 0.005;
                              return (
                                <span className="inline-flex shrink-0 items-center gap-0.5">
                                  <button
                                    type="button"
                                    title={
                                      overFunded
                                        ? "Earmark exceeds this bill (remove or adjust lines)"
                                        : "Earmark — plan cash from an account toward this bill this month"
                                    }
                                    onClick={() => setAllocationTarget(item)}
                                    className={`inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-semibold border sm:text-[11px] ${
                                      overFunded
                                        ? "border-amber-300 bg-amber-50/95 text-amber-900"
                                        : aside > 0.005
                                        ? "border-teal-200 bg-teal-50/90 text-teal-800"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:text-teal-700"
                                    }`}
                                  >
                                    <PiggyBank className="w-3 h-3 shrink-0" aria-hidden="true" />
                                    {aside > 0.005 ? (
                                      <span className="tabular-nums">
                                        {formatCurrency(aside)} / {formatCurrency(item.amount)}
                                      </span>
                                    ) : (
                                      <span>Earmark</span>
                                    )}
                                  </button>
                                  {accountFunded && !isPaidForMonth && item.status !== "funded" && (
                                    <button
                                      type="button"
                                      title="Reserve the full bill amount against Available from today (no split lines)"
                                      disabled={fundExpensePendingId === item._id}
                                      onClick={async () => {
                                        setFundExpensePendingId(item._id);
                                        try {
                                          await fundExpenseMutation({
                                            id: item._id,
                                            userId,
                                          });
                                        } finally {
                                          setFundExpensePendingId(null);
                                        }
                                      }}
                                      className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50/90 px-1 py-0.5 text-[10px] font-semibold text-emerald-900 hover:bg-emerald-100/90 disabled:opacity-50 sm:text-[11px]"
                                    >
                                      Reserve
                                    </button>
                                  )}
                                </span>
                              );
                            })()}
                          </div>
                          {budgetSubline ? (
                            <p
                              className="truncate text-[10px] leading-snug text-slate-500"
                              title={budgetSubline}
                            >
                              {budgetSubline}
                            </p>
                          ) : null}
                        </div>

                        <span className="shrink-0 tabular-nums text-xs sm:text-sm font-semibold text-slate-800">
                          {formatCurrency(item.amount)}
                        </span>

                        <label
                          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-slate-100 bg-slate-50/90 px-1.5 py-0.5 sm:px-2"
                          title="Auto-pay with payee"
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
                                await updateBudgetItem({
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
                          <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">
                            Auto
                          </span>
                        </label>

                        <TimelineRowActionsMenu
                          rowKey={rk}
                          menuOpenKey={rowMenuKey}
                          setMenuOpenKey={setRowMenuKey}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="block w-full px-3 py-1.5 text-left text-sm font-medium text-teal-700 hover:bg-teal-50"
                            onClick={() => {
                              setEditTarget(item);
                              setRowMenuKey(null);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="block w-full px-3 py-1.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              setArchivePendingId(
                                archivePendingId === item._id ? null : item._id
                              );
                              setRowMenuKey(null);
                            }}
                          >
                            Remove
                          </button>
                        </TimelineRowActionsMenu>
                      </div>

                      {archivePendingId === item._id && (
                        <div className="mt-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                          <p className="text-xs text-rose-700">
                            Remove <strong>{item.name}</strong>?
                          </p>
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleArchive(item._id)}
                              className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 px-2.5 py-1 rounded-lg"
                            >
                              Remove
                            </button>
                            <button
                              type="button"
                              onClick={() => setArchivePendingId(null)}
                              className="text-xs text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      {allocationTarget && (
        <BudgetAllocationModal
          open
          onClose={() => setAllocationTarget(null)}
          userId={userId}
          monthKey={budgetMonth}
          budgetItemId={allocationTarget._id}
          expenseName={allocationTarget.name}
          expenseAmount={allocationTarget.amount}
          defaultAccountId={allocationTarget.accountId ?? null}
          allocations={allocations ?? []}
          accounts={accounts?.map((a) => ({
            _id: a._id,
            name: a.name,
            accountType: a.accountType,
          }))}
        />
      )}

      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timeline-edit-title"
          onClick={() => setEditTarget(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="timeline-edit-title" className="font-semibold text-slate-800 mb-4">
              Edit expense
            </h2>
            <BudgetItemManager
              categoryId={editTarget.categoryId}
              editItem={editTarget}
              transactionsMonthKey={budgetMonth}
              onSuccess={() => setEditTarget(null)}
              onCancel={() => setEditTarget(null)}
            />
          </div>
        </div>
      )}

      {editDebtId && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timeline-debt-edit-title"
          onClick={() => setEditDebtId(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="timeline-debt-edit-title" className="font-semibold text-slate-800 mb-4">
              Edit debt
            </h2>
            {(() => {
              const d = debts?.find((x) => x._id === editDebtId);
              if (!d) {
                return (
                  <p className="text-sm text-slate-600">
                    This debt is not available to edit. Try again from the{" "}
                    <Link href="/debts" className="font-medium text-teal-600 hover:text-teal-700">
                      Debts
                    </Link>{" "}
                    page.
                  </p>
                );
              }
              return (
                <DebtManager
                  key={editDebtId}
                  editDebt={d}
                  onSuccess={() => setEditDebtId(null)}
                  onCancel={() => setEditDebtId(null)}
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function clampPlannerDueDay(d: number | undefined | null): { day: number; configured: boolean } {
  if (d != null && d >= 1 && d <= 31) {
    return { day: d, configured: true };
  }
  return { day: 28, configured: false };
}

function debtPlannerAmount(d: Doc<"debts">): number {
  const planned = d.plannedMonthlyPayment ?? 0;
  if (planned > 0) return planned;
  return d.minimumPayment ?? 0;
}

function cardPlannerAmount(c: Doc<"creditCards">): number {
  const planned = c.plannedMonthlyPayment ?? 0;
  if (planned > 0) return planned;
  return c.minimumPayment ?? 0;
}

export function buildPlannerRows(
  allBudgetItems: Doc<"budgetItems">[] | undefined,
  debts: Doc<"debts">[] | undefined,
  creditCards: Doc<"creditCards">[] | undefined
): PlannerRow[] {
  const budget: PlannerRow[] = (allBudgetItems ?? []).map((i) => ({
    ...i,
    rowKind: "budget" as const,
  }));
  const cardRows: PlannerRow[] = (creditCards ?? []).map((c) => {
    const { day, configured } = clampPlannerDueDay(c.dueDayOfMonth);
    return {
      rowKind: "creditCard" as const,
      creditCardId: c._id,
      name: c.name,
      amount: cardPlannerAmount(c),
      paymentDayOfMonth: day,
      markedPaidForMonth: c.markedPaidForMonth,
      accentColor: c.color,
      isAutopay: c.isAutopay,
      paymentAccountId: c.paymentAccountId,
      hasConfiguredDueDay: configured,
      usageMode: (c.usageMode === "paying_off" ? "paying_off" : "active_use") as
        | "paying_off"
        | "active_use",
    };
  });
  const debtRows: PlannerRow[] = (debts ?? []).map((d) => {
    const { day, configured } = clampPlannerDueDay(d.dueDayOfMonth);
    return {
      rowKind: "debt" as const,
      debtId: d._id,
      name: d.name,
      amount: debtPlannerAmount(d),
      paymentDayOfMonth: day,
      markedPaidForMonth: d.markedPaidForMonth,
      accentColor: d.color,
      isAutopay: d.isAutopay,
      paymentAccountId: d.paymentAccountId,
      hasConfiguredDueDay: configured,
    };
  });
  return [...budget, ...cardRows, ...debtRows];
}
