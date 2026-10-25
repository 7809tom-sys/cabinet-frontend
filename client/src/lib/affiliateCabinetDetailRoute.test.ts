import { describe, expect, it } from "vitest";
import { affiliateCabinetDetailHref } from "./affiliateCabinetDetailRoute";

describe("affiliate cabinet detail routes", () => {
  it("keeps product detail navigation inside the affiliate storefront and preserves the selected style", () => {
    expect(affiliateCabinetDetailHref({
      slug: "reaves-way-cabinet-shop",
      masterCode: "W-12-30",
      styleId: 330005,
    })).toBe("/store/reaves-way-cabinet-shop/catalog/W-12-30?style=330005");
  });

  it("uses the normal detail route when no storefront is active", () => {
    expect(affiliateCabinetDetailHref({ masterCode: "B 24", styleId: 7 }))
      .toBe("/catalog/B%2024?style=7");
  });

  it("preserves the exact cabinet record when matching SKU text is duplicated", () => {
    expect(affiliateCabinetDetailHref({
      slug: "reaves-way-cabinet-shop",
      masterCode: "W-12-30",
      styleId: 330005,
      cabinetId: 9360055,
    })).toBe("/store/reaves-way-cabinet-shop/catalog/W-12-30?style=330005&cabinetId=9360055");
  });
});
