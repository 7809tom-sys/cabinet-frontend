import { describe, expect, it } from "vitest";
import {
  WALL_OPEN_SHELF_DEPTH_IN,
  canonicalWallOpenShelfCode,
  isWallEndOpenShelfCode,
  isWallOpenShelfCabinet,
  kitchenCrestOpenEndShelfCount,
  wallOpenShelfCodeSpellings,
  wallOpenShelfDisplayName,
  wallOpenShelfNominalSize,
  wallOpenShelfShelfCenters,
  wallOpenShelfShelfCount,
  wallOpenShelfShelfRadius,
  resolvedWallOpenShelfHand,
  splitWallOpenShelfHand,
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
    expect(isWallEndOpenShelfCode("WOS0930")).toBe(true);
    expect(isWallEndOpenShelfCode("OE630")).toBe(false);

    expect(isWallOpenShelfCabinet({ masterCode: "WEOS0936" })).toBe(true);
    expect(isWallOpenShelfCabinet({ masterCode: "WOS0930" })).toBe(true);
    expect(isWallOpenShelfCabinet({ masterCode: "OE636", description: '6" x 36" Open End Shelf Wall Cabinet' })).toBe(true);
    // A thin floating shelf is never the wall open-shelf box.
    expect(isWallOpenShelfCabinet({ masterCode: "FS48", description: "48 inch Floating Shelf" })).toBe(false);
  });

  it("treats WEOS, WOES and WOS as one cabinet and resolves every spelling to the WOS master", () => {
    // Faircrest's catalog spelling is WOS; WEOS is the distributor spelling and
    // WOES is a misspelling. All three are the same physical box.
    expect(canonicalWallOpenShelfCode("WOS0930")).toBe("WOS0930");
    expect(canonicalWallOpenShelfCode("WEOS0930")).toBe("WOS0930");
    expect(canonicalWallOpenShelfCode("WOES0930")).toBe("WOS0930");

    for (const size of ["0930", "0936", "0942", "1230", "1236", "1242"]) {
      for (const prefix of ["WOS", "WEOS", "WOES"]) {
        expect(canonicalWallOpenShelfCode(`${prefix}${size}`), `${prefix}${size}`).toBe(`WOS${size}`);
        expect(isWallEndOpenShelfCode(`${prefix}${size}`), `${prefix}${size}`).toBe(true);
      }
    }

    // The size and name are identical whatever spelling the row carries.
    const expected = {
      "0930": { width: 9, height: 30 },
      "0936": { width: 9, height: 36 },
      "0942": { width: 9, height: 42 },
      "1230": { width: 12, height: 30 },
      "1236": { width: 12, height: 36 },
      "1242": { width: 12, height: 42 },
    } as const;
    for (const [size, dims] of Object.entries(expected)) {
      for (const prefix of ["WOS", "WEOS", "WOES"]) {
        const code = `${prefix}${size}`;
        expect(wallOpenShelfNominalSize(code), code).toEqual({ ...dims, depth: 12 });
        expect(wallOpenShelfDisplayName({ masterCode: code }), code).toBe(`Open Shelf ${dims.width}"W x ${dims.height}"H`);
      }
    }

    // Every spelling a row may carry lists the full set, catalog first.
    expect(wallOpenShelfCodeSpellings("WOES1236")).toEqual(["WOS1236", "WEOS1236", "WOES1236"]);
    // An unrelated code is not swept into the family by the alias.
    expect(canonicalWallOpenShelfCode("OE630")).toBeNull();
    expect(canonicalWallOpenShelfCode("B24")).toBeNull();
    // The handed 20-20 rows stay separate products, not WOS aliases.
    expect(canonicalWallOpenShelfCode("WOS1230L")).toBeNull();
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

  it("reads the 12-wide variants as the same family at every height", () => {
    expect(wallOpenShelfNominalSize("WEOS1230")).toEqual({ width: 12, height: 30, depth: 12 });
    expect(wallOpenShelfNominalSize("WEOS1236")).toEqual({ width: 12, height: 36, depth: 12 });
    expect(wallOpenShelfNominalSize("WEOS1242")).toEqual({ width: 12, height: 42, depth: 12 });
    for (const code of ["WEOS1230", "WEOS1236", "WEOS1242"]) {
      expect(isWallEndOpenShelfCode(code), code).toBe(true);
      expect(isWallOpenShelfCabinet({ masterCode: code }), code).toBe(true);
    }
    // A 12-wide code is the same family as its 9-wide sibling, not a new shape.
    expect(wallOpenShelfNominalSize("WEOS1236")?.depth).toBe(wallOpenShelfNominalSize("WEOS0936")?.depth);
  });

  it("names every size 'Open Shelf' with width and height only, never depth", () => {
    expect(wallOpenShelfDisplayName({ masterCode: "WEOS0930" })).toBe('Open Shelf 9"W x 30"H');
    expect(wallOpenShelfDisplayName({ masterCode: "WEOS0936" })).toBe('Open Shelf 9"W x 36"H');
    expect(wallOpenShelfDisplayName({ masterCode: "WEOS0942" })).toBe('Open Shelf 9"W x 42"H');
    expect(wallOpenShelfDisplayName({ masterCode: "WEOS1230" })).toBe('Open Shelf 12"W x 30"H');
    expect(wallOpenShelfDisplayName({ masterCode: "WEOS1236" })).toBe('Open Shelf 12"W x 36"H');
    expect(wallOpenShelfDisplayName({ masterCode: "WEOS1242" })).toBe('Open Shelf 12"W x 42"H');

    // Depth must never appear in a customer-facing name, at any size.
    for (const code of ["WEOS0930", "WEOS0936", "WEOS0942", "WEOS1230", "WEOS1236", "WEOS1242"]) {
      const name = wallOpenShelfDisplayName({ masterCode: code })!;
      expect(name, code).not.toMatch(/\d+"?D\b/);
      expect(name, code).not.toMatch(/\b12"\s*x\s*12/i);
      expect(name, code).toMatch(/^Open Shelf \d+"W x \d+"H$/);
    }
  });

  it("falls back to the placed width and height when the code carries no size", () => {
    // A custom row with no size-bearing code but an explicit wall open-shelf
    // description still names correctly from its placed dimensions.
    expect(wallOpenShelfDisplayName({ masterCode: "CUSTOM-OS", description: 'Wall Open Shelf', width: 15, height: 36 })).toBe('Open Shelf 15"W x 36"H');
    // No size at all: return null so the caller keeps the catalog description.
    expect(wallOpenShelfDisplayName({ masterCode: "CUSTOM-OS", description: 'Wall Open Shelf' })).toBeNull();
  });

  it("never renames a cabinet that is not an open shelf", () => {
    // A glass-door wall cabinet and a plain base keep their own names.
    expect(wallOpenShelfDisplayName({ masterCode: "W2430GD", width: 24, height: 30 })).toBeNull();
    expect(wallOpenShelfDisplayName({ masterCode: "B24", width: 24, height: 34.5 })).toBeNull();
    expect(wallOpenShelfDisplayName({ masterCode: "FS48", description: "48 inch Floating Shelf", width: 48, height: 2.06 })).toBeNull();
  });

  it("treats -L / -R as one item's handing, never as a separate SKU", () => {
    // One catalog item per size. A trailing hand resolves to the same cabinet.
    for (const [raw, hand] of [
      ["WOS0930-L", "left"],
      ["WOS0930-R", "right"],
      ["WEOS0930-L", "left"],
      ["WOES0930-R", "right"],
      ["WOS0930L", "left"],
      ["WOS1236-R", "right"],
    ] as const) {
      const split = splitWallOpenShelfHand(raw);
      expect(split.hand, raw).toBe(hand);
      expect(split.canonical, raw).toBe(raw.startsWith("WOS1236") ? "WOS1236" : "WOS0930");
      expect(isWallEndOpenShelfCode(raw), raw).toBe(true);
      // Size and name are unaffected by the hand.
      expect(wallOpenShelfDisplayName({ masterCode: raw }), raw).toBe(
        raw.startsWith("WOS1236") ? 'Open Shelf 12"W x 36"H' : 'Open Shelf 9"W x 30"H',
      );
    }

    // A code with no hand is still the same item, with hand null.
    expect(splitWallOpenShelfHand("WOS0930")).toEqual({ canonical: "WOS0930", hand: null });
    // An unrelated code ending in L/R is not reinterpreted.
    expect(splitWallOpenShelfHand("B24L").canonical).toBeNull();
    // The glued spellings in the 20-20 export are the same handed pair, not two
    // products: WOS1230L is the left-hand form of WOS1230.
    expect(splitWallOpenShelfHand("WOS1230L")).toEqual({ canonical: "WOS1230", hand: "left" });
    expect(splitWallOpenShelfHand("WOS1230R")).toEqual({ canonical: "WOS1230", hand: "right" });
  });

  it("resolves the render hand from config, then code, then the measured run end", () => {
    // An explicit saved hand wins over everything.
    expect(resolvedWallOpenShelfHand({ masterCode: "WOS0930-L", openShelfHand: "right" })).toBe("right");
    // Then a hand encoded in the code.
    expect(resolvedWallOpenShelfHand({ masterCode: "WOS0930-L" })).toBe("left");
    expect(resolvedWallOpenShelfHand({ masterCode: "WEOS1230-R" })).toBe("right");
    // Then the measured run end.
    expect(resolvedWallOpenShelfHand({ masterCode: "WOS0930", measuredHand: "left" })).toBe("left");
    // A standalone shelf with nothing to go on defaults to the viewer's right.
    expect(resolvedWallOpenShelfHand({ masterCode: "WOS0930" })).toBe("right");
  });

  it("takes the shelf count from the cabinet's own edit config, never from a stock default", () => {
    expect(wallOpenShelfShelfCount({ masterCode: "WEOS0930", fixedShelfCount: 2 })).toEqual({ count: 2, source: "config" });
    expect(wallOpenShelfShelfCount({ masterCode: "WEOS0936", fixedShelfCount: 3 })).toEqual({ count: 3, source: "config" });
    expect(wallOpenShelfShelfCount({ masterCode: "WEOS0942", numberOfFixedShelves: 4 })).toEqual({ count: 4, source: "config" });
    // A configured zero stays zero: the renderer must not add a shelf.
    expect(wallOpenShelfShelfCount({ masterCode: "WEOS0942", fixedShelfCount: 0 })).toEqual({ count: 0, source: "config" });
    // A NULL config is missing, not zero, and must fall back to the family's
    // two-shelf source drawing rather than silently drawing an empty box.
    expect(wallOpenShelfShelfCount({ masterCode: "WOS0930", fixedShelfCount: null, numberOfFixedShelves: null })).toEqual({ count: 2, source: "wall-end-source" });
    expect(wallOpenShelfShelfCount({ masterCode: "WOS1236", fixedShelfCount: null })).toEqual({ count: 2, source: "wall-end-source" });
    expect(wallOpenShelfShelfCount({ masterCode: "WEOS0930", fixedShelfCount: undefined, numberOfFixedShelves: undefined })).toEqual({ count: 2, source: "wall-end-source" });
    // No configured count on a WEOS falls back to that family's source drawing.
    expect(wallOpenShelfShelfCount({ masterCode: "WEOS0936" })).toEqual({ count: 2, source: "wall-end-source" });
    // A WOS row with no count is the same cabinet, so it gets the same source count.
    expect(wallOpenShelfShelfCount({ masterCode: "WOS0930" })).toEqual({ count: 2, source: "wall-end-source" });
    // A row outside the family gains no invented shelf at all.
    expect(wallOpenShelfShelfCount({ masterCode: "B24" })).toEqual({ count: 0, source: "none" });
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
