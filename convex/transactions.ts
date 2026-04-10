import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { balanceDeltaForSpend } from "./accountBalance";
import { getEffectiveUserId } from "./authUser";

const PAID_EPSILON = 0.005;
const MAX_TRANSACTION_AMOUNT = 1_000_000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

function assertValidIsoDate(date: string) {
  if (!ISO_DATE_RE.test(date)) {
    throw new Error("Invalid date format, expected YYYY-MM-DD");
  }
  const [yearStr, monthStr, dayStr] = date.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const valid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  if (!valid) {
    throw new Error("Invalid date");
  }
}

function assertValidAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TRANSACTION_AMOUNT) {
    throw new Error(`Amount must be greater than 0 and no more than ${MAX_TRANSACTION_AMOUNT}`);
  }
}

function monthDateRange(monthKey: string): { start: string; endExclusive: string } {
  if (!MONTH_KEY_RE.test(monthKey)) {
    throw new Error("Invalid month format, expected YYYY-MM");
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

async function listUserTransactionsInMonth(
  ctx: QueryCtx,
  userId: string,
  monthKey: string
) {
  const { start, endExclusive } = monthDateRange(monthKey);
  return await ctx.db
    .query("transactions")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", userId).gte("date", start).lt("date", endExclusive)
    )
    .order("desc")
    .collect();
}

async function reconcileBudgetItemPaidForMonth(
  ctx: MutationCtx,
  budgetItemId: Id<"budgetItems">,
  userId: string,
  monthKey: string
) {
  const item = await ctx.db.get(budgetItemId);
  if (!item || item.userId !== userId) return;

  const { start, endExclusive } = monthDateRange(monthKey);
  const txs = await ctx.db
    .query("transactions")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", userId).gte("date", start).lt("date", endExclusive)
    )
    .filter((q) => q.eq(q.field("budgetItemId"), budgetItemId))
    .collect();

  const paid = txs.reduce((sum, t) => sum + t.amount, 0);

  const full = paid + PAID_EPSILON >= item.amount;
  if (full) {
    if (item.markedPaidForMonth !== monthKey) {
      await ctx.db.patch(budgetItemId, { markedPaidForMonth: monthKey });
    }
  } else if (item.markedPaidForMonth === monthKey) {
    await ctx.db.patch(budgetItemId, { markedPaidForMonth: undefined });
  }
}

export const list = query({
  args: {
    userId: v.optional(v.string()),
    month: v.optional(v.string()), // "YYYY-MM" format
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    if (args.month) {
      return await listUserTransactionsInMonth(ctx, userId, args.month);
    }

    return await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Sum of positive payment amounts per debt for calendar month `monthKey` (`YYYY-MM`). */
export const debtPaymentTotalsForMonth = query({
  args: {
    userId: v.optional(v.string()),
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const txs = await listUserTransactionsInMonth(ctx, userId, args.monthKey);

    const totals: Record<string, number> = {};
    for (const t of txs) {
      if (!t.debtId) continue;
      const id = t.debtId as string;
      totals[id] = (totals[id] ?? 0) + t.amount;
    }
    return totals;
  },
});

export const listByDebt = query({
  args: { userId: v.optional(v.string()), debtId: v.id("debts") },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const debt = await ctx.db.get(args.debtId);
    if (!debt || debt.userId !== userId) {
      throw new Error("Debt not found");
    }
    return await ctx.db
      .query("transactions")
      .withIndex("by_debt", (q) => q.eq("debtId", args.debtId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .collect();
  },
});

export const listByCreditCard = query({
  args: { userId: v.optional(v.string()), creditCardId: v.id("creditCards") },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const card = await ctx.db.get(args.creditCardId);
    if (!card || card.userId !== userId) {
      throw new Error("Credit card not found");
    }
    return await ctx.db
      .query("transactions")
      .withIndex("by_credit_card", (q) => q.eq("creditCardId", args.creditCardId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .collect();
  },
});

export const listByCategory = query({
  args: {
    userId: v.optional(v.string()),
    categoryId: v.id("categories"),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== userId) {
      throw new Error("Category not found");
    }
    if (args.month) {
      const monthTxs = await listUserTransactionsInMonth(ctx, userId, args.month);
      return monthTxs.filter((t) => t.categoryId === args.categoryId);
    }

    return await ctx.db
      .query("transactions")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .collect();
  },
});

export const listByBudgetItem = query({
  args: {
    userId: v.optional(v.string()),
    budgetItemId: v.id("budgetItems"),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetItem = await ctx.db.get(args.budgetItemId);
    if (!budgetItem || budgetItem.userId !== userId) {
      throw new Error("Expense not found");
    }
    if (args.month) {
      const monthTxs = await listUserTransactionsInMonth(ctx, userId, args.month);
      return monthTxs.filter((t) => t.budgetItemId === args.budgetItemId);
    }

    return await ctx.db
      .query("transactions")
      .withIndex("by_budget_item", (q) => q.eq("budgetItemId", args.budgetItemId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.optional(v.string()),
    amount: v.number(),
    date: v.string(),
    note: v.optional(v.string()),
    accountId: v.optional(v.id("accounts")),
    /** Exactly one of budgetItemId, debtId, or creditCardId must be set. */
    budgetItemId: v.optional(v.id("budgetItems")),
    debtId: v.optional(v.id("debts")),
    creditCardId: v.optional(v.id("creditCards")),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    assertValidAmount(args.amount);
    assertValidIsoDate(args.date);

    const nBudget = args.budgetItemId ? 1 : 0;
    const nDebt = args.debtId ? 1 : 0;
    const nCard = args.creditCardId ? 1 : 0;
    if (nBudget + nDebt + nCard !== 1) {
      throw new Error(
        "Choose exactly one payee: a budget expense, a loan/debt, or a credit card"
      );
    }

    let categoryId: Id<"categories"> | undefined;
    let description = "Payment";

    if (args.budgetItemId) {
      const budgetItem = await ctx.db.get(args.budgetItemId);
      if (!budgetItem || budgetItem.userId !== userId) {
        throw new Error("Invalid expense");
      }
      categoryId = budgetItem.categoryId;
      description = budgetItem.name;
    } else if (args.debtId) {
      const debt = await ctx.db.get(args.debtId);
      if (!debt || debt.userId !== userId) {
        throw new Error("Invalid debt");
      }
      description = `Loan payment · ${debt.name}`;
    } else if (args.creditCardId) {
      const card = await ctx.db.get(args.creditCardId);
      if (!card || card.userId !== userId) {
        throw new Error("Invalid credit card");
      }
      description = `Card payment · ${card.name}`;
    }

    if (args.accountId) {
      const acc = await ctx.db.get(args.accountId);
      if (!acc || acc.userId !== userId) {
        throw new Error("Invalid account");
      }
    }

    const monthKey = args.date.slice(0, 7);

    const id = await ctx.db.insert("transactions", {
      userId,
      categoryId,
      budgetItemId: args.budgetItemId,
      amount: args.amount,
      description,
      date: args.date,
      note: args.note,
      accountId: args.accountId,
      debtId: args.debtId,
      creditCardId: args.creditCardId,
    });

    if (args.accountId) {
      const acc = await ctx.db.get(args.accountId);
      if (acc) {
        const delta = balanceDeltaForSpend(acc.accountType, args.amount);
        await ctx.db.patch(args.accountId, { balance: acc.balance + delta });
      }
    }

    if (args.debtId) {
      const debt = await ctx.db.get(args.debtId);
      if (debt) {
        await ctx.db.patch(args.debtId, {
          balance: Math.max(0, debt.balance - args.amount),
        });
      }
    }

    if (args.creditCardId) {
      const card = await ctx.db.get(args.creditCardId);
      if (card) {
        await ctx.db.patch(args.creditCardId, {
          balance: Math.max(0, card.balance - args.amount),
        });
      }
    }

    if (args.budgetItemId) {
      await reconcileBudgetItemPaidForMonth(ctx, args.budgetItemId, userId, monthKey);
    }

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("transactions"),
    userId: v.optional(v.string()),
    amount: v.number(),
    date: v.string(),
    note: v.optional(v.string()),
    accountId: v.optional(v.id("accounts")),
    budgetItemId: v.optional(v.id("budgetItems")),
    debtId: v.optional(v.id("debts")),
    creditCardId: v.optional(v.id("creditCards")),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    assertValidAmount(args.amount);
    assertValidIsoDate(args.date);

    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Transaction not found");
    }

    const nBudget = args.budgetItemId ? 1 : 0;
    const nDebt = args.debtId ? 1 : 0;
    const nCard = args.creditCardId ? 1 : 0;
    if (nBudget + nDebt + nCard !== 1) {
      throw new Error(
        "Choose exactly one payee: a budget expense, a loan/debt, or a credit card"
      );
    }

    let categoryId: Id<"categories"> | undefined;
    let description = "Payment";

    if (args.budgetItemId) {
      const budgetItem = await ctx.db.get(args.budgetItemId);
      if (!budgetItem || budgetItem.userId !== userId) {
        throw new Error("Invalid expense");
      }
      categoryId = budgetItem.categoryId;
      description = budgetItem.name;
    } else if (args.debtId) {
      const debt = await ctx.db.get(args.debtId);
      if (!debt || debt.userId !== userId) {
        throw new Error("Invalid debt");
      }
      description = `Loan payment · ${debt.name}`;
    } else if (args.creditCardId) {
      const card = await ctx.db.get(args.creditCardId);
      if (!card || card.userId !== userId) {
        throw new Error("Invalid credit card");
      }
      description = `Card payment · ${card.name}`;
    }

    if (args.accountId) {
      const acc = await ctx.db.get(args.accountId);
      if (!acc || acc.userId !== userId) {
        throw new Error("Invalid account");
      }
    }

    const oldMonthKey = doc.date.slice(0, 7);
    const newMonthKey = args.date.slice(0, 7);

    if (doc.accountId) {
      const acc = await ctx.db.get(doc.accountId);
      if (acc && acc.userId === userId) {
        const delta = balanceDeltaForSpend(acc.accountType, doc.amount);
        await ctx.db.patch(doc.accountId, { balance: acc.balance - delta });
      }
    }
    if (doc.debtId) {
      const debt = await ctx.db.get(doc.debtId);
      if (debt && debt.userId === userId) {
        await ctx.db.patch(doc.debtId, { balance: debt.balance + doc.amount });
      }
    }
    if (doc.creditCardId) {
      const card = await ctx.db.get(doc.creditCardId);
      if (card && card.userId === userId) {
        await ctx.db.patch(doc.creditCardId, { balance: card.balance + doc.amount });
      }
    }

    await ctx.db.patch(args.id, {
      categoryId,
      budgetItemId: args.budgetItemId,
      amount: args.amount,
      description,
      date: args.date,
      note: args.note,
      accountId: args.accountId,
      debtId: args.debtId,
      creditCardId: args.creditCardId,
    });

    if (args.accountId) {
      const acc = await ctx.db.get(args.accountId);
      if (acc) {
        const delta = balanceDeltaForSpend(acc.accountType, args.amount);
        await ctx.db.patch(args.accountId, { balance: acc.balance + delta });
      }
    }
    if (args.debtId) {
      const debt = await ctx.db.get(args.debtId);
      if (debt) {
        await ctx.db.patch(args.debtId, {
          balance: Math.max(0, debt.balance - args.amount),
        });
      }
    }
    if (args.creditCardId) {
      const card = await ctx.db.get(args.creditCardId);
      if (card) {
        await ctx.db.patch(args.creditCardId, {
          balance: Math.max(0, card.balance - args.amount),
        });
      }
    }

    const reconcileKeys = new Set<string>();
    if (doc.budgetItemId) {
      reconcileKeys.add(`${doc.budgetItemId}|${oldMonthKey}`);
    }
    if (args.budgetItemId) {
      reconcileKeys.add(`${args.budgetItemId}|${newMonthKey}`);
    }
    for (const key of reconcileKeys) {
      const pipe = key.indexOf("|");
      const bid = key.slice(0, pipe) as Id<"budgetItems">;
      const mk = key.slice(pipe + 1);
      await reconcileBudgetItemPaidForMonth(ctx, bid, userId, mk);
    }
  },
});

export const remove = mutation({
  args: { id: v.id("transactions"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Transaction not found");
    }
    if (doc.accountId) {
      const acc = await ctx.db.get(doc.accountId);
      if (acc && acc.userId === userId) {
        const delta = balanceDeltaForSpend(acc.accountType, doc.amount);
        await ctx.db.patch(doc.accountId, { balance: acc.balance - delta });
      }
    }
    if (doc.debtId) {
      const debt = await ctx.db.get(doc.debtId);
      if (debt && debt.userId === userId) {
        await ctx.db.patch(doc.debtId, { balance: debt.balance + doc.amount });
      }
    }
    if (doc.creditCardId) {
      const card = await ctx.db.get(doc.creditCardId);
      if (card && card.userId === userId) {
        await ctx.db.patch(doc.creditCardId, { balance: card.balance + doc.amount });
      }
    }
    const budgetItemId = doc.budgetItemId;
    const monthKey = doc.date.slice(0, 7);
    await ctx.db.delete(args.id);
    if (budgetItemId) {
      await reconcileBudgetItemPaidForMonth(ctx, budgetItemId, userId, monthKey);
    }
  },
});

export const getMonthlySpendingByCategory = query({
  args: {
    userId: v.optional(v.string()),
    month: v.string(), // "YYYY-MM"
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const monthTransactions = await listUserTransactionsInMonth(ctx, userId, args.month);

    const spending: Record<string, number> = {};
    for (const t of monthTransactions) {
      if (!t.categoryId) continue;
      const catId = t.categoryId.toString();
      spending[catId] = (spending[catId] ?? 0) + t.amount;
    }

    return spending;
  },
});
