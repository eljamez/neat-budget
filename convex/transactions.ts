import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { balanceDeltaForSpend } from "./accountBalance";

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

export const create = mutation({
  args: {
    userId: v.string(),
    categoryId: v.id("categories"),
    amount: v.number(),
    description: v.string(),
    date: v.string(),
    note: v.optional(v.string()),
    accountId: v.optional(v.id("accounts")),
    debtId: v.optional(v.id("debts")),
    creditCardId: v.optional(v.id("creditCards")),
  },
  handler: async (ctx, args) => {
    if (args.debtId && args.creditCardId) {
      throw new Error("Link either a debt or a credit card payment, not both");
    }
    if (args.accountId) {
      const acc = await ctx.db.get(args.accountId);
      if (!acc || acc.userId !== args.userId) {
        throw new Error("Invalid account");
      }
    }
    if (args.debtId) {
      const debt = await ctx.db.get(args.debtId);
      if (!debt || debt.userId !== args.userId) {
        throw new Error("Invalid debt");
      }
    }
    if (args.creditCardId) {
      const card = await ctx.db.get(args.creditCardId);
      if (!card || card.userId !== args.userId) {
        throw new Error("Invalid credit card");
      }
    }

    const id = await ctx.db.insert("transactions", {
      userId: args.userId,
      categoryId: args.categoryId,
      amount: args.amount,
      description: args.description,
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

    return id;
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
    await ctx.db.delete(args.id);
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
      const catId = t.categoryId.toString();
      spending[catId] = (spending[catId] ?? 0) + t.amount;
    }

    return spending;
  },
});
