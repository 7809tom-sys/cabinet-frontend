import { describe, expect, it } from "vitest";
import {
  appendRefrigeratorEnclosurePlacements,
  refrigeratorBayRunMetrics,
  wallPlacementAtUnbounded,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";

/**
 * User bug (2026-09-30): on a Continuous Wall room, Refrigerator Options →
 * Both panels → Accept added nothing and showed no message. In the standard
 * room the same click added both panels. Root cause: the reconcile pass
 * measured an end panel without run metadata by its rotated screen box, so a
 * 3/4" x 24" panel was treated as a 24" span and re-seated 23 1/4" away from
 * the opening. One engine: the same members must land in the same run offsets
 * on a standard wall and on a drawn wall.
 */
const standardRoom: RoomData = { width: 100, depth: 60, ceilingHeight: 96 } as RoomData;
const drawnRoom: RoomData = {
  width: 100, depth: 60, ceilingHeight: 96, openWallPath: true,
  vertices: [{ id: "v1", x: 0, y: 0 }, { id: "v2", x: 100, y: 0 }, { id: "v3", x: 100, y: 60 }],
  customWalls: [
    { id: "w1", startVertexId: "v1", endVertexId: "v2", label: "Wall 1", height: 96 },
    { id: "w2", startVertexId: "v2", endVertexId: "v3", label: "Wall 2", height: 96 },
  ],
} as unknown as RoomData;

const angledRoom: RoomData = {
  width: 194.912, depth: 146.912, ceilingHeight: 96, openWallPath: true,
  vertices: [
    { id: "a1", x: 0, y: 0 }, { id: "a2", x: 144, y: 0 }, { id: "a3", x: 194.9117, y: 50.9117 }, { id: "a4", x: 194.9117, y: 146.9117 },
  ],
  customWalls: [
    { id: "main", startVertexId: "a1", endVertexId: "a2", label: "Main wall", height: 96 },
    { id: "diag", startVertexId: "a2", endVertexId: "a3", label: "45° wall", lockedAngle: 45, height: 96 },
    { id: "half", startVertexId: "a3", endVertexId: "a4", label: "Half wall", height: 42 },
  ],
} as unknown as RoomData;

function fridge(wallId: string, room: RoomData = standardRoom): PlacedCabinet {
  const spot = wallPlacementAtUnbounded(30, 36, 30, wallId, room);
  return {
    uid: "fridge", cabinetId: 0, masterCode: "FRIDGE-36", description: "Refrigerator", placement: "appliance",
    x: spot.x, y: spot.y, width: 36, depth: 30, height: 70, rotation: spot.rotation, refrigeratorPanelMode: "both", wallId, wallOffset: 30,
  } as PlacedCabinet;
}

function panels(f: PlacedCabinet, room: RoomData): PlacedCabinet[] {
  const bay = refrigeratorBayRunMetrics(f, room);
  const mk = (left: boolean): PlacedCabinet => {
    const along = left ? bay.openingStart - 0.75 : bay.openingEnd;
    const spot = wallPlacementAtUnbounded(along, 0.75, 24, bay.side, room);
    return {
      uid: left ? "pl" : "pr", cabinetId: 1, masterCode: "REPV3096", description: "Refrigerator End Panel", placement: "tall",
      x: spot.x, y: spot.y, width: 0.75, depth: 24, height: 84, rotation: spot.rotation,
      wallId: spot.wallId, wallOffset: spot.wallOffset,
      customProfile: "refrigerator-end-panel", subCategory: "Refrigerator End Panel", mountBottom: 0,
      refrigeratorAssemblyId: "fridge", refrigeratorAssemblyRole: left ? "left-panel" : "right-panel",
    } as PlacedCabinet;
  };
  return [mk(true), mk(false)];
}

function accept(room: RoomData, wallId: string) {
  const f = fridge(wallId, room);
  const adds = panels(f, room);
  const res = appendRefrigeratorEnclosurePlacements([f], adds, "fridge", room);
  const committed = res.placed;
  const left = committed.find((p) => p.uid === "pl");
  const right = committed.find((p) => p.uid === "pr");
  return {
    rejected: res.rejected.map((r) => r.uid),
    left: left ? { off: wallRunOffset(left, wallId, room), span: wallRunSpan(left, wallId, room), wallId: left.wallId } : null,
    right: right ? { off: wallRunOffset(right, wallId, room), span: wallRunSpan(right, wallId, room), wallId: right.wallId } : null,
  };
}

describe("one engine: refrigerator end panels accepted on a drawn wall", () => {
    it("Both explicitly placed panels land at the same run offsets on a standard wall and a Wall Builder wall", () => {
      const standard = accept(standardRoom, "top");
      const drawn = accept(drawnRoom, "w1");
      expect(standard.rejected).toEqual([]);
      expect(drawn.rejected).toEqual([]);
      expect(standard.left).toBeTruthy();
      expect(drawn.left).toBeTruthy();
      // Left panel finishes 1/2" clearance + 3/4" thickness before the fridge (30 - 0.5 - 0.75).
      expect(standard.left!.off).toBeCloseTo(28.75, 3);
      expect(drawn.left!.off).toBeCloseTo(28.75, 3);
      // Right panel begins after the fridge plus 1/2" clearance (30 + 36 + 0.5).
      expect(standard.right!.off).toBeCloseTo(66.5, 3);
      expect(drawn.right!.off).toBeCloseTo(66.5, 3);
      expect(drawn.left!.span).toBeCloseTo(0.75, 3);
      expect(drawn.right!.span).toBeCloseTo(0.75, 3);
      expect(drawn.left!.wallId).toBe("w1");
      expect(drawn.right!.wallId).toBe("w1");
    });
    it("Both explicitly placed panels seat on a 45° Wall Builder wall at the same offsets", () => {
      const angled = accept(angledRoom, "diag");
      expect(angled.rejected).toEqual([]);
      expect(angled.left!.off).toBeCloseTo(28.75, 3);
      expect(angled.right!.off).toBeCloseTo(66.5, 3);
      expect(angled.left!.span).toBeCloseTo(0.75, 3);
      expect(angled.left!.wallId).toBe("diag");
      expect(angled.right!.wallId).toBe("diag");
    });
});
