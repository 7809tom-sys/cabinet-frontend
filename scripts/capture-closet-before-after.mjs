import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Captures the same sequences against two dev servers (main and this branch) so the before/after
 * evidence is produced by one script and differs only by the code being served.
 */
const OUT = process.env.OUT;
const BASE = process.env.BASE;
if (!OUT || !BASE) throw new Error("OUT and BASE are required");
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(10000);

let n = 0;
const shot = async (label) => {
  n += 1;
  const info = await page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    };
    const canvas = document.querySelector('canvas[data-testid="vendor-closet-canvas"]');
    const centerCoveredBy = canvas ? (() => {
      const box = canvas.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return top ? (top.getAttribute("data-testid") ?? top.tagName) : "none";
    })() : "no-canvas";
    return {
      panel: rect('[data-testid="vendor-scene-panel"]'),
      canvas: rect('canvas[data-testid="vendor-closet-canvas"]'),
      coveredAtCenter: centerCoveredBy,
      modelCenter: canvas ? [canvas.dataset.modelCenterX, canvas.dataset.modelCenterY] : null,
      workspaceChildren: Array.from(document.querySelector('[data-testid="vendor-workspace"]')?.children ?? []).map((el) => el.tagName + (el.getAttribute("data-testid") ? `:${el.getAttribute("data-testid")}` : "")),
    };
  });
  console.log(`${label} ${JSON.stringify(info)}`);
  await page.screenshot({ path: `${OUT}/${String(n).padStart(2, "0")}-${label}.png` });
};

await page.goto(`${BASE}/closet`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.getByTestId("guided-start-blank").click();
await page.waitForTimeout(900);
await shot("session-start");

// Tom's repro: pantry 7 ft x 9 ft, then a closet split.
await page.getByTestId("vendor-change-answers").click();
await page.waitForTimeout(500);
const backToRoom = page.getByTestId("guided-back");
if (await backToRoom.count()) { await backToRoom.click(); await page.waitForTimeout(400); }
const pantry = page.getByTestId("guided-space-pantry");
if (await pantry.count()) { await pantry.click(); }
await page.getByTestId("guided-width").fill("84");
await page.getByTestId("guided-depth").fill("108");
await page.getByTestId("guided-height").fill("84");
await page.getByTestId("guided-next").click();
await page.waitForTimeout(300);
await page.getByTestId("guided-build").click();
await page.waitForTimeout(1100);
await shot("pantry-7x9-built");
await page.getByTestId("guided-tune").click();
await page.waitForTimeout(400);

await page.getByTestId("vendor-change-answers").click();
await page.waitForTimeout(500);
await page.getByTestId("guided-back").click();
await page.waitForTimeout(400);
await page.getByTestId("guided-space-closet").click();
await page.getByTestId("guided-next").click();
await page.waitForTimeout(300);
await page.getByTestId("guided-build").click();
await page.waitForTimeout(1100);
await shot("closet-split-built");
await page.getByTestId("guided-tune").click();
await page.waitForTimeout(400);

// Open the tower sheet, which is where the viewer used to disappear.
await page.getByTestId("vendor-toolbar-edit").click();
await page.waitForTimeout(500);
const partsTab = page.getByRole("button", { name: "Parts", exact: true }).first();
if (await partsTab.count()) { await partsTab.click(); await page.waitForTimeout(500); }
await shot("tower-sheet-open");
const addTower = page.getByRole("button", { name: /^Add( first tower)?$/ }).first();
if (await addTower.count()) { await addTower.click(); await page.waitForTimeout(1000); }
await shot("after-add-tower");

// Wall views.
const tabs = page.getByTestId("vendor-view-tabs").getByRole("tab");
for (const wall of ["Left", "Right", "Back"]) {
  const tab = tabs.filter({ hasText: new RegExp(`^${wall}$`) });
  if (await tab.count()) { await tab.first().click(); await page.waitForTimeout(700); await shot(`elevation-${wall.toLowerCase()}`); }
}
const tab3d = tabs.filter({ hasText: /^3D$/ });
if (await tab3d.count()) { await tab3d.first().click(); await page.waitForTimeout(800); await shot("back-to-3d"); }
await browser.close();
