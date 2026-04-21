import type { Doc, Id } from "../../convex/_generated/dataModel";
import { debtPlannerMonthlyAmount } from "@/lib/utils";

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
  fundedForMonth?: string;
  hasPaidTransaction?: boolean;
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
  fundedForMonth?: string;
  hasPaidTransaction?: boolean;
  accentColor?: string;
  isAutopay?: boolean;
  usageMode: "paying_off" | "active_use";
  paymentAccountId?: Id<"accounts">;
  hasConfiguredDueDay?: boolean;
};

export type PlannerCategoryRow = {
  rowKind: "category";
  categoryId: Id<"categories">;
  groupId?: string;
  name: string;
  monthlyTarget: number;
  paymentDayOfMonth: number;
  markedPaidForMonth?: string;
  fundedForMonth?: string;
  accentColor?: string;
  icon?: string;
  isAutopay?: boolean;
  paymentAccountId?: Id<"accounts">;
  hasConfiguredDueDay: boolean;
  spent: number;
};

export type PlannerRow = PlannerBudgetRow | PlannerDebtRow | PlannerCreditCardRow | PlannerCategoryRow;

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
      fundedForMonth: c.fundedForMonth,
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
      fundedForMonth: d.fundedForMonth,
      accentColor: d.color,
      isAutopay: d.isAutopay,
      paymentAccountId: d.paymentAccountId,
      hasConfiguredDueDay: configured,
    };
  });
  return [...budget, ...cardRows, ...debtRows];
}
