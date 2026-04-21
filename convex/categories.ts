import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getEffectiveUserId } from "./authUser";
import { getEffectiveBudgetIdForMutation, getEffectiveBudgetIdForQuery } from "./budgetScope";

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

function monthDateRange(monthKey: string): { start: string; endExclusive: string } {
  if (!MONTH_KEY_RE.test(monthKey)) throw new Error("Invalid month format, expected YYYY-MM");
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: `${monthKey}-01`,
    endExclusive: `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

async function getMonthTransactions(
  ctx: QueryCtx,
  userId: string,
  budgetId: Id<"budgets">,
  monthKey: string
) {
  const { start, endExclusive } = monthDateRange(monthKey);
  return await ctx.db
    .query("transactions")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", userId).gte("date", start).lt("date", endExclusive)
    )
    .filter((q) => q.eq(q.field("budgetId"), budgetId))
    .collect();
}

/** List all non-archived categories that have a groupId (new line-item style). */
export const list = query({
  args: { userId: v.optional(v.string()), budgetId: v.optional(v.id("budgets")) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    if (!budgetId) return [];
    return await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .filter((q) => q.eq(q.field("budgetId"), budgetId))
      .filter((q) => q.neq(q.field("groupId"), undefined))
      .collect();
  },
});

export const listByGroup = query({
  args: {
    userId: v.optional(v.string()),
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    if (!budgetId) return [];
    const group = await ctx.db.get(args.groupId);
    if (!group || group.userId !== userId || group.budgetId !== budgetId) {
      throw new Error("Group not found");
    }
    return await ctx.db
      .query("categories")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.optional(v.string()),
    groupId: v.id("groups"),
    name: v.string(),
    monthlyTarget: v.optional(v.number()),
    rollover: v.optional(v.boolean()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    note: v.optional(v.string()),
    dueDayOfMonth: v.optional(v.number()),
    paymentAccountId: v.optional(v.id("accounts")),
    isAutopay: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForMutation(ctx, userId);
    const group = await ctx.db.get(args.groupId);
    if (!group || group.userId !== userId || group.budgetId !== budgetId) {
      throw new Error("Group not found");
    }
    return await ctx.db.insert("categories", {
      userId,
      budgetId,
      groupId: args.groupId,
      name: args.name,
      monthlyTarget: args.monthlyTarget,
      rollover: args.rollover,
      color: args.color,
      icon: args.icon,
      note: args.note,
      dueDayOfMonth: args.dueDayOfMonth,
      paymentAccountId: args.paymentAccountId,
      isAutopay: args.isAutopay,
      isArchived: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    userId: v.optional(v.string()),
    name: v.optional(v.string()),
    groupId: v.optional(v.id("groups")),
    monthlyTarget: v.optional(v.number()),
    rollover: v.optional(v.boolean()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    note: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    dueDayOfMonth: v.optional(v.number()),
    paymentAccountId: v.optional(v.id("accounts")),
    markedPaidForMonth: v.optional(v.string()),
    isAutopay: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId || doc.budgetId !== budgetId) {
      throw new Error("Category not found");
    }
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.groupId !== undefined) patch.groupId = args.groupId;
    if (args.monthlyTarget !== undefined) patch.monthlyTarget = args.monthlyTarget;
    if (args.rollover !== undefined) patch.rollover = args.rollover;
    if (args.color !== undefined) patch.color = args.color;
    if (args.icon !== undefined) patch.icon = args.icon;
    if (args.note !== undefined) patch.note = args.note;
    if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;
    if (args.dueDayOfMonth !== undefined) patch.dueDayOfMonth = args.dueDayOfMonth;
    if (args.paymentAccountId !== undefined) patch.paymentAccountId = args.paymentAccountId;
    if (args.markedPaidForMonth !== undefined) patch.markedPaidForMonth = args.markedPaidForMonth;
    if (args.isAutopay !== undefined) patch.isAutopay = args.isAutopay;
    await ctx.db.patch(args.id, patch);
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

export const setFundedForMonth = mutation({
  args: {
    id: v.id("categories"),
    userId: v.optional(v.string()),
    monthKey: v.string(),
    funded: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId || doc.budgetId !== budgetId) {
      throw new Error("Category not found");
    }
    await ctx.db.patch(args.id, {
      fundedForMonth: args.funded ? args.monthKey : undefined,
    });
  },
});

export const setPaidForMonth = mutation({
  args: {
    id: v.id("categories"),
    userId: v.optional(v.string()),
    monthKey: v.string(),
    paid: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId || doc.budgetId !== budgetId) {
      throw new Error("Category not found");
    }
    await ctx.db.patch(args.id, {
      markedPaidForMonth: args.paid ? args.monthKey : undefined,
    });
  },
});

/**
 * Returns each category (new line-item style) with its spending for the given month,
 * grouped so the caller can map group → [{ category, spent, target, remaining }].
 */
export const getMonthlyProgress = query({
  args: {
    userId: v.optional(v.string()),
    month: v.string(), // YYYY-MM
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForQuery(ctx, userId);
    if (!budgetId) return [];

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .filter((q) => q.eq(q.field("budgetId"), budgetId))
      .filter((q) => q.neq(q.field("groupId"), undefined))
      .collect();

    const monthTxs = await getMonthTransactions(ctx, userId, budgetId, args.month);

    const spentByCategoryId: Record<string, number> = {};
    for (const tx of monthTxs) {
      if (!tx.categoryId) continue;
      const k = tx.categoryId as string;
      spentByCategoryId[k] = (spentByCategoryId[k] ?? 0) + tx.amount;
    }

    return categories.map((cat) => {
      const txSpent = spentByCategoryId[cat._id as string] ?? 0;
      const target = cat.monthlyTarget ?? null;
      const isPaidForMonth = cat.markedPaidForMonth === args.month;
      // When marked paid, remaining is 0 regardless of logged transactions.
      // spent reflects actual transactions so the history stays accurate.
      const remaining = isPaidForMonth ? 0 : (target !== null ? target - txSpent : null);
      return {
        category: cat,
        spent: txSpent,
        target,
        remaining,
        fundedForMonth: cat.fundedForMonth,
      };
    });
  },
});
