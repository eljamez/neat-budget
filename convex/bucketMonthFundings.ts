import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByUserMonth = query({
  args: { userId: v.string(), monthKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bucketMonthFundings")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", args.userId).eq("monthKey", args.monthKey)
      )
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    bucketId: v.id("buckets"),
    amount: v.number(),
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0 || !/^\d{4}-\d{2}$/.test(args.monthKey)) {
      throw new Error("Invalid funding");
    }
    const bucket = await ctx.db.get(args.bucketId);
    if (!bucket || bucket.userId !== args.userId) {
      throw new Error("Invalid bucket");
    }
    if (bucket.isArchived === true) {
      throw new Error("Bucket is archived");
    }
    if (bucket.period !== "monthly") {
      throw new Error("Only monthly buckets support month funding");
    }
    const existing = await ctx.db
      .query("bucketMonthFundings")
      .withIndex("by_bucket_month", (q) =>
        q.eq("bucketId", args.bucketId).eq("monthKey", args.monthKey)
      )
      .collect();
    const total = existing.reduce((s, r) => s + r.amount, 0) + args.amount;
    const cap =
      bucket.monthlyFillGoal != null && bucket.monthlyFillGoal > 0.005
        ? bucket.monthlyFillGoal
        : bucket.targetAmount;
    if (total > cap + 0.005) {
      throw new Error(`Cannot fund more than ${cap} for this bucket this month`);
    }
    return await ctx.db.insert("bucketMonthFundings", {
      userId: args.userId,
      bucketId: args.bucketId,
      amount: args.amount,
      monthKey: args.monthKey,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("bucketMonthFundings"), userId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Not found");
    }
    await ctx.db.delete(args.id);
  },
});

/** Delete every month funding row for this bucket in the given calendar month. */
export const removeAllForBucketMonth = mutation({
  args: {
    userId: v.string(),
    bucketId: v.id("buckets"),
    monthKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (!/^\d{4}-\d{2}$/.test(args.monthKey)) {
      throw new Error("Invalid month");
    }
    const bucket = await ctx.db.get(args.bucketId);
    if (!bucket || bucket.userId !== args.userId) {
      throw new Error("Not found");
    }
    const rows = await ctx.db
      .query("bucketMonthFundings")
      .withIndex("by_bucket_month", (q) =>
        q.eq("bucketId", args.bucketId).eq("monthKey", args.monthKey)
      )
      .collect();
    for (const r of rows) {
      if (r.userId !== args.userId) continue;
      await ctx.db.delete(r._id);
    }
  },
});
