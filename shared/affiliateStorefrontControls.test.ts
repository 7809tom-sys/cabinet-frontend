import { describe, expect, it } from "vitest";
import {
  buildAffiliateCatalogVendors,
  cabinetProductKey,
  contrastRatio,
  customerLinkVisibility,
  publicContactForStorefront,
  storefrontEditDecision,
  validateWhiteLabelPatch,
  visibleProducts,
} from "./affiliateStorefrontControls";

describe("affiliate catalog navigation", () => {
  it("uses the affiliate's selected cabinet lines and always offers platform catalogs", () => {
    const { vendors, source } = buildAffiliateCatalogVendors([
      { id: 2, name: "Preston", publicName: "Preston", selected: false },
      { id: 9, name: "Fabuwood", publicName: "Fabuwood", selected: true },
    ]);
    expect(source).toBe("affiliate-catalog");
    expect(vendors.map((vendor) => vendor.label)).toEqual([
      "Fabuwood",
      "Hardware Resources",
      "Pelican",
      "Closets (Closet Studio)",
    ]);
  });

  it("keeps every active line when the affiliate has not saved a selection", () => {
    const { vendors } = buildAffiliateCatalogVendors([
      { id: 2, name: "Preston", selected: false },
      { id: 9, name: "Fabuwood", selected: false },
    ]);
    expect(vendors.filter((vendor) => vendor.kind === "cabinet").map((vendor) => vendor.key)).toEqual([
      "distributor:9",
      "distributor:2",
    ]);
  });

  it("falls back to platform catalogs only when distributor data is unavailable", () => {
    const { vendors, source } = buildAffiliateCatalogVendors(null);
    expect(source).toBe("platform-catalogs-only");
    expect(vendors.every((vendor) => vendor.kind !== "cabinet")).toBe(true);
  });
});

describe("customer link visibility", () => {
  it("shows the quote preview to CRM members and the designer preview to designer members", () => {
    expect(customerLinkVisibility({
      isAffiliateOwner: false,
      isAdmin: false,
      canAccessCrm: true,
      canAccessDesigner: false,
    })).toMatchObject({ quote: true, designer: false, showSection: true });
    expect(customerLinkVisibility({
      isAffiliateOwner: false,
      isAdmin: false,
      canAccessCrm: false,
      canAccessDesigner: true,
    })).toMatchObject({ quote: false, designer: true, closet: true });
  });

  it("hides customer links from members with neither CRM nor designer access", () => {
    expect(customerLinkVisibility({
      isAffiliateOwner: false,
      isAdmin: false,
      canAccessCrm: false,
      canAccessDesigner: false,
    }).showSection).toBe(false);
  });
});

describe("catalog visibility isolation", () => {
  const products = [
    { id: "12:B24", name: "B24" },
    { id: "12:W3012", name: "W3012" },
    { id: "4:B24", name: "Other line B24" },
  ];

  it("hides only the product keys recorded for that affiliate", () => {
    const affiliateA = new Set([cabinetProductKey(12, "B24")]);
    const affiliateB = new Set<string>();
    expect(visibleProducts(products, affiliateA, (item) => item.id).map((item) => item.name)).toEqual(["W3012", "Other line B24"]);
    expect(visibleProducts(products, affiliateB, (item) => item.id)).toHaveLength(3);
  });
});

describe("storefront edit permission", () => {
  const member = { affiliateId: 7, isOwner: false, accessDesigner: true };
  const crmOnly = { affiliateId: 7, isOwner: false, accessDesigner: false };

  it("lets an owner or designer edit their own store and blocks every other store", () => {
    expect(storefrontEditDecision({ role: "partner", access: { ...member, isOwner: true }, requestedAffiliateId: 7 }).ok).toBe(true);
    expect(storefrontEditDecision({ role: "partner", access: member }).ok).toBe(true);
    const crossed = storefrontEditDecision({ role: "partner", access: member, requestedAffiliateId: 8 });
    expect(crossed.ok).toBe(false);
    expect(storefrontEditDecision({ role: "partner", access: crmOnly }).ok).toBe(false);
  });

  it("lets an admin target a specific affiliate", () => {
    const decision = storefrontEditDecision({ role: "admin", access: null, requestedAffiliateId: 42 });
    expect(decision).toEqual({ ok: true, affiliateId: 42 });
  });
});

describe("white-label validation and public contact", () => {
  it("accepts a dark primary on white and rejects low-contrast text", () => {
    expect(validateWhiteLabelPatch({ primaryColor: "#123456", fontFamily: "Lato", headingFont: "Montserrat" })).toBeNull();
    expect(contrastRatio("#123456", "#ffffff") ?? 0).toBeGreaterThan(3);
    expect(validateWhiteLabelPatch({ textColor: "#eeeeee", backgroundColor: "#ffffff" })).toMatch(/contrast/i);
    expect(validateWhiteLabelPatch({ fontFamily: "Comic Sans MS" })).toMatch(/preset/i);
  });

  it("does not publish private account email or phone unless the affiliate opts in", () => {
    expect(publicContactForStorefront({
      publicEmail: "private@owner.test",
      publicPhone: "555-0100",
      publicAddress: "1 Main",
      showPublicEmail: false,
      showPublicPhone: false,
      showPublicAddress: false,
      serviceArea: "Sarasota",
    })).toEqual({ email: null, phone: null, address: null, serviceArea: "Sarasota" });
    expect(publicContactForStorefront({
      publicEmail: "hello@shop.test",
      showPublicEmail: true,
      showPublicPhone: false,
      showPublicAddress: false,
    }).email).toBe("hello@shop.test");
  });
});
