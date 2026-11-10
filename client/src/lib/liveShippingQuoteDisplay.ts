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

/** Shown when an affiliate checkout cannot display a live carrier rate. */
export const AFFILIATE_LIVE_RATE_UNAVAILABLE =
  "Live shipping rate is unavailable for this address. Retry the quote, or request a quote from the store.";

/**
 * A checkout rate is live only when the carrier returned it.
 * Flat fees, free-freight thresholds, and weight-table estimates are not.
 */
export function freightQuoteIsLiveCarrier(quote: {
  available?: boolean;
  zoneName?: string | null;
  rateGroups?: ReadonlyArray<{ source?: string | null }> | null;
} | null | undefined): boolean {
  if (!quote?.available) return false;
  if ((quote.zoneName ?? "").startsWith("Estimated")) return false;
  const groups = quote.rateGroups ?? [];
  if (groups.length === 0) return false;
  return groups.every((group) => group.source === "live" || group.source === "parcel");
}

export function affiliateLiveRateFailureMessage(detail?: string | null): string {
  const extra = detail?.trim();
  if (!extra || extra === AFFILIATE_LIVE_RATE_UNAVAILABLE) return AFFILIATE_LIVE_RATE_UNAVAILABLE;
  if (extra.startsWith(AFFILIATE_LIVE_RATE_UNAVAILABLE)) return extra;
  return `${AFFILIATE_LIVE_RATE_UNAVAILABLE} ${extra}`;
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
