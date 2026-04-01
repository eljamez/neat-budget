"use client";

import { useMemo, useState } from "react";
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
} from "@/lib/utils";
import { CATEGORY_ICON_MAP } from "@/lib/icons";
import { BudgetItemManager } from "@/components/BudgetItemManager";
import { BudgetAllocationModal } from "@/components/BudgetAllocationModal";
import { CheckCircle2, Circle, Landmark, CreditCard, PiggyBank } from "lucide-react";

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
  moneyNeededByDay: number;
  paidFrom?: string;
  accountId?: Id<"accounts">;
  markedPaidForMonth?: string;
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
  moneyNeededByDay: number;
  markedPaidForMonth?: string;
  accentColor?: string;
  isAutopay?: boolean;
};

export type PlannerCreditCardRow = {
  rowKind: "creditCard";
  creditCardId: Id<"creditCards">;
  name: string;
  amount: number;
  paymentDayOfMonth: number;
  moneyNeededByDay: number;
  markedPaidForMonth?: string;
  accentColor?: string;
  isAutopay?: boolean;
  usageMode: "paying_off" | "active_use";
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

interface ExpenseTimelineProps {
  items: PlannerRow[];
  categories: TimelineCategory[];
  budgetMonth: string;
  userId: string;
}

export function ExpenseTimeline({
  items,
  categories,
  budgetMonth,
  userId,
}: ExpenseTimelineProps) {
  const archiveItem = useMutation(api.budgetItems.archive);
  const updateBudgetItem = useMutation(api.budgetItems.update);
  const setBudgetPaidForMonth = useMutation(api.budgetItems.setPaidForMonth);
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

  const groupedByNeededDay = useMemo(() => {
    if (!items.length) return [];
    const map = new Map<number, PlannerRow[]>();
    for (const item of items) {
      const d = item.moneyNeededByDay;
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
          if (a.paymentDayOfMonth !== b.paymentDayOfMonth) {
            return a.paymentDayOfMonth - b.paymentDayOfMonth;
          }
          return a.name.localeCompare(b.name);
        }),
      }));
  }, [items]);

  const [editTarget, setEditTarget] = useState<TimelineExpense | null>(null);
  const [archivePendingId, setArchivePendingId] = useState<Id<"budgetItems"> | null>(null);
  const [paidTogglePendingKey, setPaidTogglePendingKey] = useState<string | null>(null);
  const [autopayTogglePendingId, setAutopayTogglePendingId] =
    useState<Id<"budgetItems"> | null>(null);
  const [allocationTarget, setAllocationTarget] = useState<TimelineExpense | null>(null);

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
        {groupedByNeededDay.map(({ day, items: dayItems }) => {
          const neededStart = dateInBudgetMonth(budgetMonth, day);
          const deltaNeeded = calendarDaysFromTo(todayStart, neededStart);
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
                <h3 className="font-semibold text-slate-800">Funds needed {ordinal(day)}</h3>
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
                    const isPaidForMonth = item.markedPaidForMonth === budgetMonth;
                    const paymentStart = dateInBudgetMonth(budgetMonth, item.paymentDayOfMonth);
                    const deltaPayment = calendarDaysFromTo(todayStart, paymentStart);
                    const daysUntilPayment = deltaPayment;
                    const isDuePast = !isPaidForMonth && deltaPayment < 0;
                    const usageLabel =
                      item.usageMode === "paying_off"
                        ? CREDIT_CARD_USAGE_LABELS.paying_off
                        : CREDIT_CARD_USAGE_LABELS.active_use;
                    const metaParts = [
                      item.paymentDayOfMonth !== item.moneyNeededByDay
                        ? `Due ${ordinal(item.paymentDayOfMonth)}` +
                          (daysUntilPayment > 0
                            ? ` (+${daysUntilPayment}d)`
                            : daysUntilPayment < 0
                            ? ` (${Math.abs(daysUntilPayment)}d ago)`
                            : "")
                        : null,
                      item.isAutopay ? "Autopay" : null,
                      usageLabel,
                    ].filter(Boolean);
                    const metaLine = metaParts.join(" · ");

                    return (
                      <li key={rk} className="w-full min-w-0">
                        <div
                          className={`group/row flex w-full min-w-0 items-center gap-1.5 sm:gap-2 rounded-lg border py-1 pl-1 pr-1.5 sm:pr-2 shadow-sm transition-colors ${
                            isPaidForMonth
                              ? "bg-teal-50/45 border-teal-100/90"
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
                            className="flex max-w-[min(148px,38vw)] shrink-0 items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 sm:max-w-[200px] lg:max-w-[240px]"
                            style={{ backgroundColor: `${CREDIT_CARDS_SECTION_COLOR}18` }}
                            title="Credit cards"
                          >
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                              style={{ backgroundColor: `${CREDIT_CARDS_SECTION_COLOR}26` }}
                            >
                              <CreditCard
                                className="w-3 h-3"
                                style={{ color: CREDIT_CARDS_SECTION_COLOR }}
                                aria-hidden="true"
                              />
                            </span>
                            <span
                              className="truncate text-[10px] sm:text-[11px] font-semibold"
                              style={{ color: CREDIT_CARDS_SECTION_COLOR }}
                            >
                              Cards
                            </span>
                          </div>

                          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 sm:text-sm">
                              {item.name}
                              <span className="text-slate-400 font-normal"> · payment</span>
                            </span>
                            {isPaidForMonth && (
                              <span className="shrink-0 rounded px-1 py-px text-[9px] font-semibold bg-teal-100 text-teal-800 sm:text-[10px]">
                                Paid
                              </span>
                            )}
                            {isDuePast && (
                              <span className="shrink-0 rounded px-1 py-px text-[9px] font-semibold bg-slate-100 text-slate-500 sm:text-[10px]">
                                Past due
                              </span>
                            )}
                            {metaLine ? (
                              <span className="hidden min-w-0 flex-1 truncate text-[11px] text-slate-400 sm:inline">
                                <span className="text-slate-300">·</span> {metaLine}
                              </span>
                            ) : null}
                          </div>

                          <span className="shrink-0 tabular-nums text-xs sm:text-sm font-semibold text-slate-800">
                            {formatCurrency(item.amount)}
                          </span>

                          <div className="flex shrink-0 items-center border-l border-slate-100 pl-1 sm:pl-1.5 ml-0.5">
                            <Link
                              href="/credit-cards"
                              className="rounded-md px-1.5 py-0.5 text-[10px] sm:text-xs font-medium text-teal-600 hover:bg-teal-50 sm:px-2"
                            >
                              Cards
                            </Link>
                          </div>
                        </div>

                        {metaLine ? (
                          <p className="mt-0.5 truncate pl-6 text-[10px] text-slate-400 sm:hidden">
                            {metaLine}
                          </p>
                        ) : null}
                      </li>
                    );
                  }

                  if (item.rowKind === "debt") {
                    const color = item.accentColor ?? DEBTS_SECTION_COLOR;
                    const isPaidForMonth = item.markedPaidForMonth === budgetMonth;
                    const paymentStart = dateInBudgetMonth(budgetMonth, item.paymentDayOfMonth);
                    const deltaPayment = calendarDaysFromTo(todayStart, paymentStart);
                    const daysUntilPayment = deltaPayment;
                    const isDuePast = !isPaidForMonth && deltaPayment < 0;
                    const metaParts = [
                      item.paymentDayOfMonth !== item.moneyNeededByDay
                        ? `Due ${ordinal(item.paymentDayOfMonth)}` +
                          (daysUntilPayment > 0
                            ? ` (+${daysUntilPayment}d)`
                            : daysUntilPayment < 0
                            ? ` (${Math.abs(daysUntilPayment)}d ago)`
                            : "")
                        : null,
                      item.isAutopay ? "Autopay" : null,
                    ].filter(Boolean);
                    const metaLine = metaParts.join(" · ");

                    return (
                      <li key={rk} className="w-full min-w-0">
                        <div
                          className={`group/row flex w-full min-w-0 items-center gap-1.5 sm:gap-2 rounded-lg border py-1 pl-1 pr-1.5 sm:pr-2 shadow-sm transition-colors ${
                            isPaidForMonth
                              ? "bg-teal-50/45 border-teal-100/90"
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
                            className="flex max-w-[min(148px,38vw)] shrink-0 items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 sm:max-w-[200px] lg:max-w-[240px]"
                            style={{ backgroundColor: `${DEBTS_SECTION_COLOR}18` }}
                            title="Debts"
                          >
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                              style={{ backgroundColor: `${DEBTS_SECTION_COLOR}26` }}
                            >
                              <Landmark
                                className="w-3 h-3"
                                style={{ color: DEBTS_SECTION_COLOR }}
                                aria-hidden="true"
                              />
                            </span>
                            <span
                              className="truncate text-[10px] sm:text-[11px] font-semibold"
                              style={{ color: DEBTS_SECTION_COLOR }}
                            >
                              Debts
                            </span>
                          </div>

                          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 sm:text-sm">
                              {item.name}
                              <span className="text-slate-400 font-normal"> · payment</span>
                            </span>
                            {isPaidForMonth && (
                              <span className="shrink-0 rounded px-1 py-px text-[9px] font-semibold bg-teal-100 text-teal-800 sm:text-[10px]">
                                Paid
                              </span>
                            )}
                            {isDuePast && (
                              <span className="shrink-0 rounded px-1 py-px text-[9px] font-semibold bg-slate-100 text-slate-500 sm:text-[10px]">
                                Past due
                              </span>
                            )}
                            {metaLine ? (
                              <span className="hidden min-w-0 flex-1 truncate text-[11px] text-slate-400 sm:inline">
                                <span className="text-slate-300">·</span> {metaLine}
                              </span>
                            ) : null}
                          </div>

                          <span className="shrink-0 tabular-nums text-xs sm:text-sm font-semibold text-slate-800">
                            {formatCurrency(item.amount)}
                          </span>

                          <div className="flex shrink-0 items-center border-l border-slate-100 pl-1 sm:pl-1.5 ml-0.5">
                            <Link
                              href="/debts"
                              className="rounded-md px-1.5 py-0.5 text-[10px] sm:text-xs font-medium text-teal-600 hover:bg-teal-50 sm:px-2"
                            >
                              Debts
                            </Link>
                          </div>
                        </div>

                        {metaLine ? (
                          <p className="mt-0.5 truncate pl-6 text-[10px] text-slate-400 sm:hidden">
                            {metaLine}
                          </p>
                        ) : null}
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
                  const daysUntilPayment = deltaPayment;
                  const isDuePast = !isPaidForMonth && deltaPayment < 0;

                  const dueBit =
                    item.paymentDayOfMonth !== item.moneyNeededByDay
                      ? `Due ${ordinal(item.paymentDayOfMonth)}` +
                        (daysUntilPayment > 0
                          ? ` (+${daysUntilPayment}d)`
                          : daysUntilPayment < 0
                          ? ` (${Math.abs(daysUntilPayment)}d ago)`
                          : "")
                      : null;
                  const paidFromResolved = budgetItemPaidFromLabel(item, accountMap);
                  const metaLine = [
                    dueBit,
                    item.isAutopay ? "Autopay" : null,
                    paidFromResolved ?? null,
                    item.note ? item.note : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <li key={rk} className="w-full min-w-0">
                      <div
                        className={`group/row flex w-full min-w-0 items-center gap-1.5 sm:gap-2 rounded-lg border py-1 pl-1 pr-1.5 sm:pr-2 shadow-sm transition-colors ${
                          isPaidForMonth
                            ? "bg-teal-50/45 border-teal-100/90"
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
                          aria-label={
                            isPaidForMonth
                              ? `Mark ${item.name} not paid for ${formatMonth(budgetMonth)}`
                              : `Mark ${item.name} paid for ${formatMonth(budgetMonth)}`
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
                          className="flex max-w-[min(148px,38vw)] shrink-0 items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 sm:max-w-[200px] lg:max-w-[240px]"
                          style={{ backgroundColor: `${color}18` }}
                          title={cat?.name ?? "Category"}
                        >
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${color}26` }}
                          >
                            {IconComp ? (
                              <IconComp className="w-3 h-3" style={{ color }} aria-hidden="true" />
                            ) : (
                              <span className="text-[10px] leading-none" aria-hidden="true">
                                {iconName ?? "💰"}
                              </span>
                            )}
                          </span>
                          <span
                            className="truncate text-[10px] sm:text-[11px] font-semibold"
                            style={{ color }}
                          >
                            {cat?.name ?? "Uncategorized"}
                          </span>
                        </div>

                        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden flex-wrap">
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 sm:text-sm">
                            {item.name}
                          </span>
                          {(() => {
                            const aside = allocatedByBudgetId[item._id] ?? 0;
                            return (
                              <button
                                type="button"
                                title="Set aside cash from an account for this bill"
                                onClick={() => setAllocationTarget(item)}
                                className={`shrink-0 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-semibold border sm:text-[11px] ${
                                  aside > 0.005
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
                                  <span>Set aside</span>
                                )}
                              </button>
                            );
                          })()}
                          {isPaidForMonth && (
                            <span className="shrink-0 rounded px-1 py-px text-[9px] font-semibold bg-teal-100 text-teal-800 sm:text-[10px]">
                              Paid
                            </span>
                          )}
                          {isDuePast && (
                            <span className="shrink-0 rounded px-1 py-px text-[9px] font-semibold bg-slate-100 text-slate-500 sm:text-[10px]">
                              Past due
                            </span>
                          )}
                          {metaLine ? (
                            <span className="hidden min-w-0 basis-full truncate text-[11px] text-slate-400 sm:inline sm:basis-auto">
                              <span className="text-slate-300">·</span> {metaLine}
                            </span>
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

                        <div className="flex shrink-0 items-center gap-0.5 border-l border-slate-100 pl-1 sm:pl-1.5 ml-0.5">
                          <button
                            type="button"
                            onClick={() => setEditTarget(item)}
                            className="rounded-md px-1.5 py-0.5 text-[10px] sm:text-xs font-medium text-teal-600 hover:bg-teal-50 sm:px-2"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setArchivePendingId(archivePendingId === item._id ? null : item._id)
                            }
                            className="rounded-md px-1.5 py-0.5 text-[10px] sm:text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600 sm:px-2"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {metaLine ? (
                        <p className="mt-0.5 truncate pl-6 text-[10px] text-slate-400 sm:hidden">
                          {metaLine}
                        </p>
                      ) : null}

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
              onSuccess={() => setEditTarget(null)}
              onCancel={() => setEditTarget(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
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
  const cardRows: PlannerRow[] = (creditCards ?? [])
    .filter(
      (c) =>
        (c.plannedMonthlyPayment ?? 0) > 0 &&
        c.dueDayOfMonth != null &&
        c.dueDayOfMonth >= 1 &&
        c.dueDayOfMonth <= 31
    )
    .map((c) => ({
      rowKind: "creditCard" as const,
      creditCardId: c._id,
      name: c.name,
      amount: c.plannedMonthlyPayment!,
      paymentDayOfMonth: c.dueDayOfMonth!,
      moneyNeededByDay: c.dueDayOfMonth!,
      markedPaidForMonth: c.markedPaidForMonth,
      accentColor: c.color,
      isAutopay: c.isAutopay,
      usageMode: (c.usageMode === "paying_off" ? "paying_off" : "active_use") as
        | "paying_off"
        | "active_use",
    }));
  const debtRows: PlannerRow[] = (debts ?? [])
    .filter(
      (d) =>
        (d.plannedMonthlyPayment ?? 0) > 0 &&
        d.dueDayOfMonth != null &&
        d.dueDayOfMonth >= 1 &&
        d.dueDayOfMonth <= 31
    )
    .map((d) => ({
      rowKind: "debt" as const,
      debtId: d._id,
      name: d.name,
      amount: d.plannedMonthlyPayment!,
      paymentDayOfMonth: d.dueDayOfMonth!,
      moneyNeededByDay: d.dueDayOfMonth!,
      markedPaidForMonth: d.markedPaidForMonth,
      accentColor: d.color,
      isAutopay: d.isAutopay,
    }));
  return [...budget, ...cardRows, ...debtRows];
}
