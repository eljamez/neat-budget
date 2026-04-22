"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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
  expenseFundingLevel,
  budgetBillFundRemainingForMonth,
  ACCENT_COLOR_FALLBACK,
} from "@/lib/utils";
import type {
  TimelineExpense,
  PlannerBudgetRow,
  PlannerCategoryRow,
  PlannerDebtRow,
  PlannerCreditCardRow,
  PlannerRow,
} from "@/lib/planner";
import { CATEGORY_ICON_MAP } from "@/lib/icons";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { BudgetItemManager } from "@/components/BudgetItemManager";
import { BudgetAllocationModal } from "@/components/BudgetAllocationModal";
import { DebtManager } from "@/components/DebtManager";
import { CreditCardManager } from "@/components/CreditCardManager";
import { CategoryEditModal } from "@/components/CategoryEditModal";
import type { CategoryProgressForEdit } from "@/components/CategoryEditModal";
import {
  CheckCircle2,
  Circle,
  CircleMinus,
  CreditCard,
  Landmark,
  MoreVertical,
  Plus,
} from "lucide-react";
import { useTransactionModal } from "@/components/TransactionModalProvider";
import { TransactionForm } from "@/components/TransactionForm";

export interface TimelineCategory {
  _id: Id<"categories">;
  name: string;
  color?: string;
  icon?: string;
}

export interface CategoryProgressEntry {
  category: {
    _id: string;
    name: string;
    groupId?: string | null;
    color?: string;
    icon?: string;
  };
  spent: number;
  target: number | null;
  remaining: number | null;
}

type TimelineFundState = "waiting" | "funded" | "paid";

function budgetRowFundState(isPaid: boolean, fundedTotal: number): TimelineFundState {
  if (isPaid) return "paid";
  if (fundedTotal > 0.005) return "funded";
  return "waiting";
}

function debtOrCardFundState(
  isPaid: boolean,
  fundedForMonth: string | undefined,
  budgetMonth: string
): TimelineFundState {
  if (isPaid) return "paid";
  if (fundedForMonth === budgetMonth) return "funded";
  return "waiting";
}

function timelineRowSurfaceClasses(state: TimelineFundState): string {
  switch (state) {
    case "paid":
      return "bg-emerald-50/55 border-emerald-200/85 ring-1 ring-emerald-200/45 dark:bg-emerald-950/35 dark:border-emerald-500/25 dark:ring-emerald-500/20";
    case "funded":
      return "bg-yellow-50/80 border-yellow-200/90 ring-1 ring-yellow-200/40 dark:bg-yellow-950/35 dark:border-yellow-500/25 dark:ring-yellow-500/15";
    case "waiting":
      return "bg-rose-50/60 border-rose-200/90 ring-1 ring-rose-200/35 dark:bg-rose-950/30 dark:border-rose-500/25 dark:ring-rose-500/15";
    default:
      return "bg-white border-slate-100 dark:bg-slate-800/80 dark:border-white/10";
  }
}

function PaidCheckMark({
  animate,
  onAnimationEnd,
}: {
  animate: boolean;
  onAnimationEnd?: () => void;
}) {
  if (!animate) {
    return <CheckCircle2 className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />;
  }
  return (
    <span
      className="inline-flex h-4 w-4 sm:h-[18px] sm:w-[18px]"
      style={{ animation: "check-circle-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}
      onAnimationEnd={onAnimationEnd}
      aria-hidden="true"
    >
      <svg viewBox="0 0 18 18" fill="none" className="w-full h-full">
        <circle
          cx="9" cy="9" r="8"
          className="fill-emerald-100 stroke-emerald-600 dark:fill-emerald-950 dark:stroke-emerald-400"
          strokeWidth="1.25"
        />
        <path
          d="M5.5 9l2.5 2.5L12.5 6"
          className="stroke-emerald-600 dark:stroke-emerald-400"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="11"
          style={{ animation: "draw-check-sm 0.28s ease-out 0.15s both", strokeDashoffset: 11 }}
        />
      </svg>
    </span>
  );
}

/** Mockup-style track + fill; `fillStyle` when using category hex */
function TimelineFundingBar({
  pct,
  fillClassName,
  fillStyle,
  label,
}: {
  pct: number;
  fillClassName?: string;
  fillStyle?: CSSProperties;
  label: string;
}) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-white/8"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(w)}
      aria-label={label}
    >
      <div
        className={`h-full w-full origin-left transition-transform duration-200 ${fillClassName ?? ""}`}
        style={{ transform: `scaleX(${w / 100})`, ...fillStyle }}
      />
    </div>
  );
}

function rowKey(row: PlannerRow): string {
  if (row.rowKind === "budget") return `b:${row._id}`;
  if (row.rowKind === "creditCard") return `cc:${row.creditCardId}`;
  if (row.rowKind === "category") return `cat:${row.categoryId}`;
  return `d:${row.debtId}`;
}

function rowSortOrder(row: PlannerRow): number {
  if (row.rowKind === "budget") return 0;
  if (row.rowKind === "category") return 0;
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
        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
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
          className="absolute right-0 z-20 mt-0.5 min-w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-slate-900"
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
  /** Full credit card records so timeline rows can open the same edit flow as the Credit Cards page. */
  creditCards?: Doc<"creditCards">[];
  categoryProgress?: CategoryProgressEntry[];
  groupNameById?: Record<string, string>;
}

export function ExpenseTimeline({
  items,
  categories,
  budgetMonth,
  userId,
  debts,
  creditCards,
  categoryProgress,
  groupNameById,
}: ExpenseTimelineProps) {
  const archiveItem = useMutation(api.budgetItems.archive);
  const archiveDebt = useMutation(api.debts.archive);
  const setBudgetPaidForMonth = useMutation(api.budgetItems.setPaidForMonth);
  const setDebtPaidForMonth = useMutation(api.debts.setPaidForMonth);
  const setCreditCardPaidForMonth = useMutation(api.creditCards.setPaidForMonth);
  const setCategoryPaidForMonth = useMutation(api.categories.setPaidForMonth);
  const setCategoryFundedForMonth = useMutation(api.categories.setFundedForMonth);
  const setDebtFundedForMonth = useMutation(api.debts.setFundedForMonth);
  const setCreditCardFundedForMonth = useMutation(api.creditCards.setFundedForMonth);
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
  const todayDayOfMonth = todayStart.getDate();
  const todayLocalYearMonth = `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, "0")}`;
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

  const displayGroups = useMemo(() => {
    const isCurrentMonth = todayLocalYearMonth === budgetMonth;
    if (!isCurrentMonth) return groupedByDueDay;
    const hasToday = groupedByDueDay.some(({ day }) => day === todayDayOfMonth);
    if (hasToday) return groupedByDueDay;
    return [...groupedByDueDay, { day: todayDayOfMonth, items: [] as PlannerRow[] }].sort(
      (a, b) => a.day - b.day
    );
  }, [groupedByDueDay, todayLocalYearMonth, budgetMonth, todayDayOfMonth]);

  const [editTarget, setEditTarget] = useState<TimelineExpense | null>(null);
  const [editDebtId, setEditDebtId] = useState<Id<"debts"> | null>(null);
  const [editCreditCardId, setEditCreditCardId] = useState<Id<"creditCards"> | null>(null);
  const [editCategoryItem, setEditCategoryItem] = useState<CategoryProgressForEdit | null>(null);
  const [archivePendingId, setArchivePendingId] = useState<Id<"budgetItems"> | null>(null);
  const [archiveDebtPendingId, setArchiveDebtPendingId] = useState<Id<"debts"> | null>(
    null
  );
  const [paidTogglePendingKey, setPaidTogglePendingKey] = useState<string | null>(null);
  const [justPaidKeys, setJustPaidKeys] = useState<Set<string>>(() => new Set());
  const prefersReducedMotion = usePrefersReducedMotion();
  const [fundAdjustTarget, setFundAdjustTarget] =
    useState<TimelineExpense | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddCategoryId, setQuickAddCategoryId] = useState<Id<"categories"> | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [rowMenuKey, setRowMenuKey] = useState<string | null>(null);
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
  const [fundRowPendingKey, setFundRowPendingKey] = useState<string | null>(null);
  const [fundAllPending, setFundAllPending] = useState(false);

  type TxModalTarget =
    | { kind: "budget"; id: Id<"budgetItems">; payeeKey: string; amount: number; name: string; rowKey: string }
    | { kind: "debt"; id: Id<"debts">; payeeKey: string; amount: number; name: string; rowKey: string }
    | { kind: "cc"; id: Id<"creditCards">; payeeKey: string; amount: number; name: string; rowKey: string };
  const [txModalTarget, setTxModalTarget] = useState<TxModalTarget | null>(null);

  const { openAddTransaction } = useTransactionModal();

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
    await archiveItem({ id, userId });
    setArchivePendingId(null);
  };

  const handleArchiveDebt = async (id: Id<"debts">) => {
    await archiveDebt({ id, userId });
    setArchiveDebtPendingId(null);
  };

  const handleFundAll = useCallback(async () => {
    setFundAllPending(true);
    try {
      const promises: Promise<unknown>[] = [];
      for (const item of items) {
        if (item.rowKind === "category") {
          const cat = item as PlannerCategoryRow;
          const isPaid =
            cat.markedPaidForMonth === budgetMonth ||
            (cat.monthlyTarget > 0 && cat.spent >= cat.monthlyTarget);
          if (!isPaid && cat.fundedForMonth !== budgetMonth) {
            promises.push(
              setCategoryFundedForMonth({ id: cat.categoryId, userId, monthKey: budgetMonth, funded: true })
            );
          }
        } else if (item.rowKind === "debt") {
          const d = item as PlannerDebtRow;
          const isPaid = d.hasPaidTransaction || d.markedPaidForMonth === budgetMonth;
          if (!isPaid && d.fundedForMonth !== budgetMonth) {
            promises.push(
              setDebtFundedForMonth({ id: d.debtId, userId, monthKey: budgetMonth, funded: true })
            );
          }
        } else if (item.rowKind === "creditCard") {
          const cc = item as PlannerCreditCardRow;
          const isPaid = cc.hasPaidTransaction || cc.markedPaidForMonth === budgetMonth;
          if (!isPaid && cc.fundedForMonth !== budgetMonth) {
            promises.push(
              setCreditCardFundedForMonth({ id: cc.creditCardId, userId, monthKey: budgetMonth, funded: true })
            );
          }
        }
      }
      await Promise.all(promises);
      if (promises.length > 0) {
        setActionBanner({ kind: "success", message: `Funded ${promises.length} item${promises.length === 1 ? "" : "s"} for ${formatMonth(budgetMonth)}.` });
      }
    } catch (e) {
      setActionBanner({ kind: "error", message: e instanceof Error ? e.message : "Could not fund all" });
    } finally {
      setFundAllPending(false);
    }
  }, [items, budgetMonth, userId, setCategoryFundedForMonth, setDebtFundedForMonth, setCreditCardFundedForMonth]);

  const DEBTS_SECTION_COLOR = ACCENT_COLOR_FALLBACK.debt;
  const CREDIT_CARDS_SECTION_COLOR = ACCENT_COLOR_FALLBACK.creditCard;

  const hasCategoryProgress = (categoryProgress?.length ?? 0) > 0;

  return (
    <div className="w-full min-w-0 space-y-6">

      {/* Budget categories section */}
      {hasCategoryProgress && (
        <div className="w-full space-y-1.5">
          {categoryProgress!.map((p) => {
            const color = p.category.color ?? ACCENT_COLOR_FALLBACK.category;
            const IconComp = p.category.icon ? CATEGORY_ICON_MAP[p.category.icon] : null;
            const groupName = p.category.groupId ? (groupNameById?.[p.category.groupId] ?? null) : null;
            const rawPct = p.target && p.target > 0 ? (p.spent / p.target) * 100 : 0;
            const displayPct = Math.min(rawPct, 100);
            const isOver = p.target !== null && p.spent > p.target;
            const isWarn = rawPct >= 80 && !isOver;
            const barColor = isOver
              ? ACCENT_COLOR_FALLBACK.danger
              : isWarn
                ? ACCENT_COLOR_FALLBACK.warning
                : color;
            return (
              <div
                key={p.category._id}
                className="w-full overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
                style={{ borderLeftWidth: 3, borderLeftColor: color }}
              >
                <div className="flex w-full min-w-0 items-center gap-2.5 px-3 py-2.5">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${color}26` }}
                  >
                    {IconComp ? (
                      <IconComp className="h-3.5 w-3.5" style={{ color }} aria-hidden="true" />
                    ) : (
                      <span className="text-[11px] leading-none" aria-hidden="true">💰</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-100 sm:text-sm">
                        {p.category.name}
                        {groupName && (
                          <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">
                            {groupName}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {p.target !== null
                          ? `${formatCurrency(p.spent)} / ${formatCurrency(p.target)}`
                          : formatCurrency(p.spent)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-white/8"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(displayPct)}
                        aria-label={`${p.category.name}: ${Math.round(rawPct)}% of budget used`}
                      >
                        <div
                          className="h-full w-full origin-left transition-transform duration-200"
                          style={{ transform: `scaleX(${displayPct / 100})`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  </div>
                  {isOver && (
                    <span className="shrink-0 rounded-md border border-rose-200/80 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:border-rose-500/35 dark:bg-rose-950/45 dark:text-rose-200">
                      Over
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Date-organized payment rows (debts + credit cards) */}
      {items.length === 0 ? null : (
      <div className="relative w-full min-w-0">
      {actionBanner ? (
        <div
          className={`mb-3 flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${
            actionBanner.kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-100"
              : actionBanner.kind === "success"
                ? "border-teal-200 bg-teal-50/90 text-teal-950 dark:border-teal-500/30 dark:bg-teal-950/45 dark:text-teal-100"
                : "border-slate-200 bg-slate-50 text-slate-800 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-200"
          }`}
        >
          <p className="min-w-0 leading-snug">{actionBanner.message}</p>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-500 hover:bg-black/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div
        className="absolute left-[8px] top-3 bottom-3 w-px bg-slate-200 sm:left-[11px] dark:bg-white/10"
        aria-hidden="true"
      />

      <ol className="space-y-6 w-full min-w-0">
        {displayGroups.map(({ day, items: dayItems }) => {
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
                className={`absolute left-0 top-0.5 flex h-[22px] w-[22px] sm:h-[26px] sm:w-[26px] items-center justify-center rounded-md border bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:bg-slate-950/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
                  isToday
                    ? "border-teal-400/70 ring-2 ring-teal-400/30 dark:border-teal-500/60 dark:ring-teal-500/25"
                    : "border-slate-200/90 dark:border-white/15"
                }`}
                aria-hidden="true"
              >
                <span className="relative flex h-full w-full flex-col items-center justify-center gap-0.5 pt-0.5">
                  <span
                    className={`h-1 w-1 shrink-0 rounded-full ${
                      isToday
                        ? "bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.55)]"
                        : isPast
                          ? "bg-slate-300 dark:bg-white/25"
                          : "bg-teal-500/70 dark:bg-teal-500/45"
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-[9px] sm:text-[10px] font-semibold tabular-nums leading-none tracking-tight ${
                      isToday
                        ? "text-teal-800 dark:text-teal-100"
                        : isPast
                          ? "text-slate-500"
                          : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {day}
                  </span>
                </span>
              </div>

              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Due {ordinal(day)}</h3>
                <span className="text-slate-300 dark:text-white/20" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-400 dark:text-slate-400">{formatMonth(budgetMonth)}</span>
                {rel && (
                  <>
                    <span className="text-slate-300 dark:text-white/20" aria-hidden="true">
                      ·
                    </span>
                    {isToday ? (
                      <span className="rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-teal-600">
                        Today
                      </span>
                    ) : (
                      <span
                        className={
                          isPast
                            ? "text-slate-400 dark:text-slate-500"
                            : "text-slate-500 dark:text-slate-400"
                        }
                      >
                        {rel}
                      </span>
                    )}
                  </>
                )}
              </div>

              {dayItems.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-teal-300/70 bg-teal-50/40 px-3 py-2.5 dark:border-teal-600/30 dark:bg-teal-950/20">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Nothing due today</span>
                  {isToday ? (
                    <button
                      type="button"
                      onClick={() => setNewCategoryOpen(true)}
                      title="Add a new category due today"
                      aria-label="Add a new category due today"
                      className="ml-auto flex items-center gap-1 rounded-md border border-teal-300/80 bg-white px-2 py-1 text-[11px] font-medium text-teal-700 shadow-sm transition-colors hover:bg-teal-50 hover:border-teal-400 dark:border-teal-600/50 dark:bg-slate-900 dark:text-teal-400 dark:hover:bg-teal-950/40"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      New category
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setQuickAddOpen(true)}
                      title="Add a new expense due today"
                      aria-label="Add a new expense due today"
                      className="ml-auto flex items-center gap-1 rounded-md border border-teal-300/80 bg-white px-2 py-1 text-[11px] font-medium text-teal-700 shadow-sm transition-colors hover:bg-teal-50 hover:border-teal-400 dark:border-teal-600/50 dark:bg-slate-900 dark:text-teal-400 dark:hover:bg-teal-950/40"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      New expense
                    </button>
                  )}
                </div>
              ) : null}
              <ul className="space-y-1.5 w-full min-w-0">
                {dayItems.map((item) => {
                  const rk = rowKey(item);

                  if (item.rowKind === "creditCard") {
                    const color = item.accentColor ?? CREDIT_CARDS_SECTION_COLOR;
                    const paidAmt = item.paidAmount ?? 0;
                    const isPaidByTx = item.amount > 0.005 && paidAmt >= item.amount - 0.005;
                    const isPaidForMonth = item.markedPaidForMonth === budgetMonth || isPaidByTx;
                    const isPartiallyPaid = paidAmt > 0.005 && !isPaidForMonth;
                    const paidPct = item.amount > 0.005 ? Math.min((paidAmt / item.amount) * 100, 100) : 0;
                    const fundState = debtOrCardFundState(
                      isPaidForMonth,
                      item.fundedForMonth,
                      budgetMonth
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
                      item.amount <= 0.005 ? "Set monthly payment on Cards page" : null,
                    ].filter(Boolean);
                    const metaLine = metaParts.join(" · ");
                    const paidLine = isPartiallyPaid
                      ? `${formatCurrency(paidAmt)} of ${formatCurrency(item.amount)} paid`
                      : null;
                    const ccSubline = [
                      paidLine,
                      metaLine || null,
                      isDuePast ? "Past due" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    const readinessPct = isPaidForMonth ? 100 : paidPct;
                    const readinessFill = isPaidForMonth
                      ? "bg-emerald-500"
                      : isPartiallyPaid
                        ? "bg-yellow-400"
                        : "bg-rose-500/50 dark:bg-rose-500/45";
                    const readinessLabel = isPaidForMonth
                      ? `Payment paid for ${item.name}`
                      : isPartiallyPaid
                        ? `${formatCurrency(paidAmt)} of ${formatCurrency(item.amount)} paid for ${item.name}`
                        : fundState === "funded"
                          ? `Funded — ready to pay ${formatCurrency(item.amount)} for ${item.name}`
                          : `Unfunded — mark funded when money is set aside for ${item.name}`;

                    return (
                      <li key={rk} className="w-full min-w-0">
                        <div
                          className={`group/row w-full min-w-0 overflow-visible rounded-lg border shadow-sm transition-colors ${timelineRowSurfaceClasses(
                            fundState
                          )}`}
                          style={{ borderLeftWidth: 3, borderLeftColor: color }}
                        >
                          <div className="flex w-full min-w-0 items-center gap-1.5 py-1 pl-1 pr-1.5 sm:gap-2 sm:pr-2">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!isPaidForMonth) {
                                  setTxModalTarget({ kind: "cc", id: item.creditCardId, payeeKey: `cc:${item.creditCardId}`, amount: item.amount, name: item.name, rowKey: rk });
                                } else {
                                  setPaidTogglePendingKey(rk);
                                  try {
                                    await setCreditCardPaidForMonth({
                                      id: item.creditCardId,
                                      userId,
                                      monthKey: budgetMonth,
                                      paid: false,
                                    });
                                  } finally {
                                    setPaidTogglePendingKey(null);
                                  }
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
                                  ? "text-emerald-600 hover:bg-emerald-100/80 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                                  : "text-slate-300 hover:bg-teal-50 hover:text-teal-600 dark:text-slate-500 dark:hover:bg-teal-950/40 dark:hover:text-teal-400"
                              }`}
                            >
                              {isPaidForMonth ? (
                                <PaidCheckMark
                                  animate={justPaidKeys.has(rk) && !prefersReducedMotion}
                                  onAnimationEnd={() => setJustPaidKeys(prev => { const s = new Set(prev); s.delete(rk); return s; })}
                                />
                              ) : (
                                <Circle
                                  className="h-4 w-4 sm:h-[18px] sm:w-[18px]"
                                  aria-hidden="true"
                                />
                              )}
                            </button>

                            <div
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                              style={{ backgroundColor: `${CREDIT_CARDS_SECTION_COLOR}26` }}
                              title="Credit cards"
                            >
                              <CreditCard
                                className="h-3 w-3"
                                style={{ color: CREDIT_CARDS_SECTION_COLOR }}
                                aria-hidden="true"
                              />
                            </div>

                            <div className="min-w-0 flex-1 overflow-hidden">
                              <div className="truncate text-xs font-medium text-slate-800 dark:text-slate-100 sm:text-sm">
                                {item.name}
                                <span className="font-normal text-slate-400 dark:text-slate-400">
                                  {" "}
                                  · payment
                                </span>
                              </div>
                              {ccSubline ? (
                                <p
                                  className="truncate text-[10px] leading-snug text-slate-500 dark:text-slate-400"
                                  title={ccSubline}
                                >
                                  {ccSubline}
                                </p>
                              ) : null}
                            </div>

                            {fundState === "waiting" && (
                              <button
                                type="button"
                                disabled={fundRowPendingKey === rk}
                                onClick={async () => {
                                  setFundRowPendingKey(rk);
                                  try {
                                    await setCreditCardFundedForMonth({ id: item.creditCardId, userId, monthKey: budgetMonth, funded: true });
                                  } finally {
                                    setFundRowPendingKey(null);
                                  }
                                }}
                                className="shrink-0 rounded-md border border-rose-200/90 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-900 transition-colors hover:bg-rose-200/50 disabled:opacity-50 dark:border-rose-500/35 dark:bg-rose-950/50 dark:text-rose-100 dark:hover:bg-rose-950/80 sm:text-[11px]"
                              >
                                {fundRowPendingKey === rk ? "…" : "Fund"}
                              </button>
                            )}

                            {fundState === "funded" && (
                              <span className="shrink-0 rounded-md border border-yellow-200/90 bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-950 dark:border-yellow-500/35 dark:bg-yellow-950/45 dark:text-yellow-100 sm:text-[11px]">
                                Funded
                              </span>
                            )}

                            {fundState === "paid" && (
                              <span className="shrink-0 rounded-md border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-950/45 dark:text-emerald-200 sm:text-[11px]">
                                Paid
                              </span>
                            )}

                            <span className="shrink-0 tabular-nums text-xs font-semibold text-slate-800 dark:text-slate-100 sm:text-sm">
                              {formatCurrency(item.amount)}
                            </span>

                            <TimelineRowActionsMenu
                              rowKey={rk}
                              menuOpenKey={rowMenuKey}
                              setMenuOpenKey={setRowMenuKey}
                            >
                              {fundState === "waiting" && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-1.5 text-left text-sm font-medium text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-950/50"
                                  onClick={async () => {
                                    setRowMenuKey(null);
                                    await setCreditCardFundedForMonth({ id: item.creditCardId, userId, monthKey: budgetMonth, funded: true });
                                  }}
                                >
                                  Fund
                                </button>
                              )}
                              {fundState === "funded" && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-1.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                  onClick={async () => {
                                    setRowMenuKey(null);
                                    await setCreditCardFundedForMonth({ id: item.creditCardId, userId, monthKey: budgetMonth, funded: false });
                                  }}
                                >
                                  Unfund
                                </button>
                              )}
                              <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-1.5 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                                onClick={() => {
                                  setRowMenuKey(null);
                                  openAddTransaction(`cc:${item.creditCardId}`);
                                }}
                              >
                                Log payment
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-1.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                onClick={() => {
                                  setRowMenuKey(null);
                                  setEditCreditCardId(item.creditCardId);
                                }}
                              >
                                Edit card
                              </button>
                              <Link
                                href="/credit-cards"
                                role="menuitem"
                                className="block px-3 py-1.5 text-left text-sm font-medium text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/50"
                                onClick={() => setRowMenuKey(null)}
                              >
                                Credit cards
                              </Link>
                            </TimelineRowActionsMenu>
                          </div>
                          <div className="px-2 pb-2 pt-0">
                            <TimelineFundingBar
                              pct={readinessPct}
                              fillClassName={readinessFill}
                              label={readinessLabel}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.rowKind === "debt") {
                    const color = item.accentColor ?? DEBTS_SECTION_COLOR;
                    const paidAmt = item.paidAmount ?? 0;
                    const isPaidByTx = item.amount > 0.005 && paidAmt >= item.amount - 0.005;
                    const isPaidForMonth = item.markedPaidForMonth === budgetMonth || isPaidByTx;
                    const isPartiallyPaid = paidAmt > 0.005 && !isPaidForMonth;
                    const paidPct = item.amount > 0.005 ? Math.min((paidAmt / item.amount) * 100, 100) : 0;
                    const fundState = debtOrCardFundState(
                      isPaidForMonth,
                      item.fundedForMonth,
                      budgetMonth
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
                    const paidLine = isPartiallyPaid
                      ? `${formatCurrency(paidAmt)} of ${formatCurrency(item.amount)} paid`
                      : null;
                    const debtSubline = [
                      paidLine,
                      metaLine || null,
                      isDuePast ? "Past due" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    const debtEditable = debts?.some((d) => d._id === item.debtId);

                    const debtReadinessPct = isPaidForMonth ? 100 : paidPct;
                    const debtReadinessFill = isPaidForMonth
                      ? "bg-emerald-500"
                      : isPartiallyPaid
                        ? "bg-yellow-400"
                        : "bg-rose-500/50 dark:bg-rose-500/45";
                    const debtReadinessLabel = isPaidForMonth
                      ? `Payment paid for ${item.name}`
                      : isPartiallyPaid
                        ? `${formatCurrency(paidAmt)} of ${formatCurrency(item.amount)} paid for ${item.name}`
                        : fundState === "funded"
                          ? `Funded — ready to pay ${formatCurrency(item.amount)} for ${item.name}`
                          : `Unfunded — mark funded when money is set aside for ${item.name}`;

                    return (
                      <li key={rk} className="w-full min-w-0">
                        <div
                          className={`group/row w-full min-w-0 overflow-visible rounded-lg border shadow-sm transition-colors ${timelineRowSurfaceClasses(
                            fundState
                          )}`}
                          style={{ borderLeftWidth: 3, borderLeftColor: color }}
                        >
                          <div className="flex w-full min-w-0 items-center gap-1.5 py-1 pl-1 pr-1.5 sm:gap-2 sm:pr-2">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!isPaidForMonth) {
                                  setTxModalTarget({ kind: "debt", id: item.debtId, payeeKey: `debt:${item.debtId}`, amount: item.amount, name: item.name, rowKey: rk });
                                } else {
                                  setPaidTogglePendingKey(rk);
                                  try {
                                    await setDebtPaidForMonth({
                                      id: item.debtId,
                                      userId,
                                      monthKey: budgetMonth,
                                      paid: false,
                                    });
                                  } finally {
                                    setPaidTogglePendingKey(null);
                                  }
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
                                  ? "text-emerald-600 hover:bg-emerald-100/80 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                                  : "text-slate-300 hover:bg-teal-50 hover:text-teal-600 dark:text-slate-500 dark:hover:bg-teal-950/40 dark:hover:text-teal-400"
                              }`}
                            >
                              {isPaidForMonth ? (
                                <PaidCheckMark
                                  animate={justPaidKeys.has(rk) && !prefersReducedMotion}
                                  onAnimationEnd={() => setJustPaidKeys(prev => { const s = new Set(prev); s.delete(rk); return s; })}
                                />
                              ) : (
                                <Circle
                                  className="h-4 w-4 sm:h-[18px] sm:w-[18px]"
                                  aria-hidden="true"
                                />
                              )}
                            </button>

                            <div
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                              style={{ backgroundColor: `${DEBTS_SECTION_COLOR}26` }}
                              title="Debts"
                            >
                              <Landmark
                                className="h-3 w-3"
                                style={{ color: DEBTS_SECTION_COLOR }}
                                aria-hidden="true"
                              />
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col gap-0 overflow-hidden">
                              <div className="min-w-0 truncate text-xs font-medium text-slate-800 dark:text-slate-100 sm:text-sm">
                                {item.name}
                                <span className="font-normal text-slate-400 dark:text-slate-400">
                                  {" "}
                                  · payment
                                </span>
                              </div>
                              {debtSubline ? (
                                <p
                                  className="truncate text-[10px] leading-snug text-slate-500 dark:text-slate-400"
                                  title={debtSubline}
                                >
                                  {debtSubline}
                                </p>
                              ) : null}
                            </div>

                            {fundState === "waiting" && (
                              <button
                                type="button"
                                disabled={fundRowPendingKey === rk}
                                onClick={async () => {
                                  setFundRowPendingKey(rk);
                                  try {
                                    await setDebtFundedForMonth({ id: item.debtId, userId, monthKey: budgetMonth, funded: true });
                                  } finally {
                                    setFundRowPendingKey(null);
                                  }
                                }}
                                className="shrink-0 rounded-md border border-rose-200/90 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-900 transition-colors hover:bg-rose-200/50 disabled:opacity-50 dark:border-rose-500/35 dark:bg-rose-950/50 dark:text-rose-100 dark:hover:bg-rose-950/80 sm:text-[11px]"
                              >
                                {fundRowPendingKey === rk ? "…" : "Fund"}
                              </button>
                            )}

                            {fundState === "funded" && (
                              <span className="shrink-0 rounded-md border border-yellow-200/90 bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-950 dark:border-yellow-500/35 dark:bg-yellow-950/45 dark:text-yellow-100 sm:text-[11px]">
                                Funded
                              </span>
                            )}

                            {fundState === "paid" && (
                              <span className="shrink-0 rounded-md border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-950/45 dark:text-emerald-200 sm:text-[11px]">
                                Paid
                              </span>
                            )}

                            <span className="shrink-0 tabular-nums text-xs font-semibold text-slate-800 dark:text-slate-100 sm:text-sm">
                              {item.amount > 0.005 ? formatCurrency(item.amount) : <span className="text-slate-400 dark:text-slate-500">—</span>}
                            </span>

                            <TimelineRowActionsMenu
                              rowKey={rk}
                              menuOpenKey={rowMenuKey}
                              setMenuOpenKey={setRowMenuKey}
                            >
                              {fundState === "waiting" && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-1.5 text-left text-sm font-medium text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-950/50"
                                  onClick={async () => {
                                    setRowMenuKey(null);
                                    await setDebtFundedForMonth({ id: item.debtId, userId, monthKey: budgetMonth, funded: true });
                                  }}
                                >
                                  Fund
                                </button>
                              )}
                              {fundState === "funded" && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-1.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                  onClick={async () => {
                                    setRowMenuKey(null);
                                    await setDebtFundedForMonth({ id: item.debtId, userId, monthKey: budgetMonth, funded: false });
                                  }}
                                >
                                  Unfund
                                </button>
                              )}
                              <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-1.5 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                                onClick={() => {
                                  setRowMenuKey(null);
                                  openAddTransaction(`debt:${item.debtId}`);
                                }}
                              >
                                Log payment
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                disabled={!debtEditable}
                                className="block w-full px-3 py-1.5 text-left text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-teal-400 dark:hover:bg-teal-950/50"
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
                                className="block px-3 py-1.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                onClick={() => setRowMenuKey(null)}
                              >
                                Debts page
                              </Link>
                              <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-1.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                onClick={() => {
                                  setArchiveDebtPendingId(
                                    archiveDebtPendingId === item.debtId ? null : item.debtId
                                  );
                                  setRowMenuKey(null);
                                }}
                              >
                                Archive
                              </button>
                            </TimelineRowActionsMenu>
                          </div>
                          <div className="px-2 pb-2 pt-0">
                            <TimelineFundingBar
                              pct={debtReadinessPct}
                              fillClassName={debtReadinessFill}
                              label={debtReadinessLabel}
                            />
                          </div>
                        </div>

                        {archiveDebtPendingId === item.debtId && (
                          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-500/35 dark:bg-rose-950/45">
                            <p className="text-xs text-rose-700 dark:text-rose-100">
                              Archive <strong>{item.name}</strong>? It will be hidden from active planning.
                              Balances are unchanged.
                            </p>
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => handleArchiveDebt(item.debtId)}
                                className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                              >
                                Archive
                              </button>
                              <button
                                type="button"
                                onClick={() => setArchiveDebtPendingId(null)}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  }

                  if (item.rowKind === "category") {
                    const catItem = item as PlannerCategoryRow;
                    const color = catItem.accentColor ?? ACCENT_COLOR_FALLBACK.category;
                    const IconComp = catItem.icon ? CATEGORY_ICON_MAP[catItem.icon] : null;
                    const isPaidForMonth = catItem.markedPaidForMonth === budgetMonth;
                    const spent = catItem.spent;
                    const isFullyFunded = catItem.monthlyTarget > 0 && spent >= catItem.monthlyTarget;
                    const isEffectivelyPaid = isPaidForMonth || isFullyFunded;
                    const paymentStart = dateInBudgetMonth(budgetMonth, catItem.paymentDayOfMonth);
                    const deltaPayment = calendarDaysFromTo(todayStart, paymentStart);
                    const isDuePast = !isEffectivelyPaid && deltaPayment < 0;
                    const groupName = catItem.groupId ? (groupNameById?.[catItem.groupId] ?? null) : null;
                    const payFromAccount =
                      catItem.paymentAccountId && accountMap[catItem.paymentAccountId]
                        ? `Pay from ${accountMap[catItem.paymentAccountId].name}`
                        : null;
                    const spentPct = catItem.monthlyTarget > 0
                      ? Math.min((spent / catItem.monthlyTarget) * 100, 100)
                      : 0;
                    const isOver = catItem.monthlyTarget > 0 && spent > catItem.monthlyTarget;
                    const barFillColor = isOver ? ACCENT_COLOR_FALLBACK.danger : color;
                    const isCatFunded = catItem.fundedForMonth === budgetMonth;
                    const fundState: TimelineFundState = isEffectivelyPaid
                      ? "paid"
                      : isCatFunded
                        ? "funded"
                        : "waiting";
                    const metaParts = [
                      catItem.isAutopay ? "Autopay" : null,
                      payFromAccount,
                      isDuePast ? "Past due" : null,
                      groupName,
                    ].filter(Boolean);
                    const catSubline = [
                      isEffectivelyPaid && spent <= 0.005
                        ? `Target ${formatCurrency(catItem.monthlyTarget)} · paid`
                        : spent > 0.005
                          ? `${formatCurrency(spent)} paid · ${formatCurrency(catItem.monthlyTarget)} target`
                          : `${formatCurrency(catItem.monthlyTarget)} target`,
                      metaParts.length > 0 ? metaParts.join(" · ") : null,
                    ].filter(Boolean).join(" · ");

                    return (
                      <li key={rk} className="w-full min-w-0">
                        <div
                          className={`group/row w-full min-w-0 overflow-visible rounded-lg border shadow-sm transition-colors ${timelineRowSurfaceClasses(fundState)}`}
                          style={{ borderLeftWidth: 3, borderLeftColor: color }}
                        >
                          <div className="flex w-full min-w-0 items-center gap-1.5 py-1 pl-1 pr-1.5 sm:gap-2 sm:pr-2">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!isPaidForMonth) {
                                  setJustPaidKeys(prev => { const s = new Set(prev); s.add(rk); return s; });
                                }
                                setPaidTogglePendingKey(rk);
                                try {
                                  await setCategoryPaidForMonth({
                                    id: catItem.categoryId,
                                    userId,
                                    monthKey: budgetMonth,
                                    paid: !isPaidForMonth,
                                  });
                                } finally {
                                  setPaidTogglePendingKey(null);
                                }
                              }}
                              disabled={paidTogglePendingKey === rk}
                              aria-pressed={isEffectivelyPaid}
                              title={
                                isPaidForMonth
                                  ? `Paid for ${formatMonth(budgetMonth)} — click to clear`
                                  : isFullyFunded
                                    ? `Fully paid via transactions — click to manually mark paid`
                                    : `Mark as paid — payment settled this month`
                              }
                              aria-label={
                                isEffectivelyPaid
                                  ? `Mark ${catItem.name} payment not paid for ${formatMonth(budgetMonth)}`
                                  : `Mark ${catItem.name} payment paid for ${formatMonth(budgetMonth)}`
                              }
                              className={`shrink-0 rounded-md p-0.5 transition-colors disabled:opacity-50 ${
                                isEffectivelyPaid
                                  ? "text-emerald-600 hover:bg-emerald-100/80 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                                  : "text-slate-300 hover:bg-teal-50 hover:text-teal-600 dark:text-slate-500 dark:hover:bg-teal-950/40 dark:hover:text-teal-400"
                              }`}
                            >
                              {isEffectivelyPaid ? (
                                <PaidCheckMark
                                  animate={justPaidKeys.has(rk) && !prefersReducedMotion}
                                  onAnimationEnd={() => setJustPaidKeys(prev => { const s = new Set(prev); s.delete(rk); return s; })}
                                />
                              ) : (
                                <Circle className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
                              )}
                            </button>

                            <div
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                              style={{ backgroundColor: `${color}26` }}
                              title={catItem.name}
                            >
                              {IconComp ? (
                                <IconComp className="h-3 w-3" style={{ color }} aria-hidden="true" />
                              ) : (
                                <span className="text-[10px] leading-none" aria-hidden="true">💰</span>
                              )}
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col gap-0 overflow-hidden">
                              <div className="min-w-0 truncate text-xs font-medium text-slate-800 dark:text-slate-100 sm:text-sm">
                                {catItem.name}
                                {groupName && (
                                  <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">
                                    {groupName}
                                  </span>
                                )}
                              </div>
                              {catSubline ? (
                                <p
                                  className="truncate text-[10px] leading-snug text-slate-500 dark:text-slate-400"
                                  title={catSubline}
                                >
                                  {catSubline}
                                </p>
                              ) : null}
                            </div>

                            {fundState === "waiting" && (
                              <button
                                type="button"
                                disabled={fundRowPendingKey === rk}
                                onClick={async () => {
                                  setFundRowPendingKey(rk);
                                  try {
                                    await setCategoryFundedForMonth({ id: catItem.categoryId, userId, monthKey: budgetMonth, funded: true });
                                  } finally {
                                    setFundRowPendingKey(null);
                                  }
                                }}
                                className="shrink-0 rounded-md border border-rose-200/90 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-900 transition-colors hover:bg-rose-200/50 disabled:opacity-50 dark:border-rose-500/35 dark:bg-rose-950/50 dark:text-rose-100 dark:hover:bg-rose-950/80 sm:text-[11px]"
                              >
                                {fundRowPendingKey === rk ? "…" : "Fund"}
                              </button>
                            )}

                            {fundState === "funded" && (
                              <span className="shrink-0 rounded-md border border-yellow-200/90 bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-950 dark:border-yellow-500/35 dark:bg-yellow-950/45 dark:text-yellow-100 sm:text-[11px]">
                                Funded
                              </span>
                            )}

                            {fundState === "paid" && (
                              <span className="shrink-0 rounded-md border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-950/45 dark:text-emerald-200 sm:text-[11px]">
                                Paid
                              </span>
                            )}

                            {catItem.isAutopay && fundState !== "paid" && (
                              <span className="shrink-0 rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:border-white/15 dark:bg-slate-800/50 dark:text-slate-400 sm:text-[11px]">
                                Autopay
                              </span>
                            )}

                            <span className="shrink-0 tabular-nums text-xs font-semibold text-slate-800 dark:text-slate-100 sm:text-sm">
                              {formatCurrency(catItem.monthlyTarget)}
                            </span>

                            <TimelineRowActionsMenu
                              rowKey={rk}
                              menuOpenKey={rowMenuKey}
                              setMenuOpenKey={setRowMenuKey}
                            >
                              {fundState === "waiting" && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-1.5 text-left text-sm font-medium text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-950/50"
                                  onClick={async () => {
                                    setRowMenuKey(null);
                                    await setCategoryFundedForMonth({ id: catItem.categoryId, userId, monthKey: budgetMonth, funded: true });
                                  }}
                                >
                                  Fund
                                </button>
                              )}
                              {fundState === "funded" && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-1.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                  onClick={async () => {
                                    setRowMenuKey(null);
                                    await setCategoryFundedForMonth({ id: catItem.categoryId, userId, monthKey: budgetMonth, funded: false });
                                  }}
                                >
                                  Unfund
                                </button>
                              )}
                              <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-1.5 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                                onClick={() => {
                                  setRowMenuKey(null);
                                  openAddTransaction(`category:${catItem.categoryId}`);
                                }}
                              >
                                Log payment
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-1.5 text-left text-sm font-medium text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/50"
                                onClick={() => {
                                  setRowMenuKey(null);
                                  setEditCategoryItem({
                                    category: {
                                      _id: catItem.categoryId,
                                      name: catItem.name,
                                      groupId: catItem.groupId as Id<"groups"> | undefined,
                                      monthlyTarget: catItem.monthlyTarget,
                                      dueDayOfMonth: catItem.paymentDayOfMonth,
                                      paymentAccountId: catItem.paymentAccountId
                                        ? String(catItem.paymentAccountId)
                                        : undefined,
                                      isAutopay: catItem.isAutopay,
                                      color: catItem.accentColor,
                                      icon: catItem.icon,
                                      markedPaidForMonth: catItem.markedPaidForMonth,
                                    },
                                  });
                                }}
                              >
                                Edit
                              </button>
                            </TimelineRowActionsMenu>
                          </div>
                          <div className="px-2 pb-2 pt-0">
                            <TimelineFundingBar
                              pct={isEffectivelyPaid ? 100 : spentPct}
                              fillClassName={isEffectivelyPaid ? "bg-emerald-500" : spent > 0.005 ? "bg-yellow-400" : isOver ? "bg-rose-500" : ""}
                              fillStyle={!isEffectivelyPaid && spent <= 0.005 && !isOver ? { backgroundColor: barFillColor } : undefined}
                              label={
                                isEffectivelyPaid
                                  ? `${catItem.name} paid for ${formatMonth(budgetMonth)}`
                                  : spent > 0.005
                                    ? `${formatCurrency(spent)} of ${formatCurrency(catItem.monthlyTarget)} paid`
                                    : isCatFunded
                                      ? `Funded — ready to pay ${formatCurrency(catItem.monthlyTarget)} for ${catItem.name}`
                                      : `${catItem.name}: ${formatCurrency(catItem.monthlyTarget)} target`
                              }
                            />
                          </div>
                        </div>
                      </li>
                    );
                  }

                  if (item.rowKind !== "budget") {
                    return null;
                  }
                  const cat = categoryMap[item.categoryId];
                  const color = cat?.color ?? ACCENT_COLOR_FALLBACK.category;
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

                  const billDenom = item.amount > 0.005 ? item.amount : 1;
                  const fundedPctRaw = (setAsideTotal / billDenom) * 100;
                  const barPct = isPaidForMonth
                    ? 100
                    : isOverAllocated
                      ? 100
                      : Math.min(fundedPctRaw, 100);
                  const barFillStyle =
                    isPaidForMonth || isOverAllocated
                      ? undefined
                      : ({ backgroundColor: color } satisfies CSSProperties);
                  const barFillClass = isPaidForMonth
                    ? "bg-emerald-500"
                    : isOverAllocated
                      ? "bg-rose-500"
                      : "";
                  const barLabel = isPaidForMonth
                    ? `${item.name} paid for ${formatMonth(budgetMonth)}`
                    : isOverAllocated
                      ? `${item.name} over-funded: ${formatCurrency(setAsideTotal)} set aside for ${formatCurrency(item.amount)} bill`
                      : `${item.name}: ${formatCurrency(setAsideTotal)} of ${formatCurrency(item.amount)} funded`;

                  return (
                    <li key={rk} className="w-full min-w-0">
                      <div
                        className={`group/row w-full min-w-0 overflow-visible rounded-lg border shadow-sm transition-colors ${
                          isOverAllocated && !isPaidForMonth
                            ? `${timelineRowSurfaceClasses(fundState)} ring-2 ring-yellow-400/50 ring-offset-2 ring-offset-white dark:ring-offset-slate-900`
                            : timelineRowSurfaceClasses(fundState)
                        }`}
                        style={{ borderLeftWidth: 3, borderLeftColor: color }}
                      >
                        <div className="flex w-full min-w-0 items-center gap-1.5 py-1 pl-1 pr-1.5 sm:gap-2 sm:pr-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!isPaidForMonth) {
                                setTxModalTarget({ kind: "budget", id: item._id, payeeKey: `category:${item.categoryId}`, amount: item.amount, name: item.name, rowKey: rk });
                              } else {
                                setPaidTogglePendingKey(rk);
                                try {
                                  await setBudgetPaidForMonth({
                                    id: item._id,
                                    userId,
                                    monthKey: budgetMonth,
                                    paid: false,
                                  });
                                } finally {
                                  setPaidTogglePendingKey(null);
                                }
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
                                ? "text-emerald-600 hover:bg-emerald-100/80 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                                : "text-slate-300 hover:bg-teal-50 hover:text-teal-600 dark:text-slate-500 dark:hover:bg-teal-950/40 dark:hover:text-teal-400"
                            }`}
                          >
                            {isPaidForMonth ? (
                              <PaidCheckMark
                                animate={justPaidKeys.has(rk) && !prefersReducedMotion}
                                onAnimationEnd={() => setJustPaidKeys(prev => { const s = new Set(prev); s.delete(rk); return s; })}
                              />
                            ) : (
                              <Circle
                                className="h-4 w-4 sm:h-[18px] sm:w-[18px]"
                                aria-hidden="true"
                              />
                            )}
                          </button>

                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${color}26` }}
                            title={cat?.name ?? "Category"}
                            aria-label={cat?.name ?? "Category"}
                          >
                            {IconComp ? (
                              <IconComp className="h-3 w-3" style={{ color }} aria-hidden="true" />
                            ) : (
                              <span className="text-[10px] leading-none" aria-hidden="true">
                                {iconName ?? "💰"}
                              </span>
                            )}
                          </div>

                          <div className="flex min-w-0 flex-1 flex-col gap-0 overflow-hidden">
                            <div className="min-w-0 truncate text-xs font-medium text-slate-800 dark:text-slate-100 sm:text-sm">
                              {item.name}
                            </div>
                            {budgetSubline ? (
                              <p
                                className="truncate text-[10px] leading-snug text-slate-500 dark:text-slate-400"
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
                              className="shrink-0 rounded-md p-1 text-rose-600 transition-colors hover:bg-rose-100/80 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
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
                                    ? "border border-rose-200/90 bg-rose-100 text-rose-900 hover:bg-rose-200/50 dark:border-rose-500/35 dark:bg-rose-950/50 dark:text-rose-100 dark:hover:bg-rose-950/80"
                                    : "border border-yellow-200/90 bg-yellow-50 text-yellow-950 hover:bg-yellow-100/90 dark:border-yellow-500/35 dark:bg-yellow-950/40 dark:text-yellow-100 dark:hover:bg-yellow-950/70"
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
                                className="shrink-0 rounded-md border border-yellow-200/90 bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-950 dark:border-yellow-500/35 dark:bg-yellow-950/45 dark:text-yellow-100 sm:text-[11px]"
                                title="Bill amount fully funded this month"
                              >
                                Funded
                              </span>
                            ) : null
                          ) : null}

                          {isPaidForMonth && (
                            <span className="shrink-0 rounded-md border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-950/45 dark:text-emerald-200 sm:text-[11px]">
                              Paid
                            </span>
                          )}

                          <span
                            className="shrink-0 tabular-nums text-xs font-semibold text-slate-800 dark:text-slate-100 sm:text-sm"
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
                                className="block w-full px-3 py-1.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
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
                              className="block w-full px-3 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
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
                              className="block w-full px-3 py-1.5 text-left text-sm font-medium text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/50"
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
                              className="block w-full px-3 py-1.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                              onClick={() => {
                                setArchivePendingId(
                                  archivePendingId === item._id ? null : item._id
                                );
                                setRowMenuKey(null);
                              }}
                            >
                              Archive
                            </button>
                          </TimelineRowActionsMenu>
                        </div>
                        <div className="px-2 pb-2 pt-0">
                          <TimelineFundingBar
                            pct={barPct}
                            fillClassName={barFillClass}
                            fillStyle={barFillStyle}
                            label={barLabel}
                          />
                        </div>
                      </div>

                      {archivePendingId === item._id && (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-500/35 dark:bg-rose-950/45">
                          <p className="text-xs text-rose-700 dark:text-rose-100">
                            Archive <strong>{item.name}</strong>? It will be hidden from active planning.
                          </p>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => handleArchive(item._id)}
                              className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                            >
                              Archive
                            </button>
                            <button
                              type="button"
                              onClick={() => setArchivePendingId(null)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timeline-edit-title"
          onClick={() => setEditTarget(null)}
        >
          <div
            className="w-full sm:w-3/4 max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="timeline-edit-title" className="mb-4 font-semibold text-slate-800 dark:text-slate-100">
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timeline-debt-edit-title"
          onClick={() => setEditDebtId(null)}
        >
          <div
            className="w-full sm:w-3/4 max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="timeline-debt-edit-title" className="mb-4 font-semibold text-slate-800 dark:text-slate-100">
              Edit debt
            </h2>
            {(() => {
              const d = debts?.find((x) => x._id === editDebtId);
              if (!d) {
                return (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    This debt is not available to edit. Try again from the{" "}
                    <Link
                      href="/debts"
                      className="font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                    >
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

      {editCreditCardId && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timeline-cc-edit-title"
          onClick={() => setEditCreditCardId(null)}
        >
          <div
            className="w-full sm:w-3/4 max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="timeline-cc-edit-title" className="mb-4 font-semibold text-slate-800 dark:text-slate-100">
              Edit credit card
            </h2>
            {(() => {
              const cc = creditCards?.find((x) => x._id === editCreditCardId);
              if (!cc) {
                return (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    This card is not available to edit. Try again from the{" "}
                    <Link
                      href="/credit-cards"
                      className="font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                    >
                      Credit Cards
                    </Link>{" "}
                    page.
                  </p>
                );
              }
              return (
                <CreditCardManager
                  key={editCreditCardId}
                  editCard={cc}
                  onSuccess={() => setEditCreditCardId(null)}
                  onCancel={() => setEditCreditCardId(null)}
                />
              );
            })()}
          </div>
        </div>
      )}

      {editCategoryItem && (
        <CategoryEditModal
          editProgress={editCategoryItem}
          onSuccess={() => setEditCategoryItem(null)}
          onClose={() => setEditCategoryItem(null)}
        />
      )}

      {newCategoryOpen && (
        <CategoryEditModal
          editProgress={null}
          defaultDueDayOfMonth={todayDayOfMonth}
          onSuccess={() => setNewCategoryOpen(false)}
          onClose={() => setNewCategoryOpen(false)}
        />
      )}

      {txModalTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timeline-tx-modal-title"
          onClick={() => setTxModalTarget(null)}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="timeline-tx-modal-title" className="mb-4 font-semibold text-slate-800 dark:text-slate-100">
              Log payment — {txModalTarget.name}
            </h2>
            <TransactionForm
              key={txModalTarget.rowKey}
              defaultPayee={txModalTarget.payeeKey}
              defaultAmount={txModalTarget.amount > 0.005 ? txModalTarget.amount : undefined}
              onSuccess={() => {
                void (async () => {
                  const target = txModalTarget;
                  setJustPaidKeys(prev => { const s = new Set(prev); s.add(target.rowKey); return s; });
                  if (target.kind === "budget") {
                    await setBudgetPaidForMonth({ id: target.id, userId, monthKey: budgetMonth, paid: true });
                  } else if (target.kind === "debt") {
                    await setDebtPaidForMonth({ id: target.id, userId, monthKey: budgetMonth, paid: true });
                  } else {
                    await setCreditCardPaidForMonth({ id: target.id, userId, monthKey: budgetMonth, paid: true });
                  }
                  setTxModalTarget(null);
                })();
              }}
            />
            <button
              type="button"
              onClick={() => setTxModalTarget(null)}
              className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {quickAddOpen && !quickAddCategoryId && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-add-category-title"
          onClick={() => setQuickAddOpen(false)}
        >
          <div
            className="w-full sm:w-3/4 max-h-[80vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="quick-add-category-title" className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
              Add expense
            </h2>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Pick a category for the new expense.
            </p>
            <ul className="space-y-1">
              {categories.map((cat) => {
                const IconComp = cat.icon ? CATEGORY_ICON_MAP[cat.icon] : null;
                const color = cat.color ?? "#0d9488";
                return (
                  <li key={cat._id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                      onClick={() => setQuickAddCategoryId(cat._id)}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${color}26` }}
                      >
                        {IconComp ? (
                          <IconComp className="h-3.5 w-3.5" style={{ color }} aria-hidden="true" />
                        ) : (
                          <span className="text-xs" aria-hidden="true">{cat.icon ?? "💰"}</span>
                        )}
                      </span>
                      {cat.name}
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => setQuickAddOpen(false)}
              className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {quickAddOpen && quickAddCategoryId && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-add-expense-title"
          onClick={() => { setQuickAddOpen(false); setQuickAddCategoryId(null); }}
        >
          <div
            className="w-full sm:w-3/4 max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="quick-add-expense-title" className="mb-4 font-semibold text-slate-800 dark:text-slate-100">
              New expense
            </h2>
            <BudgetItemManager
              categoryId={quickAddCategoryId}
              onSuccess={() => { setQuickAddOpen(false); setQuickAddCategoryId(null); }}
              onCancel={() => { setQuickAddOpen(false); setQuickAddCategoryId(null); }}
            />
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
}

