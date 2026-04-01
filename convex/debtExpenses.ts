import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByDebt = query({
  args: { debtId: v.id("debts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("debtExpenses")
      .withIndex("by_debt", (q) => q.eq("debtId", args.debtId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();
  },
});

export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("debtExpenses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    debtId: v.id("debts"),
    name: v.string(),
    amount: v.number(),
    dueDate: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const debt = await ctx.db.get(args.debtId);
    if (!debt || debt.userId !== args.userId) {
      throw new Error("Invalid debt");
    }
    return await ctx.db.insert("debtExpenses", {
      userId: args.userId,
      debtId: args.debtId,
      name: args.name,
      amount: args.amount,
      dueDate: args.dueDate,
      note: args.note,
      isPaid: false,
      isArchived: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("debtExpenses"),
    userId: v.string(),
    name: v.optional(v.string()),
    amount: v.optional(v.number()),
    dueDate: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Not found");
    }
    const { id, userId: _uid, ...rest } = args;
    const patch = Object.fromEntries(
      Object.entries(rest).filter(([, val]) => val !== undefined)
    ) as Record<string, unknown>;
    await ctx.db.patch(id, patch);
  },
});

export const archive = mutation({
  args: { id: v.id("debtExpenses"), userId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Not found");
    }
    await ctx.db.patch(args.id, { isArchived: true });
  },
});

export const setPaid = mutation({
  args: {
    id: v.id("debtExpenses"),
    userId: v.string(),
    paid: v.boolean(),
    paidAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Not found");
    }
    if (args.paid) {
      await ctx.db.patch(args.id, {
        isPaid: true,
        paidAt: args.paidAt ?? new Date().toISOString().slice(0, 10),
      });
    } else {
      await ctx.db.patch(args.id, { isPaid: false, paidAt: undefined });
    }
  },
});
