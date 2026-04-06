"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  expenseHasPayFromAccount,
  debtPlannerMonthlyAmount,
  expenseFundingLevel,
  budgetBillFundRemainingForMonth,
} from "@/lib/utils";
import { CATEGORY_ICON_MAP } from "@/lib/icons";
import { BudgetItemManager } from "@/components/BudgetItemManager";
import { BudgetAllocationModal } from "@/components/BudgetAllocationModal";
import { DebtManager } from "@/components/DebtManager";
import {
  CheckCircle2,
  Circle,
  CircleMinus,
  CreditCard,
  Landmark,
  MoreVertical,
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

type TimelineFundState = "waiting" | "funded" | "paid";

function budgetRowFundState(isPaid: boolean, fundedTotal: number): TimelineFundState {
  if (isPaid) return "paid";
  if (fundedTotal > 0.005) return "funded";
  return "waiting";
}

/** Debts/cards use pay-from + planned amount as “funded” when there is no allocation table. */
function plannedPaymentRowFundState(
  isPaid: boolean,
  bankLinked: boolean,
  plannedAmount: number
): TimelineFundState {
  if (isPaid) return "paid";
  if (bankLinked && plannedAmount > 0.005) return "funded";
  return "waiting";
}

function timelineRowSurfaceClasses(state: TimelineFundState): string {
  switch (state) {
    case "paid":
      return "bg-emerald-50/55 border-emerald-200/85 ring-1 ring-emerald-200/45";
    case "funded":
      return "bg-amber-50/80 border-amber-200/90 ring-1 ring-amber-200/40";
    case "waiting":
      return "bg-rose-50/60 border-rose-200/90 ring-1 ring-rose-200/35";
    default:
      return "bg-white border-slate-100";
  }
}

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
  const archiveDebt = useMutation(api.debts.archive);
  const setBudgetPaidForMonth = useMutation(api.budgetItems.setPaidForMonth);
  const setDebtPaidForMonth = useMutation(api.debts.setPaidForMonth);
  const setCreditCardPaidForMonth = useMutation(api.creditCards.setPaidForMonth);
  const createExpenseAllocation = useMutation(api.expenseAllocations.create);
  const removeAllBillFunding = useMutation(api.expenseAllocations.removeAllForBudgetMonth);

  const allocations = useQuery(api.expenseAllocations.listByUserMonth, {
    userId,
    monthKey: budgetMonth,
  });

  const budgetMonthOverrides = useQuery(api.budgetItemMonthOverrides.listByUserMonth, {
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

  const actualPaidByBudgetId = useMemo(() => {
    const m: Record<string, number> = {};
    if (!budgetMonthOverrides) return m;
    for (const o of budgetMonthOverrides) {
      const k = o.budgetItemId as string;
      const a = o.actualPaidAmount;
      if (a != null && a > 0.005) m[k] = a;
    }
    return m;
  }, [budgetMonthOverrides]);

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
  const [archiveDebtPendingId, setArchiveDebtPendingId] = useState<Id<"debts"> | null>(
    null
  );
  const [paidTogglePendingKey, setPaidTogglePendingKey] = useState<string | null>(null);
  const [fundAdjustTarget, setFundAdjustTarget] =
    useState<TimelineExpense | null>(null);
  const [rowMenuKey, setRowMenuKey] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(() => new Set());
  const [bulkFundRunning, setBulkFundRunning] = useState(false);
  const [bulkClearFundingRunning, setBulkClearFundingRunning] = useState(false);
  const [fundQuickPendingId, setFundQuickPendingId] = useState<Id<"budgetItems"> | null>(
    null
  );
  const [fundClearPendingId, setFundClearPendingId] = useState<Id<"budgetItems"> | null>(
    null
  );
  const [actionBanner, setActionBanner] = useState<{
    kind: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const budgetRowKeys = useMemo(
    () => items.filter((i): i is PlannerBudgetRow => i.rowKind === "budget").map((i) => rowKey(i)),
    [items]
  );

  const toggleRowSelected = useCallback((key: string) => {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAllBudgetRows = useCallback(() => {
    setSelectedRowKeys(new Set(budgetRowKeys));
  }, [budgetRowKeys]);

  const clearRowSelection = useCallback(() => setSelectedRowKeys(new Set()), []);

  useEffect(() => {
    setSelectedRowKeys(new Set());
  }, [budgetMonth]);

  const fundBudgetBill = useCallback(
    async (item: PlannerBudgetRow) => {
      const remaining = budgetBillFundRemainingForMonth(
        item._id as string,
        item.amount,
        item.markedPaidForMonth,
        budgetMonth,
        allocatedByBudgetId
      );
      if (remaining == null) return;
      await createExpenseAllocation({
        userId,
        budgetItemId: item._id,
        amount: remaining,
        monthKey: budgetMonth,
      });
    },
    [allocatedByBudgetId, budgetMonth, createExpenseAllocation, userId]
  );

  const handleBulkFund = useCallback(async () => {
    setActionBanner(null);
    setBulkFundRunning(true);
    let done = 0;
    let skipped = 0;
    try {
      for (const item of items) {
        if (item.rowKind !== "budget") continue;
        if (!selectedRowKeys.has(rowKey(item))) continue;
        const rem = budgetBillFundRemainingForMonth(
          item._id as string,
          item.amount,
          item.markedPaidForMonth,
          budgetMonth,
          allocatedByBudgetId
        );
        if (rem == null) {
          skipped++;
          continue;
        }
        await createExpenseAllocation({
          userId,
          budgetItemId: item._id,
          amount: rem,
          monthKey: budgetMonth,
        });
        done++;
      }
      if (done > 0) {
        setSelectedRowKeys(new Set());
        setActionBanner({
          kind: "success",
          message:
            skipped > 0
              ? `Funded ${done} bill${done === 1 ? "" : "s"}. Skipped ${skipped} (paid, already fully funded, or needs Adjust funding).`
              : `Funded ${done} bill${done === 1 ? "" : "s"}.`,
        });
      } else if ([...selectedRowKeys].some((k) => k.startsWith("b:"))) {
        setActionBanner({
          kind: "info",
          message:
            "No funding added — selected bills aren’t unpaid for this month, are already fully funded, or need Adjust funding.",
        });
      } else {
        setActionBanner({
          kind: "info",
          message: "Bulk fund applies to expense bills. Select budget rows (or use Select all bills).",
        });
      }
    } catch (e) {
      setActionBanner({
        kind: "error",
        message: e instanceof Error ? e.message : "Could not fund",
      });
    } finally {
      setBulkFundRunning(false);
    }
  }, [
    allocatedByBudgetId,
    budgetMonth,
    createExpenseAllocation,
    items,
    selectedRowKeys,
    userId,
  ]);

  const handleBulkClearFunding = useCallback(async () => {
    setActionBanner(null);
    setBulkClearFundingRunning(true);
    let done = 0;
    let skipped = 0;
    try {
      for (const item of items) {
        if (item.rowKind !== "budget") continue;
        if (!selectedRowKeys.has(rowKey(item))) continue;
        const setAside = allocatedByBudgetId[item._id] ?? 0;
        if (setAside <= 0.005) {
          skipped++;
          continue;
        }
        await removeAllBillFunding({
          userId,
          budgetItemId: item._id,
          monthKey: budgetMonth,
        });
        done++;
      }
      if (done > 0) {
        setSelectedRowKeys(new Set());
        setActionBanner({
          kind: "success",
          message:
            skipped > 0
              ? `Cleared funding on ${done} bill${done === 1 ? "" : "s"}. Skipped ${skipped} with nothing funded.`
              : `Cleared funding on ${done} bill${done === 1 ? "" : "s"}.`,
        });
      } else if ([...selectedRowKeys].some((k) => k.startsWith("b:"))) {
        setActionBanner({
          kind: "info",
          message: "No funding cleared — selected bills have no funded amount this month.",
        });
      } else {
        setActionBanner({
          kind: "info",
          message: "Clear funding applies to expense bills. Select budget rows (or use Select all bills).",
        });
      }
    } catch (e) {
      setActionBanner({
        kind: "error",
        message: e instanceof Error ? e.message : "Could not clear funding",
      });
    } finally {
      setBulkClearFundingRunning(false);
    }
  }, [
    allocatedByBudgetId,
    budgetMonth,
    items,
    removeAllBillFunding,
    selectedRowKeys,
    userId,
  ]);

  const bulkFundEligibleCount = useMemo(() => {
    let n = 0;
    for (const item of items) {
      if (item.rowKind !== "budget") continue;
      if (!selectedRowKeys.has(rowKey(item))) continue;
      if (
        budgetBillFundRemainingForMonth(
          item._id as string,
          item.amount,
          item.markedPaidForMonth,
          budgetMonth,
          allocatedByBudgetId
        ) != null
      )
        n++;
    }
    return n;
  }, [allocatedByBudgetId, budgetMonth, items, selectedRowKeys]);

  const bulkClearFundingEligibleCount = useMemo(() => {
    let n = 0;
    for (const item of items) {
      if (item.rowKind !== "budget") continue;
      if (!selectedRowKeys.has(rowKey(item))) continue;
      if ((allocatedByBudgetId[item._id] ?? 0) > 0.005) n++;
    }
    return n;
  }, [allocatedByBudgetId, items, selectedRowKeys]);

  const selectedBudgetCount = useMemo(() => {
    let n = 0;
    for (const item of items) {
      if (item.rowKind === "budget" && selectedRowKeys.has(rowKey(item))) n++;
    }
    return n;
  }, [items, selectedRowKeys]);

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

  const handleArchiveDebt = async (id: Id<"debts">) => {
    await archiveDebt({ id, userId });
    setArchiveDebtPendingId(null);
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

  const timelineCheckboxClass =
    "h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500 focus:ring-offset-0";

  return (
    <div className="relative w-full min-w-0">
      {actionBanner ? (
        <div
          className={`mb-3 flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${
            actionBanner.kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : actionBanner.kind === "success"
                ? "border-teal-200 bg-teal-50/90 text-teal-950"
                : "border-slate-200 bg-slate-50 text-slate-800"
          }`}
        >
          <p className="min-w-0 leading-snug">{actionBanner.message}</p>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-500 hover:bg-black/5 hover:text-slate-800"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {selectedRowKeys.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur-sm">
          <p className="text-sm text-slate-700">
            <span className="font-semibold tabular-nums">{selectedRowKeys.size}</span> selected
            {selectedBudgetCount > 0 ? (
              <span className="text-slate-500">
                {" "}
                ({selectedBudgetCount} bill{selectedBudgetCount === 1 ? "" : "s"})
              </span>
            ) : null}
          </p>
          <button
            type="button"
            disabled={bulkFundRunning || bulkFundEligibleCount === 0}
            onClick={() => void handleBulkFund()}
            className="rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              bulkFundEligibleCount === 0
                ? "No selected bills can be funded (not paid for month, or already fully funded)"
                : `Fund remainder for ${bulkFundEligibleCount} bill${bulkFundEligibleCount === 1 ? "" : "s"}`
            }
          >
            {bulkFundRunning
              ? "Funding…"
              : bulkFundEligibleCount > 0
                ? `Fund ${bulkFundEligibleCount} bill${bulkFundEligibleCount === 1 ? "" : "s"}`
                : "Fund bills"}
          </button>
          <button
            type="button"
            disabled={bulkClearFundingRunning || bulkClearFundingEligibleCount === 0}
            onClick={() => void handleBulkClearFunding()}
            className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              bulkClearFundingEligibleCount === 0
                ? "No selected bills have funding to clear"
                : `Clear all funding on ${bulkClearFundingEligibleCount} bill${bulkClearFundingEligibleCount === 1 ? "" : "s"}`
            }
          >
            {bulkClearFundingRunning
              ? "Clearing…"
              : bulkClearFundingEligibleCount > 0
                ? `Clear funding (${bulkClearFundingEligibleCount} bill${bulkClearFundingEligibleCount === 1 ? "" : "s"})`
                : "Clear funding"}
          </button>
          {budgetRowKeys.length > 0 ? (
            <button
              type="button"
              onClick={selectAllBudgetRows}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Select all bills
            </button>
          ) : null}
          <button
            type="button"
            onClick={clearRowSelection}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      ) : null}

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
                    const fundState = plannedPaymentRowFundState(
                      isPaidForMonth,
                      bankLinked,
                      item.amount
                    );
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
                          className={`group/row flex w-full min-w-0 items-center gap-1.5 sm:gap-2 rounded-lg border py-1 pl-1 pr-1.5 sm:pr-2 shadow-sm transition-colors ${timelineRowSurfaceClasses(
                            fundState
                          )}`}
                          style={{ borderLeftWidth: 3, borderLeftColor: color }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedRowKeys.has(rk)}
                            onChange={() => toggleRowSelected(rk)}
                            className={timelineCheckboxClass}
                            aria-label={`Select ${item.name} for bulk actions`}
                          />
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
                    const fundState = plannedPaymentRowFundState(
                      isPaidForMonth,
                      bankLinked,
                      item.amount
                    );
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
                    const debtDoc = debts?.find((d) => d._id === item.debtId);
                    const balance = debtDoc?.balance ?? 0;

                    return (
                      <li key={rk} className="w-full min-w-0">
                        <div
                          className={`group/row flex w-full min-w-0 items-center gap-1.5 sm:gap-2 rounded-lg border py-1 pl-1 pr-1.5 sm:pr-2 shadow-sm transition-colors ${timelineRowSurfaceClasses(
                            fundState
                          )}`}
                          style={{ borderLeftWidth: 3, borderLeftColor: color }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedRowKeys.has(rk)}
                            onChange={() => toggleRowSelected(rk)}
                            className={timelineCheckboxClass}
                            aria-label={`Select ${item.name} for bulk actions`}
                          />
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
                            style={{ backgroundColor: `${DEBTS_SECTION_COLOR}26` }}
                            title="Debts"
                          >
                            <Landmark
                              className="w-3 h-3"
                              style={{ color: DEBTS_SECTION_COLOR }}
                              aria-hidden="true"
                            />
                          </div>

                          <div className="flex min-w-0 flex-1 flex-col gap-0 overflow-hidden">
                            <div className="min-w-0 truncate text-xs font-medium text-slate-800 sm:text-sm">
                              {item.name}
                              <span className="font-normal text-slate-400"> · payment</span>
                            </div>
                            {debtSubline ? (
                              <p
                                className="truncate text-[10px] leading-snug text-slate-500"
                                title={debtSubline}
                              >
                                {debtSubline}
                              </p>
                            ) : null}
                          </div>

                          <span
                            className="shrink-0 tabular-nums text-xs sm:text-sm font-semibold text-slate-800"
                            title="Current balance owed"
                          >
                            {formatCurrency(balance)}
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
                            <button
                              type="button"
                              role="menuitem"
                              className="block w-full px-3 py-1.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                              onClick={() => {
                                setArchiveDebtPendingId(
                                  archiveDebtPendingId === item.debtId ? null : item.debtId
                                );
                                setRowMenuKey(null);
                              }}
                            >
                              Remove
                            </button>
                          </TimelineRowActionsMenu>
                        </div>

                        {archiveDebtPendingId === item.debtId && (
                          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                            <p className="text-xs text-rose-700">
                              Remove <strong>{item.name}</strong>? Balances are unchanged.
                            </p>
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => handleArchiveDebt(item.debtId)}
                                className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                              >
                                Remove
                              </button>
                              <button
                                type="button"
                                onClick={() => setArchiveDebtPendingId(null)}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
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
                  const accountFunded = expenseHasPayFromAccount(item);
                  const isOverAllocated =
                    item.amount > 0.005 && setAsideTotal > item.amount + 0.005;
                  const fundState = budgetRowFundState(isPaidForMonth, setAsideTotal);

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
                    isOverAllocated && !isPaidForMonth ? "Over-funded" : null,
                    isDuePast ? "Past due" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const quickFundRemaining = budgetBillFundRemainingForMonth(
                    item._id as string,
                    item.amount,
                    item.markedPaidForMonth,
                    budgetMonth,
                    allocatedByBudgetId
                  );
                  const fundingLevel = expenseFundingLevel(item.amount, setAsideTotal);
                  const displayAmount =
                    isPaidForMonth &&
                    actualPaidByBudgetId[item._id as string] != null &&
                    actualPaidByBudgetId[item._id as string]! > 0.005
                      ? actualPaidByBudgetId[item._id as string]!
                      : item.amount;

                  return (
                    <li key={rk} className="w-full min-w-0">
                      <div
                        className={`group/row flex w-full min-w-0 items-center gap-1.5 sm:gap-2 rounded-lg border py-1 pl-1 pr-1.5 sm:pr-2 shadow-sm transition-colors ${
                          isOverAllocated && !isPaidForMonth
                            ? `${timelineRowSurfaceClasses(fundState)} ring-2 ring-amber-500/50 ring-offset-2 ring-offset-white`
                            : timelineRowSurfaceClasses(fundState)
                        }`}
                        style={{ borderLeftWidth: 3, borderLeftColor: color }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRowKeys.has(rk)}
                          onChange={() => toggleRowSelected(rk)}
                          className={timelineCheckboxClass}
                          aria-label={`Select ${item.name} for bulk actions`}
                        />
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
                          <div className="min-w-0 truncate text-xs font-medium text-slate-800 sm:text-sm">
                            {item.name}
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

                        {setAsideTotal > 0.005 && !isPaidForMonth ? (
                          <button
                            type="button"
                            disabled={fundClearPendingId === item._id}
                            title={`Clear all funding for this bill (${formatCurrency(setAsideTotal)})`}
                            aria-label={`Clear funding for ${item.name}`}
                            onClick={() => {
                              void (async () => {
                                setFundClearPendingId(item._id);
                                try {
                                  await removeAllBillFunding({
                                    userId,
                                    budgetItemId: item._id,
                                    monthKey: budgetMonth,
                                  });
                                  setActionBanner({
                                    kind: "success",
                                    message: `Cleared funding for ${item.name}.`,
                                  });
                                } catch (e) {
                                  setActionBanner({
                                    kind: "error",
                                    message:
                                      e instanceof Error ? e.message : "Could not clear funding",
                                  });
                                } finally {
                                  setFundClearPendingId(null);
                                }
                              })();
                            }}
                            className="shrink-0 rounded-md p-1 text-rose-600 transition-colors hover:bg-rose-100/80 disabled:opacity-50"
                          >
                            <CircleMinus className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                          </button>
                        ) : null}
                        {!isPaidForMonth && item.amount > 0.005 ? (
                          quickFundRemaining != null ? (
                            <button
                              type="button"
                              disabled={fundQuickPendingId === item._id}
                              title={`Fund ${formatCurrency(quickFundRemaining)} toward this bill`}
                              aria-label={
                                fundingLevel === "none"
                                  ? `Fund ${item.name} — add set-aside for this month`
                                  : `Finish funding ${item.name} (${formatCurrency(quickFundRemaining)} left)`
                              }
                              onClick={() => {
                                void (async () => {
                                  setFundQuickPendingId(item._id);
                                  try {
                                    await fundBudgetBill(item);
                                  } catch (e) {
                                    setActionBanner({
                                      kind: "error",
                                      message:
                                        e instanceof Error ? e.message : "Could not fund",
                                    });
                                  } finally {
                                    setFundQuickPendingId(null);
                                  }
                                })();
                              }}
                              className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-50 sm:text-[11px] ${
                                fundingLevel === "none"
                                  ? "border border-rose-200/90 bg-rose-100 text-rose-900 hover:bg-rose-200/50"
                                  : "border border-amber-200/90 bg-amber-50 text-amber-950 hover:bg-amber-100/90"
                              }`}
                            >
                              {fundQuickPendingId === item._id
                                ? "…"
                                : fundingLevel === "none"
                                  ? "Waiting"
                                  : "Partly funded"}
                            </button>
                          ) : fundingLevel === "full" ? (
                            <span
                              className="shrink-0 rounded-md border border-amber-200/90 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-950 sm:text-[11px]"
                              title="Bill amount fully funded this month"
                            >
                              Funded
                            </span>
                          ) : null
                        ) : null}

                        <span
                          className="shrink-0 tabular-nums text-xs sm:text-sm font-semibold text-slate-800"
                          title={
                            isPaidForMonth && displayAmount !== item.amount
                              ? `Planned ${formatCurrency(item.amount)} · paid ${formatCurrency(displayAmount)}`
                              : undefined
                          }
                        >
                          {formatCurrency(displayAmount)}
                        </span>

                        <TimelineRowActionsMenu
                          rowKey={rk}
                          menuOpenKey={rowMenuKey}
                          setMenuOpenKey={setRowMenuKey}
                        >
                          {setAsideTotal > 0.005 && !isPaidForMonth ? (
                            <button
                              type="button"
                              role="menuitem"
                              className="block w-full px-3 py-1.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
                              onClick={() => {
                                setRowMenuKey(null);
                                void (async () => {
                                  try {
                                    await removeAllBillFunding({
                                      userId,
                                      budgetItemId: item._id,
                                      monthKey: budgetMonth,
                                    });
                                    setActionBanner({
                                      kind: "success",
                                      message: `Cleared funding for ${item.name}.`,
                                    });
                                  } catch (e) {
                                    setActionBanner({
                                      kind: "error",
                                      message:
                                        e instanceof Error ? e.message : "Could not clear funding",
                                    });
                                  }
                                })();
                              }}
                            >
                              Clear all funding
                            </button>
                          ) : null}
                          <button
                            type="button"
                            role="menuitem"
                            className="block w-full px-3 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                              setFundAdjustTarget(item);
                              setRowMenuKey(null);
                            }}
                          >
                            Fund / adjust amount
                          </button>
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

      {fundAdjustTarget && (
        <BudgetAllocationModal
          open
          onClose={() => setFundAdjustTarget(null)}
          userId={userId}
          monthKey={budgetMonth}
          budgetItemId={fundAdjustTarget._id}
          expenseName={fundAdjustTarget.name}
          expenseAmount={fundAdjustTarget.amount}
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
  return debtPlannerMonthlyAmount(d);
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
