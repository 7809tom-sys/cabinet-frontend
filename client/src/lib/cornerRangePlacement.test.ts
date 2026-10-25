import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, wallPlacementAt } from "./design";
import { CORNER_RANGE_HANDLE_FILLER_IN, placeCornerRange, validatePlacedCornerRange } from "./cornerRangePlacement";

const range = {
  masterCode: "RANGE-30",
  description: "30 inch Gas Range",
  placement: "appliance" as const,
  width: 30,
  depth: 24,
};

function request(overrides: Partial<Parameters<typeof placeCornerRange>[0]> = {}) {
  return {
    range,
    room: DEFAULT_ROOM,
    wallLabel: "Wall 1" as const,
    centerOffsetIn: 15,
    originCorner: "left" as const,
    runDirection: "right" as const,
    cornerEnd: "start" as const,
    ...overrides,
  };
}

describe("corner oven and range placement", () => {
  it("resolves an explicit corner range anchor through the shared wall engine", () => {
    const result = placeCornerRange(request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.wallId).toBe("top");
    expect(result.alongStart).toBe(0);
    expect(result.spot.wallId).toBe("top");
    expect(result.requiredFillerIn).toBe(3);
  });

  it("rejects a range measured away from the requested corner", () => {
    expect(placeCornerRange(request({ centerOffsetIn: 48 }))).toEqual({ ok: false, reason: "wrong-corner" });
  });

  it("does not apply the corner rule to a non-range appliance", () => {
    expect(placeCornerRange(request({ range: { ...range, masterCode: "DW-24", description: "Dishwasher" } }))).toEqual({ ok: false, reason: "not-range-or-oven" });
  });

  it("requires a three-inch handle-clearance filler when a cabinet butts the interior side", () => {
    const spot = wallPlacementAt(0, 30, 24, "top", DEFAULT_ROOM);
    const candidate = { ...range, uid: "range", cabinetId: 0, x: spot.x, y: spot.y, rotation: spot.rotation, height: 34.5, numberOfDoors: 0, numberOfDrawers: 0 };
    const adjoining = { ...candidate, uid: "base", masterCode: "B24", description: "Base cabinet", placement: "base" as const, x: 30, width: 24 };
    expect(validatePlacedCornerRange(candidate, DEFAULT_ROOM, [adjoining])).toEqual({
      ok: false,
      reason: "missing-filler",
      requiredFillerIn: CORNER_RANGE_HANDLE_FILLER_IN,
    });
  });

  it("clears the warning when a real filler is present beside the range", () => {
    const spot = wallPlacementAt(0, 30, 24, "top", DEFAULT_ROOM);
    const candidate = { ...range, uid: "range", cabinetId: 0, x: spot.x, y: spot.y, rotation: spot.rotation, height: 34.5, numberOfDoors: 0, numberOfDrawers: 0 };
    const filler = { ...candidate, uid: "filler", masterCode: "FILL-3", description: "3 inch filler", placement: "base" as const, x: 30, width: 3 };
    expect(validatePlacedCornerRange(candidate, DEFAULT_ROOM, [filler])).toBeNull();
  });
});
