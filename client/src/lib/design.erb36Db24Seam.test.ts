import { describe, expect, it } from "vitest";
import {
  cabinetPlacementCollisionDetail,
  hasCollision,
  nextAvailableRoomCornerPlacement,
  removeOverlappingPlacements,
  wallLength,
  wallPlacementAt,
  type PlacedCabinet,
  type RoomData,
} from "./design";

const room: RoomData = {
  width: 180,
  depth: 180,
  ceilingHeight: 96,
  openWallPath: true,
  vertices: [
    { id: "a", x: 0, y: 0 },
    { id: "corner", x: 100, y: 100 },
    { id: "b", x: 50, y: 150 },
  ],
  customWalls: [
    { id: "first", startVertexId: "a", endVertexId: "corner", label: "Wall 1", lockedAngle: 45, height: 96 },
    { id: "second", startVertexId: "corner", endVertexId: "b", label: "Wall 2", lockedAngle: 45, height: 96 },
  ],
};

function erb36(): PlacedCabinet {
  const seed: PlacedCabinet = {
    uid: "erb36",
    cabinetId: 36,
    masterCode: "ERB36",
    description: "Easy Reach Corner Base 36",
    placement: "base",
    x: 0,
    y: 0,
    width: 36,
    depth: 24,
    height: 34.5,
    rotation: 0,
  };
  const spot = nextAvailableRoomCornerPlacement(seed, "second" as never, room, []);
  if (!spot) throw new Error("ERB36 should seat at the measured 90-degree vertex");
  return { ...seed, ...spot, wallId: spot.wallId, wallOffset: spot.wallOffset };
}

describe("ERB36 diagonal edge seams", () => {
  it("keeps a DB24 and dishwasher at the exposed ERB36 leg edge after room-aware final placement cleanup", () => {
    const erb = erb36();
    const firstLength = wallLength("first" as never, room);
    const dbSpot = wallPlacementAt(firstLength - 36 - 24, 24, 24, "first" as never, room);
    const db24: PlacedCabinet = {
      uid: "db24",
      cabinetId: 24,
      masterCode: "3DB24",
      description: "24 inch Drawer Base",
      placement: "base",
      ...dbSpot,
      width: 24,
      depth: 24,
      height: 34.5,
      wallId: dbSpot.wallId,
      wallOffset: dbSpot.wallOffset,
    };

    expect(cabinetPlacementCollisionDetail(db24, [erb], room)).toBeNull();
    // The generic screen envelopes overlap on a diagonal measured corner, so
    // cleanup must use the explicit wall runs rather than rejecting DB24 after
    // the visible preview succeeds.
    expect(hasCollision(db24, [erb])).toBe(true);
    expect(removeOverlappingPlacements([erb, db24], room).placed.map((item) => item.uid)).toEqual(["erb36", "db24"]);
    const dishwasher = {
      ...db24,
      uid: "dw24",
      masterCode: "DW-24",
      description: "Dishwasher 24 inch",
      placement: "appliance" as const,
    };
    expect(cabinetPlacementCollisionDetail(dishwasher, [erb], room)).toBeNull();
    expect(removeOverlappingPlacements([erb, dishwasher], room).placed.map((item) => item.uid)).toEqual(["erb36", "dw24"]);
  });
});
