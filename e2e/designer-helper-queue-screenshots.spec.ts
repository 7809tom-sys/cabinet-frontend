/**
 * Screenshots of the designer helper queue for the PR.
 *
 * Renders the shipped cards through `dev/helper-shot.html`, which mounts the
 * real `designerHelperCards.tsx` components with fixture data — so each image is
 * the markup the app uses, not a drawing.
 *
 * Run with:
 *   npx vite --port 5178 --strictPort
 *   npx playwright test e2e/designer-helper-queue-screenshots.spec.ts
 *
 * Output: /opt/cursor/artifacts/designer-helper-*.png
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";

const SHOTS: { key: string; file: string }[] = [
  { key: "share", file: "designer-helper-share-button.png" },
  { key: "notice", file: "designer-helper-notification.png" },
  { key: "admin", file: "designer-helper-admin-popup.png" },
];

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
});

for (const shot of SHOTS) {
  test(`captures the ${shot.key} helper screen`, async ({ page }) => {
    page.on("pageerror", (error) => console.log("[pageerror]", error.message));
    page.on("console", (message) => {
      if (message.type() === "error") console.log("[page]", message.text());
    });

    await page.setViewportSize({ width: shot.key === "admin" ? 620 : 1180, height: 900 });
    await page.goto(`/dev/helper-shot.html?shot=${shot.key}`, { waitUntil: "load" });
    await page.waitForFunction(
      (expected) => (window as unknown as { __helperShot?: string }).__helperShot === expected,
      shot.key,
      { timeout: 60_000 },
    );

    // Prove the capture contains the shipped component, not an empty stage.
    const stage = page.locator("#stage");
    await expect(stage).toBeVisible();
    await expect(
      shot.key === "share"
        ? page.getByTestId("designer-helper-share-button")
        : shot.key === "notice"
          ? page.getByTestId("designer-helper-notice").first()
          : page.getByTestId("admin-helper-request-popup").first(),
    ).toBeVisible();

    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT_DIR}/${shot.file}`, fullPage: true });
  });
}
