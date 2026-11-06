/**
 * Captures the AI door-description return leg in the Edit Door Style form and in
 * the 3D Designer.
 *
 *   npx vite --port 5178 --strictPort
 *   CLOSET_STUDIO_BASE_URL=http://127.0.0.1:5178 npx playwright test e2e/ai-door-description-return-leg.spec.ts
 *
 * The model's answer is MOCKED in the page (`client/src/aiDoorReturnLegHarness.tsx`):
 * this machine has no provider key, and no live model is called. The component,
 * the tRPC hook, the request, the parser and the 3D mesh builder are the shipped
 * ones, so the only fake is the provider's reply.
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
});

function watch(page: import("@playwright/test").Page) {
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));
  page.on("console", (message) => {
    if (message.type() === "error") console.log("[console]", message.text());
  });
}

test("the description lands in the door's field, with the green check", async ({ page }) => {
  watch(page);
  await page.goto("/dev/ai-door-return-leg.html?state=saved", { waitUntil: "load" });

  // The door's own field is the thing that used to stay empty.
  const field = page.getByTestId("door-description-field");
  await expect(field).toBeVisible({ timeout: 30_000 });
  await expect(field).toHaveValue(/Style family: raised panel/, { timeout: 30_000 });
  // The instructions that were typed before Generate are not what is left there.
  await expect(field).not.toHaveValue(/Haven Harbor style/);

  // The green check only appears after the handoff.
  const status = page.getByTestId("ai-door-status-gpt");
  await expect(status).toBeVisible({ timeout: 30_000 });
  await expect(status).toHaveAttribute("data-state", "saved");
  await expect(status).toContainText("Description received and saved to the door field");
  // The panel keeps its own copy too.
  await expect(page.getByTestId("ai-door-field-gpt")).toHaveValue(/Style family: raised panel/);

  await page.screenshot({ path: `${OUT_DIR}/ai-door-01-description-in-door-field-green-check.png`, fullPage: true });
});

test("the waiting state shows Sending to AI", async ({ page }) => {
  watch(page);
  await page.goto("/dev/ai-door-return-leg.html?state=waiting", { waitUntil: "load" });

  const status = page.getByTestId("ai-door-status-gpt");
  await expect(status).toBeVisible({ timeout: 30_000 });
  await expect(status).toHaveAttribute("data-state", "waiting");
  await expect(status).toContainText("Sending to AI");

  await page.screenshot({ path: `${OUT_DIR}/ai-door-02-waiting-sending-to-ai.png`, fullPage: true });
});

test("the failed state names the reason", async ({ page }) => {
  watch(page);
  await page.goto("/dev/ai-door-return-leg.html?state=failed", { waitUntil: "load" });

  const status = page.getByTestId("ai-door-status-gpt");
  await expect(status).toBeVisible({ timeout: 30_000 });
  await expect(status).toHaveAttribute("data-state", "failed");
  await expect(status).toHaveAttribute("data-reason", "rate-limited");
  await expect(status).toContainText("AI is busy");
  // The plain sentence beside it carries the model's own words.
  await expect(page.getByTestId("ai-door-generate-message-gpt")).toContainText("GPT is busy");
  // A failure never writes into the door's field.
  await expect(page.getByTestId("door-description-field")).toHaveValue(/Haven Harbor style/);

  await page.screenshot({ path: `${OUT_DIR}/ai-door-03-failed-reason.png`, fullPage: true });
});

test("a missing key reads as a setup message, not an alarm", async ({ page }) => {
  watch(page);
  await page.goto("/dev/ai-door-return-leg.html?state=not-connected", { waitUntil: "load" });

  const status = page.getByTestId("ai-door-status-gpt");
  await expect(status).toBeVisible({ timeout: 30_000 });
  await expect(status).toHaveAttribute("data-state", "not-connected");
  await expect(page.getByTestId("ai-door-generate-message-gpt")).toContainText("OPENAI_API_KEY");

  await page.screenshot({ path: `${OUT_DIR}/ai-door-04-not-connected.png`, fullPage: true });
});

test("the 3D Designer builds the door from that description", async ({ page }) => {
  watch(page);
  await page.goto("/dev/ai-door-return-leg.html?state=door", { waitUntil: "load" });

  const canvas = page.getByTestId("designer-door-canvas").locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 120_000 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="designer-door-canvas"] canvas') != null,
    null,
    { timeout: 120_000 },
  );
  // The facts table proves the description's own numbers reached the renderer.
  const facts = page.getByTestId("designer-facts");
  await expect(facts).toContainText("raised-panel");
  await expect(facts).toContainText("2.5 in / 2.5 in");
  await expect(facts).toContainText("0.75 in");
  await expect(facts).toContainText("ogee");
  await expect(facts).toContainText("raised centre yes");

  await canvas.screenshot({ path: `${OUT_DIR}/ai-door-05-designer-door-from-description.png` });
  await page.screenshot({ path: `${OUT_DIR}/ai-door-05-designer-door-from-description-with-facts.png`, fullPage: true });
});
