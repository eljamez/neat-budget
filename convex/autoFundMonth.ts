import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getEffectiveUserId } from "./authUser";

const ASSET_TYPES = new Set(["checking", "savings", "cash", "other"]);

/**
 * Allocates available cash toward unfunded bills (by due day) then monthly buckets (by name),
 * up to each line's cap. Does not mark anything paid — funding is separate from payment.
 */
export const run = mutation({
  args: { userId: v.optional(v.string()), monthKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const { monthKey } = args;
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      throw new Error("Invalid month");
    }

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();

    let totalCash = 0;
    for (const acc of accounts) {
      if (ASSET_TYPES.has(acc.accountType)) totalCash += acc.balance;
    }

    const budgetItems = await ctx.db
      .query("budgetItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();

    const itemIds = new Set(budgetItems.map((i) => i._id as string));

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

    let totalFunded = 0;
    for (const a of allocations) {
      if (!itemIds.has(a.budgetItemId as string)) continue;
      totalFunded += a.amount;
    }
    for (const f of bucketFundings) {
      totalFunded += f.amount;
    }

    let pool = totalCash - totalFunded;

    const allocByItem = new Map<string, number>();
    for (const a of allocations) {
      if (!itemIds.has(a.budgetItemId as string)) continue;
      const k = a.budgetItemId as string;
      allocByItem.set(k, (allocByItem.get(k) ?? 0) + a.amount);
    }

    if (pool <= 0.005) {
      return {
        billsTouched: 0,
        bucketsTouched: 0,
        totalAdded: 0,
        remainingAvailable: Math.max(0, pool),
        message:
          "No cash available to fund. Add to asset accounts or reduce existing funding for this month.",
      };
    }

    let billsTouched = 0;
    let bucketsTouched = 0;
    let totalAdded = 0;

    const sortedBills = [...budgetItems]
      .filter(
        (i) =>
          i.markedPaidForMonth !== monthKey &&
          i.amount > 0.005
      )
      .sort((a, b) => a.paymentDayOfMonth - b.paymentDayOfMonth);

    for (const item of sortedBills) {
      if (pool <= 0.005) break;
      const current = allocByItem.get(item._id as string) ?? 0;
      if (current > item.amount + 0.005) continue;
      const need = item.amount - current;
      if (need <= 0.005) continue;
      const add = Math.min(need, pool);
      await ctx.db.insert("expenseAllocations", {
        userId,
        budgetItemId: item._id,
        amount: add,
        monthKey,
      });
      allocByItem.set(item._id as string, current + add);
      pool -= add;
      totalAdded += add;
      billsTouched++;
    }

    const buckets = await ctx.db
      .query("buckets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();

    const monthlyBuckets = buckets.filter((b) => b.period === "monthly");

    const fundedByBucket = new Map<string, number>();
    for (const f of bucketFundings) {
      const k = f.bucketId as string;
      fundedByBucket.set(k, (fundedByBucket.get(k) ?? 0) + f.amount);
    }

    const sortedBuckets = [...monthlyBuckets].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );

    for (const bucket of sortedBuckets) {
      if (pool <= 0.005) break;
      const cap =
        bucket.monthlyFillGoal != null && bucket.monthlyFillGoal > 0.005
          ? bucket.monthlyFillGoal
          : bucket.targetAmount;
      if (cap <= 0.005) continue;
      const current = fundedByBucket.get(bucket._id as string) ?? 0;
      const need = cap - current;
      if (need <= 0.005) continue;
      const add = Math.min(need, pool);
      await ctx.db.insert("bucketMonthFundings", {
        userId,
        bucketId: bucket._id,
        amount: add,
        monthKey,
      });
      fundedByBucket.set(bucket._id as string, current + add);
      pool -= add;
      totalAdded += add;
      bucketsTouched++;
    }

    let message: string | null = null;
    if (totalAdded <= 0.005) {
      message =
        "Nothing to fund — bills are paid or already fully funded, and monthly buckets are at their caps.";
    }

    return {
      billsTouched,
      bucketsTouched,
      totalAdded,
      remainingAvailable: pool,
      message,
    };
  },
});
