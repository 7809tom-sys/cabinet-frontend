export type CartPricingInput = {
  storedUnitPrice: number | null | undefined;
  liveUnitPrice: number | null | undefined;
  tier: string | null | undefined;
  isAffiliateCart: boolean;
  /** Design-origin lines retain the exact selected price at every commerce step. */
  priceLocked?: boolean;
};

/**
 * Select the price shown in the cart.
 *
 * A design-origin price lock always wins, regardless of wholesale, contractor,
 * homeowner, or affiliate context. Affiliate carts now receive their own exact
 * server-calculated sale price from the live cart endpoint, so a saved affiliate
 * markup update appears on that affiliate storefront without ever borrowing the
 * CabinetDealz homeowner/list price. Non-affiliate catalog items continue to
 * use the live tier price when available.
 */
export function resolveAffiliateCartUnitPrice({
  storedUnitPrice,
  liveUnitPrice,
  tier,
  isAffiliateCart,
  priceLocked = false,
}: CartPricingInput): number | null {
  if (priceLocked && storedUnitPrice != null && Number.isFinite(storedUnitPrice)) {
    return storedUnitPrice;
  }
  if (isAffiliateCart && tier === "homeowner") {
    return liveUnitPrice ?? storedUnitPrice ?? null;
  }
  return liveUnitPrice ?? storedUnitPrice ?? null;
}

/** Calculate a line total without introducing floating-point display drift. */
export function calculateCartLineTotal(unitPrice: number | null, quantity: number): number | null {
  if (unitPrice == null || !Number.isFinite(unitPrice) || quantity <= 0) return null;
  return Number((unitPrice * quantity).toFixed(2));
}
