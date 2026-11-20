import { describe, expect, it } from "vitest";
import { bridgeBoardEnvelope, normalizeBridgeBoards } from "./bridgeHalfInchFillers";
import { normalizeStandardWallMounts, wallPlacementAt, type PlacedCabinet, type RoomData } from "./design";
import { samePlacementsShallow } from "./samePlacements";

/**
 * Regression for the Auto Design 3D view that never finished after PR 481
 * (ca4bf43, glass over 12 / 15 / 18 in bridges). DesignTool's mount effect
 * runs normalizeStandardWallMounts, then setPlaced runs normalizeBridgeBoards.
 * Before the first-pass exclusion, the wall-mount rule dropped each 1/2 in
 * bridge board to 60 in (84 - 24), the board rule put it back at the 72 in
 * envelope, and the effect re-ran forever.
 */
const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function place(along: number, width: number, depth: number, extra: Partial<PlacedCabinet>): PlacedCabinet {
  const spot = wallPlacementAt(along, width, depth, "top", room);
  return {
    uid: "x",
    cabinetId: 1,
    masterCode: "X",
    description: "",
    category: "Wall",
    subCategory: "Wall Cabinets",
    placement: "wall",
    rotation: 0,
    wallId: "top",
    width,
    depth,
    height: 12,
    mountBottom: 72,
    ...spot,
    ...extra,
  } as PlacedCabinet;
}

function glassOverBridgeLayout(): PlacedCabinet[] {
  const bridge = place(36.5, 36, 12, {
    uid: "bridge",
    masterCode: "W3612",
    height: 12,
    nominalHeight: 12,
    mountBottom: 72,
    refrigeratorAssemblyRole: "bridge",
    refrigeratorAssemblyId: "fridge",
  });
  const glass = place(36.5, 36, 12, {
    uid: "glass",
    masterCode: "W3612GD",
    description: "Wall glass stacker",
    height: 12,
    nominalHeight: 12,
    mountBottom: 84,
    stackedOnCabinetUid: "bridge",
  });
  const left = place(36, 0.5, 12, {
    uid: "board-left",
    masterCode: "F3",
    description: "Bridge filler",
    height: 24,
    nominalHeight: 24,
    mountBottom: 72,
    refrigeratorAssemblyRole: "bridge-left-filler",
    refrigeratorAssemblyId: "fridge",
    fillerForCabinetUid: "bridge",
    fillerPieceGroupId: "bridge-half-inch:bridge:left",
  });
  const right = place(72.5, 0.5, 12, {
    uid: "board-right",
    masterCode: "F3",
    description: "Bridge filler",
    height: 24,
    nominalHeight: 24,
    mountBottom: 72,
    refrigeratorAssemblyRole: "bridge-right-filler",
    refrigeratorAssemblyId: "fridge",
    fillerForCabinetUid: "bridge",
    fillerPieceGroupId: "bridge-half-inch:bridge:right",
  });
  return [bridge, glass, left, right];
}

const boardsOf = (placed: readonly PlacedCabinet[]) => placed.filter((item) => (
  item.refrigeratorAssemblyRole === "bridge-left-filler" || item.refrigeratorAssemblyRole === "bridge-right-filler"
));

/**
 * One DesignTool cycle: the mount effect runs normalizeStandardWallMounts, then
 * setPlaced runs normalizeBridgeBoards only when the mount pass changed the plan.
 * A fixed point is a cycle that returns the same array reference, which is what
 * stops the effect from scheduling another 3D rebuild.
 */
function designerCycle(placed: PlacedCabinet[]): PlacedCabinet[] {
  const mounted = normalizeStandardWallMounts(placed, [], room);
  if (samePlacementsShallow(placed, mounted)) return placed;
  return normalizeBridgeBoards(mounted, room);
}

function settleToFixedPoint(placed: PlacedCabinet[], max = 8): { placed: PlacedCabinet[]; ticks: number; settled: boolean } {
  let current = placed;
  for (let ticks = 1; ticks <= max; ticks += 1) {
    const next = designerCycle(current);
    if (next === current) return { placed: current, ticks, settled: true };
    current = next;
  }
  return { placed: current, ticks: max, settled: false };
}

describe("Auto Design 3D: glass-over-bridge boards do not loop with the wall-mount rule", () => {
  it("reaches a fixed point and keeps both 1/2 in boards at the 72 in envelope", () => {
    const start = glassOverBridgeLayout();
    const bridge = start.find((item) => item.refrigeratorAssemblyRole === "bridge")!;
    const envelope = bridgeBoardEnvelope(bridge, start, room);
    expect(envelope.mountBottom).toBeCloseTo(72, 3);
    expect(envelope.glassAbove).toBe(true);
    expect(envelope.height).toBeCloseTo(24, 3);

    const result = settleToFixedPoint(start);
    expect(result.settled).toBe(true);
    expect(result.ticks).toBeLessThanOrEqual(2);

    const boards = boardsOf(result.placed);
    expect(boards).toHaveLength(2);
    for (const board of boards) {
      expect(board.mountBottom).toBeCloseTo(72, 3);
      expect(Number(board.height)).toBeCloseTo(24, 3);
      expect(Number(board.mountBottom) + Number(board.height)).toBeCloseTo(96, 3);
    }

    const remounted = normalizeStandardWallMounts(result.placed, [], room);
    expect(samePlacementsShallow(result.placed, remounted)).toBe(true);
    for (const board of boardsOf(remounted)) {
      expect(board.mountBottom).toBeCloseTo(72, 3);
    }
  });
});
