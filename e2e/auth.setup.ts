/**
 * Runs once before all tests. Signs in via sign-in token and saves auth state
 * so tests can reuse the session without signing in each time.
 */
import { test as setup } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import path from "path";
import fs from "fs";

export const AUTH_FILE = path.join(__dirname, ".auth/state.json");

setup("authenticate", async ({ page }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const secretKey = process.env.CLERK_SECRET_KEY!;
  const email = process.env.E2E_TEST_USER_EMAIL!;

  // Look up the test user
  const searchRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: `Bearer ${secretKey}` } }
  );
  const raw = await searchRes.json();
  const users: { id: string }[] = Array.isArray(raw) ? raw : (raw.data ?? []);
  const userId = users[0]?.id;
  if (!userId) throw new Error(`Test user not found in Clerk: ${email}`);

  // Create a one-time sign-in token (bypasses 2FA and breach checks)
  const tokenRes = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 120 }),
  });
  const tokenData = await tokenRes.json() as { url: string };
  const ticket = new URL(tokenData.url).searchParams.get("__clerk_ticket")!;

  // Load the sign-in page with the ticket so Clerk's <SignIn> component processes it
  await setupClerkTestingToken({ page });
  await page.goto(`/sign-in?__clerk_ticket=${ticket}`);
  await page.waitForURL((url) => !url.toString().includes("/sign-in"), { timeout: 30000 });

  // Save cookies + localStorage for reuse across tests
  await page.context().storageState({ path: AUTH_FILE });
  console.log("[e2e] Auth state saved to", AUTH_FILE);
});
