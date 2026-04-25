import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Wipes all data for a test user and resets their onboarding state.
 * Only intended for use in e2e tests — do not call from production code.
 */
export const resetUserForTesting = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .unique();
    if (!user) return;

    const uid = user.clerkId;

    const transactions = await ctx.db.query("transactions").withIndex("by_user", (q) => q.eq("userId", uid)).collect();
    for (const t of transactions) await ctx.db.delete(t._id);

    const categories = await ctx.db.query("categories").withIndex("by_user", (q) => q.eq("userId", uid)).collect();
    for (const c of categories) await ctx.db.delete(c._id);

    const groups = await ctx.db.query("groups").withIndex("by_user", (q) => q.eq("userId", uid)).collect();
    for (const g of groups) await ctx.db.delete(g._id);

    const accounts = await ctx.db.query("accounts").withIndex("by_user", (q) => q.eq("userId", uid)).collect();
    for (const a of accounts) await ctx.db.delete(a._id);

    await ctx.db.patch(user._id, {
      onboardingStep: undefined,
      onboardingStartedAt: undefined,
      onboardingCompletedAt: undefined,
      onboardingAccountId: undefined,
      onboardingCategoryId: undefined,
    });
  },
});
