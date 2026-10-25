import { describe, expect, it } from "vitest";
import { isLockedDesignCheckoutPrice, resolveLockedCheckoutUnitPrice } from "./checkoutPriceLock";
import { resolveAffiliateCartUnitPrice } from "@shared/affiliateCartPricing";

describe("selected design checkout prices", () => {
  it("keeps the selected customer price instead of a later list-price recomputation", () => {
    expect(resolveLockedCheckoutUnitPrice({
      priceLocked: true,
      storedUnitPrice: 324.8,
      recomputedUnitPrice: 469.94,
    })).toBe(324.8);
  });

  it.each([
    ["wholesale", 198.75, 421.25],
    ["contractor", 264.5, 469.94],
    ["homeowner", 324.8, 549.99],
  ] as const)("keeps the selected %s design price when checkout recalculates a different tier value", (_tier, selectedPrice, recomputedPrice) => {
    expect(resolveLockedCheckoutUnitPrice({
      priceLocked: true,
      storedUnitPrice: selectedPrice,
      recomputedUnitPrice: recomputedPrice,
    })).toBe(selectedPrice);
  });

  it.each([
    ["wholesale", 203.74, 399.99],
    ["contractor", 277.18, 469.94],
    ["homeowner", 346.5, 549.99],
  ] as const)("keeps the selected affiliate %s design price after the cart affiliate/live-price path", (tier, selectedAffiliatePrice, genericPlatformPrice) => {
    const cartRefresh = resolveAffiliateCartUnitPrice({
      storedUnitPrice: selectedAffiliatePrice,
      liveUnitPrice: genericPlatformPrice,
      tier,
      isAffiliateCart: true,
    });
    expect(resolveLockedCheckoutUnitPrice({
      priceLocked: true,
      storedUnitPrice: selectedAffiliatePrice,
      recomputedUnitPrice: cartRefresh,
    })).toBe(selectedAffiliatePrice);
  });

  it("continues to use live pricing for ordinary catalog-cart items", () => {
    expect(resolveLockedCheckoutUnitPrice({
      priceLocked: false,
      storedUnitPrice: 324.8,
      recomputedUnitPrice: 469.94,
    })).toBe(469.94);
  });

  it("only treats an explicit numeric cart price as a locked design price", () => {
    expect(isLockedDesignCheckoutPrice({ cartPriceLocked: true, cartUnitPrice: 324.8 })).toBe(true);
    expect(isLockedDesignCheckoutPrice({ cartPriceLocked: true, cartUnitPrice: null })).toBe(false);
    expect(isLockedDesignCheckoutPrice({ cartPriceLocked: true, cartUnitPrice: Number.NaN })).toBe(false);
    expect(isLockedDesignCheckoutPrice({ cartUnitPrice: 324.8 })).toBe(false);
  });
});
