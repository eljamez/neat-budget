import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getEffectiveUserId } from "./authUser";
import { getEffectiveBudgetIdForMutation, getEffectiveBudgetIdForQuery } from "./budgetScope";

const accountTypeValidator = v.union(
  v.literal("checking"),
  v.literal("savings"),
  v.literal("cash"),
  v.literal("credit_card"),
  v.literal("other")
);

export const list = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    if (!budgetId) return [];
    return await ctx.db
      .query("accounts")
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
    balance: v.number(),
    accountType: v.optional(accountTypeValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForMutation(ctx, userId);
    return await ctx.db.insert("accounts", {
      userId,
      budgetId,
      name: args.name,
      balance: args.balance,
      accountType: args.accountType ?? "checking",
      isArchived: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("accounts"),
    userId: v.optional(v.string()),
    name: v.optional(v.string()),
    balance: v.optional(v.number()),
    accountType: v.optional(accountTypeValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId || doc.budgetId !== budgetId) {
      throw new Error("Account not found");
    }
    const { id, ...rest } = args;
    const patch = Object.fromEntries(
      Object.entries(rest).filter(([key, val]) => key !== "userId" && val !== undefined)
    ) as Record<string, unknown>;
    await ctx.db.patch(id, patch);
  },
});

export const archive = mutation({
  args: { id: v.id("accounts"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId || doc.budgetId !== budgetId) {
      throw new Error("Account not found");
    }
    await ctx.db.patch(args.id, { isArchived: true });
  },
});
