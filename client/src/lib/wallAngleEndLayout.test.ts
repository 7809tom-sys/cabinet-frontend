import { describe, expect, it } from "vitest";
import {
  isWallAngleEndCabinet,
  wallAngleEndClipPath,
  wallAngleEndHandFromRun,
  wallAngleEndPlan,
} from "./wallAngleEndLayout";

describe("wall angle end cabinet", () => {
  it("recognizes WAC sizes and AW aliases without treating corners or base angle cabinets as one", () => {
    for (const masterCode of ["WAC1230", "WAC1236", "WAC1242", "WAC-12-30", "AW1230", "AW1236", "AW1242", "AW-12-36"]) {
      expect(isWallAngleEndCabinet({ masterCode, description: "Wall Angle Cabinet" })).toBe(true);
    }
    expect(isWallAngleEndCabinet({ masterCode: "CUSTOM", graphicType: "wall_angle" })).toBe(true);
    expect(isWallAngleEndCabinet({ masterCode: "CUSTOM", customProfile: "angled-wall" })).toBe(true);
    expect(isWallAngleEndCabinet({ masterCode: "X-9", description: "24in Angled Wall unit" })).toBe(true);
    expect(isWallAngleEndCabinet({ masterCode: "BA-24", description: "Base End Cabinet" })).toBe(false);
    expect(isWallAngleEndCabinet({ masterCode: "BEC24", description: "Quarter-Octagon Base End" })).toBe(false);
    expect(isWallAngleEndCabinet({ masterCode: "BAC24", description: "Base Angle Cabinet" })).toBe(false);
    expect(isWallAngleEndCabinet({ masterCode: "WDC2430", description: "Diagonal Wall Corner" })).toBe(false);
    expect(isWallAngleEndCabinet({ masterCode: "DCW-24-30", description: "Diagonal Corner Wall" })).toBe(false);
    expect(isWallAngleEndCabinet({ masterCode: "W3030", description: "Wall Cabinet" })).toBe(false);
  });

  it("keeps the back flat on the wall and tapers the door toward the open end", () => {
    for (const hand of ["right", "left"] as const) {
      const plan = wallAngleEndPlan({ widthIn: 12, depthIn: 12, hand });
      expect(plan.wallSide.length).toBeCloseTo(12, 6);
      expect(plan.neighborSide.length).toBeCloseTo(12, 6);
      expect(plan.doorFace.length).toBeCloseTo(12 * Math.SQRT2, 6);
      expect(plan.wallSide.start.z).toBeCloseTo(-6, 6);
      expect(plan.wallSide.end.z).toBeCloseTo(-6, 6);
      expect(plan.doorFace.outward.z).toBeGreaterThan(0.5);
      const sign = hand === "right" ? 1 : -1;
      expect(plan.neighborSide.start.x).toBeCloseTo(-sign * 6, 6);
      expect(plan.neighborSide.end.x).toBeCloseTo(-sign * 6, 6);
      expect(plan.vertices.some((point) => Math.abs(point.x - sign * 6) < 1e-6 && Math.abs(point.z - 6) < 1e-6)).toBe(false);
      expect(plan.vertices.some((point) => Math.abs(point.x + sign * 6) < 1e-6 && Math.abs(point.z - 6) < 1e-6)).toBe(true);
    }
  });

  it("mirrors left and right without changing side or door length", () => {
    const right = wallAngleEndPlan({ hand: "right" });
    const left = wallAngleEndPlan({ hand: "left" });
    expect(left.wallSide.length).toBeCloseTo(right.wallSide.length, 6);
    expect(left.neighborSide.length).toBeCloseTo(right.neighborSide.length, 6);
    expect(left.doorFace.length).toBeCloseTo(right.doorFace.length, 6);
    expect(left.doorFace.outward.x).toBeCloseTo(-right.doorFace.outward.x, 6);
    expect(left.doorFace.outward.z).toBeCloseTo(right.doorFace.outward.z, 6);
    expect(left.doorFace.rotationY).toBeCloseTo(-Math.PI / 4, 6);
    expect(right.doorFace.rotationY).toBeCloseTo(Math.PI / 4, 6);
  });

  it("maps an open run end onto the viewer's right for every cardinal wall", () => {
    const walls = [
      { facingRotation: 0, tangent: { x: 1, y: 0 }, openOnViewerRight: "end" as const },
      { facingRotation: 180, tangent: { x: 1, y: 0 }, openOnViewerRight: "start" as const },
      { facingRotation: 270, tangent: { x: 0, y: 1 }, openOnViewerRight: "start" as const },
      { facingRotation: 90, tangent: { x: 0, y: 1 }, openOnViewerRight: "end" as const },
    ];
    for (const wall of walls) {
      expect(wallAngleEndHandFromRun({
        openSide: wall.openOnViewerRight,
        tangent: wall.tangent,
        facingRotation: wall.facingRotation,
      })).toBe("right");
      expect(wallAngleEndHandFromRun({
        openSide: wall.openOnViewerRight === "end" ? "start" : "end",
        tangent: wall.tangent,
        facingRotation: wall.facingRotation,
      })).toBe("left");
    }
  });

  it("clips the right-end plan with the wall on the back of a front-facing div", () => {
    expect(wallAngleEndClipPath({ hand: "right", facingRotation: 0 })).toBe("polygon(0% 0%, 0% 100%, 100% 0%)");
    expect(wallAngleEndClipPath({ hand: "left", facingRotation: 0 })).toBe("polygon(100% 0%, 100% 100%, 0% 0%)");
    expect(wallAngleEndClipPath({ hand: "right", facingRotation: 180 })).toBe("polygon(100% 100%, 100% 0%, 0% 100%)");
  });
});
