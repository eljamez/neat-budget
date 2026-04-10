import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getEffectiveUserId } from "./authUser";
import { getEffectiveBudgetIdForMutation, getEffectiveBudgetIdForQuery } from "./budgetScope";

export const list = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    if (!budgetId) return [];
    return await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .filter((q) => q.eq(q.field("budgetId"), budgetId))
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.optional(v.string()),
    name: v.string(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForMutation(ctx, userId);
    return await ctx.db.insert("categories", {
      userId,
      budgetId,
      name: args.name,
      color: args.color,
      icon: args.icon,
      isArchived: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    userId: v.optional(v.string()),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    const { id, ...updates } = args;
    delete (updates as { userId?: string }).userId;
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId || doc.budgetId !== budgetId) {
      throw new Error("Category not found");
    }
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const archive = mutation({
  args: { id: v.id("categories"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId || doc.budgetId !== budgetId) {
      throw new Error("Category not found");
    }
    await ctx.db.patch(args.id, { isArchived: true });
  },
});
