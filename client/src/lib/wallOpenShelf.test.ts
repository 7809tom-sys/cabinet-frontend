import { describe, expect, it } from "vitest";
import {
  WALL_OPEN_SHELF_DEPTH_IN,
  isWallEndOpenShelfCode,
  isWallOpenShelfCabinet,
  kitchenCrestOpenEndShelfCount,
  wallOpenShelfNominalSize,
  wallOpenShelfShelfCenters,
  wallOpenShelfShelfCount,
  wallOpenShelfShelfRadius,
} from "./wallOpenShelf";
import {
  elevationBox,
  isWallOpenShelfCabinet as designIsWallOpenShelfCabinet,
  normalizeWallOpenShelfMounts,
  normalizeWallOpenShelfPlacement,
  ordinaryWallMountBottom,
  wallOpenShelfShelfCount as designWallOpenShelfShelfCount,
  type PlacedCabinet,
  type RoomData,
} from "./design";

const ROOM: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function wallCabinet(uid: string, x: number, width: number, height: number): PlacedCabinet {
  return {
    uid,
    cabinetId: 1,
    masterCode: `W${width}${height}`,
    description: `${width}" Wall Cabinet`,
    placement: "wall",
    x,
    y: 0,
    width,
    depth: 12,
    height,
    rotation: 0,
    numberOfDoors: width > 18 ? 2 : 1,
    numberOfDrawers: 0,
    wallId: "top",
    wallOffset: x,
  };
}

function openShelf(
  masterCode: string,
  x: number,
  overrides: Partial<PlacedCabinet> = {},
): PlacedCabinet {
  const nominal = wallOpenShelfNominalSize(masterCode)!;
  return {
    uid: `shelf-${masterCode}`,
    cabinetId: 930,
    masterCode,
    description: "Wall End Open Shelf",
    placement: "wall",
    x,
    y: 0,
    width: nominal.width,
    depth: nominal.depth,
    height: nominal.height,
    rotation: 0,
    numberOfDoors: 0,
    numberOfDrawers: 0,
    fixedShelfCount: 2,
    wallId: "top",
    wallOffset: x,
    ...overrides,
  };
}

describe("wall open shelf family", () => {
  it("recognizes the WEOS wall end family and the KitchenCrest OE6 open-end line", () => {
    expect(isWallEndOpenShelfCode("WEOS0930")).toBe(true);
    expect(isWallEndOpenShelfCode("WEOS0936")).toBe(true);
    expect(isWallEndOpenShelfCode("WEOS0942")).toBe(true);
    expect(isWallEndOpenShelfCode("WOS0930")).toBe(false);
    expect(isWallEndOpenShelfCode("OE630")).toBe(false);

    expect(isWallOpenShelfCabinet({ masterCode: "WEOS0936" })).toBe(true);
    expect(isWallOpenShelfCabinet({ masterCode: "WOS0930" })).toBe(true);
    expect(isWallOpenShelfCabinet({ masterCode: "OE636", description: '6" x 36" Open End Shelf Wall Cabinet' })).toBe(true);
    // A thin floating shelf is never the wall open-shelf box.
    expect(isWallOpenShelfCabinet({ masterCode: "FS48", description: "48 inch Floating Shelf" })).toBe(false);
  });

  it("reads the code-declared size for all three WEOS heights at the 12-inch wall depth", () => {
    expect(wallOpenShelfNominalSize("WEOS0930")).toEqual({ width: 9, height: 30, depth: 12 });
    expect(wallOpenShelfNominalSize("WEOS0936")).toEqual({ width: 9, height: 36, depth: 12 });
    expect(wallOpenShelfNominalSize("WEOS0942")).toEqual({ width: 9, height: 42, depth: 12 });
    expect(wallOpenShelfNominalSize("WEOS-09-36")).toEqual({ width: 9, height: 36, depth: 12 });
    expect(wallOpenShelfNominalSize("WOS1842")).toEqual({ width: 18, height: 42, depth: 12 });
    expect(wallOpenShelfNominalSize("OE630")).toBeNull();
    expect(WALL_OPEN_SHELF_DEPTH_IN).toBe(12);
  });

  it("takes the shelf count from the cabinet's own edit config, never from a stock default", () => {
    expect(wallOpenShelfShelfCount({ masterCode: "WEOS0930", fixedShelfCount: 2 })).toEqual({ count: 2, source: "config" });
    expect(wallOpenShelfShelfCount({ masterCode: "WEOS0936", fixedShelfCount: 3 })).toEqual({ count: 3, source: "config" });
    expect(wallOpenShelfShelfCount({ masterCode: "WEOS0942", numberOfFixedShelves: 4 })).toEqual({ count: 4, source: "config" });
    // A configured zero stays zero: the renderer must not add a shelf.
    expect(wallOpenShelfShelfCount({ masterCode: "WEOS0942", fixedShelfCount: 0 })).toEqual({ count: 0, source: "config" });
    // No configured count on a WEOS falls back to that family's source drawing.
    expect(wallOpenShelfShelfCount({ masterCode: "WEOS0936" })).toEqual({ count: 2, source: "wall-end-source" });
    // A row with no count of any kind gains no invented shelf.
    expect(wallOpenShelfShelfCount({ masterCode: "WOS0930" })).toEqual({ count: 0, source: "none" });
  });

  it("uses the supplied KitchenCrest line art ahead of a stale live master row", () => {
    const oe630 = { masterCode: "OE630", description: '6" x 30" Open End Shelf Wall Cabinet', fixedShelfCount: 3 };
    expect(kitchenCrestOpenEndShelfCount(oe630)).toBe(2);
    expect(wallOpenShelfShelfCount(oe630)).toEqual({ count: 2, source: "kitchencrest-line-art" });
    const oe636 = { masterCode: "OE636", description: '6" x 36" Open End Shelf Wall Cabinet' };
    expect(kitchenCrestOpenEndShelfCount(oe636)).toBe(3);
    // The same code without an open-shelf description is not this family.
    expect(kitchenCrestOpenEndShelfCount({ masterCode: "OE630", description: "Oven End Cabinet" })).toBeNull();
  });

  it("divides the interior evenly so every shelf centre is one equal compartment apart", () => {
    // A 30" box with two 1/2" shelves and 3/4" panels leaves 27" of opening;
    // two boards divide it into three 9" compartments.
    expect(wallOpenShelfShelfCenters(27, 2)).toEqual([9, 18]);
    expect(wallOpenShelfShelfCenters(33, 2)).toEqual([11, 22]);
    expect(wallOpenShelfShelfCenters(39, 2)).toEqual([13, 26]);
    expect(wallOpenShelfShelfCenters(27, 0)).toEqual([]);
    // Three boards, four equal openings.
    expect(wallOpenShelfShelfCenters(32, 3)).toEqual([8, 16, 24]);
  });

  it("bounds the rounded shelf-front radius so a 9-inch shelf cannot carry a nonsense arc", () => {
    const radius = wallOpenShelfShelfRadius(9, 12);
    expect(radius).toBe(2);
    expect(wallOpenShelfShelfRadius(2, 12)).toBeLessThanOrEqual(0.9);
    expect(wallOpenShelfShelfRadius(9, 1)).toBeLessThanOrEqual(0.45);
  });

  it("is re-exported through design.ts so plan, elevation and 3D share one contract", () => {
    expect(designIsWallOpenShelfCabinet({ masterCode: "WEOS0936" })).toBe(true);
    expect(designWallOpenShelfShelfCount({ masterCode: "WEOS0936", fixedShelfCount: 2 }).count).toBe(2);
  });
});

describe("wall open shelf placement and mounting", () => {
  it("normalizes a stale floating-shelf record into the full wall box for every WEOS height", () => {
    for (const [masterCode, height] of [["WEOS0930", 30], ["WEOS0936", 36], ["WEOS0942", 42]] as const) {
      const stale: PlacedCabinet = {
        uid: `stale-${masterCode}`,
        cabinetId: 930,
        masterCode,
        description: "Versa Shaker Wall End Shelf",
        placement: "base",
        x: 0,
        y: 0,
        width: 9,
        depth: 24,
        height: 2.06,
        rotation: 0,
        numberOfDoors: 2,
        numberOfDrawers: 1,
      };
      expect(normalizeWallOpenShelfPlacement(stale)).toMatchObject({
        placement: "wall",
        width: 9,
        height,
        depth: 12,
        numberOfDoors: 0,
        numberOfDrawers: 0,
        // No configured count on the row: the WEOS source shows two shelves.
        fixedShelfCount: 2,
      });
    }
  });

  it("keeps a configured shelf count through placement normalization instead of forcing two", () => {
    const threeShelf = normalizeWallOpenShelfPlacement(openShelf("WEOS0936", 54, { fixedShelfCount: 3 }));
    expect(threeShelf.fixedShelfCount).toBe(3);
    const noShelf = normalizeWallOpenShelfPlacement(openShelf("WEOS0942", 54, { fixedShelfCount: 0 }));
    expect(noShelf.fixedShelfCount).toBe(0);
  });

  it("hangs each height so its finished top matches the standard 84-inch upper run", () => {
    expect(ordinaryWallMountBottom({ placement: "wall", masterCode: "WEOS0930", height: 30 })).toBe(54);
    expect(ordinaryWallMountBottom({ placement: "wall", masterCode: "WEOS0936", height: 36 })).toBe(48);
    expect(ordinaryWallMountBottom({ placement: "wall", masterCode: "WEOS0942", height: 42 })).toBe(42);

    for (const [masterCode, bottom] of [["WEOS0930", 54], ["WEOS0936", 48], ["WEOS0942", 42]] as const) {
      const shelf = openShelf(masterCode, 54);
      expect(elevationBox({ ...shelf, mountBottom: bottom }, ROOM).bottom).toBe(bottom);
      expect(elevationBox({ ...shelf, mountBottom: bottom }, ROOM).bottom
        + elevationBox({ ...shelf, mountBottom: bottom }, ROOM).height).toBe(84);
    }
  });

  it("matches the adjacent wall cabinet's top line for a 30, 36 and 42 inch shelf", () => {
    for (const [masterCode, expectedBottom] of [["WEOS0930", 54], ["WEOS0936", 48], ["WEOS0942", 42]] as const) {
      // A 24-inch upper finishes on the run top line. On a standard 8-foot
      // ceiling that is 84 inches, so the shelf hangs its own height below it.
      const standard = normalizeWallOpenShelfMounts(
        [wallCabinet("neighbor", 30, 24, 24), openShelf(masterCode, 54)],
        ROOM,
      ).find((item) => item.masterCode === masterCode)!;
      expect(standard.mountBottom, masterCode).toBe(expectedBottom);
      // The run top stays continuous: the shelf's top meets the neighbour's top.
      const neighbour = elevationBox(wallCabinet("neighbor", 30, 24, 24), ROOM);
      const shelf = elevationBox(standard, ROOM);
      expect(shelf.bottom + shelf.height, masterCode).toBe(neighbour.bottom + neighbour.height);
    }
  });

  it("follows a raised run top when the neighbour sits above the standard line", () => {
    // A 24-inch upper raised to a 66-inch bottom finishes at 90 inches, so a
    // 36-inch shelf must start at 54 inches to keep the run top continuous.
    const raisedNeighbor: PlacedCabinet = {
      ...wallCabinet("neighbor", 30, 24, 24),
      mountBottom: 66,
      mountBottomAdjusted: true,
    };
    const placed = normalizeWallOpenShelfMounts([raisedNeighbor, openShelf("WEOS0936", 54)], ROOM);
    const shelf = placed.find((item) => item.masterCode === "WEOS0936")!;
    expect(shelf.mountBottom).toBe(54);
    expect(elevationBox(shelf, ROOM).bottom + elevationBox(shelf, ROOM).height)
      .toBe(elevationBox(raisedNeighbor, ROOM).bottom + elevationBox(raisedNeighbor, ROOM).height);
  });

  it("leaves a user's own vertical position and mid-run shelves alone", () => {
    const moved = normalizeWallOpenShelfMounts(
      [wallCabinet("neighbor", 30, 24, 30), openShelf("WEOS0936", 54, { mountBottom: 60, mountBottomAdjusted: true })],
      ROOM,
    );
    expect(moved.find((item) => item.masterCode === "WEOS0936")!.mountBottom).toBe(60);

    // A shelf with neighbours on BOTH sides sits mid-run; it keeps its own line.
    const midRun = normalizeWallOpenShelfMounts(
      [wallCabinet("left", 0, 30, 30), openShelf("WEOS0936", 30), wallCabinet("right", 39, 24, 30)],
      ROOM,
    );
    const shelf = midRun.find((item) => item.masterCode === "WEOS0936")!;
    expect(shelf.mountBottom).toBe(48);
  });
});
