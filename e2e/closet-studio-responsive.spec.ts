import { expect, test, type Page } from "@playwright/test";

/**
 * Closet Studio responsive layout, canvas priority and the Delete plan flow.
 *
 * These assertions are deliberately geometric: they read real bounding boxes and use
 * elementFromPoint, so a CSS regression that hides, shrinks or covers the drawing fails here
 * even when the markup still looks plausible.
 */

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900, minCanvasShare: 0.6, panelsClosedByDefault: false },
  { name: "tablet-768x1024", width: 768, height: 1024, minCanvasShare: 0.6, panelsClosedByDefault: true },
  { name: "tablet-1024x768", width: 1024, height: 768, minCanvasShare: 0.6, panelsClosedByDefault: true },
  { name: "phone-390x844", width: 390, height: 844, minCanvasShare: 0.6, panelsClosedByDefault: true },
  { name: "phone-360x740", width: 360, height: 740, minCanvasShare: 0.6, panelsClosedByDefault: true },
] as const;

async function enterStudio(page: Page) {
  await page.goto("/closet", { waitUntil: "networkidle" });
  // The simple start's blank-tower entry, so this spec keeps testing the workspace itself.
  await page.getByTestId("guided-start-blank").click();
  await expect(page.getByTestId("vendor-closet-studio")).toBeVisible();
  await expect(page.locator('canvas[data-testid="vendor-closet-canvas"]')).toBeVisible();
  // Give the renderer's ResizeObserver a frame at the real viewport size.
  await page.waitForTimeout(400);
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 2 });

    test("the drawing is on screen, has priority space, and nothing covers it", async ({ page }) => {
      await enterStudio(page);
      await page.screenshot({ path: `test-artifacts/closet-studio/${viewport.name}/01-studio-load.png`, fullPage: false });

      const panel = await page.getByTestId("vendor-scene-panel").boundingBox();
      expect(panel, "the canvas panel is rendered").not.toBeNull();
      expect(panel!.y).toBeGreaterThanOrEqual(0);
      expect(panel!.y).toBeLessThan(viewport.height);
      expect(panel!.height).toBeGreaterThan(120);

      const visibleHeight = Math.min(panel!.height, viewport.height - panel!.y);
      const share = (panel!.width * visibleHeight) / (viewport.width * viewport.height);
      expect(share, `canvas occupies ${(share * 100).toFixed(1)}% of the viewport`).toBeGreaterThanOrEqual(viewport.minCanvasShare);

      // elementFromPoint at the canvas center must land on the canvas, not a panel over it.
      const covered = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-testid="vendor-closet-canvas"]');
        if (!canvas) return "no canvas";
        const rect = canvas.getBoundingClientRect();
        const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return top === canvas ? null : `${top?.tagName}.${top?.className}`;
      });
      expect(covered, "the canvas center is not covered by a panel").toBeNull();

      if (viewport.panelsClosedByDefault) {
        await expect(page.getByTestId("vendor-tablet-options-dock")).toBeHidden();
        await expect(page.getByTestId("vendor-blueprint-column")).toBeHidden();
      }
    });

    test("Delete plan is in the viewport without scrolling and is a 44px target", async ({ page }) => {
      await enterStudio(page);
      const button = page.getByTestId("vendor-delete-plan");
      await expect(button).toBeVisible();
      const box = (await button.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: `test-artifacts/closet-studio/${viewport.name}/02-delete-plan.png` });
    });

    test("scrolling the controls panel keeps its position and the page never jumps", async ({ page }) => {
      await enterStudio(page);
      await page.getByTestId("vendor-toolbar-edit").click();
      await expect(page.getByTestId("vendor-tablet-options-dock")).toBeVisible();
      await page.screenshot({ path: `test-artifacts/closet-studio/${viewport.name}/03-controls-open.png` });

      const list = page.locator("#vendor-section-parts");
      await list.evaluate((element) => { element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight); });
      const setTo = await list.evaluate((element) => element.scrollTop);
      expect(setTo, "the controls list is actually scrollable").toBeGreaterThan(0);

      // Wait past any deferred scrollIntoView/focus work, then assert the position held.
      await page.waitForTimeout(500);
      expect(await list.evaluate((element) => element.scrollTop)).toBeCloseTo(setTo, 0);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await page.screenshot({ path: `test-artifacts/closet-studio/${viewport.name}/04-controls-scrolled.png` });
    });

    test("Delete plan confirms in place and Cancel keeps the plan", async ({ page }) => {
      await enterStudio(page);
      await page.getByTestId("vendor-delete-plan").click();
      const dialog = page.getByTestId("vendor-delete-plan-dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("Delete this closet plan and start over? This can't be undone.");
      const box = (await dialog.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({ path: `test-artifacts/closet-studio/${viewport.name}/05-delete-dialog.png` });

      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByTestId("vendor-closet-studio")).toBeVisible();
      expect(await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith("vendor-closet-studio")))).toBe(true);
    });

    test("confirming Delete plan clears the draft and returns to the start gate", async ({ page }) => {
      await enterStudio(page);
      await page.getByTestId("vendor-delete-plan").click();
      await page.getByTestId("vendor-delete-plan-confirm").click();
      await expect(page.getByTestId("guided-gate")).toBeVisible();
      await expect(page.getByTestId("vendor-closet-studio")).toHaveCount(0);
      expect(await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith("vendor-closet-studio")))).toBe(false);
      await page.screenshot({ path: `test-artifacts/closet-studio/${viewport.name}/06-back-to-start.png` });
    });
  });
}
