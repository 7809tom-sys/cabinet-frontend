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
  it("returns nothing when the style has no recognised distributor", () => {
    // Tom's rule: don't put something in if you don't know. With no distributor
    // there is no same-distributor door to compare against, so the card shows
    // "No WalzCraft match yet" and an administrator picks by hand. It must never
    // inherit another line's brochure.
    expect(bestCandidateDoor({ ourName: "Torino TWP" })).toBeNull();
  });

  it("still returns a sheet row for a style with a recognised distributor", () => {
    const r = bestCandidateDoor({ ourName: "Shaker White", distributorName: "Faircrest", supplierBrandName: "Faircrest" });
    expect(r?.exact).toBe(false);
    expect(WALZCRAFT_DISTRIBUTOR_DOORS).toContain(r!.door);
    expect(r!.door.distributor).toBe("Faircrest");
  });
});
