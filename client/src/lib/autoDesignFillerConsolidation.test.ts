import { describe, expect, it } from "vitest";
import {
  cabinetFamilyToken,
  closeSmallOpeningsWithStock,
  consolidateAutoDesignFillers,
  findFillerClusters,
  widerSkuClosing,
} from "./autoDesignFillerConsolidation";
import type { CatalogFillerCandidate } from "./catalogFiller";
import {
  DEFAULT_ROOM,
  wallPlacementAt,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";

const ROOM = { ...DEFAULT_ROOM, width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function catalogRow(partial: Partial<DesignCabinet> & Pick<DesignCabinet, "id" | "masterCode" | "width">): DesignCabinet {
  return {
    description: `${partial.width} inch cabinet`,
    placement: "base",
    height: "34.5",
    depth: "24",
    category: "Base",
    subCategory: "Standard Base",
    numberOfDoors: 2,
    numberOfDrawers: 0,
    ...partial,
  } as DesignCabinet;
}

const CATALOG: DesignCabinet[] = [
  catalogRow({ id: 1, masterCode: "B12", width: "12" }),
  catalogRow({ id: 2, masterCode: "B18", width: "18" }),
  catalogRow({ id: 3, masterCode: "B21", width: "21" }),
  catalogRow({ id: 4, masterCode: "B24", width: "24" }),
  catalogRow({ id: 5, masterCode: "B27", width: "27" }),
  catalogRow({ id: 6, masterCode: "B30", width: "30" }),
  catalogRow({ id: 7, masterCode: "B33", width: "33" }),
  catalogRow({ id: 8, masterCode: "W2730", width: "27", placement: "wall", height: "30", depth: "12" }),
  catalogRow({ id: 9, masterCode: "W3030", width: "30", placement: "wall", height: "30", depth: "12" }),
];

const FILLERS: CatalogFillerCandidate[] = [
  { id: 101, masterCode: "BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler", width: "3", height: "34.5", depth: "24", catalogImageUrl: null },
  { id: 102, masterCode: "BF6", description: '6" Base Filler', category: "Filler", subCategory: "Filler", width: "6", height: "34.5", depth: "24", catalogImageUrl: null },
];

function placedBase(masterCode: string, width: number, start: number, uid: string): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 24, "top", ROOM);
  return {
    uid, cabinetId: 0, masterCode, description: `${width} inch base`, category: "Base", subCategory: "Standard Base",
    placement: "base", width, depth: 24, height: 34.5, numberOfDoors: 2, numberOfDrawers: 0, mountBottom: 0,
    ...spot,
  } as PlacedCabinet;
}

function placedFiller(width: number, start: number, uid: string, owner?: string): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 24, "top", ROOM);
  return {
    uid, cabinetId: 101, masterCode: "BF3", description: `Filler 3" stock, cut to ${width} — install on right`,
    category: "Filler", subCategory: "Filler", placement: "base", width, depth: 24, height: 34.5,
    numberOfDoors: 0, numberOfDrawers: 0, mountBottom: 0,
    fillerPieceGroupId: `filler-group-${uid}`, fillerBillingRole: "primary", fillerTotalWidth: width,
    fillerPlacementMode: "right", ...(owner ? { fillerForCabinetUid: owner } : {}),
    ...spot,
  } as PlacedCabinet;
}

function uidFactory() {
  let n = 0;
  return () => `gen-${++n}`;
}

describe("cabinetFamilyToken", () => {
  it("reads the leading family of the catalog codes", () => {
    expect(cabinetFamilyToken("B27")).toBe("B");
    expect(cabinetFamilyToken("W2730")).toBe("W");
    expect(cabinetFamilyToken("3DB18")).toBe("3DB");
    expect(cabinetFamilyToken("BBC36")).toBe("BBC");
    expect(cabinetFamilyToken(null)).toBe("");
  });
});

describe("widerSkuClosing", () => {
  it("finds the same-family SKU that takes the cabinet plus the opening", () => {
    const cabinet = placedBase("B27", 27, 0, "b27");
    const wider = widerSkuClosing({ cabinet, extraIn: 3, layer: "base", catalog: CATALOG });
    expect(wider?.replacement.masterCode).toBe("B30");
    expect(wider?.widthIn).toBe(30);
  });

  it("never crosses families and never invents a width", () => {
    const cabinet = placedBase("B27", 27, 0, "b27");
    expect(widerSkuClosing({ cabinet, extraIn: 3, layer: "base", catalog: [catalogRow({ id: 60, masterCode: "W3030", width: "30", placement: "wall" })] })).toBeNull();
    expect(widerSkuClosing({ cabinet, extraIn: 4, layer: "base", catalog: CATALOG })).toBeNull();
  });});

describe("closeSmallOpeningsWithStock", () => {
  it("closes a 3 inch seam by widening the cabinet instead of cutting a board", () => {
    const run = [placedBase("B27", 27, 0, "b27"), placedBase("B27", 27, 30, "b27b")];
    const result = closeSmallOpeningsWithStock({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG,
      maxOpeningIn: 3, styleId: 1, makeUid: uidFactory(),
    });
    expect(result.closes).toHaveLength(1);
    const grown = result.placed.filter((item) => item.masterCode === "B30");
    expect(grown).toHaveLength(1);
    expect(result.placed.some((item) => /filler/i.test(item.masterCode))).toBe(false);
    expect(result.placed.reduce((sum, item) => sum + item.width, 0)).toBe(57);
  });

  it("leaves an opening no stock width closes alone", () => {
    const run = [placedBase("B27", 27, 0, "b27"), placedBase("B27", 27, 34, "b27b")];
    const result = closeSmallOpeningsWithStock({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG,
      maxOpeningIn: 3, styleId: 1, makeUid: uidFactory(),
    });
    expect(result.closes).toHaveLength(0);
    expect(result.placed).toHaveLength(2);
  });

  it("never grows a run past its wall end", () => {
    const run = [placedBase("B27", 27, 110, "b27")];
    const result = closeSmallOpeningsWithStock({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG,
      maxOpeningIn: 7, styleId: 1, makeUid: uidFactory(),
    });
    expect(result.closes).toHaveLength(0);
  });
});

describe("findFillerClusters", () => {
  it("groups two boards of one run with the cabinet between them", () => {
    const run = [
      placedBase("B27", 27, 0, "b1"),
      placedFiller(1.25, 27, "f1", "b1"),
      placedBase("B27", 27, 28.25, "b2"),
      placedFiller(3, 55.25, "f2", "b2"),
    ];
    const clusters = findFillerClusters({ placed: run, room: ROOM, openings: [], wallId: "top", layer: "base" });
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.fillers).toHaveLength(2);
    expect(clusters[0]!.cabinets.map((item) => item.uid)).toEqual(["b1", "b2"]);
    expect(clusters[0]!.boardTotalIn).toBe(4.25);
  });

  it("never joins boards on opposite sides of an appliance", () => {
    const range: PlacedCabinet = {
      uid: "range", cabinetId: 0, masterCode: "RANGE-30", description: "30 inch range", placement: "appliance",
      width: 30, depth: 25, height: 36, numberOfDoors: 0, numberOfDrawers: 0, mountBottom: 0,
      ...wallPlacementAt(27, 30, 25, "top", ROOM),
    } as PlacedCabinet;
    const run = [placedFiller(1, 26, "left"), range, placedFiller(3, 57, "right")];
    const clusters = findFillerClusters({ placed: run, room: ROOM, openings: [], wallId: "top", layer: "base" });
    expect(clusters).toHaveLength(2);
    for (const cluster of clusters) expect(cluster.fillers).toHaveLength(1);
    expect(clusters.map((cluster) => cluster.boardTotalIn).sort()).toEqual([1, 3]);
  });
});

describe("consolidateAutoDesignFillers", () => {
  it("closes a 4 inch leftover by resizing the run to stock widths", () => {
    // B21 + 4" filler + B18 = 43". No 43" sum exists. The next stock sum is
    // 45" (B24 + B21), and the wall beyond the filler is open, so the run
    // extends 2" and the filler is gone.
    const run = [
      placedBase("B21", 21, 0, "b1"),
      placedFiller(4, 21, "f4", "b1"),
      placedBase("B18", 18, 25, "b2"),
    ];
    const result = consolidateAutoDesignFillers({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG, fillers: FILLERS,
      maxFillerIn: 24, makeUid: uidFactory(), styleId: 1,
    });
    expect(result.placed.filter((item) => item.fillerPieceGroupId)).toHaveLength(0);
    expect(result.placed.map((item) => item.masterCode).sort()).toEqual(["B21", "B24"]);
    expect(result.placed.reduce((sum, item) => sum + item.width, 0)).toBe(45);
    expect(result.changes[0]?.kind).toBe("repack");
  });

  it("slides the range so a 5 inch filler becomes a stock cabinet", () => {
    const rangeSpot = wallPlacementAt(35, 30, 25, "top", ROOM);
    const range = {
      uid: "range", cabinetId: 0, masterCode: "RANGE-30", description: "30 inch range", placement: "appliance",
      width: 30, depth: 25, height: 36, numberOfDoors: 0, numberOfDrawers: 0, mountBottom: 0,
      ...rangeSpot,
    } as PlacedCabinet;
    const catalog = [...CATALOG, catalogRow({ id: 10, masterCode: "B36", width: "36" })];
    const run = [placedBase("B30", 30, 0, "b30"), placedFiller(5, 30, "f5", "b30"), range];
    const result = consolidateAutoDesignFillers({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog, fillers: FILLERS,
      maxFillerIn: 24, makeUid: uidFactory(), styleId: 1,
    });
    expect(result.placed.filter((item) => item.fillerPieceGroupId)).toHaveLength(0);
    expect(result.placed.find((item) => item.masterCode === "B36")?.width).toBe(36);
    const moved = result.placed.find((item) => item.uid === "range")!;
    expect(moved.wallOffset ?? moved.x).toBeCloseTo(36, 2);
  });

  it("keeps a gap of 1 inch or less as filler", () => {
    const run = [placedBase("B27", 27, 0, "b1"), placedFiller(0.75, 27, "f1", "b1")];
    const result = consolidateAutoDesignFillers({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG, fillers: FILLERS,
      maxFillerIn: 24, makeUid: uidFactory(), styleId: 1,
    });
    const boards = result.placed.filter((item) => item.fillerPieceGroupId);
    expect(boards).toHaveLength(1);
    expect(boards[0]!.width).toBeCloseTo(0.75, 2);
    expect(result.changes).toHaveLength(0);
  });

  it("keeps the 3 inch blind-corner filler and the inside-L corner filler", () => {
    const cornerSpot = wallPlacementAt(0, 36, 36, "top", ROOM);
    const corner = {
      uid: "bbc", cabinetId: 50, masterCode: "BBC42", description: "42 inch blind corner", placement: "base",
      width: 36, depth: 36, height: 34.5, numberOfDoors: 1, numberOfDrawers: 0, cornerType: "blind-corner",
      ...cornerSpot,
    } as PlacedCabinet;
    const blindFiller = {
      ...placedFiller(3, 36, "blind", "bbc"),
      fillerForCabinetUid: "bbc",
    };
    const cornerFiller = placedFiller(3, 0, "inside-l");
    const run = [cornerFiller, corner, blindFiller, placedBase("B21", 21, 39, "b21")];
    const result = consolidateAutoDesignFillers({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG, fillers: FILLERS,
      maxFillerIn: 24, makeUid: uidFactory(), styleId: 1,
    });
    const kept = result.placed.filter((item) => item.uid === "blind" || item.uid === "inside-l");
    expect(kept.map((item) => item.width).sort()).toEqual([3, 3]);
  });

  it("never resizes a run onto a single-door 24 inch cabinet", () => {
    const single = catalogRow({ id: 80, masterCode: "B24S", width: "24", numberOfDoors: 1, description: "24 inch single door base" });
    const run = [placedBase("B21", 21, 0, "b21"), placedFiller(3, 21, "f3", "b21")];
    const result = consolidateAutoDesignFillers({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: [single, ...CATALOG.filter((row) => row.masterCode !== "B24")],
      fillers: FILLERS, maxFillerIn: 24, makeUid: uidFactory(), styleId: 1,
    });
    expect(result.placed.some((item) => item.masterCode === "B24S")).toBe(false);
    expect(result.placed.some((item) => (item.numberOfDoors ?? 0) === 1 && Math.abs(item.width - 24) <= 0.05)).toBe(false);
  });

  it("keeps each 1 inch gap's filler instead of merging them into a wider strip", () => {
    const run = [
      placedBase("B27", 27, 0, "b1"),
      placedFiller(1, 27, "f1", "b1"),
      placedBase("B27", 27, 28, "b2"),
      placedFiller(1, 55, "f2", "b2"),
    ];
    const result = consolidateAutoDesignFillers({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG, fillers: FILLERS,
      maxFillerIn: 6, makeUid: uidFactory(), styleId: 1,
    });
    const boards = result.placed.filter((item) => item.fillerPieceGroupId);
    expect(boards).toHaveLength(2);
    expect(boards.map((item) => item.width).sort()).toEqual([1, 1]);
  });

  it("closes a 27 inch base plus a 3 inch board as B30", () => {
    const run = [placedBase("B27", 27, 0, "b1"), placedFiller(3, 27, "f1", "b1")];
    const result = consolidateAutoDesignFillers({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG, fillers: FILLERS,
      maxFillerIn: 6, makeUid: uidFactory(), styleId: 1,
    });
    expect(result.placed.filter((item) => item.fillerPieceGroupId)).toHaveLength(0);
    expect(result.placed.map((item) => item.masterCode)).toEqual(["B30"]);
    expect(result.placed[0]!.width).toBe(30);
  });

  it("closes two 3 inch boards with stock cabinets even when they exceed a 3 inch filler cap", () => {
    const run = [
      placedBase("B27", 27, 0, "b1"),
      placedFiller(3, 27, "f1", "b1"),
      placedBase("B27", 27, 30, "b2"),
      placedFiller(3, 57, "f2", "b2"),
    ];
    const result = consolidateAutoDesignFillers({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG, fillers: FILLERS,
      maxFillerIn: 3, makeUid: uidFactory(), styleId: 1,
    });
    expect(result.placed.filter((item) => item.fillerPieceGroupId)).toHaveLength(0);
    expect(result.placed.map((item) => item.masterCode)).toEqual(["B30", "B30"]);
    expect(result.placed.reduce((sum, item) => sum + item.width, 0)).toBe(60);
  });

  it("is idempotent: a consolidated run is unchanged on a second pass", () => {
    const run = [
      placedBase("B27", 27, 0, "b1"),
      placedFiller(1.25, 27, "f1", "b1"),
      placedBase("B27", 27, 28.25, "b2"),
      placedFiller(3, 55.25, "f2", "b2"),
    ];
    const first = consolidateAutoDesignFillers({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG, fillers: FILLERS,
      maxFillerIn: 6, makeUid: uidFactory(), styleId: 1,
    });
    let n = 100;
    const second = consolidateAutoDesignFillers({
      placed: first.placed, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG, fillers: FILLERS,
      maxFillerIn: 6, makeUid: () => `gen-${++n}`, styleId: 1,
    });
    expect(second.changes).toHaveLength(0);
    expect(second.placed).toEqual(first.placed);
  });

  it("never re-lays the mandatory bridge above a range", () => {
    // A 30 inch wall run over a range: the bridge is seated at its own datum by
    // its own hard rule. Re-laying it to chase a board would move a mandatory
    // cabinet, so the run is left exactly as it is.
    const bridgeSpot = wallPlacementAt(0, 30, 12, "top", ROOM);
    const bridge: PlacedCabinet = {
      uid: "bridge", cabinetId: 9, masterCode: "W3030", description: '30" bridge above the range',
      category: "Wall", subCategory: "Wall", placement: "wall", width: 30, depth: 12, height: 12,
      numberOfDoors: 2, numberOfDrawers: 0, mountBottom: 72, overRangeMicrowaveBridge: true,
      ...bridgeSpot,
    } as PlacedCabinet;
    const run = [
      bridge,
      placedFiller(1, 30, "f1", "bridge"),
      { ...placedBase("B27", 27, 31, "b2"), placement: "wall" as const, depth: 12, height: 30, mountBottom: 54 },
      placedFiller(3, 58, "f2", "b2"),
    ];
    const result = consolidateAutoDesignFillers({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG, fillers: FILLERS,
      maxFillerIn: 6, makeUid: uidFactory(), styleId: 1,
    });
    // The bridge keeps its exact seat: start, width, height, mount datum.
    const after = result.placed.find((item) => item.uid === "bridge")!;
    expect({ x: after.x, y: after.y, width: after.width, height: after.height, mountBottom: after.mountBottom })
      .toEqual({ x: bridge.x, y: bridge.y, width: bridge.width, height: bridge.height, mountBottom: bridge.mountBottom });
    expect(result.changes).toHaveLength(0);
  });
});
