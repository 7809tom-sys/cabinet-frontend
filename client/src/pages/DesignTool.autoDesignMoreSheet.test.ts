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

describe("Auto-Design in the More sheet (tablet and phone)", () => {
  it("adds an Auto-Design row for admins and affiliate Designers", () => {
    const sheet = moreSheetSource();
    expect(sheet).toContain('data-testid="more-sheet-auto-design"');
    const rowAt = sheet.indexOf('data-testid="more-sheet-auto-design"');
    const guardAt = sheet.lastIndexOf("{autoDesignAvailable && (", rowAt);
    expect(guardAt).toBeGreaterThan(-1);
    expect(sheet.slice(guardAt, rowAt)).not.toContain(")}");
  });

  it("opens the same dialog, closing the sheet first, and keeps the empty-plan rule", () => {
    const sheet = moreSheetSource();
    const rowAt = sheet.indexOf('data-testid="more-sheet-auto-design"');
    const row = sheet.slice(Math.max(0, rowAt - 200), rowAt + 1600);
    expect(row).toContain("setTimeout(openAutoDesign, 120)");
    expect(row).toContain("setMoreSheetOpen(false)");
    expect(row).toContain("!autoDesignControl.enabled");
    expect(row).toContain("Needs an empty plan");
    expect(row).toContain("Auto-Design");
  });

  it("keeps the desktop toolbar button and dialogs on the same affiliate audience gate", () => {
    expect(pageSource).toContain('data-testid="admin-auto-design-auto-build"');
    expect(pageSource).toContain("const autoDesignAvailable = isAdmin || Boolean(affiliateSlug);");
    expect(pageSource).toMatch(/\{autoDesignAvailable && \(\s*<AutoDesignDialog/);
    expect(pageSource).toMatch(/\{autoDesignAvailable && autoDesignCornerStage && \(\s*<AutoDesignCornerDialog/);
  });

  it("does not expose the row outside the audience guard anywhere else in the sheet", () => {
    const sheet = moreSheetSource();
    expect(sheet.split("openAutoDesign").length - 1).toBe(1);
  });
});
