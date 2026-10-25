import { describe, it, expect } from "vitest";
import { bestFitCatalogOption, compatibleWallCabinetAlternatives, gapFillCandidatesByWidth, nearestRectRoomWallAtPoint, nextSmartGapPreviewIndex, smartGapCatalogOptions, smartGapRecommendation, wallGapFitPreview, withTemporarySmartGapPreview, type WallGap } from "./design";

// Minimal palette rows for the pure candidate-selection helper.
type Row = Parameters<typeof gapFillCandidatesByWidth>[0][number];
const row = (masterCode: string, width: number, subCategory = "", isCornerCabinet = false): Row => ({
  masterCode,
  width: String(width),
  subCategory,
  isCornerCabinet,
});

describe("gapFillCandidatesByWidth", () => {
  it("keys one representative cabinet per standard width", () => {
    const map = gapFillCandidatesByWidth([
      row("B12", 12),
      row("B15", 15),
      row("B24", 24),
    ]);
    expect(map.size).toBe(3);
    expect(map.get(12)?.masterCode).toBe("B12");
    expect(map.get(24)?.masterCode).toBe("B24");
  });

  it("prefers a plain base box over a sink/specialty/corner unit at the same width", () => {
    const map = gapFillCandidatesByWidth([
      row("SB24", 24, "Sink Base"),
      row("BLS24", 24, "Blind corner", true),
      row("B24", 24, "Base Cabinet"),
    ]);
    // B24 (rank 0) should win over SB24 (2) and the corner (4).
    expect(map.get(24)?.masterCode).toBe("B24");
  });

  it("falls back to a sink base when no plain base exists at that width", () => {
    const map = gapFillCandidatesByWidth([
      row("SB30", 30, "Sink Base"),
      row("LS36", 36, "Lazy Susan", true),
    ]);
    expect(map.get(30)?.masterCode).toBe("SB30");
    // corner-only width still surfaces (nothing better exists)
    expect(map.get(36)?.masterCode).toBe("LS36");
  });

  it("ignores widths outside the 9-48 inch standard range", () => {
    const map = gapFillCandidatesByWidth([
      row("B6", 6),
      row("B9", 9),
      row("B48", 48),
      row("B54", 54),
    ]);
    expect(map.has(6)).toBe(false);
    expect(map.has(54)).toBe(false);
    expect(map.has(9)).toBe(true);
    expect(map.has(48)).toBe(true);
  });

  it("rounds fractional widths to the nearest inch key", () => {
    const map = gapFillCandidatesByWidth([row("B24", 23.75)]);
    expect(map.get(24)?.masterCode).toBe("B24");
  });

  it("returns an empty map for an empty pool", () => {
    expect(gapFillCandidatesByWidth([]).size).toBe(0);
  });

  it("offers active-style catalog advice for any selected gap without automatic placement", () => {
    const candidates = gapFillCandidatesByWidth([row("B24", 24), row("B30", 30), row("B36", 36)]);
    expect(smartGapRecommendation({ length: 5 }, candidates)).toMatchObject({ kind: "filler", remaining: 5 });
    expect(smartGapRecommendation({ length: 38 }, candidates)).toMatchObject({ kind: "cabinet-with-filler", cabinet: { masterCode: "B36" }, remaining: 2 });
    expect(smartGapRecommendation({ length: 48 }, candidates)).toMatchObject({ kind: "cabinet", cabinet: { masterCode: "B36" }, remaining: 12 });
    expect(smartGapRecommendation({ length: 60 }, candidates)).toMatchObject({ kind: "cabinet", cabinet: { masterCode: "B36" }, remaining: 24 });
  });

  it("returns every catalog cabinet that fits a smart gap so the user can filter by cabinet type or price", () => {
    const options = smartGapCatalogOptions({ length: 38 }, [row("B24", 24), row("SB30", 30, "Sink Base"), row("DB36", 36, "Drawer Base"), row("B42", 42)]);
    expect(options.map((option) => option.cabinet.masterCode)).toEqual(["DB36", "SB30", "B24"]);
    expect(options[0]).toMatchObject({ remaining: 2, needsFiller: true });
  });

  it("selects the largest real catalog cabinet as the one-action best fit", () => {
    expect(bestFitCatalogOption({ length: 72 }, [row("B24", 24), row("B36", 36), row("B48", 48)])).toMatchObject({ cabinet: { masterCode: "B48" }, remaining: 24, needsFiller: false });
  });

  it("measures an exact selected opening and never treats an outside pointer as valid", () => {
    const gap: WallGap = { side: "right", layer: "wall", start: 54, length: 36, center: 72, isStandardSize: true, isFillerSize: false };
    expect(wallGapFitPreview([gap], 72, 36)).toMatchObject({ status: "valid", containsTarget: true, snapStart: 54, snapEnd: 90, before: 0, after: 0 });
    expect(wallGapFitPreview([gap], 72, 42)).toMatchObject({ status: "invalid", shortage: 6 });
    expect(wallGapFitPreview([gap], 40, 36)).toMatchObject({ status: "invalid", containsTarget: false, shortage: 0 });
  });

  it("uses the physical wall nearest the 2D pointer", () => {
    expect(nearestRectRoomWallAtPoint({ width: 144, depth: 120 }, { x: 140, y: 72 })).toBe("right");
    expect(nearestRectRoomWallAtPoint({ width: 144, depth: 120 }, { x: 54, y: 3 })).toBe("top");
  });

  it("offers only matching smaller WR wall cabinets that can complete the opening with a catalog filler", () => {
    const wallRow = (masterCode: string, width: number, height: number, depth: number, placement: "wall" | "base" = "wall") => ({ masterCode, width: String(width), height: String(height), depth: String(depth), placement });
    const requested = { masterCode: "WR3624", width: 36, height: 24, depth: 24, placement: "wall" as const };
    const options = compatibleWallCabinetAlternatives(requested, 35, [
      wallRow("WR3324", 33, 24, 24),
      wallRow("WR3024", 30, 24, 24),
      wallRow("WR2724", 27, 24, 24),
      wallRow("W3324", 33, 24, 12),
      wallRow("WR3330", 33, 30, 24),
      wallRow("WR3324", 33, 24, 24, "base"),
    ]);
    expect(options.map((option) => option.cabinet.masterCode)).toEqual(["WR3324", "WR3024"]);
    expect(options.map((option) => option.remaining)).toEqual([2, 5]);
    expect(options.every((option) => option.needsFiller)).toBe(true);
  });

  it("automatically orders the closest real W-36-42-family fit first for a genuinely undersized opening", () => {
    const wallRow = (masterCode: string, width: number, height: number, depth: number) => ({ masterCode, width: String(width), height: String(height), depth: String(depth), placement: "wall" as const });
    const requested = { masterCode: "W-36-42", width: 36, height: 42, depth: 12, placement: "wall" as const };
    const options = compatibleWallCabinetAlternatives(requested, 33, [
      wallRow("W-30-42", 30, 42, 12),
      wallRow("W-33-42", 33, 42, 12),
      wallRow("W-27-42", 27, 42, 12),
      wallRow("W-33-36", 33, 36, 12),
    ]);

    expect(options.map((option) => option.cabinet.masterCode)).toEqual(["W-33-42", "W-30-42", "W-27-42"]);
    expect(options[0]).toMatchObject({ remaining: 0, needsFiller: false });
  });

  it("creates a temporary preview layer without mutating saved placements", () => {
    const saved = [{ uid: "saved" }];
    const preview = [{ uid: "smart-gap-preview" }];
    expect(withTemporarySmartGapPreview(saved, preview)).toEqual([{ uid: "saved" }, { uid: "smart-gap-preview" }]);
    expect(saved).toEqual([{ uid: "saved" }]);
  });

  it("cycles preview choices in both directions and wraps at either end", () => {
    expect(nextSmartGapPreviewIndex(0, 3, 1)).toBe(1);
    expect(nextSmartGapPreviewIndex(2, 3, 1)).toBe(0);
    expect(nextSmartGapPreviewIndex(0, 3, -1)).toBe(2);
    expect(nextSmartGapPreviewIndex(0, 1, 1)).toBe(0);
  });
});
