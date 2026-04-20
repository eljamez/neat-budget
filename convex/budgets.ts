import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getEffectiveUserId } from "./authUser";
import { getEffectiveBudgetIdForMutation } from "./budgetScope";

async function backfillBudgetId(
  ctx: MutationCtx,
  userId: string,
  budgetId: ReturnType<typeof getEffectiveBudgetIdForMutation> extends Promise<infer T> ? T : never
) {
  const tables = [
    "accounts",
    "debts",
    "creditCards",
    "debtExpenses",
    "categories",
    "transactions",
    "buckets",
    "budgetItems",
  ] as const;

  for (const table of tables) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of rows) {
      if ((row as { budgetId?: string }).budgetId === undefined) {
        await ctx.db.patch(row._id, { budgetId });
      }
    }
  }
}

export const list = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const rows = await ctx.db
      .query("budgets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
  },
});

export const ensureDefault = mutation({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForMutation(ctx, userId);
    await backfillBudgetId(ctx, userId, budgetId);
    return { budgetId };
  },
});

export const create = mutation({
  args: {
    userId: v.optional(v.string()),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const name = args.name.trim();
    if (!name) throw new Error("Budget name is required");
    return await ctx.db.insert("budgets", {
      userId,
      name,
      isDefault: false,
      isActive: false,
      createdAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: {
    userId: v.optional(v.string()),
    budgetId: v.id("budgets"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budget = await ctx.db.get(args.budgetId);
    if (!budget || budget.userId !== userId) throw new Error("Budget not found");
    const name = args.name.trim();
    if (!name) throw new Error("Budget name is required");
    await ctx.db.patch(args.budgetId, { name });
  },
});

export const remove = mutation({
  args: {
    userId: v.optional(v.string()),
    budgetId: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budget = await ctx.db.get(args.budgetId);
    if (!budget || budget.userId !== userId) throw new Error("Budget not found");

    const all = await ctx.db
      .query("budgets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (all.length <= 1) throw new Error("Cannot delete the only budget");

    if (budget.isActive) {
      const next = all.find((b) => b._id !== args.budgetId);
      if (next) await ctx.db.patch(next._id, { isActive: true });
    }

    const budgetScoped = [
      "accounts",
      "debts",
      "creditCards",
      "debtExpenses",
      "categories",
      "transactions",
      "buckets",
      "budgetItems",
    ] as const;

    for (const table of budgetScoped) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const row of rows) {
        if ((row as { budgetId?: string }).budgetId === args.budgetId) {
          await ctx.db.delete(row._id);
        }
      }
    }

    const userMonthScoped = [
      "bucketMonthFundings",
      "expenseAllocations",
      "budgetItemMonthOverrides",
    ] as const;

    for (const table of userMonthScoped) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_user_month", (q) => q.eq("userId", userId))
        .collect();
      for (const row of rows) {
        if ((row as { budgetId?: string }).budgetId === args.budgetId) {
          await ctx.db.delete(row._id);
        }
      }
    }

    await ctx.db.delete(args.budgetId);
  },
});

export const setActive = mutation({
  args: {
    userId: v.optional(v.string()),
    budgetId: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const next = await ctx.db.get(args.budgetId);
    if (!next || next.userId !== userId) throw new Error("Budget not found");

    const rows = await ctx.db
      .query("budgets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of rows) {
      const shouldBeActive = row._id === args.budgetId;
      if (row.isActive !== shouldBeActive) {
        await ctx.db.patch(row._id, { isActive: shouldBeActive });
      }
    }
  },
});
