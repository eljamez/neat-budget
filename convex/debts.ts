import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { balanceDeltaForSpend } from "./accountBalance";
import { getEffectiveUserId } from "./authUser";

async function assertPaymentAccount(
  ctx: MutationCtx,
  userId: string,
  accountId: Id<"accounts">
) {
  const a = await ctx.db.get(accountId);
  if (!a || a.userId !== userId) {
    throw new Error("Invalid payment account");
  }
}

/** Allowed for create/update — not `credit_card` (use `creditCards` table). */
const debtTypeForWrite = v.union(
  v.literal("loan"),
  v.literal("personal"),
  v.literal("payment_plan"),
  v.literal("other")
);

export const list = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    return await ctx.db
      .query("debts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.optional(v.string()),
    name: v.string(),
    balance: v.number(),
    originalLoanAmount: v.optional(v.number()),
    debtType: debtTypeForWrite,
    aprPercent: v.optional(v.number()),
    creditor: v.optional(v.string()),
    purpose: v.optional(v.string()),
    notes: v.optional(v.string()),
    minimumPayment: v.optional(v.number()),
    dueDayOfMonth: v.optional(v.number()),
    plannedMonthlyPayment: v.optional(v.number()),
    isAutopay: v.optional(v.boolean()),
    color: v.optional(v.string()),
    paymentAccountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    if (args.paymentAccountId) {
      await assertPaymentAccount(ctx, userId, args.paymentAccountId);
    }
    return await ctx.db.insert("debts", {
      userId,
      name: args.name,
      balance: args.balance,
      ...(args.originalLoanAmount !== undefined
        ? { originalLoanAmount: args.originalLoanAmount }
        : {}),
      debtType: args.debtType,
      aprPercent: args.aprPercent,
      creditor: args.creditor,
      purpose: args.purpose,
      notes: args.notes,
      minimumPayment: args.minimumPayment,
      dueDayOfMonth: args.dueDayOfMonth,
      ...(args.plannedMonthlyPayment !== undefined
        ? { plannedMonthlyPayment: args.plannedMonthlyPayment }
        : {}),
      isAutopay: args.isAutopay,
      color: args.color,
      paymentAccountId: args.paymentAccountId,
      isArchived: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("debts"),
    userId: v.optional(v.string()),
    name: v.optional(v.string()),
    balance: v.optional(v.number()),
    originalLoanAmount: v.optional(v.union(v.number(), v.null())),
    debtType: v.optional(debtTypeForWrite),
    aprPercent: v.optional(v.number()),
    creditor: v.optional(v.string()),
    purpose: v.optional(v.string()),
    notes: v.optional(v.string()),
    minimumPayment: v.optional(v.number()),
    dueDayOfMonth: v.optional(v.number()),
    plannedMonthlyPayment: v.optional(v.union(v.number(), v.null())),
    isAutopay: v.optional(v.boolean()),
    color: v.optional(v.string()),
    paymentAccountId: v.optional(v.union(v.id("accounts"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Debt not found");
    }
    const {
      id,
      paymentAccountId,
      originalLoanAmount,
      plannedMonthlyPayment,
      ...rest
    } = args;
    const patch: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([key, val]) => key !== "userId" && val !== undefined)
    );
    if (originalLoanAmount !== undefined) {
      patch.originalLoanAmount =
        originalLoanAmount === null ? undefined : originalLoanAmount;
    }
    if (plannedMonthlyPayment !== undefined) {
      patch.plannedMonthlyPayment =
        plannedMonthlyPayment === null ? undefined : plannedMonthlyPayment;
    }
    if (paymentAccountId !== undefined) {
      if (paymentAccountId === null) {
        patch.paymentAccountId = undefined;
      } else {
        await assertPaymentAccount(ctx, userId, paymentAccountId);
        patch.paymentAccountId = paymentAccountId;
      }
    }
    await ctx.db.patch(id, patch as Record<string, never>);
  },
});

export const archive = mutation({
  args: { id: v.id("debts"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Debt not found");
    }
    const lines = await ctx.db
      .query("debtExpenses")
      .withIndex("by_debt", (q) => q.eq("debtId", args.id))
      .collect();
    for (const line of lines) {
      await ctx.db.patch(line._id, { isArchived: true });
    }
    await ctx.db.patch(args.id, { isArchived: true });
  },
});

const PAY_EPSILON = 0.005;
const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

function monthDateRange(monthKey: string): { start: string; endExclusive: string } {
  if (!MONTH_KEY_RE.test(monthKey)) {
    throw new Error("Invalid month");
  }
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error("Invalid month");
  }
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: `${monthKey}-01`,
    endExclusive: `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

async function debtTransactionsForMonth(
  ctx: MutationCtx,
  userId: string,
  debtId: Id<"debts">,
  monthKey: string
) {
  const { start, endExclusive } = monthDateRange(monthKey);
  const monthTxs = await ctx.db
    .query("transactions")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", userId).gte("date", start).lt("date", endExclusive)
    )
    .filter((q) => q.eq(q.field("debtId"), debtId))
    .collect();
  return monthTxs;
}

function plannerPaymentAmount(doc: Doc<"debts">): number {
  const t = doc.debtType;
  if (t === "loan" || t === "personal") {
    const min = doc.minimumPayment ?? 0;
    if (min > 0) return min;
    return doc.plannedMonthlyPayment ?? 0;
  }
  if (t === "payment_plan") {
    const min = doc.minimumPayment ?? 0;
    if (min > 0) return min;
    return doc.plannedMonthlyPayment ?? 0;
  }
  const planned = doc.plannedMonthlyPayment ?? 0;
  if (planned > 0) return planned;
  return doc.minimumPayment ?? 0;
}

function isoDateInBudgetMonth(monthKey: string, dayOfMonth: number): string {
  const [ys, ms] = monthKey.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return `${monthKey}-01`;
  }
  const lastDay = new Date(y, m, 0).getDate();
  const d = Math.min(Math.max(1, dayOfMonth), lastDay);
  return `${monthKey}-${String(d).padStart(2, "0")}`;
}

function dueDayForPaymentDate(doc: Doc<"debts">): number {
  const d = doc.dueDayOfMonth;
  if (d != null && d >= 1 && d <= 31) return d;
  return 28;
}

/** Mark or unmark planned monthly payment as paid for a calendar month (`YYYY-MM`). */
export const setPaidForMonth = mutation({
  args: {
    id: v.id("debts"),
    userId: v.optional(v.string()),
    monthKey: v.string(),
    paid: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    if (!MONTH_KEY_RE.test(args.monthKey)) {
      throw new Error("Invalid month");
    }
    const monthKey = args.monthKey;

    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Debt not found");
    }

    if (!args.paid) {
      const monthTxs = await debtTransactionsForMonth(ctx, userId, args.id, monthKey);
      const autoTx = monthTxs.find((t) => t.debtMarkedPaidMonthKey === monthKey);

      if (autoTx) {
        if (autoTx.accountId) {
          const acc = await ctx.db.get(autoTx.accountId);
          if (acc && acc.userId === userId) {
            const delta = balanceDeltaForSpend(acc.accountType, autoTx.amount);
            await ctx.db.patch(autoTx.accountId, { balance: acc.balance - delta });
          }
        }
        const debtAfter = await ctx.db.get(args.id);
        if (debtAfter && debtAfter.userId === userId) {
          await ctx.db.patch(args.id, {
            balance: debtAfter.balance + autoTx.amount,
          });
        }
        await ctx.db.delete(autoTx._id);
      }

      if (doc.markedPaidForMonth === monthKey) {
        await ctx.db.patch(args.id, { markedPaidForMonth: undefined });
      }
      return;
    }

    const inMonth = await debtTransactionsForMonth(ctx, userId, args.id, monthKey);
    const existingAuto = inMonth.find((t) => t.debtMarkedPaidMonthKey === monthKey);

    if (existingAuto) {
      await ctx.db.patch(args.id, { markedPaidForMonth: monthKey });
      return;
    }

    const planned = plannerPaymentAmount(doc);
    const paidSoFar = inMonth.reduce((s, t) => s + t.amount, 0);
    let amountToCreate = planned - paidSoFar;

    if (amountToCreate <= PAY_EPSILON) {
      await ctx.db.patch(args.id, { markedPaidForMonth: monthKey });
      return;
    }

    amountToCreate = Math.min(amountToCreate, doc.balance);
    if (amountToCreate <= PAY_EPSILON) {
      await ctx.db.patch(args.id, { markedPaidForMonth: monthKey });
      return;
    }

    const payDate = isoDateInBudgetMonth(monthKey, dueDayForPaymentDate(doc));
    const description = `Loan payment · ${doc.name}`;

    await ctx.db.insert("transactions", {
      userId,
      amount: amountToCreate,
      description,
      date: payDate,
      note: "Marked paid from Categories timeline",
      accountId: doc.paymentAccountId,
      debtId: args.id,
      debtMarkedPaidMonthKey: monthKey,
    });

    if (doc.paymentAccountId) {
      const acc = await ctx.db.get(doc.paymentAccountId);
      if (acc && acc.userId === userId) {
        const delta = balanceDeltaForSpend(acc.accountType, amountToCreate);
        await ctx.db.patch(doc.paymentAccountId, { balance: acc.balance + delta });
      }
    }

    await ctx.db.patch(args.id, {
      balance: Math.max(0, doc.balance - amountToCreate),
      markedPaidForMonth: monthKey,
    });
  },
});
