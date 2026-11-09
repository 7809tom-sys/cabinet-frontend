/**
 * Before / after proof for issue #354: the RB3DB24 that stood in a plain base
 * run beside a freestanding range.
 *
 * Both panes are the same real 3D engine (`existingCabinetSku`/`addCabinet`).
 * The left pane is the plan as reported; the right pane is built by the branch's
 * own rules (`repairRangeBasesWithoutCooktop` + `syncRangeAndNeighbourSidePanels`),
 * so the panel you see beside the range is the one the Designer now adds.
 *
 * Run with:
 *   npx vite --port 5178 --strictPort
 *   npx playwright test e2e/issue354-before-after.spec.ts
 *
 * Output: /opt/cursor/artifacts/issue354-before-after.png
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";
const OUT_FILE = `${OUT_DIR}/issue354-before-after.png`;

test("a range base is replaced by the plain base and a side panel is added", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));
  page.on("console", (message) => {
    if (message.type() === "error") console.log("[page]", message.text());
  });

  await page.goto("/dev/issue354-shot.html", { waitUntil: "load" });
  await page.waitForFunction(
    () => (window as unknown as { __issue354Shot?: string }).__issue354Shot != null,
    null,
    { timeout: 120_000 },
  );
  const status = await page.evaluate(() => (window as unknown as { __issue354Shot?: string }).__issue354Shot!);
  expect(status).toBe("ok");

  // The captions carry the measured facts, so both claims are checkable in the image.
  await expect(page.locator("#before-caption")).toContainText("RB3DB24");
  await expect(page.locator("#after-caption")).toContainText("B24");
  await expect(page.locator("#after-caption")).toContainText("BEP2535");
  await expect(page.locator("#after-caption")).not.toContainText("RB3DB24");
  // The designer-facing name never says "range base".
  await expect(page.locator("#before-caption")).not.toContainText("Range Base");

  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT_FILE });
});
