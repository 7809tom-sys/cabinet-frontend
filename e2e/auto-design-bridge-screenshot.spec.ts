/**
 * Render a real generated kitchen to a PNG, using the project's own 3D engine.
 *
 * Run with:
 *   npx vite --port 5178 --strictPort
 *   npx playwright test e2e/auto-design-bridge-screenshot.spec.ts
 *
 * The page builds a kitchen with the real auto-designer (`runAutoDesignLayout` on
 * the matrix catalog), so the plan and the bridge in the screenshot are the ones
 * the Designer produces — not a mock.
 *
 * Output: /opt/cursor/artifacts/auto-design-bridge.png
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";
const OUT_FILE = `${OUT_DIR}/auto-design-bridge.png`;

test("a generated kitchen shows its bridge wall cabinet above the range", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("console", (message) => {
    if (message.type() === "error") console.log("[page]", message.text());
  });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await page.goto("/dev/bridge-shot.html?w=1400&h=900", { waitUntil: "load" });
  await page.waitForFunction(() => (window as unknown as { __bridgeShot?: string }).__bridgeShot != null, null, { timeout: 120_000 });
  const status = await page.evaluate(() => (window as unknown as { __bridgeShot?: string }).__bridgeShot!);
  expect(status).toBe("ok");

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT_FILE, fullPage: false });
});
