export const AFFILIATE_NON_COMPETE_TERM_MONTHS = 24;
export const AFFILIATE_LIQUIDATED_DAMAGES_USD = 10_000;

export function affiliateNonCompeteEnforcementNote(input: {
  at: Date;
  violationSummary: string;
}) {
  return `[Affiliate non-compete enforcement | ${input.at.toISOString()}] Confirmed violation: ${input.violationSummary.trim()} | Storefront suspended. Proposed liquidated damages: $${AFFILIATE_LIQUIDATED_DAMAGES_USD.toLocaleString("en-US")} per violation, subject to the Affiliate Agreement and applicable law.`;
}
