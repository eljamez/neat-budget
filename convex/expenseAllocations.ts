import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getEffectiveUserId } from "./authUser";

export const listByUserMonth = query({
  args: { userId: v.optional(v.string()), monthKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    return await ctx.db
      .query("expenseAllocations")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey)
      )
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.optional(v.string()),
    budgetItemId: v.id("budgetItems"),
    amount: v.number(),
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    if (args.amount <= 0 || !/^\d{4}-\d{2}$/.test(args.monthKey)) {
      throw new Error("Invalid allocation");
    }
    const item = await ctx.db.get(args.budgetItemId);
    if (!item || item.userId !== userId) {
      throw new Error("Invalid expense");
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
      userId,
      budgetItemId: args.budgetItemId,
      amount: args.amount,
      monthKey: args.monthKey,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("expenseAllocations"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Not found");
    }
    await ctx.db.delete(args.id);
  },
});

/** Delete every expense allocation row for this bill in the given calendar month. */
export const removeAllForBudgetMonth = mutation({
  args: {
    userId: v.optional(v.string()),
    budgetItemId: v.id("budgetItems"),
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    if (!/^\d{4}-\d{2}$/.test(args.monthKey)) {
      throw new Error("Invalid month");
    }
    const item = await ctx.db.get(args.budgetItemId);
    if (!item || item.userId !== userId) {
      throw new Error("Not found");
    }
    const rows = await ctx.db
      .query("expenseAllocations")
      .withIndex("by_budget_month", (q) =>
        q.eq("budgetItemId", args.budgetItemId).eq("monthKey", args.monthKey)
      )
      .collect();
    for (const r of rows) {
      if (r.userId !== userId) continue;
      await ctx.db.delete(r._id);
    }
  },
});

/**
 * Replace all allocations for this bill/month with a single row (total = `amount`).
 * Capped at the expense's expected monthly amount, same as incremental `create`.
 */
export const setTotalForBudgetMonth = mutation({
  args: {
    userId: v.optional(v.string()),
    budgetItemId: v.id("budgetItems"),
    monthKey: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    if (!/^\d{4}-\d{2}$/.test(args.monthKey)) {
      throw new Error("Invalid month");
    }
    if (args.amount < 0) {
      throw new Error("Invalid amount");
    }
    const item = await ctx.db.get(args.budgetItemId);
    if (!item || item.userId !== userId) {
      throw new Error("Not found");
    }
    const rows = await ctx.db
      .query("expenseAllocations")
      .withIndex("by_budget_month", (q) =>
        q.eq("budgetItemId", args.budgetItemId).eq("monthKey", args.monthKey)
      )
      .collect();
    for (const r of rows) {
      if (r.userId !== userId) continue;
      await ctx.db.delete(r._id);
    }
    const cap = item.amount;
    const toFund = Math.min(args.amount, cap);
    if (toFund <= 0.005) {
      return;
    }
    await ctx.db.insert("expenseAllocations", {
      userId,
      budgetItemId: args.budgetItemId,
      amount: toFund,
      monthKey: args.monthKey,
    });
  },
});
