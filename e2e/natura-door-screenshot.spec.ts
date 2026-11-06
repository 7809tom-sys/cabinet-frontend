/**
 * Real rendered capture of the Natura Maple (Ashford `Designer Natural`, style
 * 330004) cabinet through the 3D Designer's `addCabinet` pipeline.
 *
 *   npx vite --port 5178 --strictPort
 *   CLOSET_STUDIO_BASE_URL=http://127.0.0.1:5178 npx playwright test e2e/natura-door-screenshot.spec.ts
 *
 * `?before=1` renders the pre-fix appearance, so the same page produces both
 * halves of the before/after evidence. NATURA_SHOT_LABEL names the output image.
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";
const LABEL = process.env.NATURA_SHOT_LABEL ?? "after";
const OUT_FILE = `${OUT_DIR}/natura-maple-${LABEL}.png`;

test("Natura Maple cabinet as the 3D Designer builds it", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));
  page.on("console", (message) => {
    if (message.type() === "error") console.log("[console]", message.text());
  });

  await page.goto(`/dev/natura-door-shot.html${LABEL === "before" ? "?before=1" : ""}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => (window as unknown as { __naturaDoorShot?: unknown }).__naturaDoorShot != null,
    null,
    { timeout: 120_000 },
  );
  const shot = await page.evaluate(() => (window as unknown as { __naturaDoorShot?: unknown }).__naturaDoorShot);
  console.log("NATURA", JSON.stringify(shot, null, 2));
  await page.locator("#pane canvas").screenshot({ path: OUT_FILE });
  expect(shot).toBeTruthy();
});
