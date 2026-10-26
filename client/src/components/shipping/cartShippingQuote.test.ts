import { describe, expect, it } from "vitest";
import { cartItemsToShippingQuote, quotesForCartIndexes } from "./cartShippingQuote";

describe("cart shipping quote grouping", () => {
  it("keeps each supplier's lines separate and skips drawing items that have no supplier", () => {
    const mapped = cartItemsToShippingQuote([
      { masterCode: "B24", styleId: 4, qty: 2, unitPrice: 100, distributorId: 9, productKind: null },
      { masterCode: "FLOOR-1", styleId: 0, qty: 1, unitPrice: 50, distributorId: null, productKind: "surface", pelicanProductId: 15 },
      { masterCode: "PULL", styleId: 0, qty: 3, unitPrice: 8, distributorId: 4, productKind: "hardware", vendorProductId: 77 },
      { masterCode: "NOTE", styleId: 0, qty: 1, unitPrice: null, distributorId: null, productKind: null },
    ]);
    expect(mapped.requests.map((item) => item.kind)).toEqual(["cabinet", "pelican", "vendor_product"]);
    expect(mapped.cartIndexes).toEqual([0, 1, 2]);
    expect(mapped.requests[0]).toMatchObject({ distributorId: 9, merchandiseCents: 20000 });
    expect(mapped.requests[2]).toMatchObject({ vendorProductId: 77, merchandiseCents: 2400 });
  });

  it("shows a quote only on the cart lines that produced it", () => {
    const mapped = cartItemsToShippingQuote([
      { masterCode: "B24", styleId: 4, qty: 1, unitPrice: 10, distributorId: 9 },
      { masterCode: "FLOOR-1", styleId: 0, qty: 1, unitPrice: 10, productKind: "surface", pelicanProductId: 3 },
    ]);
    const visible = quotesForCartIndexes([
      {
        vendorScope: "dist:9",
        vendorName: "Cabinet line",
        itemIndexes: [0],
        ok: true,
        source: "vendor_rates",
        sourceLabel: "Vendor rates",
        estimate: false,
        options: [],
        note: null,
        error: null,
        code: null,
      },
      {
        vendorScope: "pelican",
        vendorName: "Pelican",
        itemIndexes: [1],
        ok: true,
        source: "site_estimate",
        sourceLabel: "Site estimate",
        estimate: true,
        options: [],
        note: null,
        error: null,
        code: null,
      },
    ], mapped.cartIndexes, [1]);
    expect(visible.map((quote) => quote.vendorScope)).toEqual(["pelican"]);
  });
});
