/**
 * A design-origin line carries the exact selling price displayed when the plan
 * was saved to cart. That price is authoritative through checkout for every
 * supported tier — wholesale, contractor, homeowner, and affiliate storefront
 * pricing — so later live-price or markup queries cannot replace it.
 */
export function resolveLockedCheckoutUnitPrice({
  priceLocked,
  storedUnitPrice,
  recomputedUnitPrice,
}: {
  priceLocked?: boolean;
  storedUnitPrice: number | null;
  recomputedUnitPrice: number | null;
}): number | null {
  return priceLocked ? storedUnitPrice : recomputedUnitPrice ?? storedUnitPrice;
}

export function isLockedDesignCheckoutPrice(line: {
  cartPriceLocked?: boolean;
  cartUnitPrice?: number | null;
}): boolean {
  return line.cartPriceLocked === true && Number.isFinite(line.cartUnitPrice);
}
