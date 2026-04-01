# Neat Budget

A YNAB/Mint-style personal budgeting app built with Next.js 14, Convex, and Clerk.

## Features

- **Budget Categories** — Create categories with monthly limits (Groceries, Rent, etc.)
- **Transaction Logging** — Record spending with descriptions, amounts, and dates
- **Real-time Dashboard** — See budget utilization instantly, per category
- **Overspend Alerts** — Visual warnings when you exceed category limits
- **Month Navigation** — Browse spending history by month
- **Secure Auth** — Each user's data is fully isolated via Clerk + Convex

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Database | Convex (real-time, reactive) |
| Auth | Clerk |
| State | React hooks + Convex queries |

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
│   │   ├── dashboard/       # Main budget overview
│   │   ├── categories/      # Manage budget categories
│   │   ├── add-transaction/ # Log spending
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
| `/dashboard` | Budget overview, spending summary, recent transactions |
| `/categories` | Create, edit, and archive budget categories |
| `/add-transaction` | Log a new spending transaction |
| `/sign-in` | Clerk sign-in |
| `/sign-up` | Clerk sign-up |
