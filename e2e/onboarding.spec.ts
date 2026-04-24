import { test, expect } from "@playwright/test";

/**
 * These tests require Clerk test credentials to run.
 *
 * To unblock: set the following in a `.env.test` file at the repo root:
 *   CLERK_SECRET_KEY=sk_test_...
 *   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
 *   E2E_TEST_USER_EMAIL=...
 *   E2E_TEST_USER_PASSWORD=...
 *
 * Also install @clerk/testing: `npm install -D @clerk/testing`
 * and configure setupAuth in playwright.config.ts using clerkSetup().
 *
 * Until those credentials are provided, all tests are marked fixme.
 */

function oneMonthFromToday(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test.describe("Onboarding flow", () => {
  test.fixme(
    "first-run onboarding happy path",
    async ({ page }) => {
      // FIXME: Requires Clerk test user credentials.
      // See file header for setup instructions.

      // Sign in as a fresh user (no prior data)
      // await clerkSignIn(page, { email: process.env.E2E_TEST_USER_EMAIL!, password: process.env.E2E_TEST_USER_PASSWORD! });

      // A fresh user hitting /dashboard should land on /onboarding/account
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/onboarding\/account/, { timeout: 10000 });

      // Step 1: account
      await page.getByLabel("Account name").fill("Checking");
      await page.getByLabel(/how much/i).fill("2400");
      await page.getByRole("button", { name: /next/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/category/, { timeout: 10000 });

      // Step 2: category
      await page.getByLabel(/what is it/i).fill("Rent");
      await page.getByLabel(/how much/i).fill("1800");
      await page.getByLabel(/need it by/i).fill(oneMonthFromToday());
      await page.getByRole("button", { name: /next/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/fund/, { timeout: 10000 });

      // Step 3: fund (slider at default, click Fund button)
      await page.getByRole("button", { name: /fund \$/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/transaction/, { timeout: 10000 });

      // Step 4: transaction
      await page.getByLabel(/who.s it for/i).fill("Landlord");
      await page.getByLabel(/how much/i).fill("1800");
      await page.getByLabel(/when/i).fill(todayIso());
      await page.getByRole("button", { name: /record it/i }).click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    }
  );

  test.fixme(
    "resume after refresh mid-flow",
    async ({ page }) => {
      // FIXME: Requires Clerk test user credentials.
      // See file header for setup instructions.

      // Sign in as a fresh user, complete step 1
      await page.goto("/onboarding/account");
      await expect(page).toHaveURL(/\/onboarding\/account/, { timeout: 10000 });
      await page.getByLabel("Account name").fill("Checking");
      await page.getByLabel(/how much/i).fill("2400");
      await page.getByRole("button", { name: /next/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/category/, { timeout: 10000 });

      // Reload — should resume at category (or further)
      await page.reload();
      await expect(page).toHaveURL(/\/onboarding\/(category|fund|transaction)/, { timeout: 10000 });
    }
  );

  test.fixme(
    "honors prefers-reduced-motion",
    async ({ browser }) => {
      // FIXME: Requires Clerk test user credentials.
      // See file header for setup instructions.

      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();

      // Walk through the flow; confetti canvas should not be present
      await page.goto("/onboarding/account");
      await expect(page).toHaveURL(/\/onboarding\/account/, { timeout: 10000 });

      await page.getByLabel("Account name").fill("Checking");
      await page.getByLabel(/how much/i).fill("2400");
      await page.getByRole("button", { name: /next/i }).click();
      await expect(page).toHaveURL(/\/onboarding\/category/, { timeout: 10000 });

      // The confetti canvas (z-[100]) should not be present since reducedMotion is set
      const confettiCanvas = page.locator("canvas");
      await expect(confettiCanvas).toHaveCount(0);

      await context.close();
    }
  );
});
