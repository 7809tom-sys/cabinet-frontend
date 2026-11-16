/**
 * Affiliate store checkout lives at /store/<slug>/checkout. It is the same
 * review, delivery address, and Stripe hand-off the cart has always used, but
 * it is not the "Build an Order" photo / CSV / code-entry tool at
 * /store/<slug>/order, which stays the store's "Get a Quote" page.
 */
export function storeCheckoutPath(slug: string): string {
  return `/store/${encodeURIComponent(slug)}/checkout`;
}

export function storeCartPath(slug: string | null | undefined): string {
  return slug ? `/store/${encodeURIComponent(slug)}/cart` : "/cart";
}

/** What the checkout page shows before the cart lines are loaded into review. */
export type CheckoutPrefillState = "loading" | "empty" | "error" | "ready";

export function checkoutPrefillState(input: {
  hasPrefill: boolean;
  pending: boolean;
  failed: boolean;
  lineCount: number;
}): CheckoutPrefillState {
  if (input.lineCount > 0) return "ready";
  if (input.failed) return "error";
  if (input.pending) return "loading";
  return input.hasPrefill ? "loading" : "empty";
}
