import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * For dashboard / planning views tied to `monthKey` (`YYYY-MM`): use today when that month is
 * current (local), otherwise the last calendar day of that month (local). Returned as `YYYY-MM-DD`.
 */
export function asOfDateForBudgetView(monthKey: string): string {
  if (monthKey === getCurrentMonth()) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

/** `monthKey` is `YYYY-MM`. `deltaMonths` adds (or subtracts) whole calendar months. */
export function shiftMonth(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Local midnight for the calendar day of `d`. */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Signed whole-day gap between two calendar dates in local time.
 * `calendarDaysFromTo(a, b)` is positive when `b` is after `a` (e.g. Mar 31 → Apr 5 → 5).
 */
export function calendarDaysFromTo(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

/** Start of `dayOfMonth` inside `monthKey` (`YYYY-MM`), local time. */
export function dateInBudgetMonth(monthKey: string, dayOfMonth: number): Date {
  const [y, m] = monthKey.split("-").map(Number);
  return startOfLocalDay(new Date(y, m - 1, dayOfMonth));
}

export function formatMonth(month: string): string {
  const [year, mon] = month.split("-");
  const date = new Date(parseInt(year), parseInt(mon) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getProgressColor(percent: number): string {
  if (percent >= 100) return "bg-red-500";
  if (percent >= 80) return "bg-yellow-500";
  return "bg-green-500";
}

export function getProgressTextColor(percent: number): string {
  if (percent >= 100) return "text-red-600";
  if (percent >= 80) return "text-yellow-600";
  return "text-green-600";
}

/** Sum of budget item amounts per category id (planned monthly expenses). */
export function sumBudgetItemsByCategory(
  items: { categoryId: string; amount: number }[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of items) {
    map[item.categoryId] = (map[item.categoryId] ?? 0) + item.amount;
  }
  return map;
}

export const DEBT_TYPE_LABELS = {
  credit_card: "Credit card (legacy — use Cards page)",
  loan: "Loan",
  personal: "Personal loan",
  payment_plan: "Payment plan",
  other: "Other",
} as const;

export type DebtTypeKey = keyof typeof DEBT_TYPE_LABELS;

/** Values allowed when creating/editing a debt in the UI (not legacy `credit_card`). */
export type WritableDebtTypeKey = Exclude<DebtTypeKey, "credit_card">;

export function formatDebtType(type: string | undefined): string {
  if (!type) return "Debt";
  return DEBT_TYPE_LABELS[type as DebtTypeKey] ?? type;
}

/** How you’re treating the card in your budget (paydown vs everyday spending). */
export const CREDIT_CARD_USAGE_LABELS = {
  paying_off: "Paying off",
  active_use: "Using for bills",
} as const;

export type CreditCardUsageModeKey = keyof typeof CREDIT_CARD_USAGE_LABELS;

export function formatCreditCardUsageMode(mode: string | undefined): string {
  if (!mode) return "Credit card";
  return CREDIT_CARD_USAGE_LABELS[mode as CreditCardUsageModeKey] ?? mode;
}

/** Day of month as ordinal, e.g. 15 → "15th". */
export function formatOrdinalDay(day: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = day % 100;
  return day + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export const ACCOUNT_TYPE_LABELS = {
  checking: "Checking",
  savings: "Savings",
  cash: "Cash",
  credit_card: "Credit card",
  other: "Other",
} as const;

export type AccountTypeKey = keyof typeof ACCOUNT_TYPE_LABELS;

/** Accounts where balance is "cash on hand" — we can show balance minus set-asides as available. */
export function accountIsAssetForAvailability(type: string | undefined): boolean {
  return (
    type === "checking" ||
    type === "savings" ||
    type === "cash" ||
    type === "other"
  );
}

export function formatAccountType(type: string | undefined): string {
  if (!type) return "Account";
  return ACCOUNT_TYPE_LABELS[type as AccountTypeKey] ?? type;
}

/** Resolved “paid from” label: linked account name, else legacy `paidFrom` text. */
export function budgetItemPaidFromLabel(
  item: { accountId?: string; paidFrom?: string },
  accountsById: Record<string, { name: string }>
): string | undefined {
  if (item.accountId) {
    const a = accountsById[item.accountId];
    if (a) return a.name;
  }
  const t = item.paidFrom?.trim();
  return t || undefined;
}

/** Format APR stored as a number, e.g. 19.99 → "19.99% APR". */
export function formatAprPercent(apr: number | undefined): string | null {
  if (apr === undefined || apr === null || Number.isNaN(apr)) return null;
  const rounded = Math.round(apr * 100) / 100;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}% APR`;
}

export type DebtPayoffEstimate = {
  /** Calendar month string when balance would hit ~zero, e.g. "July 2027". */
  payoffMonthLabel: string | null;
  monthsRemaining: number | null;
  /** Shown when the payment is too low to amortize. */
  note: string | null;
};

/**
 * Rough payoff timeline assuming a fixed payment each month.
 * With APR, uses standard amortization (payment constant, interest on declining balance).
 */
export function estimateDebtPayoff(
  balance: number,
  monthlyPayment: number,
  aprPercent?: number | null,
  fromDate: Date = new Date()
): DebtPayoffEstimate {
  if (balance <= 0 || monthlyPayment <= 0) {
    return { payoffMonthLabel: null, monthsRemaining: null, note: null };
  }
  if (monthlyPayment >= balance) {
    const y = fromDate.getFullYear();
    const m = fromDate.getMonth() + 1;
    const monthKey = `${y}-${String(m).padStart(2, "0")}`;
    return {
      payoffMonthLabel: formatMonth(monthKey),
      monthsRemaining: 1,
      note: null,
    };
  }

  const apr = aprPercent ?? 0;
  let months: number;
  if (apr <= 0) {
    months = Math.ceil(balance / monthlyPayment);
  } else {
    const r = apr / 100 / 12;
    const minToAmortize = balance * r;
    if (monthlyPayment <= minToAmortize) {
      return {
        payoffMonthLabel: null,
        monthsRemaining: null,
        note: "Payment must exceed monthly interest to pay this down.",
      };
    }
    const inner = 1 - (balance * r) / monthlyPayment;
    months = Math.ceil(-Math.log(inner) / Math.log(1 + r));
  }

  const end = new Date(fromDate.getFullYear(), fromDate.getMonth() + months, 1);
  const monthKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}`;
  return {
    payoffMonthLabel: formatMonth(monthKey),
    monthsRemaining: months,
    note: null,
  };
}

/**
 * Pay-from **bank** is set (`budgetItems.accountId`, or `paymentAccountId` on debts/cards).
 */
export function expenseHasPayFromAccount(item: {
  accountId?: string | null;
  paymentAccountId?: string | null;
}): boolean {
  const id = item.accountId ?? item.paymentAccountId;
  return id != null && id !== "";
}

export type ExpenseFundingLevel = "none" | "partial" | "full";

export function expenseFundingLevel(
  billAmount: number,
  allocatedTotal: number
): ExpenseFundingLevel {
  if (billAmount <= 0.005) {
    return allocatedTotal > 0.005 ? "full" : "none";
  }
  if (allocatedTotal <= 0.005) return "none";
  if (allocatedTotal + 0.005 >= billAmount) return "full";
  return "partial";
}

/** Max cash earmarked per month for a monthly bucket (fill goal vs spending target). */
export function bucketMonthlyFundingCap(bucket: {
  targetAmount: number;
  monthlyFillGoal?: number | null;
}): number {
  const g = bucket.monthlyFillGoal;
  if (g != null && g > 0.005) return g;
  return bucket.targetAmount;
}

/**
 * For one bank account: remaining cash to plan for the month — recurring bills (funded vs amount),
 * plus planned debt/card payments not yet marked paid, when those use this account as pay-from.
 */
export function sumLeftToFundFromAccountForMonth(
  budgetItems: {
    _id: string;
    accountId?: string;
    amount: number;
    status?: "unfunded" | "funded" | "paid";
    markedPaidForMonth?: string;
  }[],
  allocatedByBudgetId: Record<string, number>,
  debts: {
    paymentAccountId?: string;
    plannedMonthlyPayment?: number;
    markedPaidForMonth?: string;
  }[],
  creditCards: {
    paymentAccountId?: string;
    plannedMonthlyPayment?: number;
    markedPaidForMonth?: string;
  }[],
  accountId: string,
  monthKey: string
): number {
  let sum = 0;
  for (const item of budgetItems) {
    if (item.accountId !== accountId) continue;
    if (item.markedPaidForMonth === monthKey) continue;
    const st = item.status ?? "unfunded";
    if (st === "funded") continue;
    const alloc = allocatedByBudgetId[item._id] ?? 0;
    sum += Math.max(0, item.amount - alloc);
  }
  for (const d of debts) {
    if (d.paymentAccountId !== accountId) continue;
    const planned = d.plannedMonthlyPayment ?? 0;
    if (planned <= 0) continue;
    if (d.markedPaidForMonth === monthKey) continue;
    sum += planned;
  }
  for (const c of creditCards) {
    if (c.paymentAccountId !== accountId) continue;
    const planned = c.plannedMonthlyPayment ?? 0;
    if (planned <= 0) continue;
    if (c.markedPaidForMonth === monthKey) continue;
    sum += planned;
  }
  return sum;
}
