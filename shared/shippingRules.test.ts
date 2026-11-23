import { describe, expect, it } from "vitest";
import {
  AWAITING_MANUAL_SHIPPING_QUOTE_STATUS,
  AWAITING_SHIPPING_ESTIMATE_STATUS,
  BACKSPLASH_UPS_PENDING_LABEL,
  FLORIDA_COUNTERTOP_CENTS_PER_SLAB,
  FLOORING_PENDING_LABEL,
  HARDWARE_FREE_LABEL,
  OUT_OF_STATE_COUNTERTOP_PENDING_LABEL,
  SHIPPING_RULES,
  canCaptureShippingPayment,
  canPlaceOrderWithPendingShipping,
  composeCheckoutShipping,
  countertopSlabCount,
  formatKnownShippingWithPending,
  isFloridaDelivery,
  itemUsesExistingCarrierQuote,
  pathForCategory,
  quoteShippingByRules,
  shippingCategoryForItem,
} from "./shippingRules";

const miami = { state: "FL", zip: "33101" };
const tallahassee = { state: "FL", zip: "32301" };
const pensacola = { zip: "32501" };
const atlanta = { state: "GA", zip: "30301" };

const cabinets = { productKind: null, category: null, name: "B24 Base Cabinet", qty: 4 };
const twoSlabs = { productKind: "surface" as const, category: "Quartz Slabs (Countertops)", name: "Calacatta 3cm", qty: 2, qtyNote: "44.0 sq ft ÷ 55.1 sq ft/slab = 2 slabs" };
const pulls = { productKind: "hardware" as const, category: "Decorative Hardware", name: "6-inch pull", qty: 12 };
const backsplash = { productKind: "surface" as const, category: "Tile & Mosaic", name: "Calacatta mosaic", qty: 8 };
const flooring = { productKind: "surface" as const, category: "Flooring", subCategory: "Planks & Flooring", name: "Oak plank", qty: 15 };

describe("Florida delivery detection", () => {
  it("treats Miami, the panhandle, and a FL state code as Florida", () => {
    expect(isFloridaDelivery(miami)).toBe(true);
    expect(isFloridaDelivery(tallahassee)).toBe(true);
    expect(isFloridaDelivery(pensacola)).toBe(true);
    expect(isFloridaDelivery({ state: "fl" })).toBe(true);
    expect(isFloridaDelivery({ zip: "34997" })).toBe(true);
    expect(isFloridaDelivery({ zip: "32003" })).toBe(true);
  });

  it("does not treat an out-of-state address as Florida", () => {
    expect(isFloridaDelivery(atlanta)).toBe(false);
    expect(isFloridaDelivery({ state: "GA", zip: "30301" })).toBe(false);
    expect(isFloridaDelivery({ zip: "31999" })).toBe(false);
    expect(isFloridaDelivery({ zip: "35000" })).toBe(false);
    expect(isFloridaDelivery({ zip: "12" })).toBe(false);
    expect(isFloridaDelivery({})).toBe(false);
  });
});

describe("category classification", () => {
  it("maps cabinets, slabs, hardware, backsplash, and flooring", () => {
    expect(shippingCategoryForItem(cabinets)).toBe("cabinets");
    expect(shippingCategoryForItem(twoSlabs)).toBe("countertops");
    expect(shippingCategoryForItem(pulls)).toBe("hardware");
    expect(shippingCategoryForItem(backsplash)).toBe("backsplashes");
    expect(shippingCategoryForItem(flooring)).toBe("flooring");
    expect(shippingCategoryForItem({ productKind: "surface", category: "Sinks & Faucets", name: "Undermount sink", qty: 1 })).toBe("other");
  });

  it("uses cart qty as the slab count", () => {
    expect(countertopSlabCount(twoSlabs)).toBe(2);
    expect(countertopSlabCount({ ...twoSlabs, qty: 1 })).toBe(1);
    expect(countertopSlabCount({ ...twoSlabs, qty: 0 })).toBe(0);
  });
});

describe("per-category paths", () => {
  it("keeps cabinets on existing logic and hardware free", () => {
    expect(SHIPPING_RULES.cabinets.path).toBe("existing");
    expect(SHIPPING_RULES.hardware.path).toBe("fixed");
    expect(SHIPPING_RULES.hardware.fixedFeeCents).toBe(0);
    expect(SHIPPING_RULES.backsplashes.path).toBe("estimate");
    expect(SHIPPING_RULES.backsplashes.carrierLane).toBe("ups");
    expect(SHIPPING_RULES.flooring.path).toBe("estimate");
    expect(pathForCategory("countertops", miami)).toBe("fixed");
    expect(pathForCategory("countertops", atlanta)).toBe("estimate");
    expect(itemUsesExistingCarrierQuote(cabinets, miami)).toBe(true);
    expect(itemUsesExistingCarrierQuote(twoSlabs, miami)).toBe(false);
    expect(itemUsesExistingCarrierQuote(backsplash, miami)).toBe(false);
  });
});

describe("shipping rule quotes", () => {
  it("charges $50 per slab for a Florida countertop delivery", () => {
    const quote = quoteShippingByRules([twoSlabs], miami);
    const tops = quote.categories.find((row) => row.category === "countertops")!;
    expect(tops.path).toBe("fixed");
    expect(tops.slabCount).toBe(2);
    expect(tops.feeCents).toBe(2 * FLORIDA_COUNTERTOP_CENTS_PER_SLAB);
    expect(tops.displayAmount).toBe("2 slabs \u00d7 $50 = $100.00");
    expect(tops.pendingLabel).toBeNull();
    expect(quote.knownRuleShippingCents).toBe(10000);
    expect(quote.hasPendingEstimate).toBe(false);
  });

  it("ships hardware free, including a hardware-only cart", () => {
    const quote = quoteShippingByRules([pulls], atlanta);
    const hardware = quote.categories.find((row) => row.category === "hardware")!;
    expect(hardware.path).toBe("fixed");
    expect(hardware.feeCents).toBe(0);
    expect(hardware.displayAmount).toBe(HARDWARE_FREE_LABEL);
    expect(quote.knownRuleShippingCents).toBe(0);
    expect(quote.hasPendingEstimate).toBe(false);
  });

  it("leaves out-of-state countertop shipping pending and does not count it as $0", () => {
    const quote = quoteShippingByRules([twoSlabs], atlanta);
    const tops = quote.categories.find((row) => row.category === "countertops")!;
    expect(tops.path).toBe("estimate");
    expect(tops.feeCents).toBeNull();
    expect(tops.pendingLabel).toBe(OUT_OF_STATE_COUNTERTOP_PENDING_LABEL);
    expect(tops.displayAmount).toBe(OUT_OF_STATE_COUNTERTOP_PENDING_LABEL);
    expect(quote.knownRuleShippingCents).toBe(0);
    expect(quote.hasPendingEstimate).toBe(true);
    expect(quote.canRequestEstimate).toBe(true);
  });

  it("quotes a mixed cart: FL slabs, free hardware, cabinet freight left existing, backsplash and flooring pending", () => {
    const quote = quoteShippingByRules([cabinets, twoSlabs, pulls, backsplash, flooring], pensacola);
    expect(quote.categories.map((row) => row.category)).toEqual([
      "cabinets",
      "countertops",
      "hardware",
      "backsplashes",
      "flooring",
    ]);
    const tops = quote.categories.find((row) => row.category === "countertops")!;
    const hardware = quote.categories.find((row) => row.category === "hardware")!;
    const splash = quote.categories.find((row) => row.category === "backsplashes")!;
    const floor = quote.categories.find((row) => row.category === "flooring")!;
    const cabs = quote.categories.find((row) => row.category === "cabinets")!;

    expect(cabs.path).toBe("existing");
    expect(cabs.feeCents).toBeNull();
    expect(tops.feeCents).toBe(10000);
    expect(hardware.displayAmount).toBe(HARDWARE_FREE_LABEL);
    expect(splash.path).toBe("estimate");
    expect(splash.carrierLane).toBe("ups");
    expect(splash.feeCents).toBeNull();
    expect(splash.pendingLabel).toBe(BACKSPLASH_UPS_PENDING_LABEL);
    expect(floor.pendingLabel).toBe(FLOORING_PENDING_LABEL);
    expect(quote.knownRuleShippingCents).toBe(10000);
    expect(quote.hasPendingEstimate).toBe(true);

    const composed = composeCheckoutShipping({ existingCarrierCents: 45000, rules: quote });
    expect(composed.knownShippingCents).toBe(55000);
    expect(composed.hasPendingEstimate).toBe(true);
    expect(composed.holdPaymentCapture).toBe(false);
    expect(formatKnownShippingWithPending(composed.knownShippingCents, composed.pendingLabels)).toBe(
      `$550.00 + ${BACKSPLASH_UPS_PENDING_LABEL}; ${FLOORING_PENDING_LABEL}`,
    );
  });

  it("holds payment only on the manual-quote path and still allows placing an estimate-pending order", () => {
    const quote = quoteShippingByRules([twoSlabs, flooring], atlanta);
    const estimate = composeCheckoutShipping({ existingCarrierCents: 0, rules: quote });
    expect(estimate.holdPaymentCapture).toBe(false);
    expect(canPlaceOrderWithPendingShipping(AWAITING_SHIPPING_ESTIMATE_STATUS)).toBe(true);
    expect(canCaptureShippingPayment(AWAITING_SHIPPING_ESTIMATE_STATUS)).toBe(true);

    const manual = composeCheckoutShipping({ existingCarrierCents: 0, rules: quote, manualQuoteRequested: true });
    expect(manual.holdPaymentCapture).toBe(true);
    expect(canPlaceOrderWithPendingShipping(AWAITING_MANUAL_SHIPPING_QUOTE_STATUS)).toBe(false);
    expect(canCaptureShippingPayment(AWAITING_MANUAL_SHIPPING_QUOTE_STATUS)).toBe(false);
  });
});
