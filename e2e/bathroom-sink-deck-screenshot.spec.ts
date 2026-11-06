/**
 * Before/after capture for the bathroom rear-deck rule.
 *
 *   npx vite --port 5179 --strictPort
 *   CLOSET_STUDIO_BASE_URL=http://127.0.0.1:5179 npx playwright test e2e/bathroom-sink-deck-screenshot.spec.ts
 *
 * The harness renders the real Floor Plan three times from one design model: a
 * 30" Pelican vanity basin on a 30" × 21" vanity sink base between two 3VDB15
 * drawer bases.
 *
 *   before — retired 3" setback and the red "REAR DECK TOO SHALLOW" blocking label
 *   after  — the live rule for the reported 30" × 18" basin: placed, no warning
 *   tight  — the live rule for a deeper basin: placed, neutral advisory only
 *
 * Every number on screen comes from the app's own deck computation.
 *
 * Artifact:
 *   /opt/cursor/artifacts/bathroom-sink-rear-deck-before-after.png
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";
const SHOT = `${OUT_DIR}/bathroom-sink-rear-deck-before-after.png`;

test("the bathroom sink keeps placing when the rear deck is tight", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await page.goto("/dev/sink-deck-shot.html", { waitUntil: "load" });
  await expect(page.getByTestId("pane-facts-after")).toBeVisible({ timeout: 60_000 });

  // AFTER (the reported case): a 2" setback leaves 2.5" of deck, so the basin is
  // placed with no warning at all.
  const after = page.getByTestId("pane-facts-after");
  await expect(after).toContainText("22.5″ deep");
  await expect(after).toContainText("30″ × 18″");
  await expect(after).toContainText("Front setback 2″");
  await expect(after).toContainText("Rear deck 2.50″ = 22.5 − 2 − 18");
  await expect(after).toContainText("Placed. No advisory needed.");
  await expect(after).not.toContainText("TOO SHALLOW");

  // BEFORE (retired): the same basin under a 3" setback left only 1.5" and was
  // shown as a red blocking label.
  const before = page.getByTestId("pane-facts-before");
  await expect(before).toContainText("Front setback 3″");
  await expect(before).toContainText("Rear deck 1.50″ = 22.5 − 3 − 18");
  await expect(before).toContainText("REAR DECK TOO SHALLOW");
  await expect(page.getByTestId("legacy-rear-deck-badge")).toBeVisible();
  await expect(page.getByTestId("legacy-rear-deck-badge")).toHaveCSS("background-color", "rgb(190, 18, 60)");

  // TIGHT (live rule, deeper basin): 1.5" of deck, and the sink is still placeable.
  const tight = page.getByTestId("pane-facts-tight");
  await expect(tight).toContainText("Rear deck 1.50″ = 22.5 − 2 − 19");
  await expect(tight).toContainText("Placed. Neutral advisory only.");
  await expect(tight).not.toContainText("Blocked");

  // The real render paths no longer emit the red blocking label anywhere.
  await expect(page.getByTestId("sink-faucet-deck-conflict-pelican-vanity-basin")).toHaveCount(0);
  // The tight pane draws the new neutral advisory next to the real basin.
  const advisory = page.getByTestId("sink-faucet-deck-advisory-pelican-vanity-basin");
  await expect(advisory).toHaveCount(1);
  await expect(advisory).toContainText("faucet still fits");
  // Three real Floor Plan canvases: one per pane.
  await expect(page.getByTestId("floor-plan-canvas")).toHaveCount(3);

  await page.setViewportSize({ width: 1560, height: 660 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: SHOT });
});
