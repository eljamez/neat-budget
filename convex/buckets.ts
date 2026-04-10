import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getEffectiveUserId } from "./authUser";

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

const bucketPeriodValidator = v.union(
  v.literal("weekly"),
  v.literal("biweekly"),
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("yearly")
);

function assertNonEmptyName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name is required");
  }
  return trimmed;
}

async function assertCategoryOwnedByUser(
  ctx: QueryCtx | MutationCtx,
  categoryId: Id<"categories">,
  userId: string
) {
  const cat = await ctx.db.get(categoryId);
  if (!cat || cat.userId !== userId) {
    throw new Error("Invalid category");
  }
}

export const getBuckets = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    return await ctx.db
      .query("buckets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();
  },
});

export const getBucketById = query({
  args: {
    id: v.id("buckets"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) {
      return null;
    }
    return doc;
  },
});

export const createBucket = mutation({
  args: {
    userId: v.optional(v.string()),
    name: v.string(),
    targetAmount: v.number(),
    period: bucketPeriodValidator,
    rollover: v.optional(v.boolean()),
    categoryId: v.optional(v.id("categories")),
    color: v.optional(v.string()),
    note: v.optional(v.string()),
    monthlyFillGoal: v.optional(v.number()),
    paymentAccountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const name = assertNonEmptyName(args.name);
    if (!Number.isFinite(args.targetAmount) || args.targetAmount < 0) {
      throw new Error("targetAmount must be a non-negative number");
    }
    if (
      args.monthlyFillGoal !== undefined &&
      (!Number.isFinite(args.monthlyFillGoal) || args.monthlyFillGoal < 0)
    ) {
      throw new Error("monthlyFillGoal must be a non-negative number");
    }
    if (args.categoryId) {
      await assertCategoryOwnedByUser(ctx, args.categoryId, userId);
    }
    if (args.paymentAccountId) {
      await assertPaymentAccount(ctx, userId, args.paymentAccountId);
    }
    return await ctx.db.insert("buckets", {
      userId,
      name,
      targetAmount: args.targetAmount,
      period: args.period,
      rollover: args.rollover ?? false,
      categoryId: args.categoryId,
      color: args.color,
      note: args.note,
      monthlyFillGoal: args.monthlyFillGoal,
      paymentAccountId: args.paymentAccountId,
      isArchived: false,
    });
  },
});

export const updateBucket = mutation({
  args: {
    id: v.id("buckets"),
    userId: v.optional(v.string()),
    name: v.optional(v.string()),
    targetAmount: v.optional(v.number()),
    period: v.optional(bucketPeriodValidator),
    rollover: v.optional(v.boolean()),
    categoryId: v.optional(v.union(v.id("categories"), v.null())),
    color: v.optional(v.string()),
    note: v.optional(v.string()),
    monthlyFillGoal: v.optional(v.union(v.number(), v.null())),
    paymentAccountId: v.optional(v.union(v.id("accounts"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Not found");
    }

    const patch: Record<string, unknown> = {};

    if (args.name !== undefined) {
      patch.name = assertNonEmptyName(args.name);
    }
    if (args.targetAmount !== undefined) {
      if (!Number.isFinite(args.targetAmount) || args.targetAmount < 0) {
        throw new Error("targetAmount must be a non-negative number");
      }
      patch.targetAmount = args.targetAmount;
    }
    if (args.monthlyFillGoal !== undefined) {
      const g = args.monthlyFillGoal;
      if (g === null) {
        patch.monthlyFillGoal = undefined;
      } else if (!Number.isFinite(g) || g < 0) {
        throw new Error("monthlyFillGoal must be a non-negative number");
      } else {
        patch.monthlyFillGoal = g;
      }
    }
    if (args.period !== undefined) {
      patch.period = args.period;
    }
    if (args.rollover !== undefined) {
      patch.rollover = args.rollover;
    }
    if (args.color !== undefined) {
      patch.color = args.color;
    }
    if (args.note !== undefined) {
      const trimmed = args.note.trim();
      patch.note = trimmed ? trimmed : undefined;
    }

    const catArg = args.categoryId;
    if (catArg !== undefined) {
      if (catArg === null) {
        patch.categoryId = undefined;
      } else {
        await assertCategoryOwnedByUser(ctx, catArg, doc.userId);
        patch.categoryId = catArg;
      }
    }

    const payArg = args.paymentAccountId;
    if (payArg !== undefined) {
      if (payArg === null) {
        patch.paymentAccountId = undefined;
      } else {
        await assertPaymentAccount(ctx, doc.userId, payArg);
        patch.paymentAccountId = payArg;
      }
    }

    await ctx.db.patch(args.id, patch as Record<string, never>);
  },
});

export const deleteBucket = mutation({
  args: {
    id: v.id("buckets"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) {
      throw new Error("Not found");
    }
    await ctx.db.delete(args.id);
  },
});
