import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Captures the tower-on-each-wall sequence against two dev servers (main and this branch) so the
 * before/after evidence differs only by the code being served.
 *
 * The scene publishes its own geometry on the canvas (`runBackFt`, `activeTowerRotation`,
 * `activeBoxBackFt`), so each shot is a real measurement of the bug plus a picture of it.
 */
const OUT = process.env.OUT;
const BASE = process.env.BASE;
if (!OUT || !BASE) throw new Error("OUT and BASE are required");
mkdirSync(OUT, { recursive: true });

const STORAGE_KEY = "vendor-closet-studio:v1";
/** A v2 draft persists all four wall layouts; a wall with no tower simply has no bays. */
const layout = (wall, bays) => ({ wallId: wall, bays });
const blank = () => ({ back: layout("back", []), left: layout("left", []), right: layout("right", []), front: layout("front", []) });
const tower = (wall) => [{ id: `bay-${wall}`, wallId: wall, widthIn: 24, items: [{ id: `shelf-${wall}`, wallId: wall, kind: "shelf", bottomIn: 38 }] }];
const draft = (wall, extra = {}) => {
  const wallLayouts = { ...blank(), [wall]: layout(wall, tower(wall)), ...(extra.wallLayouts ?? {}) };
  return {
    version: 2, mode: "closet", mount: "floor", finish: "Glacier White", wall,
    wallWidthIn: 120, roomDepthIn: 108, roomHeightIn: 96,
    wallLayouts, bays: wallLayouts[wall].bays, ...(extra.cornerShelves ? { cornerShelves: extra.cornerShelves } : {}),
  };
};

const designs = {
  "back-wall": draft("back"),
  "left-wall": draft("left"),
  "right-wall": draft("right"),
  "front-wall": draft("front"),
  "back-wall-corner-shelf": draft("back", {
    wallLayouts: { left: layout("left", [{ id: "bay-cl", wallId: "left", widthIn: 24, items: [] }]) },
    cornerShelves: [{
      id: "corner-back-left", sku: "432556", finish: "Glacier White", mount: "fixed", profile: "curved-illustrative",
      cornerId: "back-left", wallIds: ["back", "left"], elevationIn: 40, nominalFootprintIn: 29.5,
      geometryRevision: "mastertrac-np-2026-p13-nominal-envelope-v1", geometrySource: "MasterTrac Spec Book NP 2026 p. 13",
      towerConnection: "visualAligned", capability: "visualPlanning",
    }],
  }),
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(20000);

let n = 0;
for (const [label, design] of Object.entries(designs)) {
  await page.goto(`${BASE}/closet`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(design)]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("guided-room-width").waitFor({ state: "attached", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);

  // Continue the saved draft, which is the same path a returning customer takes.
  const resume = page.getByTestId("guided-continue-draft").or(page.getByTestId("guided-start-blank"));
  await resume.first().click();
  await page.getByTestId("vendor-closet-canvas").waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1800);

  const measured = await page.evaluate(() => {
    const canvas = document.querySelector('canvas[data-testid="vendor-closet-canvas"]');
    if (!canvas) return { error: "no canvas" };
    const d = canvas.dataset;
    return {
      wall: d.designWall,
      runBackFt: d.runBackFt,
      runDepthFt: d.runDepthFt,
      activeTowerRotation: d.activeTowerRotation,
      activeBoxBackFt: d.activeBoxBackFt,
      activeBoxDepthFt: d.activeBoxDepthFt,
      hasCompanion: d.hasCompanion,
      companionRotation: d.companionRotation,
      companionBackFt: d.companionBackFt,
      modelCenterX: d.modelCenterX,
      modelCenterY: d.modelCenterY,
    };
  });
  n += 1;
  const file = `${OUT}/${String(n).padStart(2, "0")}-${label}.png`;
  await page.locator('[data-testid="vendor-scene-panel"]').screenshot({ path: file });
  console.log(`${label} ${JSON.stringify(measured)}`);
}

await browser.close();
