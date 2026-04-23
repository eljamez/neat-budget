import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** `credit_card` is legacy: kept so existing rows still validate. Use the `creditCards` table for cards. */
const debtTypeValidator = v.union(
  v.literal("credit_card"),
  v.literal("loan"),
  v.literal("personal"),
  v.literal("payment_plan"),
  v.literal("other")
);

const creditCardUsageModeValidator = v.union(
  v.literal("paying_off"),
  v.literal("active_use")
);

/** @deprecated Only used by the legacy `buckets` table. */
const bucketPeriodValidator = v.union(
  v.literal("weekly"),
  v.literal("biweekly"),
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("yearly")
);

const budgetExpenseStatusValidator = v.union(
  v.literal("unfunded"),
  v.literal("funded"),
  v.literal("paid")
);

export default defineSchema({
  budgets: defineTable({
    userId: v.string(),
    name: v.string(),
    isDefault: v.boolean(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
    onboardingStep: v.optional(v.union(
      v.literal("account"),
      v.literal("category"),
      v.literal("fund"),
      v.literal("transaction"),
      v.literal("done"),
    )),
    onboardingStartedAt: v.optional(v.number()),
    onboardingCompletedAt: v.optional(v.number()),
    onboardingAccountId: v.optional(v.id("accounts")),
    onboardingCategoryId: v.optional(v.id("categories")),
  }).index("by_clerk_id", ["clerkId"]),

  accounts: defineTable({
    userId: v.string(),
    budgetId: v.optional(v.id("budgets")),
    name: v.string(),
    /** For checking/savings/cash: cash on hand. For credit_card: amount owed. */
    balance: v.number(),
    accountType: v.union(
      v.literal("checking"),
      v.literal("savings"),
      v.literal("cash"),
      v.literal("credit_card"),
      v.literal("other")
    ),
    isArchived: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  /** Loans and non–credit-card debts; balance drops when you log a transaction with `debtId`. */
  debts: defineTable({
    userId: v.string(),
    budgetId: v.optional(v.id("budgets")),
    name: v.string(),
    balance: v.number(),
    originalLoanAmount: v.optional(v.number()),
    aprPercent: v.optional(v.number()),
    debtType: debtTypeValidator,
    creditor: v.optional(v.string()),
    purpose: v.optional(v.string()),
    notes: v.optional(v.string()),
    minimumPayment: v.optional(v.number()),
    dueDayOfMonth: v.optional(v.number()),
    plannedMonthlyPayment: v.optional(v.number()),
    creditLimit: v.optional(v.number()),
    isAutopay: v.optional(v.boolean()),
    markedPaidForMonth: v.optional(v.string()),
    fundedForMonth: v.optional(v.string()),
    paymentAccountId: v.optional(v.id("accounts")),
    color: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  creditCards: defineTable({
    userId: v.string(),
    budgetId: v.optional(v.id("budgets")),
    name: v.string(),
    balance: v.number(),
    aprPercent: v.optional(v.number()),
    creditor: v.optional(v.string()),
    purpose: v.optional(v.string()),
    notes: v.optional(v.string()),
    minimumPayment: v.optional(v.number()),
    dueDayOfMonth: v.optional(v.number()),
    plannedMonthlyPayment: v.optional(v.number()),
    creditLimit: v.optional(v.number()),
    isAutopay: v.optional(v.boolean()),
    markedPaidForMonth: v.optional(v.string()),
    fundedForMonth: v.optional(v.string()),
    usageMode: creditCardUsageModeValidator,
    paymentAccountId: v.optional(v.id("accounts")),
    color: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  /** Planned payment lines for a debt, each with a calendar due date. */
  debtExpenses: defineTable({
    userId: v.string(),
    budgetId: v.optional(v.id("budgets")),
    debtId: v.id("debts"),
    name: v.string(),
    amount: v.number(),
    dueDate: v.string(), // YYYY-MM-DD
    note: v.optional(v.string()),
    isPaid: v.optional(v.boolean()),
    paidAt: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  })
    .index("by_debt", ["debtId"])
    .index("by_user", ["userId"]),

  /**
   * Top-level budget containers (e.g. "Housing", "Food & Drink").
   * Previously called `categories`; categories are now the line items within each group.
   */
  groups: defineTable({
    userId: v.string(),
    budgetId: v.optional(v.id("budgets")),
    name: v.string(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_archived", ["userId", "isArchived"]),

  /**
   * Budget line items — each belongs to a group and carries an optional monthly spending target.
   * Merges the old `budgetItems` (recurring bills) and `buckets` (discretionary envelopes) concepts.
   *
   * Legacy rows in this table (without `groupId`) were the old top-level "category/group" documents.
   * New rows have `groupId` set.
   */
  categories: defineTable({
    userId: v.string(),
    budgetId: v.optional(v.id("budgets")),
    /** Set on new line-item rows; absent on legacy "group" rows. */
    groupId: v.optional(v.id("groups")),
    name: v.string(),
    /** Monthly spending target (optional). */
    monthlyTarget: v.optional(v.number()),
    /** Carry unused balance forward into the next month. */
    rollover: v.optional(v.boolean()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    note: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    dueDayOfMonth: v.optional(v.number()),
    paymentAccountId: v.optional(v.id("accounts")),
    markedPaidForMonth: v.optional(v.string()),
    fundedForMonth: v.optional(v.string()),
    isAutopay: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()),
    /** @deprecated Legacy field from old "category/group" rows. Use `monthlyTarget` on new rows. */
    monthlyLimit: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_group", ["groupId"])
    .index("by_user_archived", ["userId", "isArchived"]),

  transactions: defineTable({
    userId: v.string(),
    budgetId: v.optional(v.id("budgets")),
    /** Points to the `categories` line item for this transaction. */
    categoryId: v.optional(v.id("categories")),
    /** @deprecated Legacy — budgetItem transactions. Stop setting on new rows. */
    budgetItemId: v.optional(v.id("budgetItems")),
    amount: v.number(),
    description: v.string(),
    date: v.string(), // ISO date string YYYY-MM-DD
    note: v.optional(v.string()),
    accountId: v.optional(v.id("accounts")),
    debtId: v.optional(v.id("debts")),
    debtMarkedPaidMonthKey: v.optional(v.string()),
    creditCardId: v.optional(v.id("creditCards")),
    /** @deprecated Legacy — bucket transactions. Stop setting on new rows. */
    bucketId: v.optional(v.id("buckets")),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_category", ["categoryId"])
    .index("by_budget_item", ["budgetItemId"])
    .index("by_account", ["accountId"])
    .index("by_debt", ["debtId"])
    .index("by_credit_card", ["creditCardId"])
    .index("by_bucket", ["bucketId"]),

  /** @deprecated — replaced by the `categories` table (new line-item model). */
  bucketMonthFundings: defineTable({
    userId: v.string(),
    budgetId: v.optional(v.id("budgets")),
    bucketId: v.id("buckets"),
    /** @deprecated Legacy rows only. */
    accountId: v.optional(v.id("accounts")),
    amount: v.number(),
    monthKey: v.string(),
  })
    .index("by_user_month", ["userId", "monthKey"])
    .index("by_bucket_month", ["bucketId", "monthKey"]),

  /** @deprecated — replaced by the `categories` table (new line-item model). */
  expenseAllocations: defineTable({
    userId: v.string(),
    budgetId: v.optional(v.id("budgets")),
    budgetItemId: v.id("budgetItems"),
    /** @deprecated Legacy rows only. */
    accountId: v.optional(v.id("accounts")),
    amount: v.number(),
    monthKey: v.string(),
  })
    .index("by_user_month", ["userId", "monthKey"])
    .index("by_budget_month", ["budgetItemId", "monthKey"]),

  /** @deprecated — replaced by the `categories` table (new line-item model). */
  budgetItemMonthOverrides: defineTable({
    userId: v.string(),
    budgetId: v.optional(v.id("budgets")),
    budgetItemId: v.id("budgetItems"),
    monthKey: v.string(),
    actualPaidAmount: v.optional(v.number()),
  })
    .index("by_user_month", ["userId", "monthKey"])
    .index("by_budget_month", ["budgetItemId", "monthKey"]),

  /** @deprecated — replaced by the `categories` table (new line-item model). */
  buckets: defineTable({
    userId: v.string(),
    budgetId: v.optional(v.id("budgets")),
    name: v.string(),
    targetAmount: v.number(),
    period: bucketPeriodValidator,
    rollover: v.boolean(),
    categoryId: v.optional(v.id("categories")),
    monthlyFillGoal: v.optional(v.number()),
    paymentAccountId: v.optional(v.id("accounts")),
    color: v.optional(v.string()),
    note: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_category", ["categoryId"]),

  /** @deprecated — replaced by the `categories` table (new line-item model). */
  budgetItems: defineTable({
    userId: v.string(),
    budgetId: v.optional(v.id("budgets")),
    categoryId: v.id("categories"),
    name: v.string(),
    amount: v.number(),
    paymentDayOfMonth: v.number(),
    moneyNeededByDay: v.optional(v.number()),
    accountId: v.optional(v.id("accounts")),
    paidFrom: v.optional(v.string()),
    markedPaidForMonth: v.optional(v.string()),
    status: v.optional(budgetExpenseStatusValidator),
    fundedDate: v.optional(v.number()),
    paidDate: v.optional(v.number()),
    isAutopay: v.optional(v.boolean()),
    note: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_category", ["categoryId"]),

  /** User-defined shortcuts to bank and financial sites (opens in a new tab). */
  quickLinks: defineTable({
    userId: v.string(),
    label: v.string(),
    url: v.string(),
    sortOrder: v.number(),
    ogImageUrl: v.optional(v.string()),
    ogFetchedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),
});
