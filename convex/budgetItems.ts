import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByCategory = query({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("budgetItems")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();
  },
});

export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("budgetItems")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    categoryId: v.id("categories"),
    name: v.string(),
    amount: v.number(),
    paymentDayOfMonth: v.number(),
    moneyNeededByDay: v.number(),
    accountId: v.optional(v.id("accounts")),
    paidFrom: v.optional(v.string()),
    isAutopay: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cat = await ctx.db.get(args.categoryId);
    if (!cat || cat.userId !== args.userId) {
      throw new Error("Invalid category");
    }
    if (args.accountId) {
      const acct = await ctx.db.get(args.accountId);
      if (!acct || acct.userId !== args.userId) {
        throw new Error("Invalid account");
      }
    }
    return await ctx.db.insert("budgetItems", {
      ...args,
      isArchived: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("budgetItems"),
    categoryId: v.optional(v.id("categories")),
    name: v.optional(v.string()),
    amount: v.optional(v.number()),
    paymentDayOfMonth: v.optional(v.number()),
    moneyNeededByDay: v.optional(v.number()),
    accountId: v.optional(v.union(v.id("accounts"), v.null())),
    paidFrom: v.optional(v.string()),
    isAutopay: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const doc = await ctx.db.get(id);
    if (!doc) {
      throw new Error("Not found");
    }

    const accountArg = updates.accountId;
    if (accountArg !== undefined) {
      if (accountArg !== null) {
        const acct = await ctx.db.get(accountArg);
        if (!acct || acct.userId !== doc.userId) {
          throw new Error("Invalid account");
        }
      }
    }

    const patch: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined) continue;
      if (key === "accountId" && val === null) {
        patch.accountId = undefined;
        continue;
      }
      patch[key] = val;
    }
    await ctx.db.patch(id, patch as Record<string, never>);
  },
});

export const archive = mutation({
  args: { id: v.id("budgetItems") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isArchived: true });
  },
});

/** Mark or unmark a planned expense as paid for a calendar month (`YYYY-MM`). */
export const setPaidForMonth = mutation({
  args: {
    id: v.id("budgetItems"),
    monthKey: v.string(),
    paid: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (args.paid) {
      await ctx.db.patch(args.id, { markedPaidForMonth: args.monthKey });
      return;
    }
    const doc = await ctx.db.get(args.id);
    if (!doc) return;
    if (doc.markedPaidForMonth === args.monthKey) {
      await ctx.db.patch(args.id, { markedPaidForMonth: undefined });
    }
  },
});
