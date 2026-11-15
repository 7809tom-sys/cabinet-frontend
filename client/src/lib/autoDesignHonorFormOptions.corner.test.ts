import { describe, expect, it } from "vitest";
import { decideAutoDesignCornerTypeOrder } from "./autoDesignCornerDecision";
import { DEFAULT_ROOM, wallPlacementAt, type DesignCabinet, type PlacedCabinet } from "./design";

// Tom, Nov 14 2026: the Auto Design "Lazy Susan" / "Blind corner cabinet" picks
// were silently ignored (the corner decision voided both flags).
const TOP_RIGHT = { x: DEFAULT_ROOM.width, y: 0 };
const option = (code: string, width: string): DesignCabinet => ({
  id: code.length * 100 + Number(width), masterCode: code, description: code, placement: "base",
  width, height: "34.5", depth: "24",
} as DesignCabinet);
const CATALOG = [option("DCB36", "36"), option("LSB36", "36"), option("LSB33", "33"), option("BBC36", "36")];
function rangeLeaving(availableIn: number): PlacedCabinet {
  const start = DEFAULT_ROOM.width - availableIn - 30;
  return { uid: "range", cabinetId: 0, masterCode: "RANGE-30", description: "30 inch range", category: "Appliance", subCategory: "Appliance",
    placement: "appliance", ...wallPlacementAt(start, 30, 26, "top", DEFAULT_ROOM), width: 30, depth: 26, height: 36 } as PlacedCabinet;
}
const decide = (availableIn: number, prefs: { preferLazySusan?: boolean; preferBlind?: boolean }, options = CATALOG) => decideAutoDesignCornerTypeOrder({
  room: DEFAULT_ROOM, cornerWallIds: ["top", "right"], corner: TOP_RIGHT, placed: [rangeLeaving(availableIn)], options, ...prefs,
});

describe("Auto Design corner pick from the customer intake", () => {
  it("puts a blind corner first when the customer picked one and the run takes it", () => {
    expect(decide(48, {}).order[0]).toBe("lazy-susan");
    const picked = decide(48, { preferBlind: true });
    expect(picked.order[0]).toBe("blind");
    expect(picked.reason).toContain("customer asked for a blind corner");
  });

  it("puts a lazy Susan first on a 33-42 in run when a catalog lazy Susan fits", () => {
    const picked = decide(36, { preferLazySusan: true }, [option("BBC36", "36"), option("LSB33", "33")]);
    expect(picked.order[0]).toBe("lazy-susan");
  });

  it("never forces a lazy Susan the run cannot take, and says why", () => {
    const picked = decide(30, { preferLazySusan: true });
    expect(picked.band).toBe("rotated-blind");
    expect(picked.order[0]).toBe("blind");
    expect(picked.reason).toContain("none in this line fits");
  });
});
