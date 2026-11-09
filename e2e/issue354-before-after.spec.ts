/**
 * Screenshot proof for issue #354: a frameless range base with its
 * range top seated on it, drawn the way a sink base is drawn — the shared
 * countertop slab over the box and the range top set into that surface, with no
 * freestanding range in the scene.
 *
 * Everything comes from the real 3D engine (`existingCabinetSku` +
 * `addCabinet` + `addThreeDStandardCountertops`), so the image is what the
 * Designer draws.
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

test("shows the range base with its range top seated in the countertop", async ({ page }) => {
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

  // The caption carries the measured facts, so the claim is checkable from the image.
  const caption = page.locator("#after-caption");
  await expect(caption).toContainText("RB3DB30");
  await expect(caption).toContainText("for a range top");
  await expect(caption).toContainText("no freestanding range");
  // The range top sits ON the countertop line, like a basin in a sink base.
  await expect(caption).toContainText("countertop 36");
  await expect(caption).toContainText("installed in it");

  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT_FILE });
});
