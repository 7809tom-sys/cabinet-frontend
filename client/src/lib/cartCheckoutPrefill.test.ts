import { describe, expect, it } from "vitest";
import type { CartItem } from "@/contexts/CartContext";
import {
  applyCartCheckoutPrefill,
  cartItemToCheckoutPrefill,
  isSurfaceCheckoutPrefill,
} from "./cartCheckoutPrefill";

const unmatched = {
  rawCode: "PEL-404",
  normalized: "PEL404",
  qty: 2,
  cabinetId: null,
  masterCode: null,
  description: null,
  matched: false,
  confidence: "none" as const,
};

describe("cart checkout surface prefill", () => {
  it("preserves the selected countertop identity and locked slab price in the cart handoff", () => {
    const item: CartItem = {
      masterCode: "PEL-404",
      name: "Calacatta Quartz Slab",
      styleId: -404,
      styleLabel: 'Quartz Slabs (Countertops) · 126" x 63"',
      distributorId: null,
      tier: "homeowner",
      unitPrice: 1200,
      priceLocked: true,
      productKind: "surface",
      pelicanProductId: 404,
      category: "Quartz Slabs (Countertops)",
      qty: 2,
    };
    expect(cartItemToCheckoutPrefill(item, 1200)).toMatchObject({
      code: "PEL-404",
      qty: 2,
      unitPrice: 1200,
      priceLocked: true,
      name: "Calacatta Quartz Slab",
      productKind: "surface",
      pelicanProductId: 404,
    });
  });

  it("turns the intentionally namespaced PEL line into a valid selected product instead of an unmatched cabinet", () => {
    const result = applyCartCheckoutPrefill(unmatched, {
      code: "PEL-404",
      qty: 2,
      styleId: -404,
      distributorId: null,
      tier: "homeowner",
      unitPrice: 1200,
      priceLocked: true,
      name: "Calacatta Quartz Slab",
      category: "Quartz Slabs (Countertops)",
      productKind: "surface",
      pelicanProductId: 404,
    });
    expect(result).toMatchObject({
      cabinetId: null,
      masterCode: "PEL-404",
      description: "Calacatta Quartz Slab",
      matched: true,
      confidence: "exact",
      cartUnitPrice: 1200,
      cartPriceLocked: true,
      cartProductKind: "surface",
      cartPelicanProductId: 404,
    });
  });

  it("clears an accidental cabinet match from an authoritative surface product", () => {
    const result = applyCartCheckoutPrefill({
      ...unmatched,
      cabinetId: 9390001,
      masterCode: "B24",
      matched: true,
      confidence: "fuzzy" as const,
    }, {
      code: "Pallum 3cm Super Jumbo",
      qty: 1,
      distributorId: null,
      unitPrice: 2430,
      priceLocked: true,
      category: "Quartz Slabs (Countertops)",
      productKind: "surface",
    });
    expect(result).toMatchObject({
      cabinetId: null,
      masterCode: "Pallum 3cm Super Jumbo",
      matched: true,
      confidence: "exact",
      cartProductKind: "surface",
    });
  });

  it("recognizes legacy PEL cart lines even before productKind was persisted", () => {
    expect(isSurfaceCheckoutPrefill({
      code: "PEL-404",
      qty: 1,
      distributorId: null,
      unitPrice: 1200,
      priceLocked: true,
    })).toBe(true);
  });

  it("recognizes legacy direct-catalog Pelican codes with an approved price and category", () => {
    const item = {
      code: "Pallum 3cm Super Jumbo",
      qty: 1,
      distributorId: null,
      unitPrice: 2430,
      priceLocked: false,
      category: "Quartz Slabs (Countertops)",
    };
    expect(isSurfaceCheckoutPrefill(item)).toBe(true);
    expect(applyCartCheckoutPrefill({
      ...unmatched,
      rawCode: item.code,
      normalized: item.code,
    }, item)).toMatchObject({
      matched: true,
      cartProductKind: "surface",
      cartPriceLocked: true,
      cartUnitPrice: 2430,
    });
  });

  it("preserves an exact priced Hardware Resources variant for authoritative server re-pricing", () => {
    const item: CartItem = {
      masterCode: "5319BG",
      name: "KEYGRANDE Bar pull — 14-1/8-inch Overall Length",
      styleId: -3900179,
      styleLabel: "Brushed Gold",
      distributorId: null,
      tier: "homeowner",
      unitPrice: 9.8,
      priceLocked: true,
      productKind: "hardware",
      vendorProductId: 3900179,
      category: "Handles & hardware",
      qty: 38,
    };
    expect(cartItemToCheckoutPrefill(item, 9.8)).toMatchObject({
      code: "5319BG",
      qty: 38,
      unitPrice: 9.8,
      priceLocked: true,
      productKind: "hardware",
      vendorProductId: 3900179,
    });
    expect(applyCartCheckoutPrefill(unmatched, {
      code: "5319BG",
      qty: 38,
      distributorId: null,
      unitPrice: 9.8,
      priceLocked: true,
      category: "Handles & hardware",
      productKind: "hardware",
      vendorProductId: 3900179,
    })).toMatchObject({
      matched: true,
      cartProductKind: "hardware",
      cartVendorProductId: 3900179,
      cartUnitPrice: 9.8,
    });
  });

  it("does not convert an ordinary unmatched cabinet code into a selected surface", () => {
    const result = applyCartCheckoutPrefill({ ...unmatched, rawCode: "UNKNOWN", normalized: "UNKNOWN" }, {
      code: "UNKNOWN",
      qty: 1,
      distributorId: 210002,
      unitPrice: null,
      priceLocked: false,
    });
    expect(result.matched).toBe(false);
    expect(result.cartProductKind).toBeNull();
  });
});
