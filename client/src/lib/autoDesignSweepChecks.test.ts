import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet } from "./design";
import { findOverlaps, interiorFillerCounts, wallWidthMismatches, blindCornersWithoutDoorSide } from "./autoDesignSweepChecks";

const ROOM = { ...DEFAULT_ROOM, width: 144 } as typeof DEFAULT_ROOM;

function cab(uid: string, masterCode: string, placement: PlacedCabinet["placement"], width: number, offset: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "top", ROOM);
  return {
    uid, cabinetId: 1, masterCode, description: masterCode, category: "Base", subCategory: "Base",
    placement, ...spot, width, depth: 24, height: placement === "wall" ? 30 : 34.5, styleId: 1, ...extra,
  } as PlacedCabinet;
}

describe("auto-design sweep checks", () => {
  it("flags two cabinets on the same wall that overlap", () => {
    const placed = [cab("a", "B24", "base", 24, 0), cab("b", "B24", "base", 24, 18)];
    const findings = findOverlaps(placed, ROOM);
    expect(findings.map((f) => f.code)).toEqual(["cabinets-overlap"]);
  });

  it("does not flag neighbours that merely touch", () => {
    const placed = [cab("a", "B24", "base", 24, 0), cab("b", "B24", "base", 24, 24)];
    expect(findOverlaps(placed, ROOM)).toEqual([]);
  });

  it("counts an interior filler but not a scribe at the wall end", () => {
    const placed = [
      cab("b1", "B24", "base", 24, 0),
      cab("f1", "BF3", "base", 3, 24),
      cab("b2", "B24", "base", 24, 27),
      cab("scribe", "BF3", "base", 3, 141),
    ];
    const counts = interiorFillerCounts(placed, ROOM);
    expect(counts.get("top")).toBe(1);
  });

  it("flags a wall cabinet whose width differs from the base beneath it", () => {
    const placed = [cab("base", "B27", "base", 27, 0), cab("upper", "W24", "wall", 24, 0)];
    const findings = wallWidthMismatches(placed, ROOM);
    expect(findings.map((f) => f.code)).toEqual(["wall-width-differs-from-base"]);
  });

  it("flags a blind corner with no door side", () => {
    const placed = [cab("bbc", "BBC36", "base", 36, 0, { swing: null })];
    const findings = blindCornersWithoutDoorSide(placed);
    expect(findings.map((f) => f.code)).toEqual(["blind-corner-without-door-side"]);
  });
});