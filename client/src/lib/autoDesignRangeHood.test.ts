import { describe, expect, it } from "vitest";
import {
  APPLIANCES, DEFAULT_ROOM, appendCollisionFreePlacements, applianceAsDesignCabinet, cabinetWall, isHoodOverRangePair,
  wallPlacementAt, wallRunOffset, wallRunSpan, type PlacedCabinet,
} from "./design";
import { AUTO_DESIGN_STANDARD_HOOD_BOTTOM_IN, autoDesignHoodMountBottom, autoDesignRangeHood, autoDesignRangeNeedsVentilation } from "./autoDesignRangeHood";

const palette = APPLIANCES.filter((item) => item.rooms.includes("kitchen")).map(applianceAsDesignCabinet);

function range(width: number, side: "top" | "right", offset: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 26, side, DEFAULT_ROOM);
  return {
    uid: `range-${side}-${offset}`, cabinetId: 0, masterCode: `RANGE-${width}`, description: `${width}" Range`, category: "Appliance",
    subCategory: null, placement: "appliance", ...spot, width, depth: 26, height: 36, mountBottom: 0, numberOfDoors: null, numberOfDrawers: null,
  } as PlacedCabinet;
}

describe("Auto-Design range ventilation", () => {
  it("builds a 30-inch hood centered on a 30-inch range at the standard hood datum", () => {
    const r = range(30, "top", 60);
    const result = autoDesignRangeHood({ range: r, room: DEFAULT_ROOM, palette, uid: "hood-1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hood = result.hood;
    expect(hood).toMatchObject({ uid: "hood-1", masterCode: "HOOD-30", placement: "appliance", width: 30, mountBottom: AUTO_DESIGN_STANDARD_HOOD_BOTTOM_IN });
    expect(isHoodOverRangePair(hood, r)).toBe(true);
    const wall = cabinetWall(hood, DEFAULT_ROOM);
    expect(wall).toBe("top");
    expect(wallRunOffset(hood, wall, DEFAULT_ROOM) + wallRunSpan(hood, wall, DEFAULT_ROOM) / 2).toBeCloseTo(75, 3);
    expect(appendCollisionFreePlacements([r], [hood], DEFAULT_ROOM).rejected).toHaveLength(0);
  });

  it("uses the 36-inch hood for a 36-inch range and centers it on a right-wall range", () => {
    const r = range(36, "right", 30);
    const result = autoDesignRangeHood({ range: r, room: DEFAULT_ROOM, palette, uid: "hood-2" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hood.masterCode).toBe("HOOD-36");
    expect(result.hood.mountBottom).toBe(AUTO_DESIGN_STANDARD_HOOD_BOTTOM_IN);
    const wall = cabinetWall(result.hood, DEFAULT_ROOM);
    expect(wall).toBe("right");
    expect(wallRunOffset(result.hood, wall, DEFAULT_ROOM) + wallRunSpan(result.hood, wall, DEFAULT_ROOM) / 2).toBeCloseTo(30 + 18, 3);
  });

  it("raises only a 42 inch hood to 60 inches", () => {
    const r = range(42, "top", 60);
    const result = autoDesignRangeHood({
      range: r, room: DEFAULT_ROOM, uid: "hood-42",
      palette: [
        ...palette,
        { id: 42, masterCode: "HOOD-42", description: "42 inch hood", width: "42", depth: "18", height: "18", placement: "appliance", mountBottom: 66 } as never,
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hood.masterCode).toBe("HOOD-42");
    expect(result.hood.mountBottom).toBe(60);
    expect(autoDesignHoodMountBottom(30)).toBe(54);
    expect(autoDesignHoodMountBottom(36)).toBe(54);
    expect(autoDesignHoodMountBottom(48)).toBe(54);
  });

  it("explains itself when the palette has no hood", () => {
    const result = autoDesignRangeHood({ range: range(30, "top", 60), room: DEFAULT_ROOM, palette: palette.filter((item) => !/^HOOD-/.test(item.masterCode)), uid: "x" });
    expect(result.ok).toBe(false);
  });

  it("only asks about ranges that have no hood or microwave yet", () => {
    const r = range(30, "top", 60);
    expect(autoDesignRangeNeedsVentilation([r], r)).toBe(true);
    const built = autoDesignRangeHood({ range: r, room: DEFAULT_ROOM, palette, uid: "h" });
    if (!built.ok) throw new Error("hood failed");
    expect(autoDesignRangeNeedsVentilation([r, built.hood], r)).toBe(false);
  });
});
