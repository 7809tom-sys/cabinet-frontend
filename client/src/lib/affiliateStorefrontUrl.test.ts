import { affiliateCatalogPath, affiliateDashboardLinks, affiliateDashboardPath, affiliateDesignerPath, affiliateOrderPath, affiliateOwnerScopeDestination, affiliateStorefrontPath, affiliateStorefrontUrl, copyAffiliateStorefrontLink } from "./affiliateStorefrontUrl";
import { describe, expect, it, vi } from "vitest";

describe("affiliate storefront URLs", () => {
  it("builds an explicit dashboard address for the requested affiliate", () => {
    expect(affiliateDashboardPath(1)).toBe("/affiliate?viewAs=1");
    expect(affiliateDashboardPath(5730001)).toBe("/affiliate?viewAs=5730001");
  });

  it("uses each affiliate's canonical routed production storefront and referral links", () => {
    expect(affiliateDashboardLinks(
      { slug: "firstclass", referralCode: "FIRSTCLASS" },
      "https://www.cabinetdealz.com",
    )).toEqual({
      storefrontUrl: "https://www.cabinetdealz.com/store/firstclass",
      referralUrl: "https://www.cabinetdealz.com/store/firstclass/order?ref=FIRSTCLASS",
    });
    expect(affiliateDashboardLinks(
      { slug: "reaves-way-cabinet-shop", referralCode: "REAVESWAYCABINETSHOP" },
      "https://www.cabinetdealz.com",
    )).toEqual({
      storefrontUrl: "https://www.cabinetdealz.com/store/reaves-way-cabinet-shop",
      referralUrl: "https://www.cabinetdealz.com/store/reaves-way-cabinet-shop/order?ref=REAVESWAYCABINETSHOP",
    });
  });

  it("keeps referral checkout inside the affiliate route on a shared preview origin", () => {
    expect(affiliateDashboardLinks(
      { slug: "firstclass", referralCode: "FIRSTCLASS" },
      "https://preview.manus.com",
    ).referralUrl).toBe("https://preview.manus.com/store/firstclass/order?ref=FIRSTCLASS");
  });

  it("builds the canonical routed storefront path for each affiliate slug", () => {
    expect(affiliateStorefrontPath("firstclass")).toBe("/store/firstclass");
    expect(affiliateStorefrontPath("reaves-way-cabinet-shop")).toBe("/store/reaves-way-cabinet-shop");
  });

  it("keeps affiliate 5730001 in its exact dashboard or its own branded storefront", () => {
    const affiliate = { affiliateId: 5730001, slug: "reaves-way-cabinet-shop" };
    expect(affiliateOwnerScopeDestination({ pathname: "/", search: "", ...affiliate })).toBe("/affiliate?viewAs=5730001");
    expect(affiliateOwnerScopeDestination({ pathname: "/admin", search: "?tab=affiliates&affiliateId=5730001", ...affiliate })).toBe("/affiliate?viewAs=5730001");
    expect(affiliateOwnerScopeDestination({ pathname: "/affiliate", search: "?section=orders", ...affiliate })).toBe("/affiliate?viewAs=5730001&section=orders");
    expect(affiliateOwnerScopeDestination({ pathname: "/affiliate", search: "?viewAs=5730001", ...affiliate })).toBeNull();
    expect(affiliateOwnerScopeDestination({ pathname: "/store/reaves-way-cabinet-shop/design", search: "", ...affiliate })).toBeNull();
    expect(affiliateOwnerScopeDestination({ pathname: "/store/another-affiliate", search: "", ...affiliate })).toBe("/affiliate?viewAs=5730001");
  });

  it("keeps catalog, designer, and quote destinations inside the affiliate storefront", () => {
    expect(affiliateCatalogPath("spartan-city-cabinet")).toBe("/store/spartan-city-cabinet/catalog");
    expect(affiliateDesignerPath("spartan-city-cabinet")).toBe("/store/spartan-city-cabinet/design");
    expect(affiliateOrderPath("spartan-city-cabinet")).toBe("/store/spartan-city-cabinet/order");
  });

  it("uses the active application origin and never emits a legacy subdomain URL", () => {
    expect(affiliateStorefrontUrl("reaves-way-cabinet-shop", "https://www.cabinetdealz.com/")).toBe(
      "https://www.cabinetdealz.com/store/reaves-way-cabinet-shop"
    );
    expect(affiliateStorefrontUrl("firstclass", "https://preview.manus.com")).toBe(
      "https://preview.manus.com/store/firstclass"
    );
  });

  it("copies the canonical storefront URL for the selected affiliate row", async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };

    await copyAffiliateStorefrontLink("reaves-way-cabinet-shop", {
      origin: "https://www.cabinetdealz.com",
      clipboard,
    });

    expect(clipboard.writeText).toHaveBeenCalledWith(
      "https://www.cabinetdealz.com/store/reaves-way-cabinet-shop"
    );
  });
});
