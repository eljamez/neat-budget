import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup",
  use: {
    baseURL: "http://localhost:3005",
  },
  projects: [
    // Sign in once and save auth state
    {
      name: "setup",
      testMatch: "e2e/auth.setup.ts",
    },
    // All tests reuse the saved auth state
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/state.json",
      },
      dependencies: ["setup"],
    },
  ],
  // Reuse an already-running dev server; start Next.js only as fallback.
  // Run `npm run dev:all` separately before running tests (Convex won't start here).
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3005",
    reuseExistingServer: true,
    timeout: 60 * 1000,
  },
});
