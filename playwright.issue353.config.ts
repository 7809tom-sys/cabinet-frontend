import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the issue-353 before/after screenshot specs ONLY.
 *
 * It boots the dedicated `vite.issue353-shots.config.ts` dev server, which is
 * the only config that registers the `issue353-main-snapshot` plugin. The normal
 * `playwright.config.ts` (and therefore every other spec) keeps using
 * `vite.config.ts` with no snapshot plugin at all.
 *
 *   npx playwright test -c playwright.issue353.config.ts
 *   pnpm issue353:shots:test
 */
const PORT = 5178;
const TEST_APP_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  testMatch: /issue353-.*\.spec\.ts/,
  timeout: 120_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: TEST_APP_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite --config vite.issue353-shots.config.ts --port ${PORT} --strictPort`,
    url: `${TEST_APP_URL}/issue353-shot.html`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: TEST_APP_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      VITE_API_BASE_URL: "",
    },
  },
});
