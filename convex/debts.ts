import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

async function assertPaymentAccount(
  ctx: MutationCtx,
  userId: string,
  accountId: Id<"accounts">
) {
  const a = await ctx.db.get(accountId);
  if (!a || a.userId !== userId) {
    throw new Error("Invalid payment account");
  }
}

/** Allowed for create/update — not `credit_card` (use `creditCards` table). */
const debtTypeForWrite = v.union(
  v.literal("loan"),
  v.literal("personal"),
  v.literal("payment_plan"),
  v.literal("other")
);

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("debts")
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
    debtType: debtTypeForWrite,
    aprPercent: v.optional(v.number()),
    creditor: v.optional(v.string()),
    purpose: v.optional(v.string()),
    notes: v.optional(v.string()),
    minimumPayment: v.optional(v.number()),
    dueDayOfMonth: v.optional(v.number()),
    plannedMonthlyPayment: v.optional(v.number()),
    isAutopay: v.optional(v.boolean()),
    color: v.optional(v.string()),
    paymentAccountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    if (args.paymentAccountId) {
      await assertPaymentAccount(ctx, args.userId, args.paymentAccountId);
    }
    return await ctx.db.insert("debts", {
      userId: args.userId,
      name: args.name,
      balance: args.balance,
      debtType: args.debtType,
      aprPercent: args.aprPercent,
      creditor: args.creditor,
      purpose: args.purpose,
      notes: args.notes,
      minimumPayment: args.minimumPayment,
      dueDayOfMonth: args.dueDayOfMonth,
      plannedMonthlyPayment: args.plannedMonthlyPayment,
      isAutopay: args.isAutopay,
      color: args.color,
      paymentAccountId: args.paymentAccountId,
      isArchived: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("debts"),
    userId: v.string(),
    name: v.optional(v.string()),
    balance: v.optional(v.number()),
    debtType: v.optional(debtTypeForWrite),
    aprPercent: v.optional(v.number()),
    creditor: v.optional(v.string()),
    purpose: v.optional(v.string()),
    notes: v.optional(v.string()),
    minimumPayment: v.optional(v.number()),
    dueDayOfMonth: v.optional(v.number()),
    plannedMonthlyPayment: v.optional(v.number()),
    isAutopay: v.optional(v.boolean()),
    color: v.optional(v.string()),
    paymentAccountId: v.optional(v.union(v.id("accounts"), v.null())),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Debt not found");
    }
    const { id, userId, paymentAccountId, ...rest } = args;
    const patch: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([, val]) => val !== undefined)
    );
    if (paymentAccountId !== undefined) {
      if (paymentAccountId === null) {
        patch.paymentAccountId = undefined;
      } else {
        await assertPaymentAccount(ctx, userId, paymentAccountId);
        patch.paymentAccountId = paymentAccountId;
      }
    }
    await ctx.db.patch(id, patch as Record<string, never>);
  },
});

export const archive = mutation({
  args: { id: v.id("debts"), userId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Debt not found");
    }
    const lines = await ctx.db
      .query("debtExpenses")
      .withIndex("by_debt", (q) => q.eq("debtId", args.id))
      .collect();
    for (const line of lines) {
      await ctx.db.patch(line._id, { isArchived: true });
    }
    await ctx.db.patch(args.id, { isArchived: true });
  },
});

/** Mark or unmark planned monthly payment as paid for a calendar month (`YYYY-MM`). */
export const setPaidForMonth = mutation({
  args: {
    id: v.id("debts"),
    userId: v.string(),
    monthKey: v.string(),
    paid: v.boolean(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Debt not found");
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
