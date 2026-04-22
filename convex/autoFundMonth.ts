import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getEffectiveUserId } from "./authUser";
import { getEffectiveBudgetIdForMutation } from "./budgetScope";

/**
 * Marks all unfunded categories, debts, and credit cards as funded for the given month.
 * "Funded" means setting fundedForMonth = monthKey on each document.
 */
export const run = mutation({
  args: { userId: v.optional(v.string()), monthKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);
    const budgetId = await getEffectiveBudgetIdForMutation(ctx, userId);
    const { monthKey } = args;
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      throw new Error("Invalid month");
    }

    let categoriesFunded = 0;
    let debtsFunded = 0;
    let cardsFunded = 0;

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .filter((q) => q.eq(q.field("budgetId"), budgetId))
      .filter((q) => q.neq(q.field("groupId"), undefined))
      .collect();

    for (const cat of categories) {
      if (cat.fundedForMonth === monthKey) continue;
      if (!cat.monthlyTarget || cat.monthlyTarget <= 0) continue;
      await ctx.db.patch(cat._id, { fundedForMonth: monthKey });
      categoriesFunded++;
    }

    const debts = await ctx.db
      .query("debts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .filter((q) => q.eq(q.field("budgetId"), budgetId))
      .collect();

    for (const debt of debts) {
      if (debt.fundedForMonth === monthKey) continue;
      const amount = debt.plannedMonthlyPayment ?? debt.minimumPayment ?? 0;
      if (amount <= 0) continue;
      await ctx.db.patch(debt._id, { fundedForMonth: monthKey });
      debtsFunded++;
    }

    const cards = await ctx.db
      .query("creditCards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .filter((q) => q.eq(q.field("budgetId"), budgetId))
      .collect();

    for (const card of cards) {
      if (card.fundedForMonth === monthKey) continue;
      const amount = card.plannedMonthlyPayment ?? card.minimumPayment ?? 0;
      if (amount <= 0) continue;
      await ctx.db.patch(card._id, { fundedForMonth: monthKey });
      cardsFunded++;
    }

    return { categoriesFunded, debtsFunded, cardsFunded };
  },
});
