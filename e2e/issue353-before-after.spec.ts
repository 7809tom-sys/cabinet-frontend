/**
 * Before / after proof for issue 353 (Tom, Nov 9 2026): the countertop must run
 * continuously across adjoining base cabinets, stop at the end of the run, and
 * carry a real bar top over the raised bar wall.
 *
 * Top row: the 3D view. Bottom row: a top-down view. Left column = the rules
 * that shipped, right column = the fixed rules. Both halves come from the real
 * designer code (`countertopSurfaces`), not from hand-drawn boxes.
 *
 * Run with:
 *   npx vite --port 5178 --strictPort
 *   npx playwright test e2e/issue353-before-after.spec.ts
 *
 * Output: /opt/cursor/artifacts/issue353-countertop-before-after.png
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";

test("issue 353: one continuous countertop, trimmed end, and a bar top", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("console", (message) => {
    if (message.type() === "error") console.log("[page]", message.text());
  });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await page.goto("/dev/issue353-shot.html", { waitUntil: "load" });
  await page.waitForFunction(() => (window as unknown as { __issue353?: { ok?: boolean } }).__issue353 != null, null, { timeout: 120_000 });
  const facts = await page.evaluate(() => (window as unknown as { __issue353?: unknown }).__issue353);
  console.log("facts", JSON.stringify(facts));
  expect((facts as { ok: boolean }).ok).toBe(true);

  const measured = facts as {
    ok: boolean;
    before: { slabs: number; raisedBars: number };
    after: { slabs: number; raisedBars: number; maxX: number };
  };
  // Before: several slabs, no bar top. After: one slab and one bar top, and the
  // stone stops at the 144-inch end of the cabinet run.
  expect(measured.before.slabs).toBeGreaterThan(1);
  expect(measured.before.raisedBars).toBe(0);
  expect(measured.after.slabs).toBe(1);
  expect(measured.after.raisedBars).toBe(1);
  expect(measured.after.maxX).toBeCloseTo(144, 1);

  await expect(page.locator("#caption-3d-after")).toContainText("continuous");
  await expect(page.locator("#caption-3d-after")).toContainText("bar top");
  await expect(page.locator("#caption-3d-before")).toContainText("separate slabs");
  await expect(page.locator("#caption-2d-after")).toContainText("stops at the end of the run");

  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT_DIR}/issue353-countertop-before-after.png`, fullPage: false });
});
