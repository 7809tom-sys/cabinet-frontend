import { expect, test, type Page } from "@playwright/test";

/**
 * Closet Studio tower placement per wall.
 *
 * Owner-reported symptom this locks down: the 3D tower floated away from the wall on the left, right
 * and front walls, and on the back wall whenever a corner shelf was in the plan. PR 257 put every
 * wall into one canonical frame, but the scene then rotated the already-transformed tower again.
 *
 * The scene publishes its own geometry on the canvas dataset, so these assertions read the real
 * transform and the real bounding box instead of comparing WebGL pixels.
 */

const STORAGE_KEY = "vendor-closet-studio:v1";

type Wall = "back" | "left" | "right" | "front";

const layout = (wall: Wall, bays: unknown[]) => ({ wallId: wall, bays });
const blank = () => ({ back: layout("back", []), left: layout("left", []), right: layout("right", []), front: layout("front", []) });
const oneTower = (wall: Wall) => [{ id: `bay-${wall}`, wallId: wall, widthIn: 24, items: [{ id: `shelf-${wall}`, wallId: wall, kind: "shelf", bottomIn: 38 }] }];

function draft(wall: Wall, options: { cornerShelf?: boolean } = {}) {
  const wallLayouts: Record<string, { wallId: Wall; bays: unknown[] }> = { ...blank(), [wall]: layout(wall, oneTower(wall)) };
  if (options.cornerShelf) {
    // The shelf needs a tower on the neighbouring wall, exactly like the real planner builds.
    const neighbour: Wall = wall === "front" ? "left" : "left";
    wallLayouts[neighbour] = layout(neighbour, [{ id: "bay-neighbour", wallId: neighbour, widthIn: 24, items: [] }]);
  }
  return {
    version: 2, mode: "closet", mount: "floor", finish: "Glacier White", wall,
    wallWidthIn: 120, roomDepthIn: 108, roomHeightIn: 96,
    wallLayouts, bays: wallLayouts[wall].bays,
    ...(options.cornerShelf ? {
      cornerShelves: [{
        id: "corner-back-left", sku: "432556", finish: "Glacier White", mount: "fixed", profile: "curved-illustrative",
        cornerId: wall === "front" ? "front-left" : "back-left",
        wallIds: wall === "front" ? ["front", "left"] : ["back", "left"],
        elevationIn: 40, nominalFootprintIn: 29.5,
        geometryRevision: "mastertrac-np-2026-p13-nominal-envelope-v1", geometrySource: "MasterTrac Spec Book NP 2026 p. 13",
        towerConnection: "visualAligned", capability: "visualPlanning",
      }],
    } : {}),
  };
}

type SceneGeometry = {
  wall: Wall;
  runBackFt: number;
  runDepthFt: number;
  rotation: number;
  companionRotation: number;
  companionBackFt: number;
  hasCompanion: boolean;
};

async function readGeometry(page: Page): Promise<SceneGeometry> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-testid="vendor-closet-canvas"]');
    if (!canvas) throw new Error("closet canvas missing");
    const d = canvas.dataset;
    return {
      wall: d.designWall as Wall,
      runBackFt: Number(d.runBackFt),
      runDepthFt: Number(d.runDepthFt),
      rotation: Number(d.activeTowerRotation),
      companionRotation: Number(d.companionRotation),
      companionBackFt: Number(d.companionBackFt),
      hasCompanion: d.hasCompanion === "true",
    };
  });
}

/** Loads a saved draft straight into the studio, the path a returning customer takes. */
async function openDraft(page: Page, design: unknown) {
  await page.goto("/closet", { waitUntil: "domcontentloaded" });
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(design)]);
  await page.reload({ waitUntil: "domcontentloaded" });
  const resume = page.getByTestId("guided-continue-draft").or(page.getByTestId("guided-start-blank"));
  await resume.first().click();
  await expect(page.locator('canvas[data-testid="vendor-closet-canvas"]')).toBeVisible();
  await expect.poll(async () => (await page.evaluate(() => document.querySelector<HTMLCanvasElement>('canvas[data-testid="vendor-closet-canvas"]')?.dataset.designWall))).not.toBeUndefined();
  await page.waitForTimeout(600);
}

/** The tower back sits on the wall slab, the turn is zero, and the board depth is unchanged. */
async function expectTowerAgainstWall(page: Page, wall: Wall, label: string) {
  const geometry = await readGeometry(page);
  expect(geometry.wall, `${label}: active wall`).toBe(wall);
  // The regression: the active tower was rotated with the wall frame it was already built in.
  expect(geometry.rotation, `${label}: active tower rotation`).toBe(0);
  // Back edge at the slab, not floated into the room.
  expect(geometry.runBackFt, `${label}: tower back`).toBeCloseTo(0, 2);
  // Board depth survives, so the tower was not turned sideways either.
  expect(geometry.runDepthFt, `${label}: board depth`).toBeCloseTo(14.5 / 12, 2);
  return geometry;
}

test.describe("Closet Studio keeps every tower against its wall", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/closet", { waitUntil: "domcontentloaded" });
    await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  });

  for (const wall of ["left", "right", "front"] as Wall[]) {
    test(`keeps the ${wall} wall tower on the wall instead of floating it into the room`, async ({ page }) => {
      await openDraft(page, draft(wall));
      await expectTowerAgainstWall(page, wall, wall);
    });
  }

  test("keeps the back wall tower on the wall, which is the one wall that used to be right", async ({ page }) => {
    await openDraft(page, draft("back"));
    await expectTowerAgainstWall(page, "back", "back");
  });

  test("keeps the back wall tower on the wall with a corner shelf in the plan", async ({ page }) => {
    await openDraft(page, draft("back", { cornerShelf: true }));
    const geometry = await expectTowerAgainstWall(page, "back", "back + corner shelf");
    // The companion side-wall tower is turned a quarter about the shared corner, and starts at the
    // corner shelf's 29.5 in envelope instead of stacking a second rotation on its own frame.
    expect(geometry.hasCompanion, "companion is drawn").toBe(true);
    expect(Math.abs(geometry.companionRotation), "companion turn").toBeCloseTo(Math.PI / 2, 2);
    expect(geometry.companionBackFt, "companion back").toBeCloseTo(29.5 / 12, 2);
  });

  test("keeps the front wall tower on the wall with a corner shelf in the plan", async ({ page }) => {
    await openDraft(page, draft("front", { cornerShelf: true }));
    await expectTowerAgainstWall(page, "front", "front + corner shelf");
  });

  test("keeps every wall in one format: the same tower back and depth on all four", async ({ page }) => {
    const seen: string[] = [];
    for (const wall of ["back", "left", "right", "front"] as Wall[]) {
      await openDraft(page, draft(wall));
      const geometry = await expectTowerAgainstWall(page, wall, wall);
      seen.push(`${geometry.runBackFt.toFixed(3)}x${geometry.runDepthFt.toFixed(3)}`);
    }
    expect(new Set(seen).size, "all four walls frame the tower identically").toBe(1);
  });
});
