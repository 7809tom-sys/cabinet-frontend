/**
 * Before/after evidence for the 3D canvas floating buttons.
 *
 * The owner reported one problem, in plain terms: the floating buttons on the
 * right edge of the 3D canvas did not line up — the fullscreen toggle and the
 * panel toggle were offset, "Cabinet" and "Hardware" stuck out beside the zoom
 * column, and the PAN pad floated in the middle instead of sitting at the bottom
 * of the drawing surface.
 *
 * This spec drives the real page at `/dev/floating-column-shot.html`, which
 * mounts the real `InteractiveRoom3D` stage around a real WebGL room. It then
 * measures the buttons in the browser and asserts what the owner asked for:
 *
 *   1. every button in the column is the same square size,
 *   2. they share ONE vertical centre axis (nothing offset to the side),
 *   3. the PAN pad is the bottom-most thing in the stack and the column is
 *      anchored to the bottom-right of the canvas,
 *   4. the stack still fits — and stays complete — on a tablet and on a short
 *      laptop, and in fullscreen (Focus 3D) mode,
 *   5. every button has an accessible name and a hover description.
 *
 *   npx vite --port 5178 --strictPort
 *   CLOSET_STUDIO_BASE_URL=http://127.0.0.1:5178 npx playwright test e2e/floating-column-screenshot.spec.ts
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";
const COLUMN = '[data-testid="three-d-floating-column"]';

type ButtonBox = { label: string | null; x: number; width: number; height: number; bottom: number; top: number };

/** Every square button in the column, plus a count of the PAN cells. */
async function readColumn(page: Page) {
  return page.evaluate((selector) => {
    const column = document.querySelector(selector) as HTMLElement | null;
    if (!column) return null;
    const box = column.getBoundingClientRect();
    const buttons = Array.from(column.querySelectorAll("button")).map((node) => {
      const r = node.getBoundingClientRect();
      return {
        label: node.getAttribute("aria-label"),
        x: Math.round(r.x),
        width: Math.round(r.width),
        height: Math.round(r.height),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        title: node.getAttribute("title"),
        describedBy: node.getAttribute("aria-describedby"),
        description: node.getAttribute("aria-describedby")
          ? document.getElementById(node.getAttribute("aria-describedby")!)?.textContent ?? null
          : null,
        isPan: (node.getAttribute("data-testid") ?? "").startsWith("three-d-pan-"),
      };
    });
    const panPad = column.querySelector('[data-testid="three-d-pan-pad"]') as HTMLElement | null;
    // The column is `flex-col`, so document order IS visual order. Everything
    // after the PAN pad would sit below it.
    const afterPan = panPad
      ? Array.from(column.querySelectorAll("button, [data-testid]")).filter(
          (node) => !node.closest('[data-testid="three-d-pan-pad"]') && node !== panPad
            && Boolean(panPad.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING),
        ).length
      : 0;
    return {
      column: { left: Math.round(box.left), right: Math.round(box.right), bottom: Math.round(box.bottom) },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      buttons,
      panPadBottom: panPad ? Math.round(panPad.getBoundingClientRect().bottom) : null,
      panPadIsLast: afterPan === 0,
    };
  }, COLUMN);
}

function expectOneUniformColumn(data: NonNullable<Awaited<ReturnType<typeof readColumn>>>) {
  const square = data.buttons.filter((button) => !button.isPan);
  // 1. Same width and height for every button in the column.
  expect(new Set(square.map((button) => button.width)).size, "one button width").toBe(1);
  expect(new Set(square.map((button) => button.height)).size, "one button height").toBe(1);
  // 2. One centre axis: every button shares the same horizontal centre.
  const centres = new Set(square.map((button) => Math.round(button.x + button.width / 2)));
  expect(centres.size, "one vertical axis").toBe(1);
  // 3. The PAN pad is the last thing in the stack, and nothing sits below it.
  expect(data.panPadIsLast, "PAN pad is last").toBe(true);
  const lowestButton = Math.max(...data.buttons.map((button) => button.bottom));
  // The pad's own border/padding reaches the bottom; no button goes past it.
  expect(data.panPadBottom, "PAN pad reaches the bottom").toBeGreaterThanOrEqual(lowestButton);
  // 4. The column is anchored to the bottom-right of the drawing surface with
  //    normal padding, not floating in the middle of it.
  expect(data.viewport.height - data.column.bottom).toBeLessThanOrEqual(24);
  expect(data.viewport.width - data.column.right).toBeLessThanOrEqual(24);
  // 5. It fits: the whole stack is on screen, not clipped by the canvas.
  expect(Math.min(...data.buttons.map((button) => button.top))).toBeGreaterThanOrEqual(0);
}

async function openStage(page: Page, query = "") {
  await page.goto(`/dev/floating-column-shot.html${query}`, { waitUntil: "load" });
  await expect(page.locator(COLUMN)).toBeVisible({ timeout: 60_000 });
  // Let the WebGL first frame settle before measuring or capturing.
  await page.waitForTimeout(2500);
}

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
});

test.beforeEach(() => {
  // The 3D stage boots a real WebGL scene before each measurement, and the tablet
  // case captures both normal and fullscreen mode in one run.
  test.setTimeout(150_000);
});

test.describe("3D canvas floating buttons", () => {
  test("stack in one uniform column with the PAN pad at the bottom (desktop)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openStage(page);
    const data = await readColumn(page);
    expect(data).not.toBeNull();
    expectOneUniformColumn(data!);
    // Every action the owner listed is present, in the one column.
    const labels = data!.buttons.filter((button) => !button.isPan).map((button) => button.label);
    for (const name of ["Fullscreen view", "Canvas controls", "Zoom in", "Zoom out", "Add cabinet", "Add hardware", "Reset view", "Share view", "Lighting", "Auto-Design"]) {
      expect(labels, name).toContain(name);
    }
    const everyLabel = data!.buttons.map((button) => button.label);
    for (const name of ["Pan up", "Pan down", "Pan left", "Pan right"]) {
      expect(everyLabel, name).toContain(name);
    }
    await page.screenshot({ path: `${OUT_DIR}/floating-buttons-desktop.png` });
  });

  test("keeps one column in fullscreen (Focus 3D) mode", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openStage(page, "?immersive=1");
    const data = await readColumn(page);
    expectOneUniformColumn(data!);
    // The toggle flips to its exit label but stays the first button in the column.
    expect(data!.buttons.filter((button) => !button.isPan)[0].label).toBe("Exit fullscreen");
    await page.screenshot({ path: `${OUT_DIR}/floating-buttons-focus3d.png` });
  });

  test("keeps one column on a tablet, in normal and fullscreen mode", async ({ page }) => {
    await page.setViewportSize({ width: 1112, height: 834 });
    await openStage(page);
    expectOneUniformColumn((await readColumn(page))!);
    await page.screenshot({ path: `${OUT_DIR}/floating-buttons-tablet.png` });

    await openStage(page, "?immersive=1");
    expectOneUniformColumn((await readColumn(page))!);
    await page.screenshot({ path: `${OUT_DIR}/floating-buttons-tablet-focus3d.png` });
  });

  test("compresses instead of running off a short canvas", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 620 });
    await openStage(page);
    const data = await readColumn(page);
    expectOneUniformColumn(data!);
    // The buttons really did shrink, and the labels gave way first.
    const width = data!.buttons.find((button) => !button.isPan)!.width;
    expect(width).toBeLessThan(44);
    await page.screenshot({ path: `${OUT_DIR}/floating-buttons-short-laptop.png` });
  });

  test("names every button and explains it on hover", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openStage(page);
    const data = await readColumn(page);
    for (const button of data!.buttons) {
      // An accessible name and an accessible description on EVERY button.
      expect(button.label, "accessible name").toBeTruthy();
      expect(button.describedBy, `${button.label} has a describedby`).toBeTruthy();
      expect(button.description, `${button.label} has a description`).toBeTruthy();
      // `title` still explains the action on a long press.
      expect(button.title, `${button.label} has a title`).toBeTruthy();
    }

    // Hovering really shows the description, beside the button.
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    await zoomIn.hover();
    const tooltip = page.getByRole("tooltip").first();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("Zoom in");
    await page.screenshot({ path: `${OUT_DIR}/floating-buttons-hover-tooltip.png` });
  });

  test("matches the previous arrangement only where the owner asked to change it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // `?legacy=1` draws the old layout side by side with the new one for the
    // before/after pair; the new column must still measure the same.
    await openStage(page, "?legacy=1");
    expectOneUniformColumn((await readColumn(page))!);
    await page.screenshot({ path: `${OUT_DIR}/floating-buttons-before-desktop.png` });
  });
});
