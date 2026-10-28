import { describe, expect, it } from "vitest";
import {
  BASE_ANGLE_END_DOOR_IN,
  BASE_ANGLE_END_FACE_IN,
  BASE_ANGLE_END_SIDE_IN,
  baseAngleEndClearsNeighbor,
  baseAngleEndCountertopLocalPoints,
  baseAngleEndPlan,
  equalChordInteriorAngleDegrees,
  isBaseAngleEndCabinet,
} from "./baseAngleEndLayout";

describe("base angle end quarter-octagon", () => {
  it("recognizes BA-24, BEC24, and BAC24 without treating a diagonal corner as one", () => {
    expect(isBaseAngleEndCabinet({ masterCode: "BA-24", description: "Base End Cabinet" })).toBe(true);
    expect(isBaseAngleEndCabinet({ masterCode: "BEC24" })).toBe(true);
    expect(isBaseAngleEndCabinet({ masterCode: "BEC-24" })).toBe(true);
    expect(isBaseAngleEndCabinet({ masterCode: "BAC24", description: '24 inch Base Angle Cabinet (End of Run)' })).toBe(true);
    expect(isBaseAngleEndCabinet({ masterCode: "CUSTOM", description: "Quarter-Octagon Base End" })).toBe(true);
    expect(isBaseAngleEndCabinet({
      masterCode: "BEC-24",
      description: "24 inch Base Angle Cabinet (End of Run)",
    })).toBe(true);
    expect(isBaseAngleEndCabinet({ masterCode: "DCB-36", description: "36 inch Diagonal Corner Base" })).toBe(false);
    expect(isBaseAngleEndCabinet({ masterCode: "WDC2430", description: "Diagonal Wall Corner" })).toBe(false);
    expect(isBaseAngleEndCabinet({ masterCode: "B24", description: "24 inch Base Cabinet" })).toBe(false);
  });

  it("closes two 24 inch sides and two equal faces at a 45 degree pitch", () => {
    const plan = baseAngleEndPlan();
    expect(plan.wallSide.length).toBeCloseTo(BASE_ANGLE_END_SIDE_IN, 6);
    expect(plan.neighborSide.length).toBeCloseTo(BASE_ANGLE_END_SIDE_IN, 6);
    expect(plan.doorFaces).toHaveLength(2);
    expect(plan.doorFaces[0]!.length).toBeCloseTo(plan.doorFaces[1]!.length, 6);
    expect(plan.doorFaces[0]!.length).toBeCloseTo(BASE_ANGLE_END_FACE_IN, 6);
    expect(plan.faceIn).toBeCloseTo(2 * 24 * Math.sin(Math.PI / 8), 8);
    expect(plan.doorPitchDegrees).toBeCloseTo(45, 6);
    expect(plan.doorInteriorAngleDegrees).toBeCloseTo(135, 6);
    expect(plan.doorWidthIn).toBe(BASE_ANGLE_END_DOOR_IN);
    // The frontal face's run span is the 17 inches read across the elevation.
    const front = plan.doorFaces.find((face) => face.id === "front")!;
    expect(front.runSpanIn).toBeCloseTo(24 * Math.sin(Math.PI / 4), 6);
    expect(front.runSpanIn).toBeCloseTo(16.971, 2);
  });

  it("records that literal 17 inch faces do not meet at 45 degrees", () => {
    const closed = equalChordInteriorAngleDegrees(24, BASE_ANGLE_END_FACE_IN);
    const requested = equalChordInteriorAngleDegrees(24, 17);
    expect(closed).toBeCloseTo(135, 6);
    expect(requested).not.toBeNull();
    expect(requested!).toBeGreaterThan(170);
    expect(requested!).toBeLessThan(176);
  });

  it("keeps the outline, toe kick, and countertop off the neighboring cabinet", () => {
    for (const hand of ["right", "left"] as const) {
      const plan = baseAngleEndPlan({ hand });
      expect(baseAngleEndClearsNeighbor(plan)).toBe(true);
      const neighborLimit = hand === "right" ? -12 : 12;
      const shared = plan.vertices.filter((point) => Math.abs(point.x - neighborLimit) < 1e-6);
      expect(shared).toHaveLength(2);
      expect(Math.abs(shared[0]!.z - shared[1]!.z)).toBeCloseTo(24, 6);
      const tops = baseAngleEndCountertopLocalPoints(hand);
      // Overhang leaves the exposed end and the door faces. It stays on the
      // cabinet side of the neighbor (x = 0 for a right-hand end, x = 24 for a left-hand end)
      // and on the room side of the wall (y = 0).
      const neighborX = hand === "right" ? 0 : 24;
      expect(tops.every((point) => (hand === "right" ? point.x >= neighborX - 1e-6 : point.x <= neighborX + 1e-6))).toBe(true);
      expect(tops.every((point) => point.y >= -1e-6)).toBe(true);
    }
  });

  it("mirrors the exposed end without changing side or face lengths", () => {
    const right = baseAngleEndPlan({ hand: "right" });
    const left = baseAngleEndPlan({ hand: "left" });
    expect(left.wallSide.length).toBeCloseTo(right.wallSide.length, 6);
    expect(left.doorFaces.map((face) => face.length)).toEqual(
      right.doorFaces.map((face) => face.length),
    );
    expect(left.vertices[0]!.x).toBeCloseTo(-right.vertices[0]!.x, 6);
    expect(left.doorPitchDegrees).toBeCloseTo(right.doorPitchDegrees, 6);
  });
});
