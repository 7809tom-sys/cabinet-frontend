import { describe, expect, it } from "vitest";
import { checkoutPresentation } from "./checkoutPresentation";

describe("checkout presentation", () => {
  it("shows the selected style and authenticated pricing tier as read-only context", () => {
    expect(checkoutPresentation("Summit White", "Contractor")).toEqual({
      doorStyle: "Summit White",
      pricingTier: "Contractor",
      styleEditable: false,
      pricingEditable: false,
    });
  });

  it("uses the only remaining valid pricing display for wholesale accounts", () => {
    expect(checkoutPresentation("Aero Black", "Wholesale").pricingTier).toBe("Wholesale");
  });

  it("labels affiliate storefront pricing as Homeowner", () => {
    expect(checkoutPresentation("Green Haven", "Homeowner").pricingTier).toBe("Homeowner");
  });
});
