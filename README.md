# Neat Budget

A YNAB/Mint-style personal budgeting app built with Next.js 14, Convex, and Clerk.

## Features

- **Categories + recurring expenses** — Organize budget groups and define recurring bills with expected monthly amount + due day
- **Buckets (envelopes)** — Track discretionary targets by period, optional rollover, and monthly fill caps
- **Debts and credit cards** — Plan monthly paydown/payment separately for loans vs revolving balances
- **Month-based funding workflow** — Use the dashboard timeline to fund bills/buckets and mark items paid for a selected month
- **Transaction logging** — Record spending and payments to update balances/history
- **Secure Auth** — Each user's data is isolated via Clerk + Convex

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Database | Convex (real-time, reactive) |
| Auth | Clerk |
| State | React hooks + Convex queries |

## Architecture

Convex handlers use Clerk-backed identity resolution; see [docs/AUTH_PATTERN.md](docs/AUTH_PATTERN.md) for the `getEffectiveUserId` pattern and migration checklist.

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd app
npm install
```

### 2. Set up Convex

```bash
npx convex dev
```

Follow prompts to create a Convex project. Copy the `NEXT_PUBLIC_CONVEX_URL` from the output.

### 3. Set up Clerk

1. Create an account at [clerk.com](https://clerk.com)
2. Create a new application
3. Copy your `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`

In Clerk dashboard under **JWT Templates**, create a new **Convex** template. Copy the **Issuer URL**.

### 4. Configure Convex + Clerk JWT

Set the issuer domain in your Convex environment:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-instance.clerk.accounts.dev
```

### 5. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in your values:

```env
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

### 6. Run the app

```bash
# Terminal 1: Convex dev server
npx convex dev

# Terminal 2: Next.js
npm run dev
```

Open http://localhost:3000

## Project Structure

```
app/
├── convex/                  # Backend (Convex)
│   ├── schema.ts            # Database schema
│   ├── users.ts             # User mutations/queries
│   ├── categories.ts        # Budget category CRUD
│   ├── transactions.ts      # Transaction CRUD + aggregation
│   └── auth.config.ts       # Clerk JWT config
├── src/
│   ├── app/
│   │   ├── dashboard/       # Month picker, funding workflow, timeline
│   │   ├── categories/      # Categories + recurring expenses
│   │   ├── buckets/         # Envelope buckets and targets
│   │   ├── debts/           # Loan/installment planning
│   │   ├── credit-cards/    # Revolving card planning
│   │   ├── accounts/        # Cash and account balances
│   │   ├── add-transaction/ # Log spending and payments
│   │   ├── sign-in/         # Clerk sign-in
│   │   └── sign-up/         # Clerk sign-up
│   ├── components/
│   │   ├── BudgetCard.tsx       # Category budget card with progress
│   │   ├── TransactionForm.tsx  # Add spending form
│   │   ├── CategoryManager.tsx  # Create/edit categories
│   │   ├── Navbar.tsx           # Navigation bar
│   │   └── providers/
│   │       └── ConvexClerkProvider.tsx
│   ├── lib/
│   │   └── utils.ts         # Formatting & color helpers
│   └── middleware.ts        # Route protection (Clerk)
```

## Pages

| Route | Description |
|---|---|
| `/` | Landing page (redirects to dashboard if signed in) |
| `/dashboard` | Month view, funding, timeline, spending summary, recent transactions |
| `/categories` | Categories and recurring expense templates |
| `/buckets` | Bucket targets, periods, rollover, and links to categories |
| `/debts` | Loans/installment debts with planned monthly paydown |
| `/credit-cards` | Revolving cards with planned monthly payments |
| `/accounts` | Cash/account balances used for budget funding context |
| `/add-transaction` | Log a spending/payment transaction |
| `/sign-in` | Clerk sign-in |
| `/sign-up` | Clerk sign-up |
