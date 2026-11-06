/**
 * Captures the bathroom Floor Plan both ways so the review evidence is produced
 * by one script and differs only by the code being served.
 *
 * The harness at `/dev/bathroom-zones-shot.html` renders the real `PlanCanvas`
 * with a saved furniture payload that still contains the old `bathroom-zone-*`
 * rows, so the "before" images come from the previous build and the "after"
 * images come from this branch.
 *
 * Usage:
 *   OUT=test-artifacts/bathroom-zones/before BASE=http://127.0.0.1:5178 \
 *     npx playwright test e2e/bathroom-zones-screenshot.spec.ts
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = process.env.OUT;
const LABEL = process.env.LABEL ?? "plan";

test(`bathroom plan renders without planning zones (${LABEL})`, async ({ page }) => {
  if (!OUT) throw new Error("OUT is required");
  mkdirSync(OUT, { recursive: true });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await page.goto("/dev/bathroom-zones-shot.html", { waitUntil: "load" });
  await page.waitForSelector("[data-furniture-uid]", { timeout: 60_000 });
  await page.waitForTimeout(600);

  const zoneBoxes = await page.locator('[data-furniture-definition^="bathroom-zone-"]').count();
  const attributesControls = await page.locator('[data-testid^="bathroom-zone-attributes-"]').count();
  const warnings = await page.locator('[data-testid^="bathroom-zone-overlap-"]').count();
  const cabinetsOnPlan = await page.locator("[data-furniture-uid]").count();
  console.log(`${LABEL} zoneRows=${zoneBoxes} attributes=${attributesControls} warnings=${warnings} furniture=${cabinetsOnPlan}`);

  await page.locator("#plan").screenshot({ path: `${OUT}/01-${LABEL}-bathroom-plan.png` });
  await page.screenshot({ path: `${OUT}/02-${LABEL}-bathroom-plan-full.png`, fullPage: false });

  // Only the previous build still has a zone to select; select it so the dashed
  // box, its delete X and its Attributes control are all visible in one shot.
  if (zoneBoxes > 0) {
    await page.locator('[data-furniture-definition="bathroom-zone-toilet"]').click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(300);
    const selectedAttributes = await page.locator('[data-testid^="bathroom-zone-attributes-"]').count();
    console.log(`${LABEL} selectedZoneAttributes=${selectedAttributes}`);
    await page.locator("#plan").screenshot({ path: `${OUT}/03-${LABEL}-zone-selected.png` });
  }

  // Fixtures must be draggable: drag the toilet across the plan and read back its position.
  const toilet = page.locator('[data-furniture-uid="toilet"]');
  const before = await toilet.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
  await page.mouse.down();
  await page.mouse.move(before!.x + before!.width / 2 + 160, before!.y + before!.height / 2 + 120, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await toilet.boundingBox();
  console.log(`${LABEL} toilet moved dx=${Math.round((after?.x ?? 0) - before!.x)} dy=${Math.round((after?.y ?? 0) - before!.y)}`);
  await page.locator("#plan").screenshot({ path: `${OUT}/04-${LABEL}-toilet-moved.png` });
});
