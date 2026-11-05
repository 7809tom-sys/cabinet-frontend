import { defineConfig, devices } from "@playwright/test";

/**
 * Layout verification for the Closet Studio.
 *
 *   pnpm exec playwright test e2e/closet-studio-responsive.spec.ts
 *
 * The suite boots the Vite dev server itself, so it needs no backend: the Studio reads only
 * localStorage for the draft and tolerates the storefront query failing.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: process.env.CLOSET_STUDIO_BASE_URL ?? "http://127.0.0.1:5178",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.CLOSET_STUDIO_BASE_URL ? undefined : {
    command: "npx vite --port 5178 --strictPort",
    url: "http://127.0.0.1:5178/closet",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
