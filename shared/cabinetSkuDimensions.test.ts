import { describe, expect, it } from "vitest";
import { baseCabinetSkuDimensions, cabinetSkuDimensions, wallCabinetSkuDimensions } from "./cabinetSkuDimensions";

describe("wall cabinet codes", () => {
  it("reads W3024 as 30 wide × 24 high × 12 deep", () => {
    expect(wallCabinetSkuDimensions("W3024")).toEqual({ width: 30, height: 24, depth: 12 });
  });

  it("matches the Designer's own shapes", () => {
    expect(wallCabinetSkuDimensions("W-36-24")).toEqual({ width: 36, height: 24, depth: 12 });
    expect(wallCabinetSkuDimensions("W3012")).toEqual({ width: 30, height: 12, depth: 12 });
    expect(wallCabinetSkuDimensions("W3024GD")).toEqual({ width: 30, height: 24, depth: 12 });
    expect(wallCabinetSkuDimensions("W302424")).toEqual({ width: 30, height: 24, depth: 24 });
    expect(wallCabinetSkuDimensions("WR3024")).toEqual({ width: 30, height: 24, depth: 24 });
  });

  it("tolerates a vendor prefix and lower case", () => {
    expect(wallCabinetSkuDimensions("cs-w3024")).toEqual({ width: 30, height: 24, depth: 12 });
  });

  it("refuses a code it cannot read unambiguously", () => {
    expect(wallCabinetSkuDimensions("W30")).toBeNull();
    expect(wallCabinetSkuDimensions("WALL-30")).toBeNull();
    expect(wallCabinetSkuDimensions("")).toBeNull();
    expect(wallCabinetSkuDimensions(null)).toBeNull();
  });
});

describe("base cabinet codes", () => {
  it("uses the standard 24-inch depth and 34.5-inch height", () => {
    expect(baseCabinetSkuDimensions("B24")).toEqual({ width: 24, height: 34.5, depth: 24 });
    expect(baseCabinetSkuDimensions("B30FH")).toEqual({ width: 30, height: 34.5, depth: 24 });
    expect(baseCabinetSkuDimensions("3DB18")).toEqual({ width: 18, height: 34.5, depth: 24 });
  });

  it("refuses anything else", () => {
    expect(baseCabinetSkuDimensions("B")).toBeNull();
    expect(baseCabinetSkuDimensions("W3024")).toBeNull();
  });
});

describe("either shape", () => {
  it("prefers the wall reading and falls back to base", () => {
    expect(cabinetSkuDimensions("W3024")).toEqual({ width: 30, height: 24, depth: 12 });
    expect(cabinetSkuDimensions("B24")).toEqual({ width: 24, height: 34.5, depth: 24 });
    expect(cabinetSkuDimensions("XYZ-1")).toBeNull();
  });
});
