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

/** Discretionary envelope periods (groceries, fun money, etc.). */
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
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  accounts: defineTable({
    userId: v.string(),
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
    name: v.string(),
    /** Current amount owed. */
    balance: v.number(),
    /** Annual interest rate (e.g. 19.99 = 19.99% APR). */
    aprPercent: v.optional(v.number()),
    debtType: debtTypeValidator,
    creditor: v.optional(v.string()),
    purpose: v.optional(v.string()),
    notes: v.optional(v.string()),
    /** Typical minimum due each month (informational). */
    minimumPayment: v.optional(v.number()),
    /** Day of month statement or payment is usually due (1–31). */
    dueDayOfMonth: v.optional(v.number()),
    /** Amount you plan to pay toward this debt per month (budget planning). */
    plannedMonthlyPayment: v.optional(v.number()),
    /** Legacy; credit cards use the `creditCards` table. */
    creditLimit: v.optional(v.number()),
    /** Whether the typical payment is set to auto-pay with the lender. */
    isAutopay: v.optional(v.boolean()),
    /** When set to `YYYY-MM`, the planned monthly payment was marked paid for that month. */
    markedPaidForMonth: v.optional(v.string()),
    /** Checking/savings/cash you pay this debt from (for planning & transactions). */
    paymentAccountId: v.optional(v.id("accounts")),
    color: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  /**
   * Credit cards (separate from installment debts). Balance drops on payments linked via `creditCardId`.
   * `usageMode`: paying off vs actively charging day-to-day bills.
   */
  creditCards: defineTable({
    userId: v.string(),
    name: v.string(),
    /** Current balance owed. */
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
    usageMode: creditCardUsageModeValidator,
    /** Account you pay the card bill from (checking, etc.). */
    paymentAccountId: v.optional(v.id("accounts")),
    color: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  /** Planned payment lines for a debt, each with a calendar due date. */
  debtExpenses: defineTable({
    userId: v.string(),
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

  categories: defineTable({
    userId: v.string(),
    name: v.string(),
    monthlyLimit: v.optional(v.number()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_archived", ["userId", "isArchived"]),

  transactions: defineTable({
    userId: v.string(),
    /** Copied from the budget item when `budgetItemId` is set; omitted for debt/card-only amounts. */
    categoryId: v.optional(v.id("categories")),
    /** When set, this payment counts toward that recurring budget expense for the transaction month. */
    budgetItemId: v.optional(v.id("budgetItems")),
    amount: v.number(),
    description: v.string(),
    date: v.string(), // ISO date string YYYY-MM-DD
    note: v.optional(v.string()),
    /** When set, spending adjusts this account's balance. */
    accountId: v.optional(v.id("accounts")),
    /** When set, this payment reduces the linked debt's balance. */
    debtId: v.optional(v.id("debts")),
    /** When set, this payment reduces the linked credit card balance. */
    creditCardId: v.optional(v.id("creditCards")),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_category", ["categoryId"])
    .index("by_budget_item", ["budgetItemId"])
    .index("by_account", ["accountId"])
    .index("by_debt", ["debtId"])
    .index("by_credit_card", ["creditCardId"]),

  /**
   * Cash set aside from an account toward a **monthly** discretionary bucket for `monthKey`.
   * Separate from category spend tracking — this is envelope-style “funded for the month”.
   */
  bucketMonthFundings: defineTable({
    userId: v.string(),
    bucketId: v.id("buckets"),
    accountId: v.id("accounts"),
    amount: v.number(),
    monthKey: v.string(),
  })
    .index("by_user_month", ["userId", "monthKey"])
    .index("by_bucket_month", ["bucketId", "monthKey"]),

  /**
   * Cash set aside from an account toward a recurring budget expense for a calendar month.
   * Does not move money in the real world — planning only. `monthKey` is `YYYY-MM`.
   */
  expenseAllocations: defineTable({
    userId: v.string(),
    budgetItemId: v.id("budgetItems"),
    accountId: v.id("accounts"),
    amount: v.number(),
    monthKey: v.string(),
  })
    .index("by_user_month", ["userId", "monthKey"])
    .index("by_budget_month", ["budgetItemId", "monthKey"]),

  /**
   * Discretionary spending targets (not fixed bills). Spending is tracked vs `targetAmount`
   * over `period`; `rollover` can carry unused allowance forward (enforced in app logic).
   */
  buckets: defineTable({
    userId: v.string(),
    name: v.string(),
    targetAmount: v.number(),
    period: bucketPeriodValidator,
    rollover: v.boolean(),
    /** When set, associate this bucket with a budget category (same ownership as user). */
    categoryId: v.optional(v.id("categories")),
    /**
     * For monthly buckets: max cash to earmark per calendar month for this envelope.
     * If unset, month funding is capped at `targetAmount`.
     */
    monthlyFillGoal: v.optional(v.number()),
    /** Default account when funding this bucket (can override in the funding modal). */
    paymentAccountId: v.optional(v.id("accounts")),
    color: v.optional(v.string()),
    note: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_category", ["categoryId"]),

  budgetItems: defineTable({
    userId: v.string(),
    categoryId: v.id("categories"),
    name: v.string(),
    amount: v.number(), // expected monthly amount
    /** Day of month the bill is due (1–31). */
    paymentDayOfMonth: v.number(),
    /** Legacy; do not set. Cleared by `stripLegacyMoneyNeededByDay` / omitted on new rows. */
    moneyNeededByDay: v.optional(v.number()),
    /** Account this expense is paid from (checking, cash, etc.). */
    accountId: v.optional(v.id("accounts")),
    /** Legacy free-text paid-from (prefer `accountId`). */
    paidFrom: v.optional(v.string()),
    /** When set to `YYYY-MM`, this expense was marked paid for that calendar month. */
    markedPaidForMonth: v.optional(v.string()),
    /** Lifecycle: unfunded → funded (money reserved from fundedDate) → paid for markedPaidForMonth. */
    status: v.optional(budgetExpenseStatusValidator),
    /** When the expense was funded (ms); available balance counts this from this calendar day (UTC) onward. */
    fundedDate: v.optional(v.number()),
    /** When marked paid (ms), informational. */
    paidDate: v.optional(v.number()),
    /** Payment is on auto-pay with the payee (informational). */
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
    /** Cached Open Graph / social share image for card backgrounds. */
    ogImageUrl: v.optional(v.string()),
    /** When set, the client has already tried fetching preview metadata once. */
    ogFetchedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),
});
