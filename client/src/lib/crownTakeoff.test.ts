import { describe, expect, it } from "vitest";
import { CROWN_MITER_CUT_ALLOWANCE_IN, crownTakeoffFromExposedSegments } from "./crownTakeoff";
import { trimPiecesNeeded } from "./design";

describe("crownTakeoffFromExposedSegments", () => {
  it("adds four inches to both 45-degree cut edges at each exposed outside corner", () => {
    const takeoff = crownTakeoffFromExposedSegments([
      { start: { x: 12, z: 0 }, end: { x: 12, z: 12 } },
      { start: { x: 12, z: 12 }, end: { x: 0, z: 12 } },
      { start: { x: 0, z: 12 }, end: { x: 0, z: 0 } },
    ]);

    expect(CROWN_MITER_CUT_ALLOWANCE_IN).toBe(4);
    expect(takeoff.rawLinearInches).toBe(36);
    expect(takeoff.exposedMiterCornerCount).toBe(2);
    expect(takeoff.miterCutEnds).toBe(4);
    expect(takeoff.miterAllowanceInches).toBe(16);
    expect(takeoff.totalLinearInches).toBe(52);
  });

  it("does not add an allowance at a straight cabinet-to-cabinet crown join", () => {
    const takeoff = crownTakeoffFromExposedSegments([
      { start: { x: 0, z: 12 }, end: { x: 12, z: 12 } },
      { start: { x: 12, z: 12 }, end: { x: 24, z: 12 } },
    ]);

    expect(takeoff.exposedMiterCornerCount).toBe(0);
    expect(takeoff.totalLinearInches).toBe(24);
  });

  it("keeps disconnected crown runs separate without inventing miter allowance", () => {
    const takeoff = crownTakeoffFromExposedSegments([
      { start: { x: 0, z: 12 }, end: { x: 12, z: 12 } },
      { start: { x: 24, z: 12 }, end: { x: 36, z: 12 } },
    ]);

    expect(takeoff.exposedMiterCornerCount).toBe(0);
    expect(takeoff.totalLinearInches).toBe(24);
  });

  it("raises the 96-inch stock order when several exposed outside corners require miter cut length", () => {
    const takeoff = crownTakeoffFromExposedSegments([
      { start: { x: 0, z: 0 }, end: { x: 42, z: 0 } },
      { start: { x: 42, z: 0 }, end: { x: 42, z: 50 } },
      { start: { x: 42, z: 50 }, end: { x: -4, z: 50 } },
      { start: { x: -4, z: 50 }, end: { x: -4, z: 0 } },
      { start: { x: -4, z: 0 }, end: { x: 38, z: 0 } },
    ]);

    expect(takeoff.rawLinearInches).toBe(230);
    expect(takeoff.exposedMiterCornerCount).toBe(4);
    expect(takeoff.miterAllowanceInches).toBe(32);
    expect(trimPiecesNeeded(takeoff.totalLinearInches).pieces).toBe(4);
  });
});
