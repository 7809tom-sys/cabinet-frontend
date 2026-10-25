import { describe, expect, it } from "vitest";
import { MAX_PREFERRED_PRODUCTS_PER_CATEGORY, preferredCategoryForCatalogProduct, preferredReplacementCandidate, type PreferredProduct } from "./PreferredProductsContext";

describe("PreferredProductsContext catalog classification", () => {
  it("keeps the six-product customer limit per supported category", () => {
    expect(MAX_PREFERRED_PRODUCTS_PER_CATEGORY).toBe(6);
  });

  it("classifies only exact eligible catalog product categories", () => {
    expect(preferredCategoryForCatalogProduct({ category: "Flooring", subCategory: "Planks & Flooring" })).toBe("flooring");
    expect(preferredCategoryForCatalogProduct({ category: "Quartz Slabs (Countertops)", subCategory: null })).toBe("countertop");
    expect(preferredCategoryForCatalogProduct({ category: "Tile & Mosaic", subCategory: "Wall Tile" })).toBe("backsplash");
    expect(preferredCategoryForCatalogProduct({ category: "Sinks & Faucets", subCategory: "Faucets" })).toBe("faucet");
    expect(preferredCategoryForCatalogProduct({ category: "Sinks & Faucets", subCategory: "Kitchen Sinks" })).toBe("sink");
    expect(preferredCategoryForCatalogProduct({ category: "Shower & Bath", subCategory: "Showers" })).toBeNull();
  });

  it("uses the oldest same-category Preferred product as the explicit replacement candidate", () => {
    const products = [
      { id: 1, name: "First floor", category: "flooring" },
      { id: 2, name: "Countertop", category: "countertop" },
      { id: 3, name: "Second floor", category: "flooring" },
    ] as PreferredProduct[];
    expect(preferredReplacementCandidate(products, "flooring")).toMatchObject({ id: 1, name: "First floor" });
    expect(preferredReplacementCandidate(products, "backsplash")).toBeNull();
  });
});
