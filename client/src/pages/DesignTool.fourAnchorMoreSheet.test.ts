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
  it("adds an admin-only Four anchors row to the More sheet", () => {
    const sheet = moreSheetSource();
    expect(sheet).toContain('data-testid="more-sheet-four-anchors"');
    // The row must sit inside an isAdmin guard so non-admins never see it.
    const rowAt = sheet.indexOf('data-testid="more-sheet-four-anchors"');
    const guardAt = sheet.lastIndexOf("{isAdmin && (", rowAt);
    expect(guardAt).toBeGreaterThan(-1);
    // No other closing of a conditional between the guard and the row.
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

  it("keeps the desktop toolbar button admin-only and the dialog admin-gated", () => {
    expect(pageSource).toContain('data-testid="admin-four-anchor-auto-build"');
    expect(pageSource).toMatch(/\{isAdmin && \(\s*<FourAnchorAutoBuildDialog/);
    expect(pageSource).toMatch(/\{isAdmin && fourAnchorCornerStage && \(\s*<FourAnchorCornerSelectionDialog/);
  });

  it("does not expose the row outside the admin guard anywhere else in the sheet", () => {
    const sheet = moreSheetSource();
    expect(sheet.split("openFourAnchorAutoBuild").length - 1).toBe(1);
  });
});
