/**
 * Before / after proof for issue 353, round 2 (Tom, Nov 9 2026).
 *
 * Both columns are REAL designer code, not a hand-written model:
 *   - "before" calls `client/src/lib/legacyMain/design.ts`, a verbatim copy of
 *     `design.ts` + `freestandingRun.ts` from `main`;
 *   - "after" calls this branch's `countertopSurfaces`.
 *
 * The `issue353LegacyParity` unit test proves the vendored copy still reproduces
 * Tom's report on main (two slabs with a gap and no mitre).
 *
 * Layout: Tom's L — four straight bases on the back wall, the angled leg of the
 * 45-degree return dropped beside them at the Wall Builder's 11-inch hold, and a
 * raised bar wall behind the run.
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

type Facts = { slabs: number; liftedBars: number; minX: number; maxX: number; mitered: number };

test("issue 353: real main vs branch on Tom's L-shaped run", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("console", (message) => {
    if (message.type() === "error") console.log("[page]", message.text());
  });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await page.goto("/dev/issue353-shot.html", { waitUntil: "load" });
  await page.waitForFunction(() => (window as unknown as { __issue353?: { ok?: boolean } }).__issue353 != null, null, { timeout: 120_000 });
  const facts = await page.evaluate(() => (window as unknown as { __issue353?: unknown }).__issue353);
  console.log("facts", JSON.stringify(facts));
  const measured = facts as { ok: boolean; before: Facts; after: Facts };
  expect(measured.ok).toBe(true);

  // main: the angled leg gets its own slab, so the L is two pieces with no mitre
  // and no bar top.
  expect(measured.before.slabs).toBeGreaterThan(1);
  expect(measured.before.mitered).toBe(0);
  expect(measured.before.liftedBars).toBe(0);

  // branch: one continuous mitred top across the L, plus the bar top.
  expect(measured.after.slabs).toBe(3); // wall run, mitered return leg, corner infill
  expect(measured.after.mitered).toBeGreaterThan(0);
  expect(measured.after.liftedBars).toBe(1);

  // The captions carry the measured numbers, so the picture is checkable.
  await expect(page.locator("#caption-3d-before")).toContainText("2 countertop pieces");
  await expect(page.locator("#caption-3d-before")).toContainText("0 mitred slabs");
  await expect(page.locator("#caption-3d-after")).toContainText("1 bar top");
  await expect(page.locator("#caption-3d-after")).toContainText("mitred slabs");
  await expect(page.locator("#caption-2d-after")).toContainText("3 countertop pieces");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT_DIR}/issue353-countertop-before-after.png`, fullPage: false });
});
