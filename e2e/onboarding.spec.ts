import { test, expect } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function resetTestUser() {
  // Retry up to 3 times — Convex HTTP client can occasionally fail on first attempt
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      await client.mutation(api.testing.resetUserForTesting, {
        email: process.env.E2E_TEST_USER_EMAIL!,
      });
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

test.describe("Onboarding flow", () => {
  test.beforeEach(async () => {
    await resetTestUser();
  });

  test("first-run onboarding happy path", async ({ page }) => {
    // Fresh user: navigating to /dashboard should redirect to /onboarding/account
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding\/account/, { timeout: 10000 });

    // Step 1: account
    await page.getByLabel("Account name").fill("Checking");
    await page.getByLabel("How much is in there right now?").fill("2400");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding\/category/, { timeout: 10000 });

    // Step 2: category (date picker defaults to next month — already valid)
    await page.getByLabel("What is it?").fill("Rent");
    await page.getByLabel("How much do you need?").fill("1800");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding\/fund/, { timeout: 10000 });

    // Step 3: fund (slider defaults to max — click Fund button)
    await page.getByRole("button", { name: /fund \$/i }).click();
    await expect(page).toHaveURL(/\/onboarding\/transaction/, { timeout: 15000 });

    // Step 4: transaction (date defaults to today)
    await page.getByLabel("How much?").fill("1800");
    await page.getByRole("button", { name: "Record it" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test("resume after refresh mid-flow", async ({ page }) => {
    await page.goto("/onboarding/account");
    await expect(page).toHaveURL(/\/onboarding\/account/, { timeout: 10000 });

    await page.getByLabel("Account name").fill("Checking");
    await page.getByLabel("How much is in there right now?").fill("2400");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding\/category/, { timeout: 10000 });

    // Reload — OnboardingGate should keep us at category (or later)
    await page.reload();
    await expect(page).toHaveURL(/\/onboarding\/(category|fund|transaction)/, { timeout: 10000 });
  });

  test("honors prefers-reduced-motion on account step", async ({ browser }) => {
    await resetTestUser();
    const context = await browser.newContext({
      reducedMotion: "reduce",
      storageState: "e2e/.auth/state.json",
    });
    const page = await context.newPage();

    await page.goto("/onboarding/account");
    await expect(page).toHaveURL(/\/onboarding\/account/, { timeout: 10000 });

    await page.getByLabel("Account name").fill("Checking");
    await page.getByLabel("How much is in there right now?").fill("2400");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding\/category/, { timeout: 10000 });

    // No confetti canvas should appear with reduced motion
    await expect(page.locator("canvas")).toHaveCount(0);

    await context.close();
  });
});
