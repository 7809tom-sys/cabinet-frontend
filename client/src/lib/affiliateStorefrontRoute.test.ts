import { describe, expect, it } from "vitest";
import { affiliateCabinetHref, affiliateCatalogRootHref, affiliateDesignerHref } from "./affiliateStorefrontRoute";

describe("affiliate storefront detail navigation", () => {
  it("keeps catalog, related product, and designer destinations in the active affiliate storefront", () => {
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { pathname: "/store/reaves-way-cabinet-shop/catalog/W-12-30" } },
    });

    expect(affiliateCatalogRootHref()).toBe("/store/reaves-way-cabinet-shop");
    expect(affiliateCabinetHref("W-21-30", 330005)).toBe("/store/reaves-way-cabinet-shop/catalog/W-21-30?style=330005");
    expect(affiliateDesignerHref(330005)).toBe("/design?affiliate=reaves-way-cabinet-shop&style=330005");

    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  });
});
