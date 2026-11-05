import { expect, test, type Page } from "@playwright/test";

/**
 * The beginner flow, end to end, at desktop and phone.
 *
 * Step 1 sizes the room, step 2 asks four everyday questions, and the build lands in the studio
 * with a plain-language summary. These assertions also pin the two promises that make the flow
 * beginner-friendly: advanced controls stay collapsed, and every tap target is at least 44px.
 */

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "phone-390x844", width: 390, height: 844 },
] as const;

async function openFlow(page: Page) {
  await page.goto("/closet", { waitUntil: "networkidle" });
  await expect(page.getByTestId("guided-gate")).toBeVisible();
}

/** Assumes the flow is already on step 2. */
async function chooseAnswers(page: Page) {
  await expect(page.getByTestId("guided-gate")).toHaveAttribute("data-guided-step", "2");
  await page.getByTestId("guided-mix-balanced").click();
  await page.getByTestId("guided-long-hang-yes").click();
  await page.getByTestId("guided-drawers-some").click();
  await page.getByTestId("guided-shoes-some").click();
  await page.getByTestId("guided-build").click();
}

for (const viewport of VIEWPORTS) {
  test.describe(`guided flow ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 2 });

    test("completes the guided flow and shows a plain-language summary", async ({ page }) => {
      await openFlow(page);
      await page.screenshot({ path: `test-artifacts/closet-guided/${viewport.name}/01-step-1-room.png` });

      // Advanced controls are nowhere on the simple start.
      await expect(page.getByTestId("vendor-advanced-options")).toHaveCount(0);
      await expect(page.getByTestId("vendor-toolbar-edit")).toHaveCount(0);

      await page.getByTestId("guided-next").click();
      await page.screenshot({ path: `test-artifacts/closet-guided/${viewport.name}/02-step-2-questions.png` });
      await expect(page.getByTestId("guided-gate")).toHaveAttribute("data-guided-step", "2");

      await chooseAnswers(page);

      await expect(page.getByTestId("vendor-closet-studio")).toBeVisible();
      await expect(page.locator('canvas[data-testid="vendor-closet-canvas"]')).toBeVisible();
      const summary = page.getByTestId("guided-summary");
      await expect(summary).toBeVisible();
      await expect(summary).toContainText("Here is your closet");
      const lines = await page.getByTestId("guided-summary-lines").innerText();
      expect(lines).toMatch(/shelves? for folded clothes/i);
      expect(lines).toMatch(/drawers? for smaller things/i);
      expect(lines).toMatch(/shoe shel(f|ves)/i);
      // Plain language: no SKUs or studio jargon in the customer-facing summary.
      expect(lines).not.toMatch(/\bSKU\b|\b43\d{4}\b|\b(?:upright|cleat|envelope|takeoff)\b/i);
      await page.screenshot({ path: `test-artifacts/closet-guided/${viewport.name}/03-built-with-summary.png` });

      // The drawing still owns the screen; the summary is a card, not a full-screen takeover.
      const panel = (await page.getByTestId("vendor-scene-panel").boundingBox())!;
      expect(panel.y).toBeGreaterThanOrEqual(0);
      expect(panel.height).toBeGreaterThan(120);
      const covered = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-testid="vendor-closet-canvas"]');
        if (!canvas) return "no canvas";
        const rect = canvas.getBoundingClientRect();
        // Sample near the top-left, clear of both the summary card and the corner minimap.
        const top = document.elementFromPoint(rect.x + rect.width * 0.5, rect.y + Math.min(40, rect.height * 0.1));
        return top === canvas ? null : `${top?.tagName}.${top?.className}`;
      });
      expect(covered, "the drawing is visible beside the summary").toBeNull();
    });

    test("keeps Delete plan visible and advanced tools behind More options", async ({ page }) => {
      await openFlow(page);
      await page.getByTestId("guided-next").click();
      await chooseAnswers(page);

      await page.getByTestId("guided-tune").click();

      const deletePlan = page.getByTestId("vendor-delete-plan");
      await expect(deletePlan).toBeVisible();
      const deleteBox = (await deletePlan.boundingBox())!;
      expect(deleteBox.y).toBeGreaterThanOrEqual(0);
      expect(deleteBox.y + deleteBox.height).toBeLessThanOrEqual(viewport.height);
      expect(deleteBox.height).toBeGreaterThanOrEqual(44);

      const more = page.getByTestId("vendor-more-options-toggle");
      await expect(more).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByTestId("vendor-advanced-options")).toHaveCount(0);
      await page.screenshot({ path: `test-artifacts/closet-guided/${viewport.name}/04-more-options-collapsed.png` });

      await more.click();
      await expect(more).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByTestId("vendor-advanced-options")).toBeVisible();
      await page.screenshot({ path: `test-artifacts/closet-guided/${viewport.name}/05-more-options-open.png` });
    });

    test("every guided tap target is at least 44px", async ({ page }) => {
      await openFlow(page);
      const step1 = ["guided-type-reach-in", "guided-type-walk-in", "guided-next"];
      for (const testId of step1) {
        const box = (await page.getByTestId(testId).boundingBox())!;
        expect(box.height, `${testId} height`).toBeGreaterThanOrEqual(44);
      }
      await page.getByTestId("guided-next").click();
      for (const testId of ["guided-mix-hanging", "guided-mix-balanced", "guided-long-hang-yes", "guided-drawers-lots", "guided-shoes-lots", "guided-build"]) {
        const box = (await page.getByTestId(testId).boundingBox())!;
        expect(box.height, `${testId} height`).toBeGreaterThanOrEqual(44);
        // And every choice is fully inside the viewport width at the smallest size we test.
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
      }
    });

    test("Change answers returns to the questions with the previous answers kept", async ({ page }) => {
      await openFlow(page);
      await page.getByTestId("guided-next").click();
      await page.getByTestId("guided-mix-mostlyShelving").or(page.getByTestId("guided-mix-shelving")).click();
      await page.getByTestId("guided-drawers-lots").click();
      await page.getByTestId("guided-build").click();
      await expect(page.getByTestId("guided-summary")).toBeVisible();

      await page.getByTestId("guided-change-answers").click();
      await expect(page.getByTestId("guided-gate")).toHaveAttribute("data-guided-step", "2");
      // The prior choice is still selected, so a small correction does not mean re-answering everything.
      await expect(page.getByTestId("guided-mix-shelving")).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("guided-drawers-lots")).toHaveAttribute("aria-pressed", "true");
    });
  });
}
