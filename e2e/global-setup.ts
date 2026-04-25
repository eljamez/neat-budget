import { clerkSetup } from "@clerk/testing/playwright";
import type { FullConfig } from "@playwright/test";

async function ensureTestUser() {
  const secretKey = process.env.CLERK_SECRET_KEY!;
  const email = process.env.E2E_TEST_USER_EMAIL!;
  const password = process.env.E2E_TEST_USER_PASSWORD!;

  const searchRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: `Bearer ${secretKey}` } }
  );
  const raw = await searchRes.json();
  // Clerk API may return an array directly or { data: [] }
  const users: { id: string }[] = Array.isArray(raw) ? raw : (raw.data ?? []);
  const existing = users[0];

  if (existing) {
    // Keep user but ensure password matches .env.test (skip breach checks for test accounts)
    await fetch(`https://api.clerk.com/v1/users/${existing.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password, skip_password_checks: true }),
    });
  } else {
    console.log(`[e2e] Creating test user: ${email}`);
    const createRes = await fetch("https://api.clerk.com/v1/users", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email_address: [email], password, skip_password_checks: true }),
    });
    if (!createRes.ok) {
      throw new Error(`Failed to create test user: ${await createRes.text()}`);
    }
  }
}

export default async function globalSetup(_config: FullConfig) {
  await ensureTestUser();
  await clerkSetup();
}
