/**
 * Capture the design-ownership before/after, using the app's own modules.
 *
 * Run with:
 *   npx vite --port 5178 --strictPort
 *   npx playwright test e2e/design-ownership-screenshot.spec.ts
 *
 * The page is built by `client/src/designOwnershipHarness.ts`, which calls the
 * same helpers the Designer, Account, StoreAccount and CRM use, so the links and
 * scope decisions in the screenshot are the ones the app produces.
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";
const OUT_FILE = `${OUT_DIR}/design-ownership.png`;

test("a design opens under its own account and a new save lands on the signed-in account", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("console", (message) => {
    if (message.type() === "error") console.log("[page]", message.text());
  });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await page.goto("/dev/design-ownership.html", { waitUntil: "load" });
  await page.waitForFunction(
    () => (window as unknown as { __designOwnershipShot?: unknown }).__designOwnershipShot != null,
    null,
    { timeout: 60_000 },
  );

  const status = await page.evaluate(
    () => (window as unknown as { __designOwnershipShot: Record<string, unknown> }).__designOwnershipShot,
  );
  // The owner's own design opens on the platform designer, never a store route.
  expect(status.mapleLifeLink).toBe("/design?load=481");
  expect(status.mapleLifeOwner).toBe(7);
  // A store-owned design opens on its own store.
  expect(status.storeDesignLink).toBe("/store/firstclass/design?load=512");
  // An admin saving on a storefront page is filed under their own account.
  expect(status.adminSaveScope).toBe("owner");
  // A storefront customer keeps that storefront's CRM.
  expect(status.customerSaveScope).toBe("firstclass");

  await page.setViewportSize({ width: 1880, height: 1020 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT_FILE, fullPage: true });
});
