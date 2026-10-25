import { describe, expect, it } from "vitest";
import {
  floorPlanWallDimensionChains,
  wallPlacementAt,
  wallSpanMeasure,
  type PlacedCabinet,
  type RoomData,
} from "./design";

const measuredRoom: RoomData = {
  width: 156.154,
  depth: 132,
  ceilingHeight: 96,
  openWallPath: true,
  vertices: [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 101, y: 0 },
    { id: "c", x: 156.154, y: 55.154 },
  ],
  customWalls: [
    { id: "wall-101", startVertexId: "a", endVertexId: "b", label: "101 in wall" },
    { id: "wall-78", startVertexId: "b", endVertexId: "c", label: "78 in diagonal", lockedAngle: 45 },
  ],
};

function seatedBase(uid: string, code: string, width: number, wallId: string, offset: number): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, wallId, measuredRoom);
  return {
    uid,
    cabinetId: 1,
    masterCode: code,
    description: code,
    placement: "base",
    width,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    x: spot.x,
    y: spot.y,
    wallId: spot.wallId,
    wallOffset: spot.wallOffset,
    numberOfDoors: 2,
    numberOfDrawers: 0,
  };
}

describe("shared Floor Plan dimension chains", () => {
  it("shows catalog spans and the exact remaining gap on a 101-inch measured wall", () => {
    const cabinets = [
      seatedBase("lsb36", "LSB36", 36, "wall-101", 0),
      seatedBase("db12", "3DB12", 12, "wall-101", 36),
      seatedBase("range", "RANGE-30-1-16", 30.0625, "wall-101", 48),
      seatedBase("db18", "3DB18", 18, "wall-101", 78.0625),
    ];

    const chain = floorPlanWallDimensionChains(measuredRoom, cabinets)
      .find((candidate) => candidate.wallId === "wall-101" && candidate.layer === "base");

    expect(chain).toBeDefined();
    expect(chain!.length).toBeCloseTo(101, 6);
    expect(chain!.segments.map((segment) => segment.length)).toEqual([36, 12, 30.0625, 18, 4.9375]);
    expect(chain!.segments.reduce((total, segment) => total + segment.length, 0)).toBeCloseTo(chain!.length, 6);
  });

  it("uses true catalog width rather than a rotated envelope on a 45-degree wall", () => {
    const diagonalCabinet = seatedBase("diagonal-b36", "B36", 36, "wall-78", 0);
    const chain = floorPlanWallDimensionChains(measuredRoom, [diagonalCabinet])
      .find((candidate) => candidate.wallId === "wall-78" && candidate.layer === "base");

    expect(chain).toBeDefined();
    expect(chain!.segments.map((segment) => segment.length)).toEqual(expect.arrayContaining([36, expect.any(Number)]));
    expect(chain!.segments[1]!.length).toBeCloseTo(42, 3);
    expect(chain!.segments.reduce((total, segment) => total + segment.length, 0)).toBeCloseTo(chain!.length, 6);
  });

  it("reports live left and right clearance against adjoining measured-wall cabinets", () => {
    const left = seatedBase("left", "B36", 36, "wall-101", 0);
    const moving = seatedBase("moving", "B12", 12, "wall-101", 40.9375);
    const right = seatedBase("right", "B18", 18, "wall-101", 70);

    expect(wallSpanMeasure(moving, measuredRoom, [left, moving, right], "wall-101")).toMatchObject({
      before: 4.9375,
      after: 17.0625,
      beforeIsCabinet: true,
      afterIsCabinet: true,
    });
  });
});
