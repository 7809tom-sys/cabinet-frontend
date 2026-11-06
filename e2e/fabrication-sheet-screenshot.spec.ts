/**
 * Capture the real Countertop Fabrication Sheet UI and its generated PDF.
 *
 *   npx vite --port 5178 --strictPort
 *   CLOSET_STUDIO_BASE_URL=http://127.0.0.1:5178 npx playwright test e2e/fabrication-sheet-screenshot.spec.ts
 *
 * The harness builds a real kitchen with the app's own design model, so every
 * number in the screenshot and the PDF comes from the same measurement code the
 * Designer runs.
 *
 * Artifacts:
 *   /opt/cursor/artifacts/fabrication-sheet-panel.png  — the Designer panel
 *   /opt/cursor/artifacts/countertop-fabrication-sheet.pdf — the sheet itself
 */
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";
const PANEL_PNG = `${OUT_DIR}/fabrication-sheet-panel.png`;
const SHEET_PDF = `${OUT_DIR}/countertop-fabrication-sheet.pdf`;

test("the Designer renders the fabrication sheet panel and a real PDF", async ({ page }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));
  page.on("console", (message) => {
    if (message.type() === "error") console.log("[page]", message.text());
  });

  await page.goto("/dev/fabrication-sheet.html", { waitUntil: "load" });
  await page.waitForFunction(
    () => window.__fabricationSheet?.status === "ok",
    null,
    { timeout: 120_000 },
  );

  const result = await page.evaluate(() => {
    const data = window.__fabricationSheet!;
    return {
      runs: data.sheet.runs.length,
      runLabels: data.sheet.runs.map((run) => run.label),
      runSizes: data.sheet.runs.map((run) => `${run.lengthIn}" x ${run.depthIn}"`),
      cutouts: data.sheet.runs.flatMap((run) => run.cutouts).length,
      squareFeet: data.sheet.totals.squareFeet,
      unknowns: data.sheet.unknowns.length,
      subject: data.email.subject,
      pdfBytes: Math.floor(((data.pdfBase64?.length ?? 0) * 3) / 4),
      pdfBase64: data.pdfBase64 ?? "",
    };
  });

  console.log("sheet:", JSON.stringify({
    runs: result.runs,
    runLabels: result.runLabels,
    runSizes: result.runSizes,
    cutouts: result.cutouts,
    squareFeet: result.squareFeet,
    unknowns: result.unknowns,
    subject: result.subject,
    pdfBytes: result.pdfBytes,
  }, null, 2));

  // A real sheet, measured from the real design.
  expect(result.runs).toBe(2);
  expect(result.runLabels).toEqual(["Back wall", "Front wall"]);
  expect(result.runSizes).toEqual(['144" x 25.5"', '144" x 25.5"']);
  expect(result.cutouts).toBe(1);
  expect(result.squareFeet).toBeGreaterThan(40);
  expect(result.unknowns).toBeGreaterThan(0);
  expect(result.pdfBytes).toBeGreaterThan(5000);

  writeFileSync(SHEET_PDF, Buffer.from(result.pdfBase64, "base64"));

  // The panel the owner clicks in. The harness renders it twice (a wide card and
  // the real ~320px Designer sidebar); the sidebar one is the production layout.
  const panel = page.getByTestId("designer-sidebar").getByTestId("countertop-fabrication-actions");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("download-fabrication-sheet")).toBeEnabled();
  await expect(panel.getByTestId("email-fabrication-sheet")).toBeEnabled();
  await expect(panel.getByTestId("countertop-fabrication-summary")).toContainText("sq ft");
  await expect(panel.getByTestId("countertop-fabrication-unknowns")).toContainText("left blank");

  await page.setViewportSize({ width: 1180, height: 900 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: PANEL_PNG });

  // Opening the email dialog shows the recipient field and the exact message the
  // fabricator will receive, without pretending a send happened.
  await panel.getByTestId("email-fabrication-sheet").click();
  await expect(page.getByTestId("fabrication-email-dialog")).toBeVisible();
  await expect(page.getByTestId("fabricator-email-input")).toBeVisible();
  await expect(page.getByTestId("fabrication-email-send")).toBeDisabled();
  await page.getByTestId("fabricator-email-input").fill("shop@stoneworks.example");
  await expect(page.getByTestId("fabrication-email-send")).toBeEnabled();
  // Radix dialogs fade in; wait for the animation to settle before capturing.
  await page.waitForTimeout(900);
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT_DIR}/fabrication-sheet-email-dialog.png` });
});
