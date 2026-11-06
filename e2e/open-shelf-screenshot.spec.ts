/**
 * Visual proof for the Wall Open Shelf family (WOS / WEOS / WOES).
 *
 * Renders a real upper run through the real 3D engine (`existingCabinetSku` +
 * `addCabinet`) and captures a three-quarter front view of the open shelf, from
 * the open side, so the open front, the open end and the radiused shelf corners
 * are all visible. Nothing here is drawn by hand.
 *
 * Run with the dev server up:
 *   npx vite --port 5178 --strictPort
 *   npx playwright test e2e/open-shelf-screenshot.spec.ts
 *
 * Output: /opt/cursor/artifacts/open-shelf-<code>[-<hand>].png
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = "/opt/cursor/artifacts";

/** Every size Tom asked to verify, plus one example of each hand. */
const SHOTS: Array<{ code: string; hand?: "left" | "right"; shelfOnly?: boolean; view: "front-left" | "front-right"; label: string }> = [
  // The run views: camera on the right, where the shelf sits at the open end.
  { code: "WOS0930", view: "front-right", label: "9 wide x 30 high" },
  { code: "WOS0936", view: "front-right", label: "9 wide x 36 high" },
  { code: "WOS0942", view: "front-right", label: "9 wide x 42 high" },
  { code: "WOS1230", view: "front-right", label: "12 wide x 30 high" },
  // Isolated close-ups, each from the side that exposes the open end.
  { code: "WOS0930", hand: "left", shelfOnly: true, view: "front-left", label: "9 wide x 30 high, left hand" },
  { code: "WOS0930", hand: "right", shelfOnly: true, view: "front-right", label: "9 wide x 30 high, right hand" },
  { code: "WOS1230", hand: "left", shelfOnly: true, view: "front-left", label: "12 wide x 30 high, left hand" },
  { code: "WOS1230", hand: "right", shelfOnly: true, view: "front-right", label: "12 wide x 30 high, right hand" },
];

for (const shot of SHOTS) {
  const suffix = shot.shelfOnly ? "-isolated" : "";
  const handSuffix = shot.hand ? `-${shot.hand}-hand` : "";
  const file = `${OUT_DIR}/open-shelf-${shot.code}${handSuffix}${suffix}.png`;
  test(`captures ${shot.code} (${shot.label})`, async ({ page }) => {
    mkdirSync(OUT_DIR, { recursive: true });
    page.on("pageerror", (error) => console.log("[pageerror]", error.message));
    page.on("console", (message) => {
      if (message.type() === "error") console.log("[page]", message.text());
    });

    const params = new URLSearchParams({ code: shot.code, view: shot.view });
    if (shot.hand) params.set("hand", shot.hand);
    params.set("closeup", "1");
    if (shot.shelfOnly) params.set("shelfonly", "1");

    await page.goto(`/dev/open-shelf-shot.html?${params.toString()}`, { waitUntil: "load" });
    await page.waitForFunction(
      () => (window as unknown as { __openShelfShot?: string }).__openShelfShot != null,
      null,
      { timeout: 120_000 },
    );
    const status = await page.evaluate(() => (window as unknown as { __openShelfShot?: string }).__openShelfShot!);
    expect(status, `render status for ${shot.code}`).toBe("ok");

    // The rendered facts are the proof the picture is of the right cabinet.
    const facts = await page.evaluate(() => document.getElementById("caption")?.textContent ?? "");
    expect(facts, shot.code).toContain("Open Shelf");
    expect(facts, shot.code).toContain("doors 0");
    expect(facts, shot.code).toContain("drawers 0");
    expect(facts, shot.code).toContain("fixed shelves 2");
    // No face frame and no outline lines drawn across the opening.
    expect(facts, shot.code).toContain("face frames 0");
    expect(facts, shot.code).toContain("outline lines 0");
    // Cabinet depth is standard and must not appear in a customer-facing label.
    expect(facts, shot.code).not.toMatch(/\d+"\s*D\b/);
    if (shot.hand) expect(facts, shot.code).toContain(`hand ${shot.hand}`);

    await page.waitForTimeout(700);
    await page.screenshot({ path: file });
  });
}
