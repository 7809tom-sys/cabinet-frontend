/**
 * Visual check for the wall end open shelf (WEOS) render.
 *
 * Renders a real upper run through the real 3D engine and the real elevation
 * component, then captures the 3D view. Used only during development of the
 * WEOS family; the assertions live in the vitest suites.
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";

for (const code of (process.env.OPEN_SHELF_CODES ?? "WEOS0930,WEOS0936,WEOS0942").split(",")) {
  test(`renders ${code} as a finished open shelf at the end of an upper run`, async ({ page }) => {
    mkdirSync(OUT_DIR, { recursive: true });
    page.on("pageerror", (error) => console.log("[pageerror]", error.message));
    page.on("console", (message) => {
      if (message.type() === "error") console.log("[page]", message.text());
    });
    await page.goto(`/dev/open-shelf-shot.html?code=${code}${process.env.OPEN_SHELF_CLOSEUP ? "&closeup=1" : ""}`, { waitUntil: "load" });
    await page.waitForFunction(() => (window as unknown as { __openShelfShot?: string }).__openShelfShot != null, null, { timeout: 120_000 });
    const status = await page.evaluate(() => (window as unknown as { __openShelfShot?: string }).__openShelfShot!);
    expect(status).toBe("ok");
    const elevation = await page.evaluate(() => document.getElementById("elevation-markup")?.textContent ?? "");
    console.log(`[elevation-${code}]`, elevation.slice(0, 6000));
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT_DIR}/open-shelf-${code}${process.env.OPEN_SHELF_CLOSEUP ? "-closeup" : ""}.png` });
  });
}
