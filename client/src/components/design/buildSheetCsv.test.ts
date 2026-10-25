import { describe, it, expect } from "vitest";
import { buildSheetCsv, type BuildSheetArgs } from "./DesignActions";

const base: BuildSheetArgs = {
  room: { width: 120, depth: 96 },
  styleName: "Shaker White",
  tier: "Contractor",
  total: 1234.5,
  buildRows: [
    { code: "DB-24-3", description: "24\" Drawer Base", color: "Aero Obsidian", widthIn: 24, heightIn: 34.5, depthIn: 24, placement: "base", qty: 2, unitPrice: 199.99 },
    { code: "W3030", description: "30\" Wall", color: "Aero Solstice", widthIn: 30, heightIn: 30, depthIn: 12, placement: "wall", qty: 1, unitPrice: 120 },
  ],
  extraLines: [{ label: "BASE CORNER FILLER", detail: "1 x 3in (required for blind corner)" }],
};

describe("buildSheetCsv", () => {
  it("returns null when there are no cabinet rows", () => {
    expect(buildSheetCsv({ ...base, buildRows: [] })).toBeNull();
  });

  it("includes door style, tier, and room metadata", () => {
    const csv = buildSheetCsv(base)!;
    expect(csv).toContain("Door Style:,Shaker White");
    expect(csv).toContain("Pricing Tier:,Contractor");
    expect(csv).toContain("Room:,120in x 96in");
  });

  it("uses the affiliate brand rather than Cabinet Dealz on an affiliate plan", () => {
    const csv = buildSheetCsv({ ...base, brandName: "Reaves Way Cabinet Shop." })!;
    expect(csv).toContain("Reaves Way Cabinet Shop. Build Sheet");
    expect(csv).not.toContain("Cabinet Dealz");
  });

  it("computes line totals as unitPrice * qty", () => {
    const csv = buildSheetCsv(base)!;
    // 199.99 * 2 = 399.98
    expect(csv).toContain("DB-24-3");
    expect(csv).toContain("399.98");
    // single wall cabinet line total = 120.00
    expect(csv).toContain("120.00");
  });

  it("renders extra (non-cabinet) lines as 'incl.'", () => {
    const csv = buildSheetCsv(base)!;
    expect(csv).toContain("BASE CORNER FILLER");
    expect(csv).toContain("incl.");
  });

  it("includes a Color / Finish column and each line's specific color", () => {
    const csv = buildSheetCsv(base)!;
    expect(csv).toContain("Color / Finish");
    // Two-tone: each line carries its own color/finish.
    expect(csv).toContain("Aero Obsidian");
    expect(csv).toContain("Aero Solstice");
  });

  it("falls back to '(not selected)' when no style chosen and blanks unpriced lines", () => {
    const csv = buildSheetCsv({
      ...base,
      styleName: null,
      buildRows: [{ code: "B12", description: "12\" Base", widthIn: 12, heightIn: 34.5, depthIn: 24, placement: "base", qty: 1, unitPrice: null }],
    })!;
    expect(csv).toContain("Door Style:,(not selected)");
    // unpriced row: a full W x H x D size cell, then empty unit price + line total
    // Color column is blank here (no color provided); then size cell, dims, type.
    expect(csv).toContain('B12,"12"" Base",,"12""W x 34.5""H x 24""D",12,34.5,24,base,,1,,');
  });

  it("escapes values containing commas/quotes", () => {
    const csv = buildSheetCsv({
      ...base,
      buildRows: [{ code: "X1", description: 'Lazy Susan, 33"', widthIn: 33, heightIn: 34.5, depthIn: 24, placement: "base", qty: 1, unitPrice: 50 }],
    })!;
    expect(csv).toContain('"Lazy Susan, 33"""');
  });

  it("ends with the estimated total", () => {
    const csv = buildSheetCsv(base)!;
    expect(csv.trimEnd().endsWith("1234.50")).toBe(true);
  });
});
