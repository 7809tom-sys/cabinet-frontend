import { describe, expect, it } from "vitest";
import { placedFootprint, type PlacedCabinet, type RoomData, type WallOpening } from "./design";
import { rotateCustomPlanClockwise, rotatePlanPointClockwise, rotatePlanRectClockwise } from "./rotatePlan";

const room: RoomData = {
  width: 156.154,
  depth: 101,
  ceilingHeight: 96,
  openWallPath: true,
  vertices: [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 101, y: 0 },
    { id: "c", x: 156.154, y: 45.846 },
    { id: "d", x: 110.308, y: 101 },
  ],
  customWalls: [
    { id: "wall-1", startVertexId: "a", endVertexId: "b", label: "Wall 1" },
    { id: "wall-2", startVertexId: "b", endVertexId: "c", label: "Wall 2", lockedAngle: -45 },
    { id: "wall-3", startVertexId: "c", endVertexId: "d", label: "Wall 3", lockedAngle: 45 },
  ],
};

const invalidGraphCabinet: PlacedCabinet = {
  uid: "db18",
  cabinetId: 18,
  masterCode: "3-DB18",
  description: "Drawer Base 18",
  placement: "base",
  x: 0,
  y: 0,
  width: 18,
  depth: 24,
  height: 34.5,
  rotation: 0,
  wallId: "left",
};

const opening: WallOpening = {
  uid: "opening",
  kind: "door",
  label: "Door 36\"",
  side: "wall-2" as any,
  offset: 12,
  width: 36,
  height: 80,
  sill: 0,
};

const emptyExtras = {
  sinks: [],
  island: null,
  furniture: [],
  annotations: [],
  ponyWalls: [],
};

describe("custom drawing rotation", () => {
  it("rotates points and rectangles clockwise without changing their physical dimensions", () => {
    expect(rotatePlanPointClockwise({ x: 12, y: 30 }, 120)).toEqual({ x: 90, y: 12 });
    expect(rotatePlanRectClockwise({ x: 12, y: 30, width: 18, depth: 24 }, 120)).toEqual({
      x: 66,
      y: 12,
      width: 24,
      depth: 18,
    });
  });

  it("keeps wall ids, measured lengths, opening offsets, and cabinet ownership through a quarter turn", () => {
    const result = rotateCustomPlanClockwise({
      room,
      cabinets: [invalidGraphCabinet],
      openings: [opening],
      ...emptyExtras,
    });

    expect(result.room).toMatchObject({ width: 101, depth: 156.154, openWallPath: true });
    expect(result.room.customWalls?.map((wall) => wall.id)).toEqual(["wall-1", "wall-2", "wall-3"]);
    expect(result.openings[0]).toMatchObject({ side: "wall-2", offset: 12, width: 36 });
    expect(result.cabinets[0].wallId).toBe("wall-1");
    // wallOffset is the run START on every wall (the shared engine's meaning):
    // an 18" body at x 0..18 along wall-1 keeps start offset 0 through the turn.
    expect(result.cabinets[0].wallOffset).toBeCloseTo(0, 4);
    expect(result.cabinets[0].rotation).toBe(90);
    const footprint = placedFootprint(result.cabinets[0]);
    expect(result.cabinets[0].x).toBeGreaterThanOrEqual(-0.001);
    expect(result.cabinets[0].y).toBeGreaterThanOrEqual(-0.001);
    expect(result.cabinets[0].x + footprint.w).toBeLessThanOrEqual(result.room.width + 0.001);
    expect(result.cabinets[0].y + footprint.d).toBeLessThanOrEqual(result.room.depth + 0.001);
  });

  it("rotates the visible cabinet body instead of trusting a stale saved wall offset", () => {
    const visibleBodyAt24 = {
      ...invalidGraphCabinet,
      uid: "visible-body-at-24",
      width: 30,
      depth: 24,
      x: 24,
      y: 0,
      rotation: 0,
      wallId: "wall-1",
      // This intentionally stale metadata recreates the failure mode: the
      // body visibly starts 24 inches into the run, but an old save says zero.
      wallOffset: 0,
    };

    const result = rotateCustomPlanClockwise({
      room,
      cabinets: [visibleBodyAt24],
      openings: [],
      ...emptyExtras,
    });
    const expected = rotatePlanRectClockwise({ x: 24, y: 0, width: 30, depth: 24 }, room.depth);

    expect(result.cabinets[0]).toMatchObject({
      x: expected.x,
      y: expected.y,
      rotation: 90,
      wallId: "wall-1",
      wallOffset: 24,
    });
  });

  it("returns the custom wall vertices and cabinet to their starting geometry after four rotations", () => {
    let state = {
      room,
      cabinets: [{ ...invalidGraphCabinet, wallId: "wall-1", wallOffset: 12, x: 12, y: 0, rotation: 0 }],
      openings: [opening],
      ...emptyExtras,
    };
    const originalLengths = room.customWalls!.map((wall) => {
      const a = room.vertices!.find((vertex) => vertex.id === wall.startVertexId)!;
      const b = room.vertices!.find((vertex) => vertex.id === wall.endVertexId)!;
      return Math.hypot(b.x - a.x, b.y - a.y);
    });

    for (let turn = 0; turn < 4; turn += 1) state = rotateCustomPlanClockwise(state);

    const finalLengths = state.room.customWalls!.map((wall) => {
      const a = state.room.vertices!.find((vertex) => vertex.id === wall.startVertexId)!;
      const b = state.room.vertices!.find((vertex) => vertex.id === wall.endVertexId)!;
      return Math.hypot(b.x - a.x, b.y - a.y);
    });
    expect(state.room.width).toBeCloseTo(room.width, 4);
    expect(state.room.depth).toBeCloseTo(room.depth, 4);
    expect(finalLengths).toEqual(originalLengths.map((length) => expect.closeTo(length, 4)));
    expect(state.cabinets[0]).toMatchObject({ wallId: "wall-1", wallOffset: 12, rotation: 0 });
  });
});
