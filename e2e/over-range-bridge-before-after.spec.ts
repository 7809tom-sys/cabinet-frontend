/**
 * Before / after proof for the over-range bridge size bug (owner report, Nov 6 2026:
 * "the wall (bridge) cabinet over the range should be 12 inches but the designer did
 * not apply that size").
 *
 * Both halves of the capture are the SAME real Auto-Design kitchen, built by
 * `runAutoDesignLayout` and rendered by the real 3D engine. The left half is the
 * plan the Designer shipped: the Auto-Design pop-up's hard-coded 24" bridge
 * substituted over the 12" box the build had chosen. The right half is the fixed
 * one selector's 12" W3012 on the same 72" datum.
 *
 * Run with:
 *   npx vite --port 5178 --strictPort
 *   npx playwright test e2e/over-range-bridge-before-after.spec.ts
 *
 * Output: /opt/cursor/artifacts/over-range-bridge-before-after.png
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";
const OUT_FILE = `${OUT_DIR}/over-range-bridge-before-after.png`;

test("a generated kitchen shows the 12 inch bridge instead of the 24 inch one", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("console", (message) => {
    if (message.type() === "error") console.log("[page]", message.text());
  });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await page.goto("/dev/bridge-before-after.html", { waitUntil: "load" });
  await page.waitForFunction(() => (window as unknown as { __bridgeShot?: string }).__bridgeShot != null, null, { timeout: 120_000 });
  const status = await page.evaluate(() => (window as unknown as { __bridgeShot?: string }).__bridgeShot!);
  expect(status).toBe("ok");

  // The captions carry the measured numbers, so the claim is checkable from the image.
  await expect(page.locator("#after-caption")).toContainText("12");
  await expect(page.locator("#after-caption")).toContainText("flush");
  await expect(page.locator("#before-caption")).toContainText("24");
  await expect(page.locator("#before-caption")).toContainText("proud");

  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT_FILE, fullPage: false });
});
