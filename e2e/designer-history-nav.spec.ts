import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Back / Forward in the Designer header, in both room workspaces and on a phone.
 *
 * The kitchen and the bathroom are the same page with the room type chosen inside
 * it, so one shared control has to appear once, above the workspace, in every
 * case. These assertions drive the real browser History: Back has to land on the
 * real previous page, Forward has to undo that Back, and a direct link has to fall
 * back to the front page instead of dead-ending.
 *
 *   npx vite --port 5178 --strictPort
 *   CLOSET_STUDIO_BASE_URL=http://127.0.0.1:5178 npx playwright test e2e/designer-history-nav.spec.ts
 */
const OUT_DIR = "/opt/cursor/artifacts";

const back = (page: Page) => page.getByTestId("designer-history-back");
const forward = (page: Page) => page.getByTestId("designer-history-forward");
const nav = (page: Page) => page.getByTestId("designer-history-nav");

async function passEmailGate(page: Page) {
  // The Designer chunk is lazy: wait for either the email gate or the workspace
  // before deciding whether there is a gate to pass.
  const gate = page.getByPlaceholder("you@example.com");
  const toolbar = page.getByTestId("designer-toolbar");
  await expect
    .poll(async () => (await gate.isVisible().catch(() => false)) || (await toolbar.isVisible().catch(() => false)), {
      timeout: 60_000,
      message: "the Designer either shows its email gate or its workspace",
    })
    .toBe(true);

  if (await gate.isVisible().catch(() => false)) {
    await gate.fill("designer@cabinetdealz.test");
    await page.getByRole("button", { name: /Launch Designer/i }).click();
  }
  await expect(toolbar).toBeVisible({ timeout: 60_000 });
}

/** Enters the Designer through the front page, the way a shopper does. */
async function openFromFrontPage(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /Start from Scratch/i }).click();
  await expect(page).toHaveURL(/\/design$/);
  await passEmailGate(page);
  // A first visit opens the room-layout chooser over the workspace; close it so
  // the room row and the canvas are the interactive layer.
  await dismissOverlay(page);
}

/** Closes the starter dialog a first visit opens, without changing the design. */
async function dismissOverlay(page: Page) {
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  }
}

/** Switches the workspace to a room type through the catalog's room row. */
async function chooseRoom(page: Page, room: string) {
  const roomButton = page.getByRole("button", { name: room, exact: true }).first();
  const openedDrawer = !(await roomButton.isVisible().catch(() => false));
  if (openedDrawer) {
    // Phones keep the room row inside the bottom Catalog drawer.
    await page.getByRole("button", { name: /^Catalog$/ }).last().click();
  }
  await page.getByRole("button", { name: room, exact: true }).first().click();

  // Bathroom mode replaces the cabinet tab row with Vanity / Fixtures, so the
  // palette itself proves the room type actually changed.
  await expect
    .poll(async () => (await page.locator("body").innerText()).includes(room === "Bathroom" ? "Vanity" : "Base"), {
      timeout: 20_000,
    })
    .toBe(true);

  await dismissOverlay(page);
}

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
});

test.beforeEach(() => {
  // The Designer chunk is large and this spec drives real history round-trips.
  test.setTimeout(150_000);
});

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  test("offers Back and Forward in the kitchen workspace and Back returns to the front page", async ({ page }) => {
    page.on("pageerror", (error) => console.log("[pageerror]", error.message));
    await openFromFrontPage(page);

    await expect(nav(page)).toBeVisible();
    await expect(back(page)).toBeEnabled();
    // A fresh visit has never gone forward, so Forward starts disabled.
    await expect(forward(page)).toBeDisabled();
    await page.screenshot({ path: `${OUT_DIR}/designer-history-desktop-kitchen.png` });

    await back(page).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kitchen & Bath");

    // Returning forward puts the Forward stack behind us again; coming back with
    // the browser's own Forward then offers Forward once more after a Back.
    await page.goForward();
    await passEmailGate(page);
    await expect(forward(page)).toBeDisabled();
  });

  test("shows the same control in the bathroom workspace", async ({ page }) => {
    page.on("pageerror", (error) => console.log("[pageerror]", error.message));
    await openFromFrontPage(page);
    await chooseRoom(page, "Bathroom");

    await expect(nav(page)).toBeVisible();
    await expect(back(page)).toBeEnabled();
    await expect(forward(page)).toBeDisabled();
    await page.screenshot({ path: `${OUT_DIR}/designer-history-desktop-bathroom.png` });
  });

  test("Forward is enabled after a Back and undoes it", async ({ page }) => {
    page.on("pageerror", (error) => console.log("[pageerror]", error.message));
    await openFromFrontPage(page);

    // Leave the Designer, then go back to it: there is now a page ahead.
    await page.getByRole("link", { name: "Shop by Style" }).first().click();
    await expect(page).toHaveURL(/\/styles$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/design$/);
    await expect(nav(page)).toBeVisible();

    // Forward lives beside the workspace, not inside it, so it is already
    // correct while the Designer chunk reloads.
    await expect(forward(page)).toBeEnabled();
    await page.screenshot({ path: `${OUT_DIR}/designer-history-forward-enabled.png` });

    await forward(page).click();
    await expect(page).toHaveURL(/\/styles$/);

    // Back again and Forward is available a second time.
    await page.goBack();
    await expect(page).toHaveURL(/\/design$/);
    await expect(forward(page)).toBeEnabled();
  });

  test("a direct link sends Back to the front page instead of a dead end", async ({ page }) => {
    page.on("pageerror", (error) => console.log("[pageerror]", error.message));
    await page.goto("/design", { waitUntil: "domcontentloaded" });
    await expect(nav(page)).toBeVisible();
    await expect(forward(page)).toBeDisabled();
    await expect(back(page)).toHaveAttribute("title", /front page/i);

    await page.getByTestId("designer-history-back").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kitchen & Bath");
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("keeps both controls on screen in the bathroom workspace without sideways overflow", async ({ page }) => {
    page.on("pageerror", (error) => console.log("[pageerror]", error.message));
    await openFromFrontPage(page);
    await chooseRoom(page, "Bathroom");

    await expect(nav(page)).toBeVisible();
    const backBox = await back(page).boundingBox();
    const forwardBox = await forward(page).boundingBox();
    expect(backBox, "the Back button is laid out").not.toBeNull();
    expect(forwardBox, "the Forward button is laid out").not.toBeNull();
    // Side by side, both inside the viewport, and tall enough for a thumb.
    expect(forwardBox!.x).toBeGreaterThan(backBox!.x + backBox!.width - 1);
    expect(forwardBox!.x + forwardBox!.width).toBeLessThanOrEqual(390);
    expect(backBox!.height).toBeGreaterThanOrEqual(32);

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: `${OUT_DIR}/designer-history-mobile-bathroom.png` });

    await back(page).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
