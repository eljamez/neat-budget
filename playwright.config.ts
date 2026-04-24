import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup",
  use: {
    baseURL: "http://localhost:3005",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Reuse an already-running dev server; start Next.js only as fallback.
  // Run `npm run dev:all` separately before running tests (Convex won't start here).
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3005",
    reuseExistingServer: true,
    timeout: 60 * 1000,
  },
});
