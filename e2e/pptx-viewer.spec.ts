import { expect, test } from "@playwright/test";

test("clicking a deck renders it in the page and does not download", async ({ page }) => {
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  let popups = 0;
  page.on("popup", () => { popups += 1; });

  await page.goto("/dev/pptx-preview");
  await expect(page.getByText("Choose a deck to read it here.")).toBeVisible();
  await expect(page.getByTestId("pptx-slide-host")).toHaveCount(0);

  await page.getByRole("button", { name: "Cabinetdealz investor update" }).click();
  await expect(page.getByTestId("pptx-uploaded")).toHaveText("Uploaded Nov 10, 2026");
  await expect(page.getByTestId("pptx-slide-host")).toContainText("Private decks stay in this browser.", { timeout: 30_000 });
  await expect(page.locator(".pptx-preview-wrapper-pagination")).toHaveText("1/2");
  await expect(page.getByRole("button", { name: /Download/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Download/ })).toHaveCount(0);
  expect(downloads).toEqual([]);
  expect(popups).toBe(0);
  expect(page.context().pages()).toHaveLength(1);
  await page.screenshot({ path: "docs/proofs/pptx-browser-viewer.png", fullPage: true });

  await page.locator(".pptx-preview-wrapper-next").first().click();
  await expect(page.getByTestId("pptx-slide-host")).toContainText("November pipeline");
  expect(downloads).toEqual([]);

  await page.getByRole("button", { name: "Pitch notes PDF" }).click();
  await expect(page.getByTestId("pptx-slide-host").getByLabel("Page 1")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pptx-slide-host")).toContainText("Pitch notes stay on this page.");
  expect(downloads).toEqual([]);
  expect(popups).toBe(0);

  await page.getByRole("button", { name: "Pitch notes", exact: true }).click();
  await expect(page.getByTestId("pptx-slide-host")).toContainText("Pitch notes stay on this page.", { timeout: 30_000 });
  expect(downloads).toEqual([]);
  expect(popups).toBe(0);
  expect(page.context().pages()).toHaveLength(1);
});
