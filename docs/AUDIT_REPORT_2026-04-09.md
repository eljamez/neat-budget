# Neat Budget Audit Report (User-Flow Based)

Date: 2026-04-09  
Scope: `/dashboard`, `/categories`, `/buckets`, `/debts`, `/credit-cards`, `/accounts`, `/add-transaction` and related Convex functions.

## Anti-Patterns Verdict

**Verdict: Partial fail (likely AI-generated in multiple places).**

Specific tells:
- Repeated "safe card grid" layouts across many pages (`accounts`, `buckets`, `debts`, `credit-cards`, `dashboard`) with similar icon + title + metric pattern.
- Heavy reliance on hard-coded Tailwind color values and inline hexes instead of design tokens (`#0d9488`, `#4f46e5`, etc.) across routes/components.
- Decorative/confetti animation in `add-transaction` implemented with random render-time values (also causes lint failures).

## Executive Summary

- Total issues: **18**
  - **Critical:** 5
  - **High:** 6
  - **Medium:** 5
  - **Low:** 2
- Most critical:
  1. Cross-user mutation risk in several Convex functions that patch/delete by record ID without validating ownership.
  2. API trust model relies on client-supplied `userId` instead of server identity checks.
  3. Archived entities can still be queried via some indexed lookups and displayed in linked transaction flows.
  4. Lint currently fails (9 errors), blocking CI reliability and masking regressions.
  5. Paid/funding state can drift due to overlapping pathways and partial month overrides.
- Overall quality score: **6.3/10**
- Recommended next steps: fix critical backend authorization/data integrity first, then lint blockers, then a11y/theming/responsive polish.

## Detailed Findings by Severity

### Critical Issues

1) **Location:** `convex/categories.ts` (`update`, `archive`) and `convex/budgetItems.ts` (`update`, `archive`, `setPaidForMonth`)  
**Severity:** Critical  
**Category:** Accessibility / Performance / Theming / Responsive (N/A), **Security/Data integrity**  
**Description:** Mutations can patch/archive by `id` without asserting caller owns the document.  
**Impact:** If an ID is guessed/leaked, users can modify/archive other users' records.  
**WCAG/Standard:** OWASP ASVS V4.0.3 (access control), IDOR prevention  
**Recommendation:** Require `userId` (or authenticated identity) and verify ownership (`doc.userId === caller`).  
**Suggested command:** `/harden`

2) **Location:** `convex/transactions.ts` (`listByDebt`, `listByCreditCard`, `listByCategory`, `listByBudgetItem`)  
**Severity:** Critical  
**Category:** Security/Data exposure  
**Description:** Queries return records by foreign key only, with no explicit user ownership check.  
**Impact:** Potential read exposure across tenants if IDs are discovered.  
**WCAG/Standard:** OWASP ASVS access control requirements  
**Recommendation:** Add `userId` arg and enforce ownership checks on parent entity + row-level filter.  
**Suggested command:** `/harden`

3) **Location:** all Convex handlers taking `userId` from client (`categories`, `accounts`, `transactions`, `debts`, `creditCards`, etc.)  
**Severity:** Critical  
**Category:** Security architecture  
**Description:** Authorization depends on user-supplied `userId` argument.  
**Impact:** Trust boundary is weak; future endpoint mistakes become high-risk multi-tenant leaks.  
**WCAG/Standard:** OWASP ASVS authentication/authorization controls  
**Recommendation:** Derive identity server-side via Convex auth context and reject mismatched `userId` payloads (or remove payload entirely).  
**Suggested command:** `/harden`

4) **Location:** `convex/transactions.ts` + paid-state logic in debts/budget items  
**Severity:** Critical  
**Category:** Data integrity  
**Description:** Multiple pathways mutate balances/paid flags (`create/update/remove`, `setPaidForMonth`, overrides), increasing drift risk under edits/reversals.  
**Impact:** Financial totals can become inconsistent (account balance, debt/card balance, paid marker disagree).  
**WCAG/Standard:** N/A  
**Recommendation:** Consolidate transaction side effects in one canonical path and add reconciliation checks.  
**Suggested command:** `/harden`

5) **Location:** `convex/transactions.ts` (`create`, `update`)  
**Severity:** Critical  
**Category:** Validation  
**Description:** No strict validation for date format and upper bounds on monetary values in mutation layer.  
**Impact:** Invalid dates/amounts can corrupt month logic and summaries.  
**WCAG/Standard:** Input validation best practices  
**Recommendation:** Enforce strict ISO date regex + sane numeric bounds in backend validators.  
**Suggested command:** `/harden`

### High-Severity Issues

1) **Location:** `src/app/add-transaction/page.tsx`  
**Severity:** High  
**Category:** Performance / Stability  
**Description:** `Math.random()` called during render path triggers React purity lint errors.  
**Impact:** CI/lint failure and potentially unstable UI behavior.  
**WCAG/Standard:** N/A  
**Recommendation:** Generate confetti data once via ref/effect or deterministic seed.  
**Suggested command:** `/optimize`

2) **Location:** `src/app/categories/page.tsx`, `src/components/Sidebar.tsx`  
**Severity:** High  
**Category:** Performance  
**Description:** Synchronous `setState` inside effects triggers `react-hooks/set-state-in-effect` errors.  
**Impact:** Cascading renders and lint failure; can degrade UX responsiveness.  
**WCAG/Standard:** N/A  
**Recommendation:** Derive state directly where possible or move transitions to event handlers.  
**Suggested command:** `/optimize`

3) **Location:** `src/components/TransactionForm.tsx`, `src/components/BudgetItemManager.tsx`  
**Severity:** High  
**Category:** Reliability  
**Description:** Hook dependency warnings on effects that derive form state from edit objects.  
**Impact:** Stale form values possible when editing rapidly/swapping rows.  
**WCAG/Standard:** N/A  
**Recommendation:** Include full dependencies or refactor form-init logic for explicit reset behavior.  
**Suggested command:** `/harden`

4) **Location:** `convex/transactions.ts` (`list`, `getMonthlySpendingByCategory`)  
**Severity:** High  
**Category:** Performance  
**Description:** Pulls all user transactions then filters in memory by month.  
**Impact:** Query cost grows with history; dashboard slows for long-term users.  
**WCAG/Standard:** N/A  
**Recommendation:** Use date index range queries (`by_user_date`) for month windows everywhere.  
**Suggested command:** `/optimize`

5) **Location:** `convex/transactions.ts` (`listByDebt`, `listByCreditCard`) + UI linked logs  
**Severity:** High  
**Category:** User-flow correctness  
**Description:** Archived debt/card rows can still appear in related transaction listings unless filtered upstream.  
**Impact:** Confusing history and unclear active-vs-archived status.  
**WCAG/Standard:** N/A  
**Recommendation:** Add explicit archived-state semantics in linked views and query filters.  
**Suggested command:** `/clarify`

6) **Location:** `README.md` vs `docs/USER_FLOWS.md`  
**Severity:** High  
**Category:** Product/docs consistency  
**Description:** Public feature copy emphasizes categories+limits, but user flows now include recurring expenses, buckets, debts/cards planning.  
**Impact:** Onboarding mismatch and wrong user expectations.  
**WCAG/Standard:** N/A  
**Recommendation:** Update landing/README language to match current flow model.  
**Suggested command:** `/clarify`

### Medium-Severity Issues

1) **Location:** `src/app/dashboard/page.tsx` and multiple route pages  
**Severity:** Medium  
**Category:** Theming  
**Description:** Frequent hard-coded colors and inline style values rather than reusable tokens.  
**Impact:** Inconsistent theming, harder dark-mode expansion, brittle future restyling.  
**WCAG/Standard:** Design system consistency  
**Recommendation:** Extract semantic color tokens and replace inline hex usage.  
**Suggested command:** `/normalize`

2) **Location:** Tooltip patterns in `dashboard` (hover/focus reveal spans)  
**Severity:** Medium  
**Category:** Accessibility  
**Description:** Tooltips are hover-driven and not clearly associated via `aria-describedby`; touch behavior uncertain.  
**Impact:** Keyboard/screen-reader discoverability varies; mobile users may miss help text.  
**WCAG/Standard:** WCAG 1.3.1, 2.1.1, 4.1.2  
**Recommendation:** Convert to accessible disclosure pattern or explicit help buttons with SR mapping.  
**Suggested command:** `/harden`

3) **Location:** Modal implementations in `categories`, `debts` and others  
**Severity:** Medium  
**Category:** Accessibility  
**Description:** Dialogs use overlay click close but no clear focus trap/initial focus return behavior visible in code.  
**Impact:** Keyboard users can lose context or tab behind modal.  
**WCAG/Standard:** WCAG 2.1.1 Keyboard, 2.4.3 Focus Order  
**Recommendation:** Use a11y dialog primitive with focus lock + restore.  
**Suggested command:** `/harden`

4) **Location:** `Sidebar` mobile nav and bottom nav overlap patterns  
**Severity:** Medium  
**Category:** Responsive  
**Description:** Fixed header + fixed bottom nav patterns risk content clipping if page spacing is not consistently applied per route.  
**Impact:** Some forms/lists can be partially obscured on small screens.  
**WCAG/Standard:** WCAG 1.4.10 Reflow  
**Recommendation:** enforce shared layout safe-area paddings and verify all screens.  
**Suggested command:** `/adapt`

5) **Location:** `add-transaction` success animation  
**Severity:** Medium  
**Category:** Accessibility / Motion  
**Description:** Animated burst/check does not appear to respect reduced-motion preference.  
**Impact:** Motion-sensitive users may experience discomfort.  
**WCAG/Standard:** WCAG 2.3.3 Animation from Interactions  
**Recommendation:** gate non-essential animation behind `prefers-reduced-motion`.  
**Suggested command:** `/harden`

### Low-Severity Issues

1) **Location:** `next build` output (`middleware` deprecation warning)  
**Severity:** Low  
**Category:** Technical debt  
**Description:** Next.js warns `middleware` convention deprecated in favor of `proxy`.  
**Impact:** Future framework upgrade friction.  
**WCAG/Standard:** N/A  
**Recommendation:** Plan migration to new convention.  
**Suggested command:** `/polish`

2) **Location:** Minor copy and tone inconsistencies across empty states  
**Severity:** Low  
**Category:** UX writing  
**Description:** Some labels alternate between "Remove/Delete/Archive" with different permanence semantics.  
**Impact:** Mild user confusion about reversibility.  
**WCAG/Standard:** N/A  
**Recommendation:** Standardize destructive-action language and helper text.  
**Suggested command:** `/clarify`

## Patterns & Systemic Issues

- Ownership checks are inconsistent across Convex modules; some handlers are robust, others are ID-only.
- Tenant isolation currently depends on trusted client `userId` inputs rather than server-auth identity.
- Flow complexity increased (recurring templates + month funding + actual paid overrides), but guardrails/tests did not keep pace.
- UI uses many repeated local style decisions (colors/cards/tooltips) rather than centralized design primitives.

## Positive Findings

- Core user-flow routes from `docs/USER_FLOWS.md` exist and are mapped clearly.
- Build passes successfully (`next build`) with static generation for main pages.
- Many forms include basic validation and accessible labels.
- Good use of monthly key conventions (`YYYY-MM`) across funding and timeline logic.
- Helpful domain copy in several screens explains planning vs payment separation.

## Recommendations by Priority

1. **Immediate (critical blockers)**
   - Enforce ownership checks in every mutation/query by document and tenant.
   - Stop trusting client `userId` as authority; bind data access to authenticated identity.
   - Add strict backend validation for date/amount domains.

2. **Short-term (this sprint)**
   - Fix lint errors blocking quality gate (`Math.random` in render, setState-in-effect).
   - Normalize paid/funding mutation pathways and add reconciliation safeguards.
   - Address tooltip/modal accessibility gaps.

3. **Medium-term (next sprint)**
   - Migrate month-based transaction queries to indexed date range everywhere.
   - Introduce shared design tokens and reduce inline hex/style duplication.
   - Standardize destructive-action wording and archive semantics.

4. **Long-term**
   - Add regression test coverage for user flows (manual scripts minimum; automated preferred).
   - Migrate deprecated middleware convention.

## Suggested Commands for Fixes

- Use `/harden` for authorization, modal/focus handling, validation, and paid/funding consistency.
- Use `/optimize` for query/index efficiency and render-effect lint issues.
- Use `/normalize` for tokenized theming and reducing hard-coded color usage.
- Use `/adapt` for mobile safe-area/reflow verification and fixes.
- Use `/clarify` for copy, archive/delete semantics, and README/marketing flow alignment.
- Use `/polish` for framework deprecations and final consistency cleanup.

## Verification Notes (performed in this audit)

- `npm run lint` fails with **9 errors** and **10 warnings** (key errors in `add-transaction`, `categories`, `Sidebar`).
- `npm run build` passes, but warns that `middleware` convention is deprecated.
- No automated tests are configured for these flows, increasing regression risk.
