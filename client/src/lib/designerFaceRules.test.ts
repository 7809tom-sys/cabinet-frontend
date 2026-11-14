import { describe, expect, it } from "vitest";
import {
  ensureSingleDoorBase,
  faucetInsideRoom,
  fillerWouldCrossWindow,
  hingeSideOf,
  isSingleDoorBase,
  isTwoDrawerBase,
  kitchenHasSingleDoorBase,
  normalizeUpperHeights,
  pairAdjacentSingleDoorHandles,
  twoDrawerRowLayout,
  upperHangsAtRuleHeight,
  upperMountBottomFor,
  upperStopsShortOfWindow,
  upperTopLineFor,
  windowRuleViolations,
} from "./designerFaceRules";
import {
  DEFAULT_ROOM,
  wallPlacementAt,
  type DesignCabinet,
  type PlacedCabinet,
  type WallOpening,
} from "./design";

function base(masterCode: string, width: number, start: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 24, "bottom", DEFAULT_ROOM);
  return {
    uid: `${masterCode}-${start}`,
    cabinetId: 1,
    masterCode,
    description: `${width} inch base`,
    category: "Base",
    subCategory: "Base",
    placement: "base",
    ...spot,
    width,
    depth: 24,
    height: 34.5,
    numberOfDoors: 1,
    numberOfDrawers: 1,
    ...extra,
  } as PlacedCabinet;
}

function upper(masterCode: string, width: number, start: number, height: number, mountBottom: number | null): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 12, "bottom", DEFAULT_ROOM);
  return {
    uid: `${masterCode}-${start}`,
    cabinetId: 1,
    masterCode,
    description: `${width} inch wall`,
    category: "Wall",
    subCategory: "Wall",
    placement: "wall",
    ...spot,
    width,
    depth: 12,
    height,
    mountBottom,
    numberOfDoors: 1,
    numberOfDrawers: 0,
  } as PlacedCabinet;
}

const catalogRows: DesignCabinet[] = [
  { id: 12, masterCode: "B12", width: "12", description: "12 base", placement: "base", numberOfDoors: 1 },
  { id: 15, masterCode: "B15", width: "15", description: "15 base", placement: "base", numberOfDoors: 1 },
  { id: 18, masterCode: "B18", width: "18", description: "18 base", placement: "base", numberOfDoors: 1 },
  { id: 24, masterCode: "B24", width: "24", description: "24 base", placement: "base", numberOfDoors: 2 },
] as DesignCabinet[];

describe("rule 11: uppers hang at 54 and land on the 84/90/96 line", () => {
  it("maps each upper height to its top line", () => {
    expect(upperTopLineFor(30)).toBe(84);
    expect(upperTopLineFor(36)).toBe(90);
    expect(upperTopLineFor(42)).toBe(96);
    expect(upperMountBottomFor(30)).toBe(54);
    expect(upperMountBottomFor(42)).toBe(54);
  });

  it("puts a 42 inch upper at 54 to reach 96", () => {
    const wall = upper("W4242", 24, 0, 42, 54);
    expect(upperHangsAtRuleHeight(wall)).toBe(true);
    expect(normalizeUpperHeights([wall])[0]!.mountBottom).toBe(54);
  });

  it("repairs an upper that was hung off the rule line", () => {
    const wrong = upper("W3042", 24, 0, 30, 60);
    const fixed = normalizeUpperHeights([wrong])[0]!;
    expect(fixed.mountBottom).toBe(54);
    expect(upperHangsAtRuleHeight(fixed)).toBe(true);
  });
});

describe("rule 5: two-drawer bases stack two equal full-width fronts", () => {
  it("lays a 2DB out as two stacked drawers", () => {
    const drawerBase = base("2DB24", 24, 0, { numberOfDoors: 0, numberOfDrawers: 2 }) as PlacedCabinet;
    expect(isTwoDrawerBase(drawerBase)).toBe(true);
    const layout = twoDrawerRowLayout(drawerBase);
    expect(layout.sideBySide).toBe(false);
    expect(layout.rows).toEqual([{ count: 1, height: 17.25 }, { count: 1, height: 17.25 }]);
  });

  it("never treats a door base as a two-drawer base", () => {
    expect(isTwoDrawerBase(base("B24", 24, 0))).toBe(false);
    expect(twoDrawerRowLayout(base("B24", 24, 0)).rows).toEqual([]);
  });
});

describe("rule 6: every kitchen has a single-door base", () => {
  it("recognises a real single-door base", () => {
    expect(isSingleDoorBase(base("B18", 18, 0))).toBe(true);
    expect(isSingleDoorBase(base("B24", 24, 0, { numberOfDoors: 2 }))).toBe(false);
    expect(isSingleDoorBase(base("3DB18", 18, 0, { numberOfDoors: 0, numberOfDrawers: 3 }))).toBe(false);
  });

  it("swaps a same-width double-door base for a single-door base", () => {
    const plan = [base("B18", 18, 0, { numberOfDoors: 2 })];
    expect(kitchenHasSingleDoorBase(plan)).toBe(false);
    const result = ensureSingleDoorBase({
      placed: plan,
      room: DEFAULT_ROOM,
      catalog: catalogRows,
      makeUid: () => "uid-new",
      styleId: 1,
    });
    expect(result.warning).toBeNull();
    expect(kitchenHasSingleDoorBase(result.placed)).toBe(true);
    expect(result.added?.masterCode).toBe("B18");
  });

  it("does not turn a 24 inch base into a single-door cabinet", () => {
    const plan = [base("B24", 24, 0, { numberOfDoors: 2 })];
    const result = ensureSingleDoorBase({
      placed: plan,
      room: DEFAULT_ROOM,
      catalog: [
        { id: 1, masterCode: "B24S", width: "24", numberOfDoors: 1 } as DesignCabinet,
        { id: 2, masterCode: "B24", width: "24", numberOfDoors: 2 } as DesignCabinet,
      ],
      makeUid: () => "uid-new",
      styleId: 1,
    });
    expect(result.added).toBeNull();
    expect(result.placed[0]?.numberOfDoors).toBe(2);
    expect(result.placed[0]?.masterCode).toBe("B24");
  });

  it("warns instead of resizing a run when the line has no single-door base", () => {
    const plan = [base("B18", 18, 0, { numberOfDoors: 2 })];
    const result = ensureSingleDoorBase({
      placed: plan,
      room: DEFAULT_ROOM,
      catalog: [{ id: 1, masterCode: "B18", width: "18", numberOfDoors: 2 } as DesignCabinet],
      makeUid: () => "uid-new",
      styleId: 1,
    });
    expect(result.added).toBeNull();
    expect(result.warning).toMatch(/single-door/);
    expect(result.placed).toEqual(plan);
  });

  it("leaves a kitchen that already has one alone", () => {
    const plan = [base("B18", 18, 0), base("B24", 24, 18, { numberOfDoors: 2 })];
    const result = ensureSingleDoorBase({ placed: plan, room: DEFAULT_ROOM, catalog: catalogRows, makeUid: () => "x", styleId: 1 });
    expect(result.placed).toBeTruthy();
    expect(result.added).toBeNull();
    expect(result.warning).toBeNull();
  });
});

describe("rule 7: adjacent single doors meet at the shared seam", () => {
  it("mirrors a butted pair so both handles land on the seam", () => {
    const left = base("B18", 18, 0);
    const right = base("B18", 18, 18);
    const result = pairAdjacentSingleDoorHandles({ placed: [left, right], room: DEFAULT_ROOM });
    const pairedLeft = result.placed.find((item) => item.uid === left.uid)!;
    const pairedRight = result.placed.find((item) => item.uid === right.uid)!;
    expect(hingeSideOf(pairedLeft)).toBe("left");
    expect(hingeSideOf(pairedRight)).toBe("right");
    expect(result.pairedUids).toEqual(expect.arrayContaining([left.uid, right.uid]));
  });

  it("keeps a user's explicit hinge side", () => {
    const left = base("B18", 18, 0, { swing: "right" });
    const right = base("B18", 18, 18);
    const result = pairAdjacentSingleDoorHandles({
      placed: [left, right],
      room: DEFAULT_ROOM,
      explicitHingeUids: [left.uid],
    });
    expect(result.placed.find((item) => item.uid === left.uid)!.swing).toBe("right");
    expect(hingeSideOf(result.placed.find((item) => item.uid === right.uid)!)).toBe("right");
  });

  it("ignores cabinets with a gap between them", () => {
    const left = base("B18", 18, 0);
    const right = base("B18", 18, 20);
    const result = pairAdjacentSingleDoorHandles({ placed: [left, right], room: DEFAULT_ROOM });
    expect(result.pairedUids).toEqual([]);
  });
});

describe("rule 9: windows are fixed, faucets outside the wall are ignored", () => {
  const window = (offset: number, height = 36): WallOpening => ({
    uid: "w1", kind: "window", label: "Sink window", side: "bottom", offset, width: 36, height, sill: 42,
  });

  it("reports a moved, resized or deleted window", () => {
    const before = [window(40)];
    expect(windowRuleViolations({ before, after: [window(40)] })).toEqual([]);
    expect(windowRuleViolations({ before, after: [window(44)] })[0]).toMatch(/moved/);
    expect(windowRuleViolations({ before, after: [window(40, 48)] })[0]).toMatch(/height/);
    expect(windowRuleViolations({ before, after: [] })[0]).toMatch(/removed/);
  });

  it("keeps uppers 3 inches short of the window", () => {
    const w = window(40);
    expect(upperStopsShortOfWindow({ cabinetStart: 0, cabinetEnd: 37, window: w })).toBe(true);
    expect(upperStopsShortOfWindow({ cabinetStart: 0, cabinetEnd: 39, window: w })).toBe(false);
    expect(upperStopsShortOfWindow({ cabinetStart: 79, cabinetEnd: 100, window: w })).toBe(true);
    expect(upperStopsShortOfWindow({ cabinetStart: 70, cabinetEnd: 100, window: w })).toBe(false);
  });

  it("never lets a filler bridge the window", () => {
    const w = window(40);
    expect(fillerWouldCrossWindow({ startIn: 30, widthIn: 15, window: w })).toBe(true);
    expect(fillerWouldCrossWindow({ startIn: 20, widthIn: 5, window: w })).toBe(false);
  });

  it("ignores a faucet outside the room", () => {
    expect(faucetInsideRoom({ x: 40, y: 10 }, DEFAULT_ROOM)).toBe(true);
    expect(faucetInsideRoom({ x: 40, y: -10 }, DEFAULT_ROOM)).toBe(false);
    expect(faucetInsideRoom({ x: DEFAULT_ROOM.width + 10, y: 10 }, DEFAULT_ROOM)).toBe(false);
  });
});
