/**
 * Screenshot of the staff quick lookup, on the sample data at
 * /dev/crm-customer-lookup: one linked design (opens it), several linked designs
 * (pick from theirs), none linked (says so), and a number outside the CRM scope.
 *
 *   npx vite --port 5178 --strictPort
 *   CLOSET_STUDIO_BASE_URL=http://127.0.0.1:5178 npx playwright test e2e/crm-customer-lookup.spec.ts
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";
const OUT_FILE = `${OUT_DIR}/crm-customer-lookup-5192.png`;

async function lookUp(page: Page, panel: Locator, identifier: string) {
  await panel.getByLabel("Customer number").fill(identifier);
  await panel.getByTestId("crm-customer-lookup-submit").click();
}

test("staff type a customer number and go straight to that customer's design", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  await page.goto("/dev/crm-customer-lookup", { waitUntil: "load" });
  await page.waitForSelector('[data-testid="lookup-one"]');

  // One linked design: no pick list, the plan opens.
  const one = page.locator('[data-testid="lookup-one"]');
  await lookUp(page, one, "5192");
  await expect(one.getByTestId("crm-customer-lookup-hit")).toHaveAttribute("data-outcome", "one");
  await expect(one.getByTestId("crm-customer-lookup-designs")).toHaveAttribute("data-linked-design-count", "1");
  await expect(one).toContainText("Rivera kitchen — final");
  // The one design opens by itself, without a second click.
  await expect(page.getByTestId("lookup-one-opened")).toContainText("Designer opened: /design?load=4401");

  // Several: only that customer's designs, each openable.
  const several = page.locator('[data-testid="lookup-several"]');
  await lookUp(page, several, "6001");
  await expect(several.getByTestId("crm-customer-lookup-hit")).toHaveAttribute("data-outcome", "several");
  await expect(several.locator('[data-testid="customer-linked-design"]')).toHaveCount(3);
  await expect(several).not.toContainText("Rivera kitchen");

  // None: says so, and offers no design.
  const none = page.locator('[data-testid="lookup-none"]');
  await lookUp(page, none, "7002");
  await expect(none.getByTestId("crm-customer-lookup-empty")).toContainText("That customer has no design linked yet.");

  // Outside the scope: says so rather than showing something.
  const miss = page.locator('[data-testid="lookup-miss"]');
  await lookUp(page, miss, "8888");
  await expect(miss.getByTestId("crm-customer-lookup-miss")).toContainText("No customer with that number is in your CRM scope.");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: OUT_FILE, fullPage: true });
});
