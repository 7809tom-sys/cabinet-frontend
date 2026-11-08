import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * End-to-end proof that a 3" filler beside a range is selectable, offers its
 * right-click menu, and is removed from it — with the real PlanCanvas.
 *
 *   npx vite --port 5179 --strictPort
 *   CLOSET_STUDIO_BASE_URL=http://127.0.0.1:5179 npx playwright test e2e/designer-filler-selection.spec.ts
 */
test("a 3in filler beside a range can be selected, right-clicked, and deleted", async ({ page }) => {
  mkdirSync("/opt/cursor/artifacts", { recursive: true });
  test.setTimeout(90_000);
  // A smaller canvas fits the plan at a lower zoom, which is exactly the case
  // the owner hit: a 3" filler narrower than the 12 px minimum target.
  await page.setViewportSize({ width: 560, height: 400 });
  await page.goto("/dev/filler-flow.html", { waitUntil: "load" });
  await page.waitForFunction(() => (window as unknown as { __fillerFlow?: { ready: boolean } }).__fillerFlow?.ready === true);

  const filler = page.locator('[data-cabinet-uid="filler"]');
  await expect(filler).toBeVisible();

  // The drawn board is thin; the target is at least 12 px across.
  const target = await filler.boundingBox();
  const drawn = await page.locator('[data-cabinet-uid="filler"] [data-plan-item-body="true"]').boundingBox();
  expect(target!.width).toBeGreaterThanOrEqual(12);
  expect(drawn!.width).toBeLessThan(target!.width);

  // Hovering the drawn board shows the move cursor, not the default arrow.
  const centre = { x: drawn!.x + drawn!.width / 2, y: drawn!.y + drawn!.height / 2 };
  const cursor = await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    return hit?.closest('[data-cabinet-uid="filler"]') ? getComputedStyle(hit!.closest('[data-cabinet-uid="filler"]') as HTMLElement).cursor : "miss";
  }, centre);
  expect(cursor).toBe("move");

  // A click selects the filler.
  await page.mouse.click(centre.x, centre.y);
  expect(await page.evaluate(() => (window as unknown as { __fillerFlow: { selected: string[] } }).__fillerFlow.selected)).toContain("filler");

  // A right-click opens the item menu, and Remove is offered.
  await page.mouse.click(centre.x, centre.y, { button: "right" });
  await expect(page.getByTestId("placed-item-context-menu")).toBeVisible();
  await expect(page.getByTestId("placed-item-menu-remove")).toBeVisible();
  await page.screenshot({ path: "/opt/cursor/artifacts/filler-item-menu.png" });
  await page.getByTestId("placed-item-menu-remove").click();
  expect(await page.evaluate(() => (window as unknown as { __fillerFlow: { deleted: string[] } }).__fillerFlow.deleted)).toEqual(["filler"]);
});
