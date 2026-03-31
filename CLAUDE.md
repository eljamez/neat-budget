# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (run both simultaneously)
npx convex dev        # Terminal 1: Convex backend dev server (required)
npm run dev           # Terminal 2: Next.js frontend

# Build & lint
npm run build
npm run lint
```

There are no tests configured.

## Architecture

**SuperBudget** is a YNAB-style budgeting app. The stack is Next.js 14 (App Router) + Convex (backend/database) + Clerk (auth).

### Auth flow

Clerk handles auth. `src/middleware.ts` protects all routes except `/`, `/sign-in`, and `/sign-up`. The `ConvexClerkProvider` (`src/components/providers/ConvexClerkProvider.tsx`) wraps the app and bridges Clerk JWTs into Convex via a JWT template configured in the Clerk dashboard. Convex validates those JWTs via `convex/auth.config.ts` using `CLERK_JWT_ISSUER_DOMAIN`.

**Important**: Convex functions receive `userId` as a plain string argument (the Clerk user ID) — there is no server-side auth identity extraction in the current mutations/queries. All data isolation relies on passing and filtering by `userId`.

### Convex backend (`convex/`)

- `schema.ts` — defines three tables: `users`, `categories`, `transactions`
  - `transactions.date` is stored as ISO string `YYYY-MM-DD`; month filtering is done client-side via `String.startsWith("YYYY-MM")`
  - `categories` supports soft-delete via `isArchived`
- `transactions.ts` — CRUD + `getMonthlySpendingByCategory` which returns a `Record<categoryId, totalAmount>` map
- `categories.ts` / `users.ts` — standard CRUD

### Frontend (`src/`)

- `app/layout.tsx` — root layout wraps everything in `ConvexClerkProvider` + `Sidebar`
- Pages call Convex hooks directly (`useQuery`, `useMutation` from `convex/react`)
- `src/lib/utils.ts` — shared formatting and color helpers used across components

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
