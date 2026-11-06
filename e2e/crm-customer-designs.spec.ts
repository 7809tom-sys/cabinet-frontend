/**
 * Screenshot of the CRM customer saved-designs block, on the sample data at
 * /dev/crm-customer-designs. The left pane is customer 5192 with one linked
 * design out of six saved on the account; the right pane is the same customer
 * with no stored link, which now says so and offers a link action.
 *
 *   npx vite --port 5178 --strictPort
 *   CLOSET_STUDIO_BASE_URL=http://127.0.0.1:5178 npx playwright test e2e/crm-customer-designs.spec.ts
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";
const OUT_FILE = `${OUT_DIR}/crm-customer-5192-linked-designs.png`;

test("customer 5192 shows only the linked design", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await page.goto("/dev/crm-customer-designs", { waitUntil: "load" });
  await page.waitForSelector('[data-testid="preview-linked-designs"]', { timeout: 60_000 });

  const linked = page.locator('[data-testid="preview-linked-designs"]');
  await expect(linked).toHaveAttribute("data-linked-design-count", "1");
  await expect(page.locator('[data-testid="preview-linked-designs"] [data-testid="customer-linked-design"]')).toHaveCount(1);
  await expect(linked).toContainText("Rivera kitchen — final");
  await expect(linked).toContainText("Linked to this deal");
  // The list holds one design; the picker below it may offer the unlinked ones,
  // which is exactly how a design gets linked in the first place.
  const listedNames = await page.locator('[data-testid="preview-linked-designs"] [data-testid="customer-linked-design"]').allInnerTexts();
  expect(listedNames.join(" ")).not.toContain("Rivera pantry");
  expect(listedNames.join(" ")).not.toContain("Untitled plan");
  const pickerOptions = await page.locator('[data-testid="preview-linked-designs"] [data-testid="customer-design-picker-select"] option').allInnerTexts();
  expect(pickerOptions.join(" ")).toContain("Rivera pantry");
  expect(pickerOptions.join(" ")).not.toContain("Rivera kitchen — final");

  const empty = page.locator('[data-testid="preview-empty-designs"]');
  await expect(empty).toHaveAttribute("data-linked-design-count", "0");
  await expect(empty).toContainText("No design linked to this customer yet.");
  await expect(empty).toContainText("Link a saved design");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: OUT_FILE, fullPage: true });
});
