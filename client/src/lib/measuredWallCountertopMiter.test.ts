import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM,
  countertopSurfaces,
  countertopSurfacePlanPolygon,
  measuredWallCountertopMiterSurfaces,
  type PlacedCabinet,
  wallPlacementAt,
} from "./design";

const room = {
  ...DEFAULT_ROOM,
  width: 180,
  depth: 180,
  vertices: [
    { id: "v1", x: 0, y: 0 },
    { id: "v2", x: 60, y: 60 },
    { id: "v3", x: 60, y: 180 },
    { id: "v4", x: 0, y: 180 },
  ],
  customWalls: [
    { id: "diagonal", startVertexId: "v1", endVertexId: "v2", lockedAngle: 45 as const },
    { id: "straight", startVertexId: "v2", endVertexId: "v3" },
    { id: "return", startVertexId: "v3", endVertexId: "v4" },
    { id: "close", startVertexId: "v4", endVertexId: "v1" },
  ],
};

function baseCabinet(uid: string, wallId: string, offset: number, width = 24): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, wallId as any, room);
  return {
    uid,
    cabinetId: 10,
    masterCode: "B-24",
    description: '24" Base Cabinet',
    placement: "base",
    x: spot.x,
    y: spot.y,
    width,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    wallId,
    wallOffset: spot.wallOffset,
    numberOfDoors: 2,
    numberOfDrawers: 1,
  };
}

describe("measuredWallCountertopMiterSurfaces", () => {
  it("keeps a 45-degree measured-wall slab centered on the exact rotated cabinet run", () => {
    const diagonalBase = baseCabinet("diagonal-base", "diagonal", 12, 30);
    const surface = countertopSurfaces([diagonalBase], room)[0]!;
    const slabDepth = 25.5;
    const spot = wallPlacementAt(12, 30, slabDepth, "diagonal" as any, room);
    const radians = spot.rotation * Math.PI / 180;
    const expectedCenterX = spot.x + (
      Math.abs(30 * Math.cos(radians)) + Math.abs(slabDepth * Math.sin(radians))
    ) / 2;
    const expectedCenterY = spot.y + (
      Math.abs(30 * Math.sin(radians)) + Math.abs(slabDepth * Math.cos(radians))
    ) / 2;

    expect(surface).toMatchObject({
      customWallId: "diagonal",
      width: 30,
      depth: slabDepth,
      rotation: 45,
    });
    expect(surface.x + surface.width / 2).toBeCloseTo(expectedCenterX, 8);
    expect(surface.y + surface.depth / 2).toBeCloseTo(expectedCenterY, 8);
  });

  it("cuts both countertop-supported runs to one real 45-degree seam", () => {
    const diagonalLength = Math.hypot(60, 60);
    const diagonalBase = baseCabinet("diagonal-base", "diagonal", diagonalLength - 24);
    const straightBase = baseCabinet("straight-base", "straight", 0);

    const bridges = measuredWallCountertopMiterSurfaces([diagonalBase, straightBase], room);
    expect(bridges).toHaveLength(1);
    expect(bridges[0]).toMatchObject({
      customWallMiterWallIds: ["diagonal", "straight"],
      customWallMiterVertexId: "v2",
      miteredStart: true,
      miteredEnd: true,
    });
    expect(bridges[0]?.polygon).toHaveLength(3);
    expect(bridges[0]?.areaInches).toBeGreaterThan(1);

    const surfaces = countertopSurfaces([diagonalBase, straightBase], room);
    expect(surfaces).toHaveLength(2);
    expect(surfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ customWallId: "diagonal", customWallMiterVertexId: "v2", miteredEnd: true }),
      expect.objectContaining({ customWallId: "straight", customWallMiterVertexId: "v2", miteredStart: true }),
    ]));
    expect(surfaces.find((surface) => surface.customWallCornerInfill)).toBeUndefined();
    expect(surfaces.every((surface) => surface.polygon && surface.polygon.length === 4)).toBe(true);
    expect(surfaces.filter((surface) => surface.rotation === 45 || surface.rotation === 90)).toHaveLength(2);
  });

  it("keeps the real countertop miter when both cabinets hold 11 inches from a locked 45-degree join", () => {
    const diagonalLength = Math.hypot(60, 60);
    const diagonalBase = baseCabinet("diagonal-held-base", "diagonal", diagonalLength - 24 - 11);
    const straightBase = baseCabinet("straight-held-base", "straight", 11);

    const bridges = measuredWallCountertopMiterSurfaces([diagonalBase, straightBase], room);
    expect(bridges).toEqual([
      expect.objectContaining({
        customWallMiterWallIds: ["diagonal", "straight"],
        customWallMiterVertexId: "v2",
        miteredStart: true,
        miteredEnd: true,
      }),
    ]);
    const surfaces = countertopSurfaces([diagonalBase, straightBase], room);
    expect(surfaces).toHaveLength(3);
    expect(surfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ customWallId: "diagonal", miteredEnd: true, customWallMiterVertexId: "v2" }),
      expect.objectContaining({ customWallId: "straight", miteredStart: true, customWallMiterVertexId: "v2" }),
      expect.objectContaining({ customWallCornerInfill: true, customWallMiterVertexId: "v2" }),
    ]));
    const infill = surfaces.find((surface) => surface.customWallCornerInfill);
    expect(infill?.polygon).toHaveLength(4);
    expect(infill?.areaInches).toBeGreaterThan(0);

    const containsPoint = (points: { x: number; y: number }[], target: { x: number; y: number }) => points.some((point) => (
      Math.hypot(point.x - target.x, point.y - target.y) < 1e-6
    ));
    const infillPolygon = countertopSurfacePlanPolygon(infill!);
    // The explicit 11-inch cabinet holds leave this back corner uncovered by
    // cabinet boxes. The physical fill polygon must reach the true wall vertex
    // and share both cabinet-facing miter edges exactly, so no countertop void
    // remains at the inside 45-degree corner.
    expect(containsPoint(infillPolygon, { x: 60, y: 60 })).toBe(true);
	    const signedInfillArea = infillPolygon.reduce((sum, point, index) => {
	      const next = infillPolygon[(index + 1) % infillPolygon.length]!;
	      return sum + point.x * next.y - next.x * point.y;
	    }, 0);
	    // Counter-clockwise plan winding becomes the visible top face after the
	    // shared polygon extrusion rotates it into Three.js room coordinates.
	    expect(signedInfillArea).toBeGreaterThan(0);
    const diagonalPolygon = countertopSurfacePlanPolygon(surfaces.find((surface) => surface.customWallId === "diagonal")!);
    const straightPolygon = countertopSurfacePlanPolygon(surfaces.find((surface) => surface.customWallId === "straight")!);
    const sharedWithDiagonal = infillPolygon.filter((point) => containsPoint(diagonalPolygon, point));
    const sharedWithStraight = infillPolygon.filter((point) => containsPoint(straightPolygon, point));
    expect(sharedWithDiagonal).toHaveLength(2);
    expect(sharedWithStraight).toHaveLength(2);
  });

  it("closes the same true 45-degree pocket when fitted fillers move cabinet bodies up to three inches beyond the hold", () => {
    const diagonalLength = Math.hypot(60, 60);
    // These 12-inch endpoints model a one-inch filler fitted at each required
    // 11-inch hold. The finished top must still span from the cabinet fronts to
    // the wall; leaving the added fitted width untreated creates the visible
    // triangular void reported in the Wall Builder.
    const diagonalBase = baseCabinet("diagonal-fitted-base", "diagonal", diagonalLength - 24 - 12);
    const straightBase = baseCabinet("straight-fitted-base", "straight", 12);
    const surfaces = countertopSurfaces([diagonalBase, straightBase], room);
    const infill = surfaces.find((surface) => surface.customWallCornerInfill);
    expect(infill).toMatchObject({ customWallMiterVertexId: "v2" });
    expect(countertopSurfacePlanPolygon(infill!)).toEqual(expect.arrayContaining([
      expect.objectContaining({ x: 60, y: 60 }),
    ]));
  });

  it("does not bridge an arbitrary free gap beyond the fitted three-inch filler allowance", () => {
    const diagonalLength = Math.hypot(60, 60);
    const diagonalBase = baseCabinet("diagonal-free-gap", "diagonal", diagonalLength - 24 - 15);
    const straightBase = baseCabinet("straight-free-gap", "straight", 15);
    const surfaces = countertopSurfaces([diagonalBase, straightBase], room);
    expect(surfaces.some((surface) => surface.customWallCornerInfill)).toBe(false);
  });

  it("extends the countertop across a physically drawn 45-degree turn even when it was not tagged as locked", () => {
    const rightAngleRoom = {
      ...room,
      customWalls: room.customWalls.map((wall) => wall.id === "diagonal" ? { ...wall, lockedAngle: undefined } : wall),
    };
    const diagonalLength = Math.hypot(60, 60);
    const diagonalBase = { ...baseCabinet("diagonal-base", "diagonal", diagonalLength - 24), rotation: 45 };
    const straightBase = baseCabinet("straight-base", "straight", 0);

    expect(measuredWallCountertopMiterSurfaces([diagonalBase, straightBase], rightAngleRoom)).toEqual([
      expect.objectContaining({
        customWallMiterWallIds: ["diagonal", "straight"],
        customWallMiterVertexId: "v2",
      }),
    ]);
    const surfaces = countertopSurfaces([diagonalBase, straightBase], rightAngleRoom);
    expect(surfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ customWallId: "diagonal", customWallMiterVertexId: "v2", miteredEnd: true }),
      expect.objectContaining({ customWallId: "straight", customWallMiterVertexId: "v2", miteredStart: true }),
    ]));
  });

  it("uses one flush square seam where two diagonal measured walls turn 90 degrees", () => {
    const squareRoom = {
      ...DEFAULT_ROOM,
      width: 180,
      depth: 180,
      vertices: [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 60, y: 60 },
        { id: "c", x: 0, y: 120 },
        { id: "d", x: 0, y: 180 },
      ],
      customWalls: [
        { id: "first", startVertexId: "a", endVertexId: "b", lockedAngle: 45 as const },
        { id: "second", startVertexId: "b", endVertexId: "c", lockedAngle: 45 as const },
        { id: "close", startVertexId: "c", endVertexId: "d" },
        { id: "left", startVertexId: "d", endVertexId: "a" },
      ],
    };
    const base = (uid: string, wallId: string, offset: number): PlacedCabinet => {
      const spot = wallPlacementAt(offset, 36, 24, wallId as any, squareRoom);
      return {
        uid,
        cabinetId: 11,
        masterCode: "B-36",
        description: '36" Base Cabinet',
        placement: "base",
        x: spot.x,
        y: spot.y,
        width: 36,
        depth: 24,
        height: 34.5,
        rotation: spot.rotation,
        wallId,
        wallOffset: spot.wallOffset,
        numberOfDoors: 2,
        numberOfDrawers: 1,
      };
    };
    const diagonalLength = Math.hypot(60, 60);
    const surfaces = countertopSurfaces([
      base("first-base", "first", diagonalLength - 36),
      base("second-base", "second", 0),
    ], squareRoom);

    expect(surfaces).toHaveLength(2);
    expect(surfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ customWallId: "first", customWallSquareCornerWallIds: ["first", "second"], customWallSquareCornerVertexId: "b" }),
      expect.objectContaining({ customWallId: "second", customWallSquareCornerWallIds: ["first", "second"], customWallSquareCornerVertexId: "b" }),
    ]));
    expect(surfaces.every((surface) => !surface.customWallMiterWallIds)).toBe(true);

    const [first, second] = surfaces.map(countertopSurfacePlanPolygon);
    const matchingEdge = first.some((start, index) => {
      const end = first[(index + 1) % first.length]!;
      return second.some((otherStart, otherIndex) => {
        const otherEnd = second[(otherIndex + 1) % second.length]!;
        return Math.hypot(start.x - otherEnd.x, start.y - otherEnd.y) < 1e-6
          && Math.hypot(end.x - otherStart.x, end.y - otherStart.y) < 1e-6;
      });
    });
    // A full common edge proves this is a physical flush square seam, not two
    // untrimmed rotated rectangles that overlap or leave a triangular void.
    expect(matchingEdge).toBe(true);
  });
});
