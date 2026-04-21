# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Shared agent rules (Cursor + Claude + others)

- **`.cursor/rules/*.mdc`** — Stack, auth, Convex, and frontend conventions. Cursor loads these automatically; **follow them for implementation** in this repo even when using Claude Code. They use YAML frontmatter (`description`, `alwaysApply`, `globs`) plus Markdown.
- **`AGENTS.md`** — Short index of where rules live so nothing is "Cursor-only" or "Claude-only" by accident.
- **Product / UX voice and visual design** — This file (`CLAUDE.md`) remains the longer reference for brand personality and design principles.
- If instructions conflict, prefer **`.cursor/rules`** for code/stack patterns and **this file** for product and UX tone unless a rule explicitly says otherwise.

## Commands

```bash
# Development (run both simultaneously)
npx convex dev        # Terminal 1: Convex backend dev server (required)
npm run dev           # Terminal 2: Next.js frontend (port 3005)
# or: npm run dev:all  # both Convex + Next in one terminal

# Build & lint
npm run build
npm run lint
```

There are no tests configured.

## Architecture

**Neat Budget** is a YNAB-style budgeting app. The stack is Next.js (App Router) + Convex (backend/database) + Clerk (auth).

### Auth flow

Clerk handles auth. **`src/proxy.ts`** uses `clerkMiddleware` and protects all routes except `/`, `/sign-in`, and `/sign-up`. The `ConvexClerkProvider` (`src/components/providers/ConvexClerkProvider.tsx`) wraps the app and bridges Clerk JWTs into Convex via a JWT template configured in the Clerk dashboard. Convex validates those JWTs via `convex/auth.config.ts` using `CLERK_JWT_ISSUER_DOMAIN`.

**Important**: Convex functions receive `userId` as a plain string argument (the Clerk user ID) — there is no server-side auth identity extraction in the current mutations/queries. All data isolation relies on passing and filtering by `userId` (and budget scoping where applicable).

### Core budgeting model: Groups → Categories

The fundamental building block is the **category**. Everything the user wants to track — groceries, rent, streaming subscriptions, car insurance — is a category. Categories are funded monthly: you set a target, spend against it, and at month-end the cycle resets (or rolls over if rollover is enabled).

**Groups** are organizational containers for categories. Every category belongs to exactly one group. The default group is called **Expenses** and is created automatically for new users. Categories can be moved between groups at any time.

Key category properties:
- `monthlyTarget` — how much to fund per month (optional)
- `rollover` — when true, unspent balance carries forward to next month
- `dueDayOfMonth` — optional; if set, the category appears as a date-anchored row on the timeline (e.g. rent due on the 1st)
- `paymentAccountId` — optional bank account this category is typically paid from
- `isAutopay` — flag for payments that are auto-drafted
- `markedPaidForMonth` — stores the month key (`YYYY-MM`) when the user marks the category as paid
- `isArchived` — soft-delete; archived categories are hidden from all active views

**What is NOT a separate concept anymore**: "Buckets" and "budget items" were prior names for spending slots. They are gone. Categories replace both.

### Convex backend (`convex/`)

- `schema.ts` — defines all tables. **This is the source of truth** for fields and indexes.
- `groups.ts` — CRUD for groups (list, create, update, archive)
- `categories.ts` — CRUD + `getMonthlyProgress` (returns categories with spent/target/remaining for a given month)
- `transactions.ts` — spending records; each transaction links to a `categoryId`, `debtId`, or `creditCardId` as the payee
- `accounts.ts` — bank/cash accounts with running balances
- `debts.ts` / `creditCards.ts` — loan and card tracking; both appear on the timeline like categories with due days
- `migrations.ts` — idempotent one-time migration that converts legacy `budgetItems` + `buckets` rows to the new `categories` model
- Dates use ISO `YYYY-MM-DD`; month filtering uses `String.startsWith("YYYY-MM")` client-side

### Frontend (`src/`)

- `app/layout.tsx` — root layout: `ConvexClerkProvider` + `Sidebar`
- `app/dashboard/page.tsx` — main view: full-width expense timeline + category spending section
- `app/categories/page.tsx` — Budget page: groups with categories, monthly targets, spending progress; month selector
- Pages call Convex hooks directly (`useQuery`, `useMutation` from `convex/react`)
- `src/lib/utils.ts` — shared formatting and color helpers
- `src/lib/planner.ts` — `PlannerRow` union type (`budget | debt | cc | category`) drives the timeline
- `src/components/ExpenseTimeline.tsx` — renders the date-organized payment timeline; category rows with due days appear here alongside debts and credit cards
- `src/components/CategoryEditModal.tsx` — reusable modal for creating/editing a category; fetches groups and accounts internally
- `src/components/DebtManager.tsx` — form for creating/editing debts; used from both the Debts page and the timeline edit flow
- `src/components/TransactionForm.tsx` — quick-add transaction form; payee is a category, debt, or credit card

### Environment variables required

```
NEXT_PUBLIC_CONVEX_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
# Set in Convex dashboard (not .env):
CLERK_JWT_ISSUER_DOMAIN
```

## Design Context

### Users
Personal household budgeting — primarily one or two people (couple/partners) sharing the same budget view. Users check in on mobile throughout the day (quick transaction entry, balance checks) and do deeper planning sessions on desktop. The experience must feel equally native on both. A future multi-budget feature is planned but not in scope yet.

### Brand Personality
**Three words**: Warm, organized, encouraging.

Money management doesn't have to feel like a trip to the bank. Neat Budget should feel like a thoughtful friend helping you stay on top of things — never sterile, never alarming, always clear. When things are going well, the UI should quietly celebrate that. When something needs attention, it should surface it gently, not anxiously.

### Aesthetic Direction
- **Light**: Soft warm-white background (not pure white), slate/charcoal text, teal as the primary accent
- **Dark**: Deep slate with the same teal accent — not neon, not glowing
- **Typography**: Something with personality — not Geist as the only face; consider a humanist or rounded sans for headings, with Geist or a clean geometric for body/data
- **Color**: Teal (#0d9488) is the established brand color — keep it. Neutrals should be subtly warm, not cold blue-gray
- **Anti-pattern**: No sterile bank-app aesthetic. No corporate blues. No heavy form-heavy interfaces. No hero metric cards with gradient accents.
- **Reference feel**: Closer to a well-designed personal journaling or notes app than a fintech dashboard

### Design Principles
1. **Calm clarity** — Every screen should feel easy to scan. Data is organized, not crowded. Breathing room is a feature.
2. **Mobile-equal, not mobile-reduced** — Mobile gets full functionality adapted for thumb-first use, not a stripped-down view.
3. **Encouragement over alarm** — Positive states are visually rewarded. Negative states are surfaced gently with clear next actions.
4. **Shared without feeling shared** — When two users interact with the same data, the UI should feel personal to each, not like a shared spreadsheet.
5. **Warmth in the details** — Micro-interactions, empty states, and confirmations should have personality. Not corporate, not cutesy — just human.
