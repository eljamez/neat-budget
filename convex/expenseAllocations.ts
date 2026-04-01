import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByUserMonth = query({
  args: { userId: v.string(), monthKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("expenseAllocations")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", args.userId).eq("monthKey", args.monthKey)
      )
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    budgetItemId: v.id("budgetItems"),
    accountId: v.id("accounts"),
    amount: v.number(),
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0 || !/^\d{4}-\d{2}$/.test(args.monthKey)) {
      throw new Error("Invalid allocation");
    }
    const item = await ctx.db.get(args.budgetItemId);
    if (!item || item.userId !== args.userId) {
      throw new Error("Invalid expense");
    }
    const acct = await ctx.db.get(args.accountId);
    if (!acct || acct.userId !== args.userId) {
      throw new Error("Invalid account");
    }
    const existing = await ctx.db
      .query("expenseAllocations")
      .withIndex("by_budget_month", (q) =>
        q.eq("budgetItemId", args.budgetItemId).eq("monthKey", args.monthKey)
      )
      .collect();
    const total = existing.reduce((s, r) => s + r.amount, 0) + args.amount;
    if (total > item.amount + 0.005) {
      throw new Error(
        `Cannot set aside more than ${item.amount} for this expense`
      );
    }
    return await ctx.db.insert("expenseAllocations", {
      userId: args.userId,
      budgetItemId: args.budgetItemId,
      accountId: args.accountId,
      amount: args.amount,
      monthKey: args.monthKey,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("expenseAllocations"), userId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Not found");
    }
    await ctx.db.delete(args.id);
  },
});
