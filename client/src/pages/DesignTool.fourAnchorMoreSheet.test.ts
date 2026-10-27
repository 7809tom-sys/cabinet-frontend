import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

/** The More sheet is the only toolbar surface a phone or tablet can reach. */
function moreSheetSource(): string {
  const start = pageSource.indexOf("{/* ── Main \"More\" sheet");
  expect(start).toBeGreaterThan(0);
  const end = pageSource.indexOf("</SheetContent>", start);
  expect(end).toBeGreaterThan(start);
  return pageSource.slice(start, end);
}

describe("Four anchors in the More sheet (tablet and phone)", () => {
  it("adds a Four anchors row for admins and affiliate Designers", () => {
    const sheet = moreSheetSource();
    expect(sheet).toContain('data-testid="more-sheet-four-anchors"');
    const rowAt = sheet.indexOf('data-testid="more-sheet-four-anchors"');
    const guardAt = sheet.lastIndexOf("{fourAnchorAvailable && (", rowAt);
    expect(guardAt).toBeGreaterThan(-1);
    expect(sheet.slice(guardAt, rowAt)).not.toContain(")}");
  });

  it("opens the same dialog, closing the sheet first, and keeps the empty-plan rule", () => {
    const sheet = moreSheetSource();
    const rowAt = sheet.indexOf('data-testid="more-sheet-four-anchors"');
    const row = sheet.slice(Math.max(0, rowAt - 600), rowAt + 900);
    expect(row).toContain("setTimeout(openFourAnchorAutoBuild, 120)");
    expect(row).toContain("setMoreSheetOpen(false)");
    expect(row).toContain("placed.length > 0 || layoutLocked");
    expect(row).toContain("Four anchors");
  });

  it("keeps the desktop toolbar button and dialogs on the same affiliate audience gate", () => {
    expect(pageSource).toContain('data-testid="admin-four-anchor-auto-build"');
    expect(pageSource).toContain("const fourAnchorAvailable = isAdmin || Boolean(affiliateSlug);");
    expect(pageSource).toMatch(/\{fourAnchorAvailable && \(\s*<FourAnchorAutoBuildDialog/);
    expect(pageSource).toMatch(/\{fourAnchorAvailable && fourAnchorCornerStage && \(\s*<FourAnchorCornerSelectionDialog/);
  });

  it("does not expose the row outside the audience guard anywhere else in the sheet", () => {
    const sheet = moreSheetSource();
    expect(sheet.split("openFourAnchorAutoBuild").length - 1).toBe(1);
  });
});
