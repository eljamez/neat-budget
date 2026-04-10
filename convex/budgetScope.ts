import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

async function readUserBudgets(ctx: Ctx, userId: string) {
  return await ctx.db
    .query("budgets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

function pickActiveBudgetId(budgets: Array<{ _id: Id<"budgets">; isActive: boolean }>) {
  return budgets.find((b) => b.isActive)?._id ?? null;
}

export async function getEffectiveBudgetIdForQuery(
  ctx: QueryCtx,
  userId: string
): Promise<Id<"budgets"> | null> {
  const budgets = await readUserBudgets(ctx, userId);
  return pickActiveBudgetId(budgets);
}

export async function getEffectiveBudgetIdForMutation(
  ctx: MutationCtx,
  userId: string
): Promise<Id<"budgets">> {
  const budgets = await readUserBudgets(ctx, userId);
  const active = pickActiveBudgetId(budgets);
  if (active) {
    return active;
  }

  const now = Date.now();
  return await ctx.db.insert("budgets", {
    userId,
    name: "My Budget",
    isDefault: true,
    isActive: true,
    createdAt: now,
  });
}
