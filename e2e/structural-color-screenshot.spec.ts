/**
 * Real rendered before/after for the structural-colour restoration.
 *
 *   npx vite --port 5178 --strictPort
 *   CLOSET_STUDIO_BASE_URL=http://127.0.0.1:5178 npx playwright test e2e/structural-color-screenshot.spec.ts
 *
 * Both panes render the same cabinet through the same real renderer. The left pane
 * has the PR #123 split re-applied locally, the right pane is the live code, so the
 * difference in the capture is the change under review — not lighting.
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";
const OUT_FILE = `${OUT_DIR}/structural-color-before-after.png`;

test("box, sides and toe kick follow the door appearance", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await page.goto("/dev/color-shot.html", { waitUntil: "load" });
  await page.waitForFunction(
    () => (window as unknown as { __colorShot?: unknown }).__colorShot != null,
    null,
    { timeout: 120_000 },
  );
  const samples = await page.evaluate(() => (window as unknown as { __colorShot?: unknown }).__colorShot);
  console.log("samples:", JSON.stringify(samples));

  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT_FILE });

  const s = samples as { pixels: { before: Record<string, string>; after: Record<string, string> } };
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const dist = (x: string, y: string) => {
    const [a, b] = [parse(x), parse(y)];
    return Math.round(a.reduce((sum, v, i) => sum + Math.abs(v - b[i]!), 0) / 3);
  };
  // The split shows as a large front-to-side gap in the "before" pane; the
  // restoration closes it. Lighting affects both panes equally, so a real source
  // mismatch is the only thing that can separate them like this.
  const beforeGap = dist(s.pixels.before.front!, s.pixels.before.side!);
  const afterGap = dist(s.pixels.after.front!, s.pixels.after.side!);
  console.log(`front-to-side gap: before=${beforeGap} after=${afterGap}`);
  expect(beforeGap).toBeGreaterThan(afterGap + 5);
});
