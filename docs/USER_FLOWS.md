# User flows: recurring expenses, buckets, debts, and credit cards

This document describes how the main budget entities relate to each other and what “per month” means for each. Use it for marketing copy, onboarding, and keeping README/CLAUDE in sync with the product.

## Mental model

- **Categories** are budget groups (e.g. Housing, Food). They organize **recurring expenses** and can link to **buckets**. A category’s “planned” total on the dashboard is the **sum of those expenses’ expected monthly amounts**, not a separate limit you set on the category alone.
- **Accounts** represent cash or card balances. Funding and payments are **planning** in the app unless you also **log transactions** that move balances.
- The **dashboard** (month picker, timeline, funding) is where month-specific actions happen: fund bills, fund buckets, mark items paid, etc.

---

## Recurring expenses (`budgetItems`)

**Where:** Categories page — add expenses inside each category.

**What they are:** Fixed or recurring bills (rent, subscriptions, utilities) with:

| Field | Role |
|--------|------|
| **Expected amount** | Default **planned cost per calendar month** for that line item. |
| **Due (day of month)** | When the bill is treated as due on the timeline. |
| **Paid from account** | Which checking/savings/cash account usually pays it (optional). |

**“Per month” here:** The expected amount is the **template** for every month. On the timeline, you can still **fund a specific month** (cash set aside toward that bill) and record **actual paid** amounts when they differ — those are month overrides, not changes to the recurring template.

---

## Buckets (`buckets`)

**Where:** Buckets page to create/edit; dashboard to **fund** them per month.

**What they are:** **Discretionary envelopes** (groceries, fun money, etc.) — not the same as recurring bills.

| Field | Role |
|--------|------|
| **Target amount** | Spending **goal for the chosen period** (weekly / monthly / …). Progress is tracked against this. |
| **Period** | How often the target resets (weekly, biweekly, monthly, quarterly, yearly). |
| **Rollover** | Whether unused allowance can carry forward (enforced in app logic). |
| **Monthly fill cap** (monthly buckets only) | **Max cash you plan to move into this envelope each calendar month** from accounts. If unset, the cap defaults to the target amount. Can differ from the spending target (e.g. high target, lower monthly top-up). |
| **Linked category** (optional) | Associates spending in that category with this bucket. |

**“Per month” here:** For monthly buckets, **monthly fill cap** is the budgeted **contribution** per month; **target** is how much you aim to have available to spend over the period. Funding happens on the dashboard by month.

---

## Debts (`debts`)

**Where:** Debts page.

**What they are:** **Loans and installment-style balances** (not revolving credit cards — those use **Credit cards**).

| Field | Role |
|--------|------|
| **Balance** | Amount currently owed. |
| **Planned monthly paydown** (optional, for some debt types) | How much you **plan** to put toward this debt each month for planning and the timeline. |
| **Minimum payment / month** | For loan-like types, this can double as the **planned** amount on the timeline (see in-app copy when creating the debt). |
| **Due day, payment account, APR, etc.** | Planning and display; **logging a payment** (transaction linked to this debt) reduces balance. |

**“Per month” here:** **Planned monthly payment** (or the loan-style minimum field when used as the plan) is a **budget line**, not an automatic bank transfer. Marking paid / recording payments is a separate step.

---

## Credit cards (`creditCards`)

**Where:** Credit cards page.

**What they are:** **Revolving** balances, separate from the Debts table.

| Field | Role |
|--------|------|
| **Balance** | Current amount owed on the card. |
| **Usage mode** | e.g. paying off vs active use (affects how the app treats the card in planning). |
| **Planned monthly payment** (optional) | Amount you **plan** to pay toward the card each month (paydown or toward the statement). |
| **Minimum, due day, payment account** | Same general idea as debts — informational/planning; **transactions** linked to the card update the balance. |

**“Per month” here:** Same as debts: a **planning** figure for the timeline and summaries, not automatic payment execution.

---

## How this ties to the home / marketing page

Today the public landing page emphasizes **categories and monthly limits** and **transaction logging**. It does **not** yet explain:

- Recurring **expenses** under categories (expected monthly amount + due day).
- **Buckets** (targets, periods, optional monthly fill cap, dashboard funding).
- **Debts vs credit cards** and **planned monthly payment** for each.
- That **funding** month-by-month on the dashboard is separate from setting the recurring template.

Pull short paragraphs from the sections above when updating `src/app/page.tsx` feature copy so prospects see the full story.

---

## Related routes (for maintainers)

| Route | Purpose |
|--------|---------|
| `/categories` | Categories + recurring expenses |
| `/buckets` | Bucket definitions |
| `/debts` | Loans / installment debts |
| `/credit-cards` | Revolving cards |
| `/accounts` | Cash and account balances |
| `/dashboard` | Month view, funding, timeline, cards & loans in context |
| `/add-transaction` | Log spending and payments |

---

## Tests

There are **no automated tests** configured for these flows; changes to Convex mutations or dashboard math are easy to regress. Consider at least high-level tests or manual QA scripts keyed off this document.
