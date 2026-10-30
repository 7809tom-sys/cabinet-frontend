import { describe, expect, it } from "vitest";
import { resolvePricingFor, visiblePricesForViewer } from "./pricingTier";

const row = {
  listPrice: "100",
  wholesalePrice: "40",
  contractorPrice: "55",
  homeownerPrice: "80",
};

describe("resolvePricingFor", () => {
  it("gives an approved contractor the trade column and hides it from customers", () => {
    expect(resolvePricingFor({ role: "contractor", pricingTier: "homeowner" })).toMatchObject({
      audience: "contractor",
      tier: "contractor",
      canSeeTradePricing: true,
    });
    expect(resolvePricingFor({ role: "user", pricingTier: "homeowner" })).toMatchObject({
      audience: "customer",
      tier: "homeowner",
      canSeeTradePricing: false,
    });
    expect(resolvePricingFor(null).canSeeTradePricing).toBe(false);
  });

  it("keeps affiliate tier selection on the assigned pricing tier", () => {
    expect(resolvePricingFor({ role: "partner", pricingTier: "wholesale" }).tier).toBe("wholesale");
    expect(resolvePricingFor({ role: "partner", pricingTier: "homeowner" })).toMatchObject({
      audience: "affiliate",
      tier: "homeowner",
    });
  });

  it("nulls trade prices in the response for a customer and keeps the contractor price for a contractor", () => {
    const customer = visiblePricesForViewer(row, resolvePricingFor({ role: "user" }).tier, false);
    const contractor = visiblePricesForViewer(row, resolvePricingFor({ role: "contractor" }).tier, false);
    expect(customer.contractorPrice).toBeNull();
    expect(customer.wholesalePrice).toBeNull();
    expect(customer.homeownerPrice).toBe("80");
    expect(contractor.contractorPrice).toBe("55");
    expect(contractor.wholesalePrice).toBeNull();
  });
});
