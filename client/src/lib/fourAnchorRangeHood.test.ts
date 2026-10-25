import { describe, expect, it } from "vitest";
import {
  APPLIANCES, DEFAULT_ROOM, appendCollisionFreePlacements, applianceAsDesignCabinet, cabinetWall, isHoodOverRangePair,
  wallPlacementAt, wallRunOffset, wallRunSpan, type PlacedCabinet,
} from "./design";
import { fourAnchorRangeHood, fourAnchorRangeNeedsVentilation } from "./fourAnchorRangeHood";

const palette = APPLIANCES.filter((item) => item.rooms.includes("kitchen")).map(applianceAsDesignCabinet);

function range(width: number, side: "top" | "right", offset: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 26, side, DEFAULT_ROOM);
  return {
    uid: `range-${side}-${offset}`, cabinetId: 0, masterCode: `RANGE-${width}`, description: `${width}" Range`, category: "Appliance",
    subCategory: null, placement: "appliance", ...spot, width, depth: 26, height: 36, mountBottom: 0, numberOfDoors: null, numberOfDrawers: null,
  } as PlacedCabinet;
}

describe("Four-anchor range ventilation", () => {
  it("builds a 30-inch hood centered on a 30-inch range at the standard hood datum", () => {
    const r = range(30, "top", 60);
    const result = fourAnchorRangeHood({ range: r, room: DEFAULT_ROOM, palette, uid: "hood-1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hood = result.hood;
    expect(hood).toMatchObject({ uid: "hood-1", masterCode: "HOOD-30", placement: "appliance", width: 30, mountBottom: 66 });
    expect(isHoodOverRangePair(hood, r)).toBe(true);
    const wall = cabinetWall(hood, DEFAULT_ROOM);
    expect(wall).toBe("top");
    expect(wallRunOffset(hood, wall, DEFAULT_ROOM) + wallRunSpan(hood, wall, DEFAULT_ROOM) / 2).toBeCloseTo(75, 3);
    expect(appendCollisionFreePlacements([r], [hood], DEFAULT_ROOM).rejected).toHaveLength(0);
  });

  it("uses the 36-inch hood for a 36-inch range and centers it on a right-wall range", () => {
    const r = range(36, "right", 30);
    const result = fourAnchorRangeHood({ range: r, room: DEFAULT_ROOM, palette, uid: "hood-2" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hood.masterCode).toBe("HOOD-36");
    const wall = cabinetWall(result.hood, DEFAULT_ROOM);
    expect(wall).toBe("right");
    expect(wallRunOffset(result.hood, wall, DEFAULT_ROOM) + wallRunSpan(result.hood, wall, DEFAULT_ROOM) / 2).toBeCloseTo(30 + 18, 3);
  });

  it("explains itself when the palette has no hood", () => {
    const result = fourAnchorRangeHood({ range: range(30, "top", 60), room: DEFAULT_ROOM, palette: palette.filter((item) => !/^HOOD-/.test(item.masterCode)), uid: "x" });
    expect(result.ok).toBe(false);
  });

  it("only asks about ranges that have no hood or microwave yet", () => {
    const r = range(30, "top", 60);
    expect(fourAnchorRangeNeedsVentilation([r], r)).toBe(true);
    const built = fourAnchorRangeHood({ range: r, room: DEFAULT_ROOM, palette, uid: "h" });
    if (!built.ok) throw new Error("hood failed");
    expect(fourAnchorRangeNeedsVentilation([r, built.hood], r)).toBe(false);
  });
});
