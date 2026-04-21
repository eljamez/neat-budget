import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getEffectiveUserId } from "./authUser";
import { getEffectiveBudgetIdForMutation, getEffectiveBudgetIdForQuery } from "./budgetScope";

async function assertPaymentAccount(
  ctx: MutationCtx,
  userId: string,
  budgetId: Id<"budgets">,
  accountId: Id<"accounts">
) {
  const a = await ctx.db.get(accountId);
  if (!a || a.userId !== userId || a.budgetId !== budgetId) {
    throw new Error("Invalid payment account");
  }
}

const usageModeValidator = v.union(v.literal("paying_off"), v.literal("active_use"));

export const list = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    if (!budgetId) return [];
    return await ctx.db
      .query("creditCards")
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
    usageMode: usageModeValidator,
    aprPercent: v.optional(v.number()),
    creditor: v.optional(v.string()),
    purpose: v.optional(v.string()),
    notes: v.optional(v.string()),
    minimumPayment: v.optional(v.number()),
    dueDayOfMonth: v.optional(v.number()),
    plannedMonthlyPayment: v.optional(v.number()),
    creditLimit: v.optional(v.number()),
    isAutopay: v.optional(v.boolean()),
    color: v.optional(v.string()),
    paymentAccountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForMutation(ctx, userId);
    if (args.paymentAccountId) {
      await assertPaymentAccount(ctx, userId, budgetId, args.paymentAccountId);
    }
    return await ctx.db.insert("creditCards", {
      userId,
      budgetId,
      name: args.name,
      balance: args.balance,
      usageMode: args.usageMode,
      aprPercent: args.aprPercent,
      creditor: args.creditor,
      purpose: args.purpose,
      notes: args.notes,
      minimumPayment: args.minimumPayment,
      dueDayOfMonth: args.dueDayOfMonth,
      plannedMonthlyPayment: args.plannedMonthlyPayment,
      creditLimit: args.creditLimit,
      isAutopay: args.isAutopay,
      color: args.color,
      paymentAccountId: args.paymentAccountId,
      isArchived: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("creditCards"),
    userId: v.optional(v.string()),
    name: v.optional(v.string()),
    balance: v.optional(v.number()),
    usageMode: v.optional(usageModeValidator),
    aprPercent: v.optional(v.number()),
    creditor: v.optional(v.string()),
    purpose: v.optional(v.string()),
    notes: v.optional(v.string()),
    minimumPayment: v.optional(v.number()),
    dueDayOfMonth: v.optional(v.number()),
    plannedMonthlyPayment: v.optional(v.number()),
    creditLimit: v.optional(v.number()),
    isAutopay: v.optional(v.boolean()),
    color: v.optional(v.string()),
    paymentAccountId: v.optional(v.union(v.id("accounts"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId || doc.budgetId !== budgetId) {
      throw new Error("Credit card not found");
    }
    const { id, paymentAccountId, ...rest } = args;
    const patch: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([key, val]) => key !== "userId" && val !== undefined)
    );
    if (paymentAccountId !== undefined) {
      if (paymentAccountId === null) {
        patch.paymentAccountId = undefined;
      } else {
        if (!budgetId) throw new Error("No active budget");
        await assertPaymentAccount(ctx, userId, budgetId, paymentAccountId);
        patch.paymentAccountId = paymentAccountId;
      }
    }
    await ctx.db.patch(id, patch as Record<string, never>);
  },
});

export const archive = mutation({
  args: { id: v.id("creditCards"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId || doc.budgetId !== budgetId) {
      throw new Error("Credit card not found");
    }
    await ctx.db.patch(args.id, { isArchived: true });
  },
});

export const setFundedForMonth = mutation({
  args: {
    id: v.id("creditCards"),
    userId: v.optional(v.string()),
    monthKey: v.string(),
    funded: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId || doc.budgetId !== budgetId) {
      throw new Error("Credit card not found");
    }
    await ctx.db.patch(args.id, {
      fundedForMonth: args.funded ? args.monthKey : undefined,
    });
  },
});

export const setPaidForMonth = mutation({
  args: {
    id: v.id("creditCards"),
    userId: v.optional(v.string()),
    monthKey: v.string(),
    paid: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId || doc.budgetId !== budgetId) {
      throw new Error("Credit card not found");
    }
    if (args.paid) {
      await ctx.db.patch(args.id, { markedPaidForMonth: args.monthKey });
      return;
    }
    if (doc.markedPaidForMonth === args.monthKey) {
      await ctx.db.patch(args.id, { markedPaidForMonth: undefined });
    }
  },
});
