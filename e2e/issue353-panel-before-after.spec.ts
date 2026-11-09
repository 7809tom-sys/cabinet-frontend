/**
 * Before / after proof for issue 353 outcome 8 (Tom, Nov 9 2026).
 *
 * Tom's actual case: a STANDALONE W3024 upper (30 × 24 in) with an end panel on
 * its side that ran down past the cabinet's own bottom.
 *
 * Both columns are REAL designer code:
 *   - BEFORE runs main's exposed-side engine, served straight out of git by the
 *     `issue353-main-snapshot` Vite plugin (no vendored copy in the repo);
 *   - AFTER runs this branch's engine, which clamps the panel to the upper band.
 *
 * Measured facts on main: the panel sits at 60" while the cabinet bottom is 72",
 * so 12" of board hangs below the cabinet. On the branch the panel starts at 72"
 * and no panel is placed beside a standalone short upper at all.
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

test("issue 353 outcome 8: a panel beside a W3024 must not hang below it", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("console", (message) => {
    if (message.type() === "error") console.log("[page]", message.text());
  });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await page.goto("/dev/issue353-panel-shot.html", { waitUntil: "load" });
  await page.waitForFunction(() => (window as unknown as { __issue353Panel?: { ok?: boolean } }).__issue353Panel != null, null, { timeout: 120_000 });
  const facts = await page.evaluate(() => (window as unknown as { __issue353Panel?: unknown }).__issue353Panel);
  console.log("facts", JSON.stringify(facts));

  const measured = facts as {
    ok: boolean;
    upperBottom: number;
    before: { panels: number; lowestBottom: number | null };
    after: { panels: number; lowestBottom: number | null };
  };
  expect(measured.ok).toBe(true);

  // The W3024's own bottom.
  expect(measured.upperBottom).toBe(72);

  // main hangs the panel 12 inches below the cabinet's bottom — Tom's report.
  expect(measured.before.panels).toBeGreaterThan(0);
  expect(measured.before.lowestBottom).toBeLessThan(measured.upperBottom - 1);
  expect(measured.upperBottom - (measured.before.lowestBottom ?? 0)).toBeCloseTo(12, 1);

  // The branch never lets a panel reach below the cabinet.
  if (measured.after.panels > 0) {
    expect(measured.after.lowestBottom).toBeGreaterThanOrEqual(measured.upperBottom - 0.01);
  }

  await expect(page.locator("#caption-before")).toContainText("hangs below");
  await expect(page.locator("#caption-after")).toContainText("never reaches below the cabinet");
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT_DIR}/issue353-panel-before-after.png`, fullPage: false });
});
