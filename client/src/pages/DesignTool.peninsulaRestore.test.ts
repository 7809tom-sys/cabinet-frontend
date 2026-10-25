import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("saved peninsula restore", () => {
  it("canonicalizes explicit peninsula placements before Plan or 3D receives restored cabinets", () => {
    const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
    const restoreStart = source.indexOf("const loadSavedDesign = useCallback");
    const restoreEnd = source.indexOf("// Map of door-style id", restoreStart);
    const restoreSource = source.slice(restoreStart, restoreEnd);
    expect(restoreSource).toContain("normalizeLegacyPeninsulaCabinets(");
    expect(restoreSource.indexOf("normalizeLegacyPeninsulaCabinets(")).toBeLessThan(restoreSource.indexOf("setPlaced("));

    const draftStart = source.indexOf("const raw = localStorage.getItem(draftKey);");
    const draftEnd = source.indexOf("if (Array.isArray(d.openings)) setOpenings(d.openings);", draftStart);
    const draftSource = source.slice(draftStart, draftEnd);
    expect(draftSource).toContain("const peninsulaNormalizedDraft = clampCabinetsToRoom(backfillLegacyWallRuns(normalizeLegacyPeninsulaCabinets(");
    expect(draftSource.indexOf("normalizeLegacyPeninsulaCabinets(")).toBeLessThan(draftSource.indexOf("setPlaced("));
  });
});
