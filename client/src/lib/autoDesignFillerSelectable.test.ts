/**
 * A filler Auto-Design seats is an ordinary placed row, so the 2D plan renders
 * it through the same code as a manually placed one. The owner reported both
 * paths ("manual placement and Auto-Design"), and the fix must therefore cover
 * the consolidated board that #344/#346 produce, not only a hand-placed filler.
 *
 * These assertions are about identity, not layout: a consolidated board keeps a
 * uid, a filler group, an owner, and real width/depth, which is exactly what the
 * plan needs to draw it and to hit-test it.
 */
import { describe, expect, it } from "vitest";
import { consolidateAutoDesignFillers } from "./autoDesignFillerConsolidation";
import {
  DEFAULT_ROOM,
  isFillerItem,
  wallPlacementAt,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import type { CatalogFillerCandidate } from "./catalogFiller";

const ROOM = { ...DEFAULT_ROOM, width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

const CATALOG: DesignCabinet[] = [
  { id: 1, masterCode: "B24", description: '24" Base', placement: "base", height: "34.5", depth: "24", width: "24", category: "Base", subCategory: "Standard Base", numberOfDoors: 2, numberOfDrawers: 0 },
  { id: 2, masterCode: "B27", description: '27" Base', placement: "base", height: "34.5", depth: "24", width: "27", category: "Base", subCategory: "Standard Base", numberOfDoors: 2, numberOfDrawers: 0 },
] as DesignCabinet[];

const FILLERS: CatalogFillerCandidate[] = [
  { id: 101, masterCode: "BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler", width: "3", height: "34.5", depth: "24", catalogImageUrl: null },
  { id: 102, masterCode: "BF6", description: '6" Base Filler', category: "Filler", subCategory: "Filler", width: "6", height: "34.5", depth: "24", catalogImageUrl: null },
];

function base(masterCode: string, width: number, start: number, uid: string): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 24, "top", ROOM);
  return {
    uid, cabinetId: 1, masterCode, description: `${width} inch base`, category: "Base", subCategory: "Standard Base",
    placement: "base", width, depth: 24, height: 34.5, numberOfDoors: 2, numberOfDrawers: 0, mountBottom: 0,
    ...spot,
  } as PlacedCabinet;
}

function filler(width: number, start: number, uid: string, owner: string): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 24, "top", ROOM);
  return {
    uid, cabinetId: 101, masterCode: "BF3", description: `Filler 3" stock, cut to ${width}`,
    category: "Filler", subCategory: "Filler", placement: "base", width, depth: 24, height: 34.5,
    numberOfDoors: 0, numberOfDrawers: 0, mountBottom: 0,
    fillerPieceGroupId: `filler-group-${uid}`, fillerBillingRole: "primary", fillerTotalWidth: width,
    fillerPlacementMode: "right", fillerForCabinetUid: owner,
    ...spot,
  } as PlacedCabinet;
}

function uidFactory() {
  let n = 0;
  return () => `gen-${++n}`;
}

describe("a consolidated Auto-Design filler is a normal, selectable placed row", () => {
  it("keeps a real width, an owner, and a group so the plan can draw and hit it", () => {
    // Two slivers in one run consolidate into a single board (the case the
    // existing consolidation spec already pins: two 1" boards become one 2").
    const placed = [
      base("B27", 27, 0, "b1"),
      filler(1, 27, "f1", "b1"),
      base("B27", 27, 28, "b2"),
      filler(1, 55, "f2", "b2"),
    ];
    const result = consolidateAutoDesignFillers({
      placed,
      room: ROOM,
      openings: [],
      wallIds: ["top"],
      catalog: CATALOG,
      fillers: FILLERS,
      maxFillerIn: 6,
      makeUid: uidFactory(),
      styleId: 1,
    });

    const boards = result.placed.filter((item) => item.fillerPieceGroupId);
    expect(boards).toHaveLength(1);
    const board = boards[0]!;

    // Identity the plan's hit target and item menu rely on.
    expect(board.uid).toBeTruthy();
    expect(board.fillerPieceGroupId).toBeTruthy();
    expect(["b1", "b2"]).toContain(board.fillerForCabinetUid);
    // Real, positive geometry — never a zero-size ghost.
    expect(Number(board.width)).toBeGreaterThan(0);
    expect(Number(board.depth)).toBeGreaterThan(0);
    // And a catalog code, so the plan's title/name is meaningful.
    expect(board.masterCode).toBeTruthy();
  });
});
