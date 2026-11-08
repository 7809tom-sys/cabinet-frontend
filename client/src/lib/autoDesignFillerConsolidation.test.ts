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
  it("turns two boards in one run into one board of their combined width", () => {
    const run = [
      placedBase("B27", 27, 0, "b1"),
      placedFiller(1.25, 27, "f1", "b1"),
      placedBase("B27", 27, 28.25, "b2"),
      placedFiller(3, 55.25, "f2", "b2"),
    ];
    const result = consolidateAutoDesignFillers({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG, fillers: FILLERS,
      maxFillerIn: 6, makeUid: uidFactory(), styleId: 1,
    });
    const fillers = result.placed.filter((item) => /filler/i.test(`${item.masterCode} ${item.description}`));
    expect(fillers).toHaveLength(1);
    // 27 + 27 + 4.25 (or the 30 inch SKU closing it): the run is still closed end to end.
    const total = result.placed.reduce((sum, item) => sum + item.width, 0);
    expect(total).toBeCloseTo(58.25, 2);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("closes a boardless run with the wider stock SKU instead of two boards", () => {
    // 27 + 1 + 29 + 1 = 58: the 27 inch base becomes a 30 only if the line sells
    // one AND the run keeps its length, so this case is a real board.
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
    // Two boards of 1 inch are one board of 2 inches, or one widened cabinet: never two boards.
    const boards = result.placed.filter((item) => !!item.fillerPieceGroupId);
    expect(boards).toHaveLength(1);
    expect(boards[0]!.width).toBeCloseTo(2, 2);
    expect(result.placed.reduce((sum, item) => sum + item.width, 0)).toBeCloseTo(56, 2);
  });

  it("leaves a single board exactly where it is when no stock width closes it", () => {
    // 21 + 4 = 25: the line sells no 25 inch base, so the board stays.
    const run = [placedBase("B21", 21, 0, "b1"), placedFiller(4, 21, "f1", "b1")];
    const result = consolidateAutoDesignFillers({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG, fillers: FILLERS,
      maxFillerIn: 6, makeUid: uidFactory(), styleId: 1,
    });
    expect(result.placed).toHaveLength(2);
    expect(result.changes).toHaveLength(0);
  });

  it("absorbs a single board into a wider stock SKU when one exists", () => {
    // 27 + 3 = 30, and the line sells B30: the run closes with no filler at all.
    const run = [placedBase("B27", 27, 0, "b1"), placedFiller(3, 27, "f1", "b1")];
    const result = consolidateAutoDesignFillers({
      placed: run, room: ROOM, openings: [], wallIds: ["top"], catalog: CATALOG, fillers: FILLERS,
      maxFillerIn: 6, makeUid: uidFactory(), styleId: 1,
    });
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]!.kind).toBe("widen");
    expect(result.placed.filter((item) => item.fillerPieceGroupId)).toHaveLength(0);
    expect(result.placed.map((item) => item.masterCode)).toEqual(["B30"]);
    expect(result.placed[0]!.width).toBe(30);
  });

  it("refuses to merge boards whose combined width exceeds the filler maximum", () => {
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
    expect(result.placed.filter((item) => item.fillerPieceGroupId)).toHaveLength(2);
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
});
