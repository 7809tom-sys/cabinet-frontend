import { describe, expect, it } from "vitest";
import { placedCornerGeometryKind, type PlacedCabinet } from "@/lib/design";
import { planCabinetClipPath, planCabinetRenderFrame, planCornerGeometry, planDiagonalFrontPath, planLazySusanTwoFrontPath } from "./PlanCanvas";

describe("PlanCanvas shared corner geometry", () => {
  it("uses the persisted WDC2430 diagonal classification instead of drawing a square or triangle", () => {
    const wdc: PlacedCabinet = {
      uid: "wdc2430",
      cabinetId: 2430,
      masterCode: "WDC2430",
      description: "24 inch Diagonal Wall Corner Cabinet",
      placement: "wall",
      x: 0,
      y: 0,
      width: 24,
      depth: 12,
      height: 30,
      rotation: 0,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      cornerType: null,
    };

    expect(placedCornerGeometryKind(wdc)).toBe("diagonal");
    expect(planCornerGeometry(wdc)).toMatchObject({
      isDiagonal: true,
      isTriangle: false,
      isBlind: false,
      isConfiguredL: false,
    });
    expect(planCabinetClipPath(wdc, { width: 144, depth: 120 })).toBe(
      "polygon(0 0, 100% 0, 100% 50%, 50% 100%, 0 100%)",
    );
    expect(planDiagonalFrontPath(wdc, { width: 144, depth: 120 })).toBe("M100 50L50 100");
  });

  it("uses LS36's saved lazy-Susan record as the restored 36-inch L-corner footprint", () => {
    const ls36: PlacedCabinet = {
      uid: "ls3612",
      cabinetId: 3612,
      masterCode: "LS3612",
      description: "36 inch Lazy Susan Base Cabinet",
      placement: "base",
      x: 0,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      cornerType: "lazy-susan",
    };

    expect(placedCornerGeometryKind(ls36)).toBe("l-shape");
    expect(planCornerGeometry(ls36)).toMatchObject({
      isDiagonal: false,
      isTriangle: false,
      isBlind: false,
      isConfiguredL: true,
    });
    expect(planCabinetClipPath(ls36, { width: 144, depth: 120 })).not.toBe(
      "polygon(0 0, 100% 0, 100% 50%, 50% 100%, 0 100%)",
    );
    expect(planDiagonalFrontPath(ls36, { width: 144, depth: 120 })).toBeUndefined();
    expect(planLazySusanTwoFrontPath(ls36)).toBe("M67 67L100 67M67 67L67 100");
  });

  it("keeps BEC-24 as a 24-by-24 Base End Cabinet return without a diagonal or triangle corner clip", () => {
    const bec24: PlacedCabinet = {
      uid: "bec24",
      cabinetId: 24,
      masterCode: "BEC-24",
      description: '24 inch Base End Cabinet',
      placement: "base",
      x: 0,
      y: 0,
      width: 24,
      depth: 24,
      height: 34.5,
      rotation: 0,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      cornerType: null,
      customProfile: "end-return",
      subCategory: "Base End Cabinet",
    };

    expect(placedCornerGeometryKind(bec24)).toBe("base-end");
    expect(planCornerGeometry(bec24)).toMatchObject({
      isDiagonal: false,
      isTriangle: false,
      isBlind: false,
      isConfiguredL: false,
    });
    expect(planCabinetClipPath(bec24, { width: 144, depth: 120 })).toBeUndefined();
    expect(planDiagonalFrontPath(bec24, { width: 144, depth: 120 })).toBeUndefined();
  });

  it("centers a diagonally seated ERB36 on its rotated physical footprint so one rear corner reaches the shared vertex", () => {
    const side = 36;
    const diagonalBound = side * Math.SQRT2;
    const erb: PlacedCabinet = {
      uid: "erb36-diagonal-corner",
      cabinetId: 36,
      masterCode: "ERB36",
      description: "Easy Reach Corner Base 36",
      placement: "base",
      // Bounding-box origin for a 36×36 body rotated 135° around (74.544, 100).
      x: 74.5441558772843 - diagonalBound / 2,
      y: 100 - diagonalBound / 2,
      width: side,
      depth: side,
      height: 34.5,
      rotation: 135,
      wallId: "measured-diagonal-wall",
      wallOffset: 0,
      numberOfDoors: 2,
      numberOfDrawers: 0,
    };
    const frame = planCabinetRenderFrame(erb);
    expect(frame).toMatchObject({ lockedAngledRun: true, bodyW: side, bodyD: side });
    const center = { x: frame.bodyLeft + frame.bodyW / 2, y: frame.bodyTop + frame.bodyD / 2 };
    const radians = erb.rotation * Math.PI / 180;
    const vertices = [-1, 1].flatMap((xSign) => [-1, 1].map((ySign) => ({
      x: center.x + (xSign * side / 2) * Math.cos(radians) - (ySign * side / 2) * Math.sin(radians),
      y: center.y + (xSign * side / 2) * Math.sin(radians) + (ySign * side / 2) * Math.cos(radians),
    })));
    expect(vertices.some((vertex) => Math.hypot(vertex.x - 100, vertex.y - 100) < 0.001)).toBe(true);
  });

  it("keeps the ERB36 L-notch in its local frame before rotating a measured diagonal corner", () => {
    const erb: PlacedCabinet = {
      uid: "erb36-v-corner",
      cabinetId: 36,
      masterCode: "ERB36",
      description: "Easy Reach Corner Base 36",
      placement: "base",
      x: 74.5441558772843,
      y: 149.08831175456856,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 225,
      wallId: "left-leg",
      wallOffset: 34.71067811865476,
    };
    expect(planCabinetClipPath(erb, { width: 180, depth: 220, ceilingHeight: 96 })).toBe(
      "polygon(0 0, 100% 0, 100% 67%, 67% 67%, 67% 100%, 0 100%)",
    );
  });
});
