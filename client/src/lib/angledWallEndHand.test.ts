import { describe, expect, it } from "vitest";
import {
  angledWallEndClipPath,
  angledWallEndNeighborSide,
  syncWallRunOffsets,
  wallPlacementAt,
  wallRunFrame,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { triangleCornerFootprintVertices, triangleCornerFrontPose } from "../components/design/InteractiveRoom3D";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function onTop(uid: string, masterCode: string, offset: number, width: number, depth: number, placement: PlacedCabinet["placement"], height: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, depth, "top", room);
  return { uid, cabinetId: 1, masterCode, description: masterCode, placement, ...spot, width, depth, height };
}

const pantry = (offset: number) => onTop("u", "U249624", offset, 24, 24, "tall", 96);
const aw = (offset: number) => onTop("aw", "AW1242", offset, 12, 12, "wall", 42);

describe("AW angled wall-end handing", () => {
  it("puts the square corner on the side of the tall neighbour", () => {
    expect(wallRunFrame("top", room)?.tangent.x).toBeGreaterThan(0);
    // U249624 at 0..24, AW at 24..36: neighbour on the AW's left.
    expect(angledWallEndNeighborSide(aw(24), [pantry(0), aw(24)], room)).toBe("left");
    // AW at 0..12, U249624 at 12..36: neighbour on the AW's right.
    expect(angledWallEndNeighborSide(aw(0), [aw(0), pantry(12)], room)).toBe("right");
    // Free-standing AW keeps whatever it had.
    expect(angledWallEndNeighborSide(aw(60), [pantry(0), aw(60)], room)).toBeNull();
  });

  it("stamps the hand at the commit boundary and mirrors the plan clip", () => {
    const synced = syncWallRunOffsets([pantry(0), aw(24)], room);
    const stamped = synced.find((cabinet) => cabinet.uid === "aw");
    expect(stamped?.angleEndHand).toBe("left");
    expect(angledWallEndClipPath(stamped?.angleEndHand)).toBe("polygon(0 0, 100% 0, 0 100%)");
    expect(angledWallEndClipPath(null)).toBe("polygon(0 0, 100% 0, 100% 100%)");
  });

  it("mirrors the 3D wedge and turns the door to face the open end", () => {
    const right = triangleCornerFootprintVertices(1, 1);
    const left = triangleCornerFootprintVertices(1, 1, "left");
    // The square corner is the vertex at the back (z = -0.5) on the neighbour side.
    expect(right).toContainEqual({ x: 0.5, z: -0.5 });
    expect(right).toContainEqual({ x: 0.5, z: 0.5 });
    expect(left).toContainEqual({ x: -0.5, z: -0.5 });
    expect(left).toContainEqual({ x: -0.5, z: 0.5 });
    expect(left).not.toContainEqual({ x: 0.5, z: 0.5 });
    expect(triangleCornerFrontPose(1, 1).normalX).toBeLessThan(0);
    expect(triangleCornerFrontPose(1, 1, undefined, "left").normalX).toBeGreaterThan(0);
    expect(triangleCornerFrontPose(1, 1, undefined, "left").rotation).toBeCloseTo(Math.PI / 4);
  });
});
