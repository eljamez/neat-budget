# Re-Audit Report (Post Parallel Fixes)

Date: 2026-04-09  
Based on: `docs/AUDIT_REPORT_2026-04-09.md`  
Verification run: `npm run lint`, `npm run build`

## Re-Audit Outcome

- Status: **Improved significantly**
- Lint: **Pass** (0 errors, 7 warnings)
- Build: **Pass**
- Critical/high issues fixed: **Most**
- Remaining priority issues: **Security architecture + a few consistency/perf items**

## Fixed Since Previous Audit

### Critical/High fixes confirmed

1. **Ownership checks added on previously vulnerable handlers**
   - `convex/categories.ts`: `update`, `archive` now verify ownership with `userId`.
   - `convex/budgetItems.ts`: `update`, `archive`, `setPaidForMonth` now verify ownership.

2. **Cross-tenant query hardening for transaction lookups**
   - `convex/transactions.ts`: `listByDebt`, `listByCreditCard`, `listByCategory`, `listByBudgetItem` now require `userId`, verify parent ownership, and filter by `userId`.
   - Frontend callsites updated accordingly.

3. **Transaction input validation hardened**
   - `convex/transactions.ts` now validates:
     - strict `YYYY-MM-DD` date format + calendar-valid date,
     - finite positive amount with upper cap (`<= 1_000_000`).

4. **Lint-blocking frontend defects fixed**
   - `src/app/add-transaction/page.tsx`: removed render-time `Math.random` impurity.
   - `src/app/categories/page.tsx`: refactored expansion state logic to avoid setState-in-effect lint issue.
   - `src/components/Sidebar.tsx`: removed route-change setState-in-effect lint issue.

5. **A11y/UX improvements shipped**
   - Reduced-motion handling added for transaction success animation.
   - Dashboard helper tooltips now support better ARIA wiring and click-toggle behavior.

6. **Medium/low consistency improvements**
   - Standardized archive/delete wording across major entity pages.
   - Shared accent fallback constants introduced in `src/lib/utils.ts` and used across key pages.
   - Mobile bottom safe-area spacing increased in `src/components/AppShell.tsx`.
   - README and landing copy updated to align with user flows.

## Remaining Issues (Open)

### High

1. **Auth architecture still trusts client-supplied `userId` broadly**
   - While many dangerous endpoints are now hardened, the system still generally depends on client `userId` instead of deriving identity from Convex auth context.
   - Recommendation: migrate to server-derived identity and treat request `userId` as untrusted or remove it.

2. **Some query performance paths still fetch wide sets then filter in memory**
   - Example pattern remains in monthly aggregations.
   - Recommendation: continue migrating month-scoped reads to indexed date range queries.

### Medium

3. **Warnings remain in lint output**
   - Generated files with unused eslint directives.
   - Minor unused vars in Convex files.
   - Anonymous default export warning in auth config.
   - Not blocking, but still technical debt.

4. **Tooltip/disclosure pattern improved but not yet on a shared primitive**
   - Current implementation is better, but a reusable accessible tooltip/disclosure component would reduce drift.

### Low

5. **Next.js middleware deprecation warning still present**
   - Build warns to migrate from `middleware` convention to `proxy`.

## Validation Snapshot

- `npm run lint`:
  - `✖ 7 problems (0 errors, 7 warnings)`
- `npm run build`:
  - successful production build
  - middleware deprecation warning remains

## Suggested Next Actions

1. Complete auth-context migration (remove trust on client `userId`).
2. Finish month query/index optimizations in remaining hotspots.
3. Clean remaining lint warnings + middleware deprecation.
4. Add automated regression tests for user-flow-critical mutations and balance integrity.
