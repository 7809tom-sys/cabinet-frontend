import { describe, expect, it } from "vitest";
import { bestCandidateDoor, doorForStyle, WALZCRAFT_DISTRIBUTOR_DOORS } from "./walzcraftDistributorMatches";

describe("bestCandidateDoor", () => {
  it("returns the exact match when doorForStyle finds one", () => {
    const style = { ourName: "Fresh Sage", supplierBrandName: "Faircrest" };
    const exact = doorForStyle(style);
    expect(bestCandidateDoor(style)).toEqual({ door: exact, exact: true });
  });
  it("falls back to a real sheet row within the style's distributor", () => {
    const r = bestCandidateDoor({ ourName: "Shaker Grey", supplierBrandName: "Kitchen Crest" })!;
    expect(r.exact).toBe(false);
    expect(r.door.distributor).toBe("Kitchen Crest");
    expect(WALZCRAFT_DISTRIBUTOR_DOORS).toContain(r.door);
  });
  it("still returns a sheet row when the style has no recognised distributor", () => {
    const r = bestCandidateDoor({ ourName: "Torino TWP" })!;
    expect(r.exact).toBe(false);
    expect(WALZCRAFT_DISTRIBUTOR_DOORS).toContain(r.door);
  });
});
