import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getEffectiveUserId } from "./authUser";

const STEP_ORDER = ["account", "category", "fund", "transaction", "done"] as const;
type OnboardingStep = (typeof STEP_ORDER)[number];

async function getUserRow(ctx: Parameters<typeof getEffectiveUserId>[0], userId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
    .first();
}

export const getState = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let userId: string;
    try {
      userId = await getEffectiveUserId(ctx, args.userId);
    } catch {
      return null;
    }
    const user = await getUserRow(ctx, userId);
    if (!user) return null;
    return {
      step: (user.onboardingStep ?? "account") as OnboardingStep,
      startedAt: user.onboardingStartedAt ?? 0,
      completedAt: user.onboardingCompletedAt,
      accountId: user.onboardingAccountId,
      categoryId: user.onboardingCategoryId,
    };
  },
});

export const start = mutation({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const user = await getUserRow(ctx, userId);
    if (!user) throw new Error("User not found");
    if (user.onboardingStep) return; // already started

    // Users who existed before onboarding was built already have real data.
    // Skip onboarding for them rather than forcing the new-user flow.
    const existingAccount = await ctx.db
      .query("accounts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    const now = Date.now();
    if (existingAccount) {
      await ctx.db.patch(user._id, {
        onboardingStep: "done",
        onboardingStartedAt: now,
        onboardingCompletedAt: now,
      });
    } else {
      await ctx.db.patch(user._id, {
        onboardingStep: "account",
        onboardingStartedAt: now,
      });
    }
  },
});

export const advance = mutation({
  args: {
    userId: v.optional(v.string()),
    step: v.union(
      v.literal("account"),
      v.literal("category"),
      v.literal("fund"),
      v.literal("transaction"),
      v.literal("done"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const user = await getUserRow(ctx, userId);
    if (!user) throw new Error("User not found");

    const currentStep = user.onboardingStep ?? "account";
    const currentIdx = STEP_ORDER.indexOf(currentStep as OnboardingStep);
    const targetIdx = STEP_ORDER.indexOf(args.step);

    if (targetIdx <= currentIdx) {
      throw new Error(`Cannot move backward: current=${currentStep}, requested=${args.step}`);
    }

    const patch: Record<string, unknown> = { onboardingStep: args.step };
    if (args.step === "done") {
      patch.onboardingCompletedAt = Date.now();
    }
    await ctx.db.patch(user._id, patch);
  },
});

export const setAccountId = mutation({
  args: {
    userId: v.optional(v.string()),
    accountId: v.id("accounts"),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const user = await getUserRow(ctx, userId);
    if (!user) throw new Error("User not found");

    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== userId) {
      throw new Error("Account not found or does not belong to user");
    }

    await ctx.db.patch(user._id, { onboardingAccountId: args.accountId });
  },
});

export const setCategoryId = mutation({
  args: {
    userId: v.optional(v.string()),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const user = await getUserRow(ctx, userId);
    if (!user) throw new Error("User not found");

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== userId) {
      throw new Error("Category not found or does not belong to user");
    }

    await ctx.db.patch(user._id, { onboardingCategoryId: args.categoryId });
  },
});

export const complete = mutation({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const user = await getUserRow(ctx, userId);
    if (!user) throw new Error("User not found");
    if (user.onboardingStep === "done") return; // idempotent
    await ctx.db.patch(user._id, {
      onboardingStep: "done",
      onboardingCompletedAt: Date.now(),
    });
  },
});
