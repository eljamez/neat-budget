import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const expenseStatusValidator = v.union(
  v.literal("unfunded"),
  v.literal("funded"),
  v.literal("paid")
);

function utcYmdFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

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

/**
 * Mark a recurring expense as funded: money is reserved from `fundedDate` (today) for available-balance math.
 * Requires a pay-from `accountId`. Clears paid flags so you can start a new month after paying.
 */
export const fundExpense = mutation({
  args: { id: v.id("budgetItems"), userId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Not found");
    }
    if (!doc.accountId) {
      throw new Error("Choose a pay-from account for this expense before funding");
    }
    await ctx.db.patch(args.id, {
      status: "funded",
      fundedDate: Date.now(),
      paidDate: undefined,
      markedPaidForMonth: undefined,
    });
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
 * Cash still available per bank account after earmarks: funded expenses (from `fundedDate`), monthly
 * allocation lines (legacy / partial), and bucket fundings for the month of `date`.
 * `date` is `YYYY-MM-DD`. Uses stored `accounts.balance`; funded expenses use UTC calendar day from `fundedDate`.
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

    const itemById = Object.fromEntries(budgetItems.map((i) => [i._id, i]));

    const fundedExpenseByAccount: Record<string, number> = {};
    for (const item of budgetItems) {
      if (item.status !== "funded") continue;
      if (!item.accountId || item.fundedDate == null) continue;
      if (utcYmdFromMs(item.fundedDate) > date) continue;
      const accId = item.accountId as string;
      fundedExpenseByAccount[accId] =
        (fundedExpenseByAccount[accId] ?? 0) + item.amount;
    }

    const fundedFromAllocations: Record<string, number> = {};
    for (const a of allocations) {
      const item = itemById[a.budgetItemId];
      if (!item) continue;
      if (
        item.status === "funded" &&
        item.fundedDate != null &&
        utcYmdFromMs(item.fundedDate) <= date
      ) {
        continue;
      }
      const accId = a.accountId as string;
      fundedFromAllocations[accId] =
        (fundedFromAllocations[accId] ?? 0) + a.amount;
    }

    const fundedFromBuckets: Record<string, number> = {};
    for (const f of bucketFundings) {
      const accId = f.accountId as string;
      fundedFromBuckets[accId] =
        (fundedFromBuckets[accId] ?? 0) + f.amount;
    }

    let totalAvailable = 0;
    const byAccount = accounts.map((acc) => {
      const id = acc._id as string;
      const funded =
        (fundedExpenseByAccount[id] ?? 0) +
        (fundedFromAllocations[id] ?? 0) +
        (fundedFromBuckets[id] ?? 0);
      const isAsset = ASSET_TYPES.has(acc.accountType);
      const available = isAsset ? acc.balance - funded : null;
      if (isAsset && available != null) totalAvailable += available;
      return {
        accountId: acc._id,
        balance: acc.balance,
        funded,
        available,
        isAsset,
      };
    });

    return { date, byAccount, totalAvailable };
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
        status: doc.fundedDate != null ? "funded" : "unfunded",
      });
    }
  },
});
