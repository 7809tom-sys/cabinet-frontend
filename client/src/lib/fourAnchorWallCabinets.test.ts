import { describe, expect, it } from "vitest";
import { buildFourAnchorWallCabinets } from "./fourAnchorWallCabinets";
import {
  wallPlacementAt,
  wallRunOffset,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";

const ROOM: RoomData = { width: 180, depth: 120, ceilingHeight: 96 };

/** A complete source-catalog record: additions must be copied from these real SKUs, never invented. */
function catalogCabinet(overrides: Partial<DesignCabinet> & Pick<DesignCabinet, "id" | "masterCode">): DesignCabinet {
  return {
    id: overrides.id,
    masterCode: overrides.masterCode,
    displayMasterCode: null,
    description: "Standard Wall Cabinet",
    category: "Wall",
    subCategory: "Wall Cabinet",
    width: "36",
    height: "30",
    depth: "12",
    placement: "wall",
    constructionMethod: null,
    applianceRole: null,
    applianceProductId: null,
    applianceCatalogCode: null,
    applianceCatalogName: null,
    applianceCatalogPrice: null,
    cooktopConversionStatus: undefined,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    isCornerCabinet: false,
    fillerRequired: null,
    mountBottom: null,
    catalogImageUrl: null,
    specImageUrl: null,
    graphicType: null,
    pullMin: null,
    pullMax: null,
    cornerType: null,
    openingType: null,
    doorHeight: null,
    drawerHeight: null,
    doorsPerRow: null,
    doorOrientation: null,
    ovenType: null,
    sourceOvenDrawerLayout: null,
    layoutSpec: null,
    drawerLayout: null,
    customProfile: null,
    facePattern: null,
    glassDoor: false,
    glassDoorAddonCode: null,
    glassIncluded: false,
    ...overrides,
  };
}

function onWall(
  room: RoomData,
  side: "top" | "bottom" | "left" | "right",
  overrides: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode" | "placement" | "width" | "depth">,
  offset: number,
): PlacedCabinet {
  const spot = wallPlacementAt(offset, overrides.width, overrides.depth, side, room);
  const appliance = overrides.placement === "appliance";
  return {
    uid: overrides.uid,
    cabinetId: appliance ? 0 : 1,
    masterCode: overrides.masterCode,
    description: appliance ? "Kitchen appliance" : "Lower cabinet",
    category: appliance ? "Appliance" : "Base",
    subCategory: appliance ? "Appliance" : "Base Cabinet",
    isCornerCabinet: false,
    placement: overrides.placement,
    x: spot.x,
    y: spot.y,
    width: overrides.width,
    depth: overrides.depth,
    height: appliance ? 34.5 : 34.5,
    rotation: spot.rotation,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
    nominalWidth: overrides.width,
    nominalDepth: overrides.depth,
    nominalHeight: appliance ? 34.5 : 34.5,
    ...overrides,
  };
}

function onTopWall(
  room: RoomData,
  overrides: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode" | "placement" | "width" | "depth">,
  offset: number,
): PlacedCabinet {
  return onWall(room, "top", overrides, offset);
}

function uidFactory(prefix = "upper") {
  let sequence = 0;
  return () => `${prefix}-${++sequence}`;
}

function build(input: {
  placed: PlacedCabinet[];
  catalog: DesignCabinet[];
  room?: RoomData;
  openings?: WallOpening[];
  wallCabinetHeightIn?: 30 | 36 | 42;
  styleId?: number | null;
  corners?: Array<{ base: PlacedCabinet; point: { x: number; y: number; firstWallId: string } }>;
}) {
  return buildFourAnchorWallCabinets({
    placed: input.placed,
    room: input.room ?? ROOM,
    openings: input.openings ?? [],
    catalog: input.catalog,
    wallCabinetHeightIn: input.wallCabinetHeightIn ?? 30,
    styleId: input.styleId ?? 77,
    makeUid: uidFactory(),
    corners: input.corners,
  });
}

describe("buildFourAnchorWallCabinets", () => {
  it("aligns source-priced W3630 and W2430 cabinets with a B36 and DW-24 projection", () => {
    const base = onTopWall(ROOM, { uid: "base-36", masterCode: "B36", placement: "base", width: 36, depth: 24 }, 12);
    const dishwasher = onTopWall(ROOM, {
      uid: "dishwasher-24", masterCode: "DW-24", placement: "appliance", width: 24, depth: 24,
      description: "Dishwasher 24\"",
    }, 60);
    const result = build({
      placed: [base, dishwasher],
      catalog: [
        catalogCabinet({ id: 101, masterCode: "W3630", description: "36 inch Double Door Wall Cabinet", width: "36" }),
        catalogCabinet({ id: 102, masterCode: "W2430", description: "24 inch Double Door Wall Cabinet", width: "24" }),
      ],
      styleId: 432,
    });

    expect(result.additions).toHaveLength(2);
    expect(result.additions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        uid: "upper-1", cabinetId: 101, masterCode: "W3630", placement: "wall",
        width: 36, depth: 12, height: 30, mountBottom: 54, styleId: 432,
      }),
      expect.objectContaining({
        uid: "upper-2", cabinetId: 102, masterCode: "W2430", placement: "wall",
        width: 24, depth: 12, height: 30, mountBottom: 54, styleId: 432,
      }),
    ]));
    expect(wallRunOffset(result.additions[0]!, "top", ROOM)).toBeCloseTo(wallRunOffset(base, "top", ROOM), 6);
    expect(wallRunOffset(result.additions[1]!, "top", ROOM)).toBeCloseTo(wallRunOffset(dishwasher, "top", ROOM), 6);
    expect(result.placed).toHaveLength(4);
  });

  it("falls back from B36 to exactly two real W1830 source SKUs without resizing or zero-ID records", () => {
    const base = onTopWall(ROOM, { uid: "base-tiled", masterCode: "B36", placement: "base", width: 36, depth: 24 }, 12);
    const result = build({
      placed: [base],
      catalog: [catalogCabinet({ id: 151, masterCode: "W1830", description: "18 inch Double Door Wall Cabinet", width: "18" })],
    });

    expect(result.additions).toHaveLength(2);
    expect(result.additions).toEqual([
      expect.objectContaining({ cabinetId: 151, masterCode: "W1830", width: 18, height: 30, depth: 12 }),
      expect.objectContaining({ cabinetId: 151, masterCode: "W1830", width: 18, height: 30, depth: 12 }),
    ]);
    expect(result.additions.every((cabinet) => cabinet.cabinetId > 0 && cabinet.width === 18)).toBe(true);
    expect(wallRunOffset(result.additions[0]!, "top", ROOM)).toBeCloseTo(12, 6);
    expect(wallRunOffset(result.additions[1]!, "top", ROOM)).toBeCloseTo(30, 6);
    expect(result.skipped).toEqual([]);
  });

  it("rolls back the whole tiled projection when its second source-sized upper is blocked", () => {
    const base = onTopWall(ROOM, { uid: "base-atomic", masterCode: "B36", placement: "base", width: 36, depth: 24 }, 12);
    const window: WallOpening = {
      uid: "tile-window", kind: "window", label: "Window", side: "top", offset: 48, width: 36, height: 36, sill: 42,
    };
    const result = build({
      placed: [base],
      openings: [window],
      catalog: [catalogCabinet({ id: 161, masterCode: "W1830", width: "18" })],
    });

    // The first tile (12–30) is clear, but the second (30–48) crosses the window's 3-inch clearance at 45.
    expect(result.additions).toEqual([]);
    expect(result.placed).toEqual([base]);
    expect(result.skipped).toContainEqual(expect.stringContaining("B36: aligned upper needs review for an opening"));
  });

  it("keeps an aligned same-width upper on a right wall's measured run axis", () => {
    const base = onWall(ROOM, "right", { uid: "right-base", masterCode: "B36", placement: "base", width: 36, depth: 24 }, 24);
    const result = build({
      placed: [base],
      catalog: [catalogCabinet({ id: 171, masterCode: "W3630", width: "36" })],
    });

    expect(result.additions).toHaveLength(1);
    expect(result.additions[0]).toMatchObject({ cabinetId: 171, masterCode: "W3630", wallId: "right", rotation: 90, width: 36 });
    expect(wallRunOffset(result.additions[0]!, "right", ROOM)).toBeCloseTo(wallRunOffset(base, "right", ROOM), 6);
  });

  it.each([
    [36, "W3636"],
    [42, "W3642"],
  ] as const)("uses the selected %i-inch source height (%s), not a resized alternate", (height, expectedCode) => {
    const base = onTopWall(ROOM, { uid: `base-${height}`, masterCode: "B36", placement: "base", width: 36, depth: 24 }, 18);
    const result = build({
      placed: [base],
      wallCabinetHeightIn: height,
      catalog: [
        catalogCabinet({ id: 201, masterCode: "W3630", width: "36", height: "30" }),
        catalogCabinet({ id: 202, masterCode: "W3636", width: "36", height: "36" }),
        catalogCabinet({ id: 203, masterCode: "W3642", width: "36", height: "42" }),
      ],
    });

    expect(result.additions).toHaveLength(1);
    expect(result.additions[0]).toMatchObject({ masterCode: expectedCode, width: 36, height });
  });

  it("does not add an upper whose aligned projection is inside the required three-inch window clearance", () => {
    const base = onTopWall(ROOM, { uid: "window-base", masterCode: "B36", placement: "base", width: 36, depth: 24 }, 11);
    const window: WallOpening = {
      uid: "window", kind: "window", label: "Window", side: "top", offset: 48, width: 36, height: 36, sill: 42,
    };
    const result = build({
      placed: [base],
      openings: [window],
      catalog: [catalogCabinet({ id: 301, masterCode: "W3630", width: "36" })],
    });

    // The cabinet would end at 47 in: only one inch from the window instead of the required three.
    expect(result.additions).toEqual([]);
    expect(result.skipped).toContainEqual(expect.stringContaining("B36: aligned upper needs review for an opening"));
    expect(result.placed).toEqual([base]);
  });

  it("skips instead of resizing or inventing a wall SKU when real sources cannot cover the lower exactly", () => {
    const base = onTopWall(ROOM, { uid: "base-37", masterCode: "B37", placement: "base", width: 37, depth: 24 }, 12);
    const result = build({
      placed: [base],
      catalog: [catalogCabinet({ id: 401, masterCode: "W3630", width: "36" })],
    });

    expect(result.additions).toEqual([]);
    expect(result.placed).toEqual([base]);
    expect(result.skipped).toContainEqual(expect.stringContaining("B37: no source-sized 30″ wall cabinet matches its 37″ run."));
  });

  it("does not select glass, wine/open-face, or other specialty uppers as ordinary replacements", () => {
    const base = onTopWall(ROOM, { uid: "base-specialty", masterCode: "B36", placement: "base", width: 36, depth: 24 }, 12);
    const result = build({
      placed: [base],
      catalog: [
        catalogCabinet({ id: 501, masterCode: "W3630GD", description: "36 inch Glass Door Wall Cabinet", width: "36", glassDoor: true }),
        catalogCabinet({ id: 502, masterCode: "WXR3630", description: "36 inch Wine Cross Rack", width: "36", facePattern: "criss-cross" }),
        catalogCabinet({ id: 503, masterCode: "WOS3630", description: "36 inch Wall Open Shelf", width: "36" }),
      ],
    });

    expect(result.additions).toEqual([]);
    expect(result.skipped).toContainEqual(expect.stringContaining("B36: no source-sized 30″ wall cabinet matches its 36″ run."));
  });

  it("never adds an ordinary upper above a range or refrigerator and leaves an existing fridge bay untouched", () => {
    const range = onTopWall(ROOM, {
      uid: "range", masterCode: "RANGE-30", placement: "appliance", width: 30, depth: 25, height: 36,
      description: "30 inch Gas Range",
    }, 12);
    const fridge = onTopWall(ROOM, {
      uid: "fridge", masterCode: "FRIDGE-36", placement: "appliance", width: 36, depth: 30, height: 70,
      description: "Refrigerator 36 inch",
    }, 54);
    const existingFridgeBridge = onTopWall(ROOM, {
      uid: "fridge-bridge", cabinetId: 701, masterCode: "WR3630", placement: "wall", width: 36, depth: 12, height: 30,
      description: "Refrigerator Wall Cabinet", category: "Wall", subCategory: "Refrigerator", mountBottom: 54,
    }, 54);
    const result = build({
      placed: [range, fridge, existingFridgeBridge],
      catalog: [
        catalogCabinet({ id: 601, masterCode: "W3030", width: "30" }),
        catalogCabinet({ id: 602, masterCode: "W3630", width: "36" }),
      ],
    });

    expect(result.additions).toEqual([]);
    expect(result.placed).toEqual([range, fridge, existingFridgeBridge]);
    expect(result.placed.filter((cabinet) => cabinet.uid === "fridge-bridge")).toHaveLength(1);
  });

  it("preserves an existing wall bay rather than duplicating over an occupied aligned projection", () => {
    const base = onTopWall(ROOM, { uid: "base-existing", masterCode: "B36", placement: "base", width: 36, depth: 24 }, 24);
    const existingUpper = onTopWall(ROOM, {
      uid: "existing-upper", cabinetId: 711, masterCode: "W3630", placement: "wall", width: 36, depth: 12, height: 30,
      description: "Existing source-priced wall cabinet", category: "Wall", subCategory: "Wall Cabinet", mountBottom: 54, styleId: 5,
    }, 24);
    const result = build({
      placed: [base, existingUpper],
      catalog: [catalogCabinet({ id: 712, masterCode: "W3630", width: "36" })],
    });

    expect(result.additions).toEqual([]);
    expect(result.placed).toEqual([base, existingUpper]);
    expect(result.placed.filter((cabinet) => cabinet.masterCode === "W3630")).toEqual([existingUpper]);
    expect(result.skipped).toContainEqual(expect.stringContaining("B36: aligned upper needs review"));
  });

  it("rejects a selected-height upper that would exceed the room ceiling", () => {
    const shortRoom: RoomData = { ...ROOM, ceilingHeight: 95 };
    const base = onTopWall(shortRoom, { uid: "ceiling-base", masterCode: "B36", placement: "base", width: 36, depth: 24 }, 12);
    const result = build({
      room: shortRoom,
      placed: [base],
      wallCabinetHeightIn: 42,
      catalog: [catalogCabinet({ id: 801, masterCode: "W3642", width: "36", height: "42" })],
    });

    expect(result.additions).toEqual([]);
    expect(result.placed).toEqual([base]);
    expect(result.skipped).toContainEqual(expect.stringContaining("B36: aligned upper needs review"));
  });

  it("places a compatible real corner upper at its requested vertex before the straight upper run", () => {
    const cornerBase = onTopWall(ROOM, {
      uid: "corner-base", masterCode: "LSB36", placement: "base", width: 36, depth: 24, height: 34.5,
      description: "36 inch Lazy Susan Corner Base", isCornerCabinet: true, cornerType: "lazy-susan",
    }, 0);
    const adjacentBase = onTopWall(ROOM, { uid: "straight-base", masterCode: "B36", placement: "base", width: 36, depth: 24 }, 36);
    const result = build({
      placed: [cornerBase, adjacentBase],
      catalog: [
        catalogCabinet({
          id: 901, masterCode: "WDC2430", description: "24 inch Diagonal Wall Corner Cabinet", width: "24", depth: "24",
          isCornerCabinet: true, cornerType: "diagonal",
        }),
        catalogCabinet({ id: 902, masterCode: "W3630", width: "36" }),
      ],
      corners: [{ base: cornerBase, point: { x: 0, y: 0, firstWallId: "top" } }],
    });

    expect(result.skipped).toEqual([]);
    expect(result.additions.map((cabinet) => cabinet.masterCode)).toEqual(["WDC2430", "W3630"]);
    expect(result.additions[0]).toMatchObject({
      cabinetId: 901, styleId: 77, cornerType: "diagonal", x: 0, y: 0,
    });
    expect(wallRunOffset(result.additions[1]!, "top", ROOM)).toBeCloseTo(36, 6);
  });
});
