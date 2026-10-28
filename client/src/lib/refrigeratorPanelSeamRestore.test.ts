import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM,
  cabinetPlanBodiesIntersect,
  refrigeratorEndPanelConflictDetail,
  removeOverlappingPlacements,
  wallPlacementAtUnbounded,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "@/lib/design";

// A drawn room whose walls are not axis-exact, like a Wall Builder sketch.
const room = {
  ...DEFAULT_ROOM,
  width: 200,
  depth: 200,
  vertices: [
    { id: "v1", x: 0, y: 0 }, { id: "v2", x: 60, y: 60 }, { id: "v3", x: 60.3, y: 180 }, { id: "v4", x: 0, y: 180 },
  ],
  customWalls: [
    { id: "diagonal", startVertexId: "v1", endVertexId: "v2", lockedAngle: 45 as const },
    { id: "straight", startVertexId: "v2", endVertexId: "v3" },
    { id: "return", startVertexId: "v3", endVertexId: "v4" },
    { id: "close", startVertexId: "v4", endVertexId: "v1" },
  ],
} as unknown as RoomData;

function base(wall: WallSide, along: number): PlacedCabinet {
  const spot = wallPlacementAtUnbounded(along, 24, 24, wall, room);
  return { uid: "db", cabinetId: 1, masterCode: "3DB24", description: "Drawer Base", placement: "base", ...spot, width: 24, depth: 24, height: 34.5 };
}
function panel(wall: WallSide, along: number): PlacedCabinet {
  const spot = wallPlacementAtUnbounded(along, 0.75, 24, wall, room);
  return { uid: "panel", cabinetId: 2, masterCode: "REP2496", description: "Refrigerator End Panel", placement: "tall", ...spot, width: 0.75, depth: 24, height: 96 };
}

describe("refrigerator end panel butted against a cabinet on a drawn wall", () => {
  it("is never treated as overlapping, so a reload does not delete it", () => {
    let flagged = 0;
    for (const wall of ["diagonal", "straight", "return", "close"] as WallSide[]) {
      for (let along = 0; along < 60; along += 0.4375) {
        const drawer = base(wall, along);
        const flush = panel(wall, along + 24);
        if (refrigeratorEndPanelConflictDetail(flush, [drawer], null, room)) flagged++;
        expect(removeOverlappingPlacements([drawer, flush], room).placed.map((item) => item.uid)).toEqual(["db", "panel"]);
      }
    }
    expect(flagged).toBe(0);
  });

  it("still catches a real 1/16-inch overlap", () => {
    for (const wall of ["diagonal", "straight", "return", "close"] as WallSide[]) {
      const drawer = base(wall, 20);
      const into = panel(wall, 44 - 1 / 16);
      expect(cabinetPlanBodiesIntersect(into, drawer)).toBe(true);
      expect(refrigeratorEndPanelConflictDetail(into, [drawer], null, room)?.cabinet.uid).toBe("db");
    }
  });
});
