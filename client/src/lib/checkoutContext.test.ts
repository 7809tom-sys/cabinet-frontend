import { describe, expect, it } from "vitest";
import { checkoutUsesReadOnlyContext, resolveCheckoutTier } from "./checkoutContext";

describe("checkout context", () => {
  it("preserves a selected tier and otherwise applies the authenticated account tier", () => {
    expect(resolveCheckoutTier("Wholesale", "Contractor")).toBe("Wholesale");
    expect(resolveCheckoutTier(undefined, "wholesale")).toBe("Wholesale");
    expect(resolveCheckoutTier(undefined, "homeowner")).toBe("Homeowner");
    expect(resolveCheckoutTier("homeowner", "Contractor")).toBe("Homeowner");
  });

  it("keeps door style and pricing read-only at checkout", () => {
    expect(checkoutUsesReadOnlyContext()).toEqual({ styleEditable: false, pricingEditable: false });
  });
});
