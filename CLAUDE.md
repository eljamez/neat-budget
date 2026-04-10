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

**Neat Budget** is a YNAB-style budgeting app. The stack is Next.js 14 (App Router) + Convex (backend/database) + Clerk (auth).

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
