import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { balanceDeltaForSpend } from "./accountBalance";

const PAID_EPSILON = 0.005;

async function reconcileBudgetItemPaidForMonth(
  ctx: MutationCtx,
  budgetItemId: Id<"budgetItems">,
  userId: string,
  monthKey: string
) {
  const item = await ctx.db.get(budgetItemId);
  if (!item || item.userId !== userId) return;

  const txs = await ctx.db
    .query("transactions")
    .withIndex("by_budget_item", (q) => q.eq("budgetItemId", budgetItemId))
    .collect();

  const paid = txs
    .filter((t) => t.date.startsWith(monthKey))
    .reduce((sum, t) => sum + t.amount, 0);

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
    userId: v.string(),
    month: v.optional(v.string()), // "YYYY-MM" format
  },
  handler: async (ctx, args) => {
    const txQuery = ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId));

    const transactions = await txQuery.order("desc").collect();

    if (args.month) {
      return transactions.filter((t) => t.date.startsWith(args.month!));
    }

    return transactions;
  },
});

/** Sum of positive payment amounts per debt for calendar month `monthKey` (`YYYY-MM`). */
export const debtPaymentTotalsForMonth = query({
  args: {
    userId: v.string(),
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    const start = `${args.monthKey}-01`;
    const end = `${args.monthKey}-31`;
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).gte("date", start).lte("date", end)
      )
      .collect();

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
  args: { debtId: v.id("debts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_debt", (q) => q.eq("debtId", args.debtId))
      .order("desc")
      .collect();
  },
});

export const listByCreditCard = query({
  args: { creditCardId: v.id("creditCards") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_credit_card", (q) => q.eq("creditCardId", args.creditCardId))
      .order("desc")
      .collect();
  },
});

export const listByCategory = query({
  args: {
    categoryId: v.id("categories"),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .order("desc")
      .collect();

    if (args.month) {
      return transactions.filter((t) => t.date.startsWith(args.month!));
    }

    return transactions;
  },
});

export const listByBudgetItem = query({
  args: {
    budgetItemId: v.id("budgetItems"),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_budget_item", (q) => q.eq("budgetItemId", args.budgetItemId))
      .order("desc")
      .collect();

    if (args.month) {
      return transactions.filter((t) => t.date.startsWith(args.month!));
    }

    return transactions;
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
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
      if (!budgetItem || budgetItem.userId !== args.userId) {
        throw new Error("Invalid expense");
      }
      categoryId = budgetItem.categoryId;
      description = budgetItem.name;
    } else if (args.debtId) {
      const debt = await ctx.db.get(args.debtId);
      if (!debt || debt.userId !== args.userId) {
        throw new Error("Invalid debt");
      }
      description = `Loan payment · ${debt.name}`;
    } else if (args.creditCardId) {
      const card = await ctx.db.get(args.creditCardId);
      if (!card || card.userId !== args.userId) {
        throw new Error("Invalid credit card");
      }
      description = `Card payment · ${card.name}`;
    }

    if (args.accountId) {
      const acc = await ctx.db.get(args.accountId);
      if (!acc || acc.userId !== args.userId) {
        throw new Error("Invalid account");
      }
    }

    const monthKey = args.date.slice(0, 7);

    const id = await ctx.db.insert("transactions", {
      userId: args.userId,
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
      await reconcileBudgetItemPaidForMonth(ctx, args.budgetItemId, args.userId, monthKey);
    }

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("transactions"),
    userId: v.string(),
    amount: v.number(),
    date: v.string(),
    note: v.optional(v.string()),
    accountId: v.optional(v.id("accounts")),
    budgetItemId: v.optional(v.id("budgetItems")),
    debtId: v.optional(v.id("debts")),
    creditCardId: v.optional(v.id("creditCards")),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
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
      if (!budgetItem || budgetItem.userId !== args.userId) {
        throw new Error("Invalid expense");
      }
      categoryId = budgetItem.categoryId;
      description = budgetItem.name;
    } else if (args.debtId) {
      const debt = await ctx.db.get(args.debtId);
      if (!debt || debt.userId !== args.userId) {
        throw new Error("Invalid debt");
      }
      description = `Loan payment · ${debt.name}`;
    } else if (args.creditCardId) {
      const card = await ctx.db.get(args.creditCardId);
      if (!card || card.userId !== args.userId) {
        throw new Error("Invalid credit card");
      }
      description = `Card payment · ${card.name}`;
    }

    if (args.accountId) {
      const acc = await ctx.db.get(args.accountId);
      if (!acc || acc.userId !== args.userId) {
        throw new Error("Invalid account");
      }
    }

    const oldMonthKey = doc.date.slice(0, 7);
    const newMonthKey = args.date.slice(0, 7);

    if (doc.accountId) {
      const acc = await ctx.db.get(doc.accountId);
      if (acc && acc.userId === args.userId) {
        const delta = balanceDeltaForSpend(acc.accountType, doc.amount);
        await ctx.db.patch(doc.accountId, { balance: acc.balance - delta });
      }
    }
    if (doc.debtId) {
      const debt = await ctx.db.get(doc.debtId);
      if (debt && debt.userId === args.userId) {
        await ctx.db.patch(doc.debtId, { balance: debt.balance + doc.amount });
      }
    }
    if (doc.creditCardId) {
      const card = await ctx.db.get(doc.creditCardId);
      if (card && card.userId === args.userId) {
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
      await reconcileBudgetItemPaidForMonth(ctx, bid, args.userId, mk);
    }
  },
});

export const remove = mutation({
  args: { id: v.id("transactions"), userId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Transaction not found");
    }
    if (doc.accountId) {
      const acc = await ctx.db.get(doc.accountId);
      if (acc && acc.userId === args.userId) {
        const delta = balanceDeltaForSpend(acc.accountType, doc.amount);
        await ctx.db.patch(doc.accountId, { balance: acc.balance - delta });
      }
    }
    if (doc.debtId) {
      const debt = await ctx.db.get(doc.debtId);
      if (debt && debt.userId === args.userId) {
        await ctx.db.patch(doc.debtId, { balance: debt.balance + doc.amount });
      }
    }
    if (doc.creditCardId) {
      const card = await ctx.db.get(doc.creditCardId);
      if (card && card.userId === args.userId) {
        await ctx.db.patch(doc.creditCardId, { balance: card.balance + doc.amount });
      }
    }
    const budgetItemId = doc.budgetItemId;
    const monthKey = doc.date.slice(0, 7);
    await ctx.db.delete(args.id);
    if (budgetItemId) {
      await reconcileBudgetItemPaidForMonth(ctx, budgetItemId, args.userId, monthKey);
    }
  },
});

export const getMonthlySpendingByCategory = query({
  args: {
    userId: v.string(),
    month: v.string(), // "YYYY-MM"
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const monthTransactions = transactions.filter((t) =>
      t.date.startsWith(args.month)
    );

    const spending: Record<string, number> = {};
    for (const t of monthTransactions) {
      if (!t.categoryId) continue;
      const catId = t.categoryId.toString();
      spending[catId] = (spending[catId] ?? 0) + t.amount;
    }

    return spending;
  },
});
