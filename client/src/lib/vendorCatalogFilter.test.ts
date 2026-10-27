import { describe, expect, it } from "vitest";
import { catalogCategoryKey } from "@shared/catalogCategory";
import {
  ALL_CATEGORIES,
  catalogCategoryOptions,
  isStandaloneCatalogVendor,
  pagedRows,
  portalSectionAfterVendorSwitch,
  selectedCatalogCategory,
  vendorAccountCode,
  vendorShowsProfileOnly,
} from "./vendorCatalogFilter";

describe("catalog category keys", () => {
  it("keeps stored names, including spaces, ampersands, and parentheses", () => {
    expect(catalogCategoryKey("Range Tops")).toBe("Range Tops");
    expect(catalogCategoryKey("  Sinks & Faucets ")).toBe("Sinks & Faucets");
    expect(catalogCategoryKey("Quartz Slabs (Countertops)")).toBe("Quartz Slabs (Countertops)");
    expect(catalogCategoryKey("  ")).toBeNull();
    expect(catalogCategoryKey(null)).toBeNull();
  });

  it("clears All categories instead of falling back to the first category", () => {
    const categories = ["Flooring", "Range Tops", "Sinks & Faucets"];
    expect(selectedCatalogCategory(ALL_CATEGORIES)).toBeUndefined();
    expect(selectedCatalogCategory("")).toBeUndefined();
    expect(selectedCatalogCategory(null)).toBeUndefined();
    expect(selectedCatalogCategory("   ")).toBeUndefined();
    expect(selectedCatalogCategory("Range Tops")).toBe("Range Tops");
    expect(selectedCatalogCategory(ALL_CATEGORIES)).not.toBe(categories[0]);
  });

  it("builds dropdown options from the overview rows and does not invent categories from a page of products", () => {
    expect(catalogCategoryOptions([
      { category: "Flooring", count: 254 },
      { category: "Range Tops", count: 8 },
      { category: "  ", count: 3 },
      { category: "Flooring", count: 1 },
    ])).toEqual([
      { category: "Flooring", count: 254 },
      { category: "Range Tops", count: 8 },
    ]);
  });
});

describe("vendor switching", () => {
  const pelican = { sourceKey: "pelican", linkedDistributor: null };
  const cabinet = { sourceKey: "dist:12", linkedDistributor: { id: 12, code: "USCD" } };
  const profileOnly = { sourceKey: null, linkedDistributor: null };

  it("keeps the current section for a Pelican-type vendor and does not label it profile only", () => {
    expect(isStandaloneCatalogVendor(pelican)).toBe(true);
    expect(vendorShowsProfileOnly(pelican)).toBe(false);
    expect(vendorAccountCode(pelican)).toBe("PEL");
    expect(portalSectionAfterVendorSwitch("catalog", pelican)).toBe("catalog");
    expect(portalSectionAfterVendorSwitch("shipping", pelican)).toBe("shipping");
    expect(portalSectionAfterVendorSwitch("featured-styles", pelican)).toBe("overview");
  });

  it("keeps a cabinet vendor on its current section and still sends a profile-only vendor to Supplier Profile", () => {
    expect(portalSectionAfterVendorSwitch("featured-styles", cabinet)).toBe("featured-styles");
    expect(vendorShowsProfileOnly(cabinet)).toBe(false);
    expect(vendorAccountCode(cabinet)).toBe("USCD");
    expect(portalSectionAfterVendorSwitch("catalog", profileOnly)).toBe("supplier-profile");
    expect(vendorShowsProfileOnly(profileOnly)).toBe(true);
    expect(vendorAccountCode(profileOnly)).toBe("PROFILE");
  });
});

describe("paged catalog payloads", () => {
  it("reads a legacy array and a paged object", () => {
    expect(pagedRows([{ id: 1 }])).toEqual({ items: [{ id: 1 }], total: null });
    expect(pagedRows({ items: [{ id: 2 }], total: 40 })).toEqual({ items: [{ id: 2 }], total: 40 });
    expect(pagedRows(null)).toEqual({ items: [], total: null });
  });
});
