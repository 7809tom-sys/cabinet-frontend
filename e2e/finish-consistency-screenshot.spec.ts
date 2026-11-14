/**
 * Real rendered check: one off-white door line reads the same on every wall.
 *
 *   npx vite --port 5178 --strictPort
 *   CLOSET_STUDIO_BASE_URL=http://127.0.0.1:5178 npx playwright test e2e/finish-consistency-screenshot.spec.ts
 *
 * The harness puts the same painted cabinets on the back, left and right walls and
 * reads each door head-on through the real renderer (ACES, exposure, environment,
 * room lights). `rig=legacy` is the pre-fix lighting; the default is the live code.
 */
import { expect, test } from "@playwright/test";

type Result = { materialHexes: string[]; readouts: Record<string, string> };

async function readWalls(page: import("@playwright/test").Page, query: string) {
  await page.goto(`/dev/finish-consistency-shot.html?${query}`, { waitUntil: "load" });
  await page.waitForFunction(() => (window as unknown as { __finishResult?: unknown }).__finishResult != null, null, { timeout: 120_000 });
  const result = await page.evaluate(() => (window as unknown as { __finishResult: Result }).__finishResult);
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const doors = Object.entries(result.readouts).filter(([key]) => key.endsWith("head-on")).map(([, hex]) => parse(hex));
  let gap = 0;
  for (const a of doors) for (const b of doors) gap = Math.max(gap, ...a.map((value, index) => Math.abs(value - b[index]!)));
  return { result, gap };
}

test("one door line renders one shade on the back, left and right walls", async ({ page }) => {
  const legacy = await readWalls(page, "rig=legacy");
  const live = await readWalls(page, "rig=live");
  console.log(`largest channel gap between walls: legacy=${legacy.gap} live=${live.gap}`);
  expect(live.result.materialHexes).toHaveLength(1);
  expect(live.gap).toBeLessThanOrEqual(3);
  expect(legacy.gap).toBeGreaterThan(live.gap + 10);
});
