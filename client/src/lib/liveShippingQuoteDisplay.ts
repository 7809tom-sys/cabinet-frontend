/**
 * When a checkout may show a live carrier rate.
 *
 * The quote itself is address-bound: street, city, state, and ZIP are enough
 * to request it and to put it in the total. Name, email, and phone stay
 * required for submit. Affiliate storefronts do not share the owner host's
 * session, so those contact fields are empty until the shopper types them.
 * A returned rate must not wait on that session.
 */
export type LiveShippingQuotePanel = "need-address" | "calculating" | "quote" | "unavailable";

export function liveShippingQuotePanel(input: {
  hasItems: boolean;
  addressReady: boolean;
  fetching: boolean;
  available: boolean;
}): LiveShippingQuotePanel {
  if (!input.hasItems || !input.addressReady) return "need-address";
  if (input.available) return "quote";
  if (input.fetching) return "calculating";
  return "unavailable";
}

/** Merchandise plus tax plus a live shipping amount, in dollars. */
export function checkoutTotalWithLiveShipping(input: {
  merchandise: number;
  tax: number;
  shippingCents: number;
}): number {
  const shipping = Number.isFinite(input.shippingCents) ? Math.max(0, input.shippingCents) / 100 : 0;
  return input.merchandise + input.tax + shipping;
}
