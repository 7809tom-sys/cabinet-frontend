import { describe, expect, it } from "vitest";
import { normalizeDesignPricingTier } from "./designPricingTier";

describe("normalizeDesignPricingTier", () => {
  it("maps legacy retail drafts to the matching Homeowner tier", () => {
    expect(normalizeDesignPricingTier("retail")).toBe("Homeowner");
    expect(normalizeDesignPricingTier("Retail")).toBe("Homeowner");
  });

  it("keeps valid current persisted tiers", () => {
    expect(normalizeDesignPricingTier("Homeowner")).toBe("Homeowner");
    expect(normalizeDesignPricingTier("Contractor")).toBe("Contractor");
    expect(normalizeDesignPricingTier("Wholesale")).toBe("Wholesale");
  });

  it("never passes an invalid tier into the price resolver", () => {
    expect(normalizeDesignPricingTier("trade-retail")).toBe("Homeowner");
    expect(normalizeDesignPricingTier(null, "Contractor")).toBe("Contractor");
  });
});
