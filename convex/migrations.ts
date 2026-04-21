import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getEffectiveUserId } from "./authUser";

/**
 * One-time migration from the old three-concept model (categories/budgetItems/buckets)
 * to the new two-level model (groups → categories).
 *
 * Idempotent: checks for existing data before inserting.
 *
 * Steps:
 * 1. Old `categories` rows (now conceptually "groups") → new `groups` table
 * 2. Old `budgetItems` rows → new `categories` rows (with groupId from step 1)
 * 3. Old `buckets` rows → new `categories` rows (with groupId if bucket had a categoryId)
 * 4. Old transactions with `budgetItemId` but no new-style `categoryId` → update categoryId
 */
export const migrateToGroupsAndCategories = mutation({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx, args.userId);

    // Determine active budgetId
    const budgets = await ctx.db
      .query("budgets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const activeBudget = budgets.find((b) => b.isActive) ?? budgets[0] ?? null;
    const budgetId = activeBudget?._id;

    // --- Step 1: migrate old categories → groups ---
    const oldCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("groupId"), undefined))
      .collect();

    // Map: old categoryId → new groupId
    const categoryToGroupId = new Map<string, Id<"groups">>();

    // Check for existing groups to avoid duplicates
    const existingGroups = await ctx.db
      .query("groups")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Store existing groups by name for deduplication
    const existingGroupsByName = new Map(existingGroups.map((g) => [g.name, g._id]));

    let groupsCreated = 0;
    for (const oldCat of oldCategories) {
      let groupId = existingGroupsByName.get(oldCat.name);
      if (!groupId) {
        groupId = await ctx.db.insert("groups", {
          userId,
          budgetId: oldCat.budgetId ?? budgetId,
          name: oldCat.name,
          color: oldCat.color,
          icon: oldCat.icon,
          isArchived: oldCat.isArchived,
        });
        existingGroupsByName.set(oldCat.name, groupId);
        groupsCreated++;
      }
      categoryToGroupId.set(oldCat._id as string, groupId);
    }

    // --- Step 2: migrate old budgetItems → new categories ---
    const oldBudgetItems = await ctx.db
      .query("budgetItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Map: old budgetItemId → new categoryId (for transaction updates)
    const budgetItemToNewCategoryId = new Map<string, Id<"categories">>();

    // Check existing new-style categories to avoid duplicates
    const existingNewCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("groupId"), undefined))
      .collect();

    const existingNewCategoryNames = new Set(existingNewCategories.map((c) => `${c.groupId}:${c.name}`));

    let budgetItemCategoriesCreated = 0;
    for (const item of oldBudgetItems) {
      const groupId = categoryToGroupId.get(item.categoryId as string);
      if (!groupId) continue; // skip if no matching group

      const dedupeKey = `${groupId}:${item.name}`;
      if (existingNewCategoryNames.has(dedupeKey)) {
        // Find existing and map
        const existing = existingNewCategories.find(
          (c) => c.groupId === groupId && c.name === item.name
        );
        if (existing) {
          budgetItemToNewCategoryId.set(item._id as string, existing._id);
        }
        continue;
      }

      const newCatId = await ctx.db.insert("categories", {
        userId,
        budgetId: item.budgetId ?? budgetId,
        groupId,
        name: item.name,
        monthlyTarget: item.amount,
        rollover: false,
        color: undefined,
        icon: undefined,
        note: item.note,
        isArchived: item.isArchived,
      });
      budgetItemToNewCategoryId.set(item._id as string, newCatId);
      existingNewCategoryNames.add(dedupeKey);
      budgetItemCategoriesCreated++;
    }

    // --- Step 3: migrate old buckets → new categories ---
    const oldBuckets = await ctx.db
      .query("buckets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Ensure "Uncategorized" group exists for buckets without a categoryId
    let uncategorizedGroupId: Id<"groups"> | null = null;
    const getOrCreateUncategorized = async () => {
      if (uncategorizedGroupId) return uncategorizedGroupId;
      let gid = existingGroupsByName.get("Uncategorized");
      if (!gid) {
        gid = await ctx.db.insert("groups", {
          userId,
          budgetId,
          name: "Uncategorized",
          isArchived: false,
        });
        existingGroupsByName.set("Uncategorized", gid);
        groupsCreated++;
      }
      uncategorizedGroupId = gid;
      return gid;
    };

    let bucketCategoriesCreated = 0;
    for (const bucket of oldBuckets) {
      const groupId =
        bucket.categoryId
          ? categoryToGroupId.get(bucket.categoryId as string) ?? await getOrCreateUncategorized()
          : await getOrCreateUncategorized();

      const dedupeKey = `${groupId}:${bucket.name}`;
      if (existingNewCategoryNames.has(dedupeKey)) continue;

      await ctx.db.insert("categories", {
        userId,
        budgetId: bucket.budgetId ?? budgetId,
        groupId,
        name: bucket.name,
        monthlyTarget: bucket.targetAmount,
        rollover: bucket.rollover,
        color: bucket.color,
        icon: undefined,
        note: bucket.note,
        isArchived: bucket.isArchived,
      });
      existingNewCategoryNames.add(dedupeKey);
      bucketCategoriesCreated++;
    }

    // --- Step 4: update transactions with budgetItemId to new categoryId ---
    const allTxs = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let transactionsUpdated = 0;
    for (const tx of allTxs) {
      if (!tx.budgetItemId) continue;
      const newCatId = budgetItemToNewCategoryId.get(tx.budgetItemId as string);
      if (!newCatId) continue;
      // Only update if the transaction doesn't already have a new-style categoryId
      // (A new-style category has a groupId; old-style categories don't)
      if (tx.categoryId) {
        const cat = await ctx.db.get(tx.categoryId);
        if (cat && cat.groupId) continue; // already points to a new-style category
      }
      await ctx.db.patch(tx._id, { categoryId: newCatId });
      transactionsUpdated++;
    }

    return {
      groupsCreated,
      budgetItemCategoriesCreated,
      bucketCategoriesCreated,
      transactionsUpdated,
    };
  },
});
