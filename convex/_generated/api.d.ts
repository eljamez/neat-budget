/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountBalance from "../accountBalance.js";
import type * as accounts from "../accounts.js";
import type * as authUser from "../authUser.js";
import type * as autoFundMonth from "../autoFundMonth.js";
import type * as bucketMonthFundings from "../bucketMonthFundings.js";
import type * as buckets from "../buckets.js";
import type * as budgetItemMonthOverrides from "../budgetItemMonthOverrides.js";
import type * as budgetItems from "../budgetItems.js";
import type * as budgetScope from "../budgetScope.js";
import type * as budgets from "../budgets.js";
import type * as categories from "../categories.js";
import type * as creditCards from "../creditCards.js";
import type * as debtExpenses from "../debtExpenses.js";
import type * as debts from "../debts.js";
import type * as expenseAllocations from "../expenseAllocations.js";
import type * as groups from "../groups.js";
import type * as migrations from "../migrations.js";
import type * as onboarding from "../onboarding.js";
import type * as quickLinks from "../quickLinks.js";
import type * as testing from "../testing.js";
import type * as transactions from "../transactions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountBalance: typeof accountBalance;
  accounts: typeof accounts;
  authUser: typeof authUser;
  autoFundMonth: typeof autoFundMonth;
  bucketMonthFundings: typeof bucketMonthFundings;
  buckets: typeof buckets;
  budgetItemMonthOverrides: typeof budgetItemMonthOverrides;
  budgetItems: typeof budgetItems;
  budgetScope: typeof budgetScope;
  budgets: typeof budgets;
  categories: typeof categories;
  creditCards: typeof creditCards;
  debtExpenses: typeof debtExpenses;
  debts: typeof debts;
  expenseAllocations: typeof expenseAllocations;
  groups: typeof groups;
  migrations: typeof migrations;
  onboarding: typeof onboarding;
  quickLinks: typeof quickLinks;
  testing: typeof testing;
  transactions: typeof transactions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
