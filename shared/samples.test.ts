import { describe, expect, it } from "vitest";
import {
  canPlaceSampleOrder,
  lineClaimsSample,
  mayExposeSampleToPublicCustomer,
  resolveSampleDoorLink,
  sampleChargePrice,
  sampleOrderAffiliateId,
  sampleOrderingChannelAllowed,
  samplesTabEnabled,
  visibleSampleOrders,
} from "./samples";

const orders = [
  { id: 1, affiliateId: 7, distributorIds: [11] },
  { id: 2, affiliateId: 8, distributorIds: [11, 22] },
  { id: 3, affiliateId: null, distributorIds: [22] },
];

describe("sample ordering access", () => {
  it("refuses a public customer and allows an affiliate and an admin", () => {
    expect(canPlaceSampleOrder({ role: "user" })).toBe(false);
    expect(canPlaceSampleOrder({ role: null })).toBe(false);
    expect(canPlaceSampleOrder({ role: "distributor", affiliateId: null, isAffiliateMember: false })).toBe(false);
    expect(canPlaceSampleOrder({ role: "partner", affiliateId: 7, isAffiliateMember: true })).toBe(true);
    expect(canPlaceSampleOrder({ role: "admin" })).toBe(true);
    expect(() => sampleOrderAffiliateId({ role: "user" }, 7)).toThrow(/PUBLIC_CUSTOMER/);
  });

  it("attributes an affiliate order to that affiliate only", () => {
    const actor = { role: "partner", affiliateId: 7, isAffiliateMember: true };
    expect(sampleOrderAffiliateId(actor, 8)).toBe(7);
    expect(visibleSampleOrders(orders, { role: "affiliate", affiliateId: 7 }).map((order) => order.id)).toEqual([1]);
    expect(visibleSampleOrders(orders, { role: "customer" })).toEqual([]);
    expect(visibleSampleOrders(orders, { role: "vendor", distributorId: 22 }).map((order) => order.id)).toEqual([2, 3]);
    expect(visibleSampleOrders(orders, { role: "vendor", distributorId: 11 }).map((order) => order.id)).toEqual([1, 2]);
  });

  it("keeps samples off the public storefront and cart", () => {
    expect(mayExposeSampleToPublicCustomer("storefront")).toBe(false);
    expect(mayExposeSampleToPublicCustomer("cart")).toBe(false);
    expect(sampleOrderingChannelAllowed("cart")).toBe(false);
    expect(sampleOrderingChannelAllowed("backoffice")).toBe(true);
    expect(lineClaimsSample({ masterCode: "SD" })).toBe(true);
    expect(lineClaimsSample({ masterCode: "B24" })).toBe(false);
  });

  it("links an existing sample door instead of inventing one", () => {
    const catalog = [
      { id: 5, masterCode: "SD", distributorId: 11, showInDesigner: false, showInCatalog: false },
      { id: 6, masterCode: "B24", distributorId: 11, showInDesigner: true, showInCatalog: true },
      { id: 7, masterCode: "SD", distributorId: 22, showInDesigner: false, showInCatalog: false },
    ];
    expect(resolveSampleDoorLink(catalog, 11, null)).toEqual({ cabinetId: 5, masterCode: "SD" });
    expect(resolveSampleDoorLink(catalog, 11, "B24")).toBeNull();
    expect(resolveSampleDoorLink(catalog, 99, "SD")).toBeNull();
  });

  it("charges the entered price, including free, with no multiplier", () => {
    expect(sampleChargePrice({ price: 25 })).toBe(25);
    expect(sampleChargePrice({ price: 25, free: true })).toBe(0);
    expect(sampleChargePrice({ price: null })).toBe(0);
  });

  it("gates the samples tab to cabinet vendors and the samples feature key", () => {
    expect(samplesTabEnabled({ scope: "dist:11" })).toBe(true);
    expect(samplesTabEnabled({ scope: "pelican" })).toBe(false);
    expect(samplesTabEnabled({ scope: "dist:11", enabledFeatures: [] })).toBe(false);
    expect(samplesTabEnabled({ scope: "dist:11", enabledFeatures: ["samples"] })).toBe(true);
  });
});
