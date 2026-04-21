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
      .query("groups")
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
    return await ctx.db.insert("groups", {
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
    id: v.id("groups"),
    userId: v.optional(v.string()),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId || doc.budgetId !== budgetId) {
      throw new Error("Group not found");
    }
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.color !== undefined) patch.color = args.color;
    if (args.icon !== undefined) patch.icon = args.icon;
    await ctx.db.patch(args.id, patch);
  },
});

/** Creates an "Expenses" group if the user has no groups yet. Safe to call on every page load. */
export const ensureDefault = mutation({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForMutation(ctx, userId);
    const existing = await ctx.db
      .query("groups")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .filter((q) => q.eq(q.field("budgetId"), budgetId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("groups", {
      userId,
      budgetId,
      name: "Expenses",
      color: "#0d9488",
      isArchived: false,
    });
  },
});

export const archive = mutation({
  args: { id: v.id("groups"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId || doc.budgetId !== budgetId) {
      throw new Error("Group not found");
    }
    await ctx.db.patch(args.id, { isArchived: true });
  },
});
