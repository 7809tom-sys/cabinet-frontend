/**
 * Before / after proof for issue 353 outcome 8 (Tom, Nov 9 2026): a tall flat
 * side/end panel must not stand beside a 24-inch upper.
 *
 * Left: the board the old continuous-filler contract wrote — floor to 96 inches.
 * Right: the board the fixed contract writes — the upper band only (54–96 inches).
 * Both are the real board envelope; the harness draws nothing by hand.
 *
 * Run with:
 *   npx vite --port 5178 --strictPort
 *   npx playwright test e2e/issue353-panel-before-after.spec.ts
 *
 * Output: /opt/cursor/artifacts/issue353-panel-before-after.png
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";

test("issue 353 outcome 8: no floor-standing panel beside a short upper", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("console", (message) => {
    if (message.type() === "error") console.log("[page]", message.text());
  });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await page.goto("/dev/issue353-panel-shot.html", { waitUntil: "load" });
  await page.waitForFunction(() => (window as unknown as { __issue353Panel?: { ok?: boolean } }).__issue353Panel != null, null, { timeout: 120_000 });
  const facts = await page.evaluate(() => (window as unknown as { __issue353Panel?: unknown }).__issue353Panel);
  console.log("facts", JSON.stringify(facts));
  const measured = facts as { ok: boolean; before: { bottom: number; height: number }; after: { bottom: number; height: number } };
  expect(measured.ok).toBe(true);
  // Before: the board is 96 inches tall from the floor.
  expect(measured.before.bottom).toBe(0);
  expect(measured.before.height).toBe(96);
  // After: it starts at the 54-inch upper line.
  expect(measured.after.bottom).toBe(54);

  await expect(page.locator("#caption-before")).toContainText("floor");
  await expect(page.locator("#caption-after")).toContainText("upper band");
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT_DIR}/issue353-panel-before-after.png`, fullPage: false });
});
