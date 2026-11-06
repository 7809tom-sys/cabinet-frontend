import { test, expect } from "@playwright/test";

/**
 * Renders the KBIS 2027 booth panel on its own to confirm the featured image,
 * the document list, the supplier-ready badge, and the filter row all appear.
 * The panel is served by the Vite dev server through dev/kbis-booth-shot.html;
 * run with CLOSET_STUDIO_BASE_URL pointing at that server.
 */
test.use({ viewport: { width: 1280, height: 1600 } });

const PANEL_URL = "/dev/kbis-booth-shot.html";

test("KBIS booth panel shows the featured image, the deck, and the supplier filter", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(PANEL_URL, { waitUntil: "networkidle" });
  await expect(
    page.locator('[data-testid="kbis-booth-assets"]'),
    `panel did not render. Console: ${errors.join(" | ")}`,
  ).toBeVisible({ timeout: 30_000 });

  const featured = page.getByTestId("kbis-booth-featured");
  await expect(featured).toContainText("Closets Added");
  await expect(featured).toContainText("Concept rendering");
  await expect(featured).toContainText("Supplier-ready");

  const document = page.getByTestId("kbis-booth-document");
  await expect(document).toContainText("KBIS 2027 Opportunity Deck");
  await expect(document).toContainText("Supplier-ready");
  await expect(document).toContainText("9 slides");
  await expect(document).toContainText("439 KB");

  await expect(page.getByTestId("kbis-booth-copy")).toContainText("Be an affiliate. Be the face of Cabinetdealz.");

  await page.screenshot({ path: "test-artifacts/kbis-booth/kbis-booth-panel.png", fullPage: true });

  // The supplier filter keeps only the flagged assets.
  await page.getByRole("button", { name: "Supplier-ready", exact: true }).click();
  await expect(page.getByTestId("kbis-booth-grid").locator("article")).toHaveCount(3);
  await expect(document).toBeVisible();

  // The copy filter hides the artwork and keeps only the text assets.
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByTestId("kbis-booth-featured")).toHaveCount(0);
  await expect(page.getByTestId("kbis-booth-documents")).toHaveCount(0);
  await expect(page.getByTestId("kbis-booth-copy")).toBeVisible();

  await page.screenshot({ path: "test-artifacts/kbis-booth/kbis-booth-copy-filter.png", fullPage: true });
  expect(errors).toEqual([]);
});
