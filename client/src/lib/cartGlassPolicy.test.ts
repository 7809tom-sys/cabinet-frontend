import { describe, expect, it } from "vitest";
import { requiresSeparateGlassPurchase, separateGlassPurchaseItems } from "./cartGlassPolicy";

describe("cart glass purchase warnings", () => {
  it("warns only for an explicit separate-glass distributor policy on glass nomenclature", () => {
    expect(requiresSeparateGlassPurchase({ masterCode: "W2430GD", glassIncluded: false })).toBe(true);
    expect(requiresSeparateGlassPurchase({ masterCode: "W2430PG", glassIncluded: false })).toBe(true);
    expect(requiresSeparateGlassPurchase({ masterCode: "W2430G", glassIncluded: false })).toBe(true);
    expect(requiresSeparateGlassPurchase({ masterCode: "W2430", glassIncluded: false })).toBe(false);
    expect(requiresSeparateGlassPurchase({ masterCode: "W2430GD", glassIncluded: true })).toBe(false);
    expect(requiresSeparateGlassPurchase({ masterCode: "W2430GD", glassIncluded: null })).toBe(false);
  });

  it("returns every separate-glass cabinet for one cart-wide warning", () => {
    expect(separateGlassPurchaseItems([
      { masterCode: "W2430GD", glassIncluded: false },
      { masterCode: "W2430", glassIncluded: false },
      { masterCode: "W3015PG", glassIncluded: true },
      { masterCode: "W3612G", glassIncluded: false },
    ]).map((item) => item.masterCode)).toEqual(["W2430GD", "W3612G"]);
  });
});
