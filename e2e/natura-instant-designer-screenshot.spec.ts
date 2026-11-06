/**
 * Capture the INSTANT (auto) designer's 144 × 144 inch L-shaped kitchen in Natura
 * Maple, rendered by the real 3D engine.
 *
 *   npx vite --port 5178 --strictPort
 *   CLOSET_STUDIO_BASE_URL=http://127.0.0.1:5178 npx playwright test e2e/natura-instant-designer-screenshot.spec.ts
 *
 * `?before=1` renders the pre-fix appearance, so this produces both halves of the
 * before/after evidence. NATURA_INSTANT_LABEL names the output image.
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";
const LABEL = process.env.NATURA_INSTANT_LABEL ?? "after";
const OUT_FILE = `${OUT_DIR}/natura-instant-lshape-${LABEL}.png`;

test("instant designer: Natura Maple L-shaped kitchen", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));
  page.on("console", (message) => {
    if (message.type() === "error") console.log("[console]", message.text());
  });

  const query = LABEL === "before" ? "?before=1" : LABEL === "flat" ? "?flat=1" : "";
  await page.goto(`/dev/natura-instant-shot.html${query}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => (window as unknown as { __naturaInstantShot?: unknown }).__naturaInstantShot != null,
    null,
    { timeout: 180_000 },
  );
  const shot = await page.evaluate(() => (window as unknown as { __naturaInstantShot?: unknown }).__naturaInstantShot);
  console.log("INSTANT", JSON.stringify(shot, null, 2));
  await page.locator("#pane canvas").screenshot({ path: OUT_FILE });
  expect(shot).toBeTruthy();
});
