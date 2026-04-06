import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const expenseStatusValidator = v.union(
  v.literal("unfunded"),
  v.literal("funded"),
  v.literal("paid")
);

const ASSET_TYPES = new Set([
  "checking",
  "savings",
  "cash",
  "other",
]);

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

/** Optional one-time cleanup: drops legacy `moneyNeededByDay` from all budget items. */
export const stripLegacyMoneyNeededByDay = mutation({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("budgetItems").collect();
    for (const item of items) {
      if (item.moneyNeededByDay !== undefined) {
        await ctx.db.patch(item._id, { moneyNeededByDay: undefined });
      }
    }
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    categoryId: v.id("categories"),
    name: v.string(),
    amount: v.number(),
    paymentDayOfMonth: v.number(),
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
    if (updates.paymentDayOfMonth !== undefined) {
      patch.moneyNeededByDay = undefined;
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

/** Mark the expense paid for a calendar month (`YYYY-MM`). Sets `status: paid` and `paidDate`. */
export const markExpensePaid = mutation({
  args: {
    id: v.id("budgetItems"),
    userId: v.string(),
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!/^\d{4}-\d{2}$/.test(args.monthKey)) {
      throw new Error("Invalid month");
    }
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Not found");
    }
    await ctx.db.patch(args.id, {
      status: "paid",
      paidDate: Date.now(),
      markedPaidForMonth: args.monthKey,
    });
  },
});

/**
 * Funding for `date`'s calendar month (`expenseAllocations` + `bucketMonthFundings`) vs total cash in asset accounts.
 * Account rows are balances only — funding is budget-wide and does not adjust per-account display.
 * `date` is `YYYY-MM-DD`. Uses stored `accounts.balance`.
 */
export const getAvailableBalance = query({
  args: { userId: v.string(), date: v.string() },
  handler: async (ctx, { userId, date }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Invalid date");
    }
    const monthKey = date.slice(0, 7);
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();

    const budgetItems = await ctx.db
      .query("budgetItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();

    const allocations = await ctx.db
      .query("expenseAllocations")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("monthKey", monthKey)
      )
      .collect();

    const bucketFundings = await ctx.db
      .query("bucketMonthFundings")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("monthKey", monthKey)
      )
      .collect();

    const itemIds = new Set(budgetItems.map((i) => i._id as string));

    let totalFunded = 0;
    for (const a of allocations) {
      if (!itemIds.has(a.budgetItemId as string)) continue;
      totalFunded += a.amount;
    }
    for (const f of bucketFundings) {
      totalFunded += f.amount;
    }

    let totalCash = 0;
    const byAccount = accounts.map((acc) => {
      const isAsset = ASSET_TYPES.has(acc.accountType);
      if (isAsset) totalCash += acc.balance;
      return {
        accountId: acc._id,
        balance: acc.balance,
        isAsset,
      };
    });

    const availableToFund = totalCash - totalFunded;

    return {
      date,
      totalCash,
      totalFunded,
      availableToFund,
      byAccount,
    };
  },
});

export const getExpensesByStatus = query({
  args: { userId: v.string(), status: expenseStatusValidator },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("budgetItems")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();

    return items.filter((item) => {
      const s = item.status ?? "unfunded";
      if (args.status === "unfunded") {
        return s === "unfunded";
      }
      return s === args.status;
    });
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
    if (!/^\d{4}-\d{2}$/.test(args.monthKey)) {
      throw new Error("Invalid month");
    }
    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new Error("Not found");
    }
    if (args.paid) {
      await ctx.db.patch(args.id, {
        markedPaidForMonth: args.monthKey,
        status: "paid",
        paidDate: Date.now(),
      });
      return;
    }
    if (doc.markedPaidForMonth === args.monthKey) {
      await ctx.db.patch(args.id, {
        markedPaidForMonth: undefined,
        paidDate: undefined,
        status: "unfunded",
        fundedDate: undefined,
      });
    }
  },
});
