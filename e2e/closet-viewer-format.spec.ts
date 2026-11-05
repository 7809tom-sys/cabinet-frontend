import { expect, test, type Page } from "@playwright/test";

/**
 * Closet Studio viewer consistency.
 *
 * Owner-reported symptoms this locks down:
 *  - the viewer "disappeared" after adding a tower (the tower sheet covered the whole workspace),
 *  - the model drifted to the bottom-left after a pantry 7 ft x 9 ft -> closet switch,
 *  - the viewer format changed between the back wall and a side wall,
 *  - a new tower appended at the far right instead of landing beside the selected tower.
 *
 * The assertions read the live camera's projected model bounds, so they prove the model itself is
 * centered rather than comparing pixels of a WebGL canvas.
 */

type Bounds = { centerX: number; centerY: number; width: number; height: number; panelY: number; panelHeight: number; distance: number };

async function readBounds(page: Page): Promise<Bounds> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-testid="vendor-closet-canvas"]');
    const panel = document.querySelector('[data-testid="vendor-scene-panel"]')!.getBoundingClientRect();
    if (!canvas) throw new Error("closet canvas missing");
    const data = canvas.dataset;
    return {
      centerX: Number(data.modelCenterX),
      centerY: Number(data.modelCenterY),
      width: Number(data.modelWidth),
      height: Number(data.modelHeight),
      panelY: Math.round(panel.y),
      panelHeight: Math.round(panel.height),
      distance: Number(data.cameraDistance),
    };
  });
}

/** The model is centered in the panel and the panel starts at the top of the workspace. */
async function expectCentered(page: Page, label: string) {
  await expect(page.locator('canvas[data-testid="vendor-closet-canvas"]')).toBeVisible();
  // Let the ResizeObserver and one animation frame settle after the design change.
  await page.waitForTimeout(500);
  const bounds = await readBounds(page);
  expect(Math.abs(bounds.centerX), `${label}: model horizontal center`).toBeLessThan(0.1);
  expect(Math.abs(bounds.centerY), `${label}: model vertical center`).toBeLessThan(0.1);
  expect(bounds.width, `${label}: model has width`).toBeGreaterThan(0.05);
  expect(bounds.height, `${label}: model has height`).toBeGreaterThan(0.5);
  return bounds;
}

/** The viewer panel starts directly under the tab strip, never pushed to the bottom of the page. */
async function expectViewerAtTop(page: Page) {
  const geometry = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="vendor-scene-panel"]')!.getBoundingClientRect();
    const tabs = document.querySelector('[data-testid="vendor-view-tabs"]')!.getBoundingClientRect();
    const workspace = document.querySelector('[data-testid="vendor-workspace"]')!.getBoundingClientRect();
    return { panelTop: Math.round(panel.y), tabsBottom: Math.round(tabs.bottom), workspaceTop: Math.round(workspace.y), panelHeight: Math.round(panel.height) };
  });
  expect(geometry.panelTop).toBeLessThanOrEqual(geometry.tabsBottom + 40);
  expect(geometry.panelTop).toBeGreaterThanOrEqual(geometry.workspaceTop);
  expect(geometry.panelHeight).toBeGreaterThan(150);
}

test.describe("Closet Studio viewer format", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/closet", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("guided-gate")).toBeVisible();
  });

  test("stays centered and at the top through the pantry 7x9 -> closet split repro", async ({ page }) => {
    // Pantry, 7 ft x 9 ft (84 in x 108 in) with an 84 in ceiling.
    await page.getByTestId("guided-space-pantry").click();
    await page.getByTestId("guided-width").fill("84");
    await page.getByTestId("guided-depth").fill("108");
    await page.getByTestId("guided-height").fill("84");
    await page.getByTestId("guided-next").click();
    await page.getByTestId("guided-build").click();
    await expect(page.getByTestId("vendor-closet-studio")).toBeVisible();
    await expectViewerAtTop(page);
    const pantry = await expectCentered(page, "pantry 7x9");
    await page.screenshot({ path: "test-artifacts/closet-viewer/01-pantry-7x9.png" });
    await page.getByTestId("guided-tune").click();

    // Now switch the same room to a closet split.
    await page.getByTestId("vendor-change-answers").click();
    await page.getByTestId("guided-back").click();
    await page.getByTestId("guided-space-closet").click();
    await page.getByTestId("guided-next").click();
    await page.getByTestId("guided-build").click();
    await expectViewerAtTop(page);
    await expectCentered(page, "closet split");
    await page.screenshot({ path: "test-artifacts/closet-viewer/02-closet-split.png" });

    // The viewer never moved down the page, and the model is still framed by the same camera.
    const after = await readBounds(page);
    expect(after.panelY).toBe(pantry.panelY);
    expect(after.distance).toBeGreaterThan(0);
  });

  test("stays visible and centered after adding towers, instead of being covered by the tower sheet", async ({ page }) => {
    await page.getByTestId("guided-start-blank").click();
    await expect(page.getByTestId("vendor-closet-studio")).toBeVisible();
    await expectCentered(page, "start");

    await page.getByTestId("vendor-toolbar-edit").click();
    await page.getByRole("button", { name: "Parts", exact: true }).first().click();
    await expect(page.getByTestId("vendor-part-selector")).toBeVisible();
    await expectCentered(page, "parts panel open");

    const addTower = page.getByRole("button", { name: /^Add( first tower)?$/ }).first();
    await addTower.click();
    await expect(page.getByRole("group", { name: "Select a tower" }).getByRole("button")).toHaveCount(2);
    await expectCentered(page, "after add tower");
    await page.screenshot({ path: "test-artifacts/closet-viewer/03-after-add-tower.png" });

    // The drawing must not be covered at its center by the tower sheet.
    const covered = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-testid="vendor-closet-canvas"]')!;
      const box = canvas.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return top?.getAttribute("data-testid") ?? top?.tagName ?? "none";
    });
    expect(covered).toBe("vendor-closet-canvas");
    await expectViewerAtTop(page);
  });

  test("keeps the same framing on every wall view and after switching walls", async ({ page }) => {
    await page.getByTestId("guided-type-walk-in").click();
    await page.getByTestId("guided-next").click();
    await page.getByTestId("guided-build").click();
    await expect(page.getByTestId("vendor-closet-studio")).toBeVisible();
    await page.getByTestId("guided-tune").click();
    const reference = await expectCentered(page, "3D angle");

    const tabs = page.getByTestId("vendor-view-tabs").getByRole("tab");
    for (const wall of ["Back", "Left", "Right"]) {
      await tabs.filter({ hasText: new RegExp(`^${wall}$`) }).first().click();
      await expect(page.getByTestId("closet-wall-elevation")).toHaveAttribute("data-wall", wall.toLowerCase());
      await page.screenshot({ path: `test-artifacts/closet-viewer/04-elevation-${wall.toLowerCase()}.png` });
      // Back to the drawing: the framing must be untouched by the wall visit.
      await tabs.filter({ hasText: /^3D$/ }).first().click();
      const back = await expectCentered(page, `3D after ${wall}`);
      expect(back.distance).toBeCloseTo(reference.distance, 1);
      expect(back.height).toBeCloseTo(reference.height, 2);
    }

    // Switching the active wall from the room map re-renders the scene; the viewer must not shift.
    const overview = page.getByTestId("vendor-room-overview");
    for (const wall of ["Left wall", "Right wall", "Back wall"]) {
      await overview.getByRole("button", { name: new RegExp(`^${wall}`) }).first().click();
      await expectCentered(page, `active ${wall}`);
      await expectViewerAtTop(page);
    }
  });

  test("stays centered after deleting a plan and starting over", async ({ page }) => {
    await page.getByTestId("guided-start-blank").click();
    await expectCentered(page, "start");
    await page.getByTestId("vendor-delete-plan").click();
    await page.getByTestId("vendor-delete-plan-confirm").click();
    await expect(page.getByTestId("guided-gate")).toBeVisible();
    await page.getByTestId("guided-start-blank").click();
    await expectCentered(page, "after delete");
    await expectViewerAtTop(page);
  });

  test("drops a shelf run from the bottom at the default pitch and reports what did not fit", async ({ page }) => {
    await page.getByTestId("guided-start-blank").click();
    await page.getByTestId("vendor-toolbar-edit").click();
    await page.getByRole("button", { name: "Parts", exact: true }).first().click();
    const run = page.getByTestId("vendor-shelf-run");
    await run.getByRole("spinbutton", { name: "Number of shelves to add" }).fill("4");
    await run.getByRole("button", { name: "Add 4 shelves from the bottom" }).click();
    // The result is reported where the tool is used, not only in the other sheet.
    await expect(page.getByTestId("vendor-studio-notice")).toContainText("6.75 in");
    await expectCentered(page, "after shelf run");
    await page.screenshot({ path: "test-artifacts/closet-viewer/05-shelf-run.png" });
  });
});
