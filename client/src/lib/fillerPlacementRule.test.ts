/**
 * Owner rule: a filler only ever sits in the cabinet FRONT FACE line, and only
 * to close a gap between two cabinets, between a cabinet and a wall end, or
 * between a cabinet and an appliance.
 *
 * It is never cut against the side of a refrigerator end panel, never bolted to
 * a run's open outside face, and never a default board on every cabinet.
 *
 * The regression these tests lock: a wall cabinet above a refrigerator measured
 * its "before" gap back to the wall start — straight through the 24-inch-deep,
 * 84-inch-tall end panel — because `sharesPlanCollisionZone` (design.ts:4170)
 * deliberately exempts panels. `findSmallGapFillerOpportunity`
 * (smallGapFiller.ts) then sold a board for that gap, placed by
 * `applyStandardSmallGapFillers` (designerLayoutRules.ts:905) on the bridge's
 * 72-inch datum and 12-inch height. In 3D it read as a white horizontal strip
 * across the panel's outside face.
 */
import { describe, expect, it } from "vitest";
import {
  auditFillerPlacements,
  fillerRuleViolation,
  isFillableBoundary,
  removeIllegalFillers,
  seamBoundariesFor,
} from "./fillerPlacementRule";
import { findSmallGapFillerOpportunity } from "./smallGapFiller";
import { applyDesignerLayoutRules } from "./designerLayoutRules";
import type { CatalogFillerCandidate } from "./catalogFiller";
import {
  DEFAULT_ROOM,
  wallPlacementAt,
  wallRunOffset,
  type PlacedCabinet,
  type RoomData,
} from "./design";

const ROOM = { ...DEFAULT_ROOM, width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

const FILLER_STOCK: CatalogFillerCandidate[] = [
  { id: 101, masterCode: "BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler", width: "3", height: "34.5", depth: "24", catalogImageUrl: null },
  { id: 102, masterCode: "WF3", description: '3" Wall Filler', category: "Filler", subCategory: "Filler", width: "3", height: "30", depth: "12", catalogImageUrl: null },
  { id: 103, masterCode: "TF3", description: '3" Tall Filler', category: "Filler", subCategory: "Filler", width: "3", height: "96", depth: "24", catalogImageUrl: null },
];

function seat(
  partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "width"> & { placement?: PlacedCabinet["placement"] },
  start: number,
  wallId = "top",
  depthOverride?: number,
): PlacedCabinet {
  const placement = partial.placement ?? "base";
  const depth = depthOverride ?? (placement === "wall" ? 12 : 24);
  const spot = wallPlacementAt(start, partial.width, depth, wallId as never, ROOM);
  return {
    cabinetId: 1,
    masterCode: "X",
    description: "",
    category: "Base",
    subCategory: "Standard Base",
    height: placement === "wall" ? 30 : placement === "tall" ? 96 : 34.5,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    mountBottom: placement === "wall" ? 54 : 0,
    ...partial,
    placement,
    width: partial.width,
    depth,
    ...spot,
  } as PlacedCabinet;
}

function filler(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "width">, start: number, ownerUid?: string, wallId = "top", depthOverride?: number): PlacedCabinet {
  return {
    ...seat({ placement: "base", masterCode: "BF3", description: 'Filler 3" stock', category: "Filler", subCategory: "Filler", numberOfDoors: 0, height: 34.5, ...partial }, start, wallId, depthOverride),
    fillerPieceGroupId: `filler-group-${partial.uid}`,
    fillerBillingRole: "primary",
    fillerTotalWidth: partial.width,
    fillerPlacementMode: "right",
    ...(ownerUid ? { fillerForCabinetUid: ownerUid } : {}),
  } as PlacedCabinet;
}

/** The exact refrigerator enclosure the designer builds: panel, refrigerator, panel, cabinet above. */
function refrigeratorEnclosure() {
  const leftPanel = seat({
    uid: "left-panel", masterCode: "S2496", description: "Tall End Panel for Refrigerator", placement: "tall",
    width: 0.75, height: 84, category: "Panel", refrigeratorAssemblyRole: "left-panel", refrigeratorAssemblyId: "fridge",
  }, 4.25);
  const refrigerator = seat({
    uid: "fridge", masterCode: "FRIDGE-36", description: "36 inch Refrigerator", placement: "appliance",
    width: 36, height: 70, category: "Appliance",
  }, 5.5);
  const rightPanel = seat({
    uid: "right-panel", masterCode: "S2496", description: "Tall End Panel for Refrigerator", placement: "tall",
    width: 0.75, height: 84, category: "Panel", refrigeratorAssemblyRole: "right-panel", refrigeratorAssemblyId: "fridge",
  }, 41.5);
  const bridge = seat({
    uid: "bridge", masterCode: "W361224", description: '36" Refrigerator Wall Cabinet', placement: "wall",
    width: 36, height: 12, mountBottom: 72, refrigeratorAssemblyRole: "bridge", refrigeratorAssemblyId: "fridge",
  }, 5.5, "top", 24);
  return { leftPanel, refrigerator, rightPanel, bridge };
}

describe("seamBoundariesFor", () => {
  it("names the panel beside a refrigerator cabinet instead of the free wall behind it", () => {
    const { leftPanel, refrigerator, rightPanel, bridge } = refrigeratorEnclosure();
    const bounds = seamBoundariesFor({
      cabinet: bridge, placed: [leftPanel, refrigerator, rightPanel, bridge], room: ROOM, openings: [],
    });
    expect(bounds.start.kind).toBe("panel");
    expect(bounds.start.item?.uid).toBe("left-panel");
    expect(bounds.start.gapIn).toBeCloseTo(0.5, 3);
    expect(bounds.end.kind).toBe("panel");
    expect(bounds.end.item?.uid).toBe("right-panel");
  });

  it("recognizes a wall end and a neighbouring cabinet on an ordinary run", () => {
    const left = seat({ uid: "left", masterCode: "B24", width: 24 }, 0);
    const target = seat({ uid: "target", masterCode: "B24", width: 24 }, 24);
    const right = seat({ uid: "right", masterCode: "B24", width: 24 }, 50);
    const bounds = seamBoundariesFor({ cabinet: target, placed: [left, target, right], room: ROOM, openings: [] });
    expect(bounds.start).toMatchObject({ kind: "cabinet", gapIn: 0 });
    expect(bounds.start.item?.uid).toBe("left");
    expect(bounds.end).toMatchObject({ kind: "cabinet", gapIn: 2 });
    expect(bounds.end.item?.uid).toBe("right");
  });

  it("recognizes a wall opening as a boundary", () => {
    const cabinet = seat({ uid: "c1", masterCode: "B24", width: 24 }, 24);
    const bounds = seamBoundariesFor({
      cabinet, placed: [cabinet], room: ROOM,
      openings: [{ uid: "w1", kind: "window", side: "top", offset: 0, width: 24, height: 36, sill: 42 } as never],
    });
    expect(bounds.start.kind).toBe("opening");
    expect(bounds.start.gapIn).toBe(0);
  });

  it("never treats a panel as a fillable boundary", () => {
    expect(isFillableBoundary({ at: "start", kind: "panel", item: null, gapIn: 1 })).toBe(false);
    expect(isFillableBoundary({ at: "start", kind: "nothing", item: null, gapIn: 1 })).toBe(false);
    for (const kind of ["wall", "opening", "cabinet", "appliance"] as const) {
      expect(isFillableBoundary({ at: "start", kind, item: null, gapIn: 1 })).toBe(true);
    }
  });
});

describe("fillerRuleViolation", () => {
  it("rejects a board cut against a refrigerator end panel", () => {
    const { leftPanel, refrigerator, rightPanel, bridge } = refrigeratorEnclosure();
    // 0 → 4.25 butts the left panel's outer face: this is the exact board the
    // designer used to sell beside the enclosure.
    const board = filler({ uid: "side", width: 4.25, placement: "wall", height: 12, mountBottom: 72 }, 0, "bridge", "top", 24);
    const violation = fillerRuleViolation({
      filler: board, placed: [leftPanel, refrigerator, rightPanel, bridge, board], room: ROOM, openings: [],
    });
    expect(violation?.code).toBe("against-refrigerator-panel");
    expect(violation?.detail).toContain("S2496");
  });

  it("rejects a board that runs through a panel", () => {
    const { leftPanel, refrigerator, rightPanel, bridge } = refrigeratorEnclosure();
    // 0 → 5.5 starts at the wall and runs across the left panel's footprint.
    const board = filler({ uid: "through", width: 5.5, placement: "wall", height: 12, mountBottom: 72 }, 0, "bridge", "top", 24);
    const violation = fillerRuleViolation({
      filler: board, placed: [leftPanel, refrigerator, rightPanel, bridge, board], room: ROOM, openings: [],
    });
    expect(["through-a-panel", "against-refrigerator-panel"]).toContain(violation?.code);
  });

  it("keeps the angled-corner miter pair and a board in the inside-corner hold", () => {
    const cabinet = seat({ uid: "end", masterCode: "B24", width: 24 }, 12);
    const miter = filler({
      uid: "miter", width: 1, fillerTransitionKind: "front-miter-pair", fillerMiterAngle: 22.5,
    }, 11, "end");
    expect(fillerRuleViolation({ filler: miter, placed: [cabinet, miter], room: ROOM, openings: [] })).toBeNull();
    // A plain board in the open middle of the run is still illegal.
    const side = filler({ uid: "side", width: 3 }, 43, "end");
    expect(fillerRuleViolation({ filler: side, placed: [cabinet, side], room: ROOM, openings: [] })?.code).toBe("on-open-side-face");
  });

  it("rejects a board on a run's open outside face", () => {
    // A lone cabinet mid-wall: neither side is wall, opening or another piece.
    const cabinet = seat({ uid: "alone", masterCode: "B24", width: 24 }, 40);
    const board = filler({ uid: "side", width: 3 }, 43, "alone");
    const violation = fillerRuleViolation({ filler: board, placed: [cabinet, board], room: ROOM, openings: [] });
    expect(violation?.code).toBe("on-open-side-face");
  });

  it("accepts a board between two cabinets", () => {
    const left = seat({ uid: "left", masterCode: "B24", width: 24 }, 0);
    const right = seat({ uid: "right", masterCode: "B24", width: 24 }, 27);
    const board = filler({ uid: "seam", width: 3 }, 24, "left");
    expect(fillerRuleViolation({ filler: board, placed: [left, right, board], room: ROOM, openings: [] })).toBeNull();
  });

  it("accepts a board between a cabinet and a wall end", () => {
    // A run that starts at the wall: the board sits between the wall and the box.
    const cabinet = seat({ uid: "end", masterCode: "B24", width: 24 }, 3);
    const board = filler({ uid: "wall-end", width: 3 }, 0, "end");
    expect(fillerRuleViolation({ filler: board, placed: [cabinet, board], room: ROOM, openings: [] })).toBeNull();
  });

  it("accepts a board between a cabinet and an appliance", () => {
    const cabinet = seat({ uid: "cab", masterCode: "B24", width: 24 }, 0);
    const range = seat({ uid: "range", masterCode: "RANGE-30", description: "30 inch Range", placement: "appliance", width: 30, height: 36 }, 27);
    const board = filler({ uid: "to-range", width: 3 }, 24, "cab");
    expect(fillerRuleViolation({ filler: board, placed: [cabinet, range, board], room: ROOM, openings: [] })).toBeNull();
  });

  it("ignores a wall blind corner's integrated face filler, which has no footprint of its own", () => {
    const integrated = {
      ...filler({ uid: "wbc-integrated", width: 3, placement: "wall", height: 30 }, 10, "wbc", "top", 12),
      integratedWallBlindFiller: true,
    } as PlacedCabinet;
    expect(fillerRuleViolation({ filler: integrated, placed: [integrated], room: ROOM, openings: [] })).toBeNull();
  });
});

describe("auditFillerPlacements / removeIllegalFillers", () => {
  it("drops only the illegal board and leaves every legal one in place", () => {
    const left = seat({ uid: "left", masterCode: "B24", width: 24 }, 0);
    const right = seat({ uid: "right", masterCode: "B24", width: 24 }, 27);
    const legal = filler({ uid: "legal", width: 3 }, 24, "left");
    const panel = seat({
      uid: "panel", masterCode: "S2496", description: "Refrigerator End Panel", placement: "tall",
      width: 0.75, height: 84, category: "Panel",
    }, 51);
    const illegal = filler({ uid: "illegal", width: 1.25, placement: "wall", height: 12, mountBottom: 72 }, 51, "right", "top", 24);
    const result = removeIllegalFillers({ placed: [left, right, legal, panel, illegal], room: ROOM, openings: [] });
    expect(result.removed.map((entry) => entry.filler.uid)).toEqual(["illegal"]);
    expect(result.placed.map((item) => item.uid)).toEqual(["left", "right", "legal", "panel"]);
  });

  it("is a no-op when every board is legal", () => {
    const left = seat({ uid: "left", masterCode: "B24", width: 24 }, 0);
    const right = seat({ uid: "right", masterCode: "B24", width: 24 }, 27);
    const legal = filler({ uid: "legal", width: 3 }, 24, "left");
    const placed = [left, right, legal];
    expect(auditFillerPlacements({ placed, room: ROOM, openings: [] })).toEqual([]);
    expect(removeIllegalFillers({ placed, room: ROOM, openings: [] }).placed).toEqual(placed);
  });
});

describe("the designer no longer offers a filler against a refrigerator panel", () => {
  it("reports no small-gap opportunity on the cabinet above the refrigerator", () => {
    const { leftPanel, refrigerator, rightPanel, bridge } = refrigeratorEnclosure();
    const placed = [leftPanel, refrigerator, rightPanel, bridge];
    expect(findSmallGapFillerOpportunity(ROOM, placed, [], bridge.uid)).toBeNull();
  });

  it("still offers a real cabinet-to-cabinet seam", () => {
    const left = seat({ uid: "left", masterCode: "B24", width: 24 }, 0);
    const target = seat({ uid: "target", masterCode: "B24", width: 24 }, 25.5);
    const placed = [left, target];
    const opportunity = findSmallGapFillerOpportunity(ROOM, placed, [], left.uid);
    expect(opportunity?.remaining).toBeCloseTo(1.5, 3);
  });

  it("never leaves an illegal board behind after the shared rules pass", () => {
    const { leftPanel, refrigerator, rightPanel, bridge } = refrigeratorEnclosure();
    const placed = [leftPanel, refrigerator, rightPanel, bridge];
    const result = applyDesignerLayoutRules({
      placed, room: ROOM, openings: [], fillers: FILLER_STOCK,
      makeUid: (() => { let n = 0; return () => `gen-${++n}`; })(),
      styleId: 1, allowAutoFillers: true,
    });
    const boards = result.placed.filter((item) => Boolean(item.fillerPieceGroupId));
    for (const board of boards) {
      expect(fillerRuleViolation({ filler: board, placed: result.placed, room: ROOM, openings: [] })).toBeNull();
    }
    // Nothing sits on the panel's span at all.
    const leftPanelSpan = {
      start: wallRunOffset(leftPanel, "top", ROOM),
      end: wallRunOffset(leftPanel, "top", ROOM) + 0.75,
    };
    for (const board of boards) {
      const start = wallRunOffset(board, "top", ROOM);
      const end = start + Number(board.width || 0);
      const overlapsPanel = Math.min(end, leftPanelSpan.end) - Math.max(start, leftPanelSpan.start) > getTolerance();
      expect(overlapsPanel).toBe(false);
    }
  });
});

function getTolerance() {
  return 0.02;
}
