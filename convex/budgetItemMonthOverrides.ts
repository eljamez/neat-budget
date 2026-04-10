import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getEffectiveUserId } from "./authUser";

export const getByBudgetMonth = query({
  args: {
    userId: v.optional(v.string()),
    budgetItemId: v.id("budgetItems"),
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const rows = await ctx.db
      .query("budgetItemMonthOverrides")
      .withIndex("by_budget_month", (q) =>
        q.eq("budgetItemId", args.budgetItemId).eq("monthKey", args.monthKey)
      )
      .collect();
    return rows.find((r) => r.userId === userId) ?? null;
  },
});

export const listByUserMonth = query({
  args: { userId: v.optional(v.string()), monthKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    return await ctx.db
      .query("budgetItemMonthOverrides")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("monthKey", args.monthKey)
      )
      .collect();
  },
});

export const upsertActualPaid = mutation({
  args: {
    userId: v.optional(v.string()),
    budgetItemId: v.id("budgetItems"),
    monthKey: v.string(),
    actualPaidAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    if (!/^\d{4}-\d{2}$/.test(args.monthKey)) {
      throw new Error("Invalid month");
    }
    if (!(args.actualPaidAmount > 0)) {
      throw new Error("Actual paid must be greater than zero");
    }
    const item = await ctx.db.get(args.budgetItemId);
    if (!item || item.userId !== userId) {
      throw new Error("Not found");
    }
    const rows = await ctx.db
      .query("budgetItemMonthOverrides")
      .withIndex("by_budget_month", (q) =>
        q.eq("budgetItemId", args.budgetItemId).eq("monthKey", args.monthKey)
      )
      .collect();
    const existing = rows.find((r) => r.userId === userId);
    if (existing) {
      await ctx.db.patch(existing._id, { actualPaidAmount: args.actualPaidAmount });
      return existing._id;
    }
    return await ctx.db.insert("budgetItemMonthOverrides", {
      userId,
      budgetItemId: args.budgetItemId,
      monthKey: args.monthKey,
      actualPaidAmount: args.actualPaidAmount,
    });
  },
});
