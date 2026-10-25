import { describe, it, expect } from "vitest";
import {
  categorySlug,
  categoryFromSlug,
  formatPrice,
  pelicanCategoryLabel,
  pelicanDepartmentFromSlug,
  pelicanDisplayName,
  pelicanFamilyHref,
  pelicanPricePresentation,
  pelicanProductType,
  isPelicanDesignerPaletteAvailable,
  surfaceRole,
  PELICAN_STOREFRONT_CATEGORIES,
} from "./pelican";

describe("pelican storefront helpers", () => {
  it("round-trips every storefront category through slug <-> category", () => {
    for (const cat of PELICAN_STOREFRONT_CATEGORIES) {
      const slug = categorySlug(cat);
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(categoryFromSlug(slug)).toBe(cat);
    }
  });

  it("maps the quartz slug to the full category name", () => {
    expect(categoryFromSlug("quartz")).toBe("Quartz Slabs (Countertops)");
    expect(categorySlug("Quartz Slabs (Countertops)")).toBe("quartz");
  });

  it("returns null for an unknown slug", () => {
    expect(categoryFromSlug("not-a-real-category")).toBeNull();
  });

  it("formats prices as USD and handles missing price", () => {
    expect(formatPrice(1234.5)).toBe("$1,234.50");
    expect(formatPrice(0)).toBe("$0.00");
    expect(formatPrice(null)).toBe("Call for pricing");
    expect(formatPrice(undefined)).toBe("Call for pricing");
  });

  it("keeps raw categories queryable while returning a clear shopper-facing category label", () => {
    expect(categorySlug("Quartz Slabs (Countertops)")).toBe("quartz");
    expect(categoryFromSlug("quartz")).toBe("Quartz Slabs (Countertops)");
    expect(pelicanCategoryLabel("Quartz Slabs (Countertops)")).toBe("Quartz Countertops");
  });

  it("maps a shopper department to existing raw-category family routes", () => {
    const kitchenSurfaces = pelicanDepartmentFromSlug("kitchen-surfaces");
    expect(kitchenSurfaces?.title).toBe("Kitchen Surfaces");
    const flooring = kitchenSurfaces?.families.find((family) => family.title === "Flooring");
    expect(flooring).toBeDefined();
    expect(pelicanFamilyHref(flooring!)).toBe("/surfaces/flooring?family=Planks%20%26%20Flooring");
    expect(pelicanDepartmentFromSlug("cabinets")).toBeNull();
  });

  it("adds a plain-language Pelican product type without changing an authoritative source name", () => {
    const quartz = { name: "Calacatta Oro", category: "Quartz Slabs (Countertops)", subCategory: "Quartz Slab" };
    expect(pelicanProductType(quartz)).toBe("Quartz Countertop Slab");
    expect(pelicanDisplayName(quartz)).toBe("Calacatta Oro");

    const codedSink = { name: "PL-3082", category: "Sinks & Faucets", subCategory: "Sinks" };
    expect(pelicanProductType(codedSink)).toBe("Sink");
    expect(pelicanDisplayName(codedSink)).toBe("PL-3082 — Sink");

    const alreadyClear = { name: "Farmhouse Sink", category: "Sinks & Faucets", subCategory: "Sinks" };
    expect(pelicanDisplayName(alreadyClear)).toBe("Farmhouse Sink");

    const descriptiveFixture = { name: "Farmhouse Reserve 33", category: "Sinks & Faucets", subCategory: "Sinks" };
    expect(pelicanDisplayName(descriptiveFixture)).toBe("Farmhouse Reserve 33");
  });

  it("keeps Pelican cost-reference pricing out of public product presentation", () => {
    expect(pelicanPricePresentation({ sellPrice: 72.56, msrp: "101.25", isAdmin: false })).toEqual({
      referencePrice: null,
      savingsPercent: null,
    });
    expect(pelicanPricePresentation({ sellPrice: 72.56, msrp: "101.25", isAdmin: true })).toEqual({
      referencePrice: 101.25,
      savingsPercent: 28,
    });
  });

  it("shows a Pelican Designer action only for a paid product that the current Designer palette can load", () => {
    expect(isPelicanDesignerPaletteAvailable({
      category: "Sinks & Faucets",
      showInDesigner: true,
      sellPrice: 72.56,
    })).toBe(true);
    expect(isPelicanDesignerPaletteAvailable({
      category: "Range Tops",
      showInDesigner: true,
      sellPrice: 899,
    })).toBe(false);
    expect(isPelicanDesignerPaletteAvailable({
      category: "Sinks & Faucets",
      showInDesigner: false,
      sellPrice: 72.56,
    })).toBe(false);
    expect(isPelicanDesignerPaletteAvailable({
      pelicanCode: "PL-3099 Bone",
      category: "Sinks & Faucets",
      showInDesigner: true,
      sellPrice: 72.56,
    })).toBe(false);
  });
});

describe("surfaceRole (real Pelican storefront categories)", () => {
  it("maps source flooring and legacy flooring picks to flooring", () => {
    expect(surfaceRole({ category: "Flooring", name: "Waterproof LVP Oak" })).toBe("flooring");
    expect(surfaceRole({ category: "Flooring", subCategory: "Planks & Flooring", name: "Aveline 20mil Vinyl Flooring" })).toBe("flooring");
  });

  it("does not treat flooring trim as an installed floor", () => {
    expect(surfaceRole({ category: "Flooring", subCategory: "Moldings & Trim", name: "Aveline T-Molding" })).toBe("other");
    expect(surfaceRole({ category: "Flooring", subCategory: "Moldings & Trim", name: "Astoria Stair Nose" })).toBe("other");
  });

  it("maps the parenthesized quartz category to countertop", () => {
    expect(surfaceRole({ category: "Quartz Slabs (Countertops)", name: "Calacatta Gold" })).toBe(
      "countertop"
    );
  });

  it("maps Tile & Mosaic to backsplash", () => {
    expect(surfaceRole({ category: "Tile & Mosaic", name: "Subway White 3x6" })).toBe("backsplash");
  });

  it("splits the combined Sinks & Faucets line by subCategory", () => {
    expect(
      surfaceRole({ category: "Sinks & Faucets", subCategory: "Sinks", name: "Undermount 32in" })
    ).toBe("sink");
    expect(
      surfaceRole({ category: "Sinks & Faucets", subCategory: "Faucets", name: "Pull-down 1H" })
    ).toBe("faucet");
  });

  it("falls back to the product name when subCategory is missing on the combined line", () => {
    expect(surfaceRole({ category: "Sinks & Faucets", name: "Kitchen Faucet Pull-Down" })).toBe(
      "faucet"
    );
    expect(surfaceRole({ category: "Sinks & Faucets", name: "Farmhouse Sink 33in" })).toBe("sink");
  });

  it("treats accessories/disposals in the combined line as neither sink nor faucet", () => {
    expect(
      surfaceRole({
        category: "Sinks & Faucets",
        subCategory: "Sink & Faucet Accessories",
        name: "Basket Strainer",
      })
    ).toBe("other");
    expect(
      surfaceRole({
        category: "Sinks & Faucets",
        subCategory: "Disposals & Accessories",
        name: "3/4 HP Disposal",
      })
    ).toBe("other");
  });

  it("returns other for non-kitchen surface categories and unknowns", () => {
    expect(surfaceRole({ category: "Shower & Bath", name: "Glass Panel" })).toBe("other");
    expect(surfaceRole({ category: "Toilets & Bidets", name: "Smart Bidet" })).toBe("other");
    expect(surfaceRole({ category: "", name: "" })).toBe("other");
    expect(surfaceRole({})).toBe("other");
  });
});
