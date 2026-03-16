import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    userId: v.string(),
    month: v.optional(v.string()), // "YYYY-MM" format
  },
  handler: async (ctx, args) => {
    let txQuery = ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId));

    const transactions = await txQuery.order("desc").collect();

    if (args.month) {
      return transactions.filter((t) => t.date.startsWith(args.month!));
    }

    return transactions;
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("transactions", args);
  },
});

export const remove = mutation({
  args: { id: v.id("transactions") },
  handler: async (ctx, args) => {
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
