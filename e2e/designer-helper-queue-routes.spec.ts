import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Confirm the Designer surface exists on the real route, not only in the
 * screenshot harness: the Share / Get a designer helper button is mounted in the
 * customer's pricing panel, under the Estimated Total, with its whole label
 * readable on screen.
 *
 * The Designer sits behind the public email gate, so the test walks through it,
 * exactly like a customer. The dialog's behaviour is covered by
 * `designerHelperCards.test.tsx` and the harness screenshots; this spec exists to
 * prove the button is really wired into the shipped Designer panel.
 *
 * Output: /opt/cursor/artifacts/designer-helper-share-button-live.png
 */
const OUT_DIR = "/opt/cursor/artifacts";

test("the real Designer panel offers Share / Get a designer helper", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/design", { waitUntil: "load" });

  // The public Designer opens behind an email gate. Walk through it as a customer.
  const email = page.locator('input[type="email"]').first();
  await email.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
  if (await email.count()) {
    await email.fill("dana.miller@example.com");
    const name = page.locator('input[autocomplete="name"], input[placeholder*="Name"]').first();
    if (await name.count()) await name.fill("Dana Miller");
    await page.getByRole("button", { name: /Launch Designer/i }).first().click();
  }

  const button = page.getByTestId("designer-helper-share-button");
  await expect(button).toBeVisible({ timeout: 30_000 });
  await expect(button).toContainText("Share / Get a designer helper");

  // It sits in the pricing panel next to the total, and its whole label is on
  // screen — a customer can read the action without hunting a scroll rail.
  const panel = page.getByTestId("price-panel-quick-actions");
  await expect(panel.getByTestId("designer-helper-share-button")).toBeVisible();
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(1440);

  await page.screenshot({ path: `${OUT_DIR}/designer-helper-share-button-live.png`, fullPage: false });

  const unexpected = errors.filter((message) => !/Failed to fetch|NetworkError|ECONNREFUSED|Load failed|Unexpected end of JSON/i.test(message));
  expect(unexpected).toEqual([]);
});
