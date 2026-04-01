import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const accountTypeValidator = v.union(
  v.literal("checking"),
  v.literal("savings"),
  v.literal("cash"),
  v.literal("credit_card"),
  v.literal("other")
);

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    balance: v.number(),
    accountType: v.optional(accountTypeValidator),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("accounts", {
      userId: args.userId,
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
    userId: v.string(),
    name: v.optional(v.string()),
    balance: v.optional(v.number()),
    accountType: v.optional(accountTypeValidator),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Account not found");
    }
    const { id, userId: _uid, ...rest } = args;
    const patch = Object.fromEntries(
      Object.entries(rest).filter(([, val]) => val !== undefined)
    ) as Record<string, unknown>;
    await ctx.db.patch(id, patch);
  },
});

export const archive = mutation({
  args: { id: v.id("accounts"), userId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Account not found");
    }
    await ctx.db.patch(args.id, { isArchived: true });
  },
});
