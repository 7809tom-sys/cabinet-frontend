import { describe, expect, it } from "vitest";
import { canonicalCabinetDetailCode, isBlindCornerCode } from "./CabinetDetail";

describe("merged cabinet detail aliases", () => {
  it("routes both retained legacy codes through canonical BEC-24 without changing ordinary codes", () => {
    expect(canonicalCabinetDetailCode("BEC-24")).toBe("BEC-24");
    expect(canonicalCabinetDetailCode("BA-24")).toBe("BEC-24");
    expect(canonicalCabinetDetailCode("bec24")).toBe("BEC-24");
    expect(canonicalCabinetDetailCode("BMC30")).toBe("BMC30");
  });

  it("shows blind-corner guidance only for blind-corner products, not easy-reach openings", () => {
    expect(isBlindCornerCode("BBC36", "Blind Corner Base Cabinet")).toBe(true);
    expect(isBlindCornerCode("LSB36ADA", "ADA Easy Reach Corner Base with Lazy Susan Trays")).toBe(false);
    expect(isBlindCornerCode("BER36ADA", "ADA Easy Reach Corner Base")).toBe(false);
  });
});
