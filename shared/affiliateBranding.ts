// ─────────────────────────────────────────────────────────────────────────────
// Affiliate white-label branding + markup resolution (pure, unit-tested)
//
// An affiliate sells the central Cabinet Dealz catalog under their OWN brand:
//   • Brand NAME override — they can rename a door style (e.g. central "Aspen
//     White" → their "Coastal White") without touching the shared catalog.
//   • MARKUP — they set a default markup % applied on top of their affiliate
//     cost to produce the customer-facing retail price, with optional per-door-
//     style and per-category overrides.
//
// Precedence for markup (most specific wins):
//     per-door-style  >  per-category  >  affiliate global default
//
// All money is integer cents; markups are basis points (10000 = +100%).
// ─────────────────────────────────────────────────────────────────────────────

import {
  applyBps,
  priceLadder,
  roundCents,
  type PlatformPricingSettings,
} from "./pricing";

/** A single brand-name override row for one affiliate. */
export interface BrandNameOverride {
  /** Central door-style id this override renames. */
  styleId: number;
  /** The affiliate's white-label name for that style. Blank/null = no override. */
  brandName?: string | null;
}

/**
 * Resolve the customer-facing door-style name for an affiliate storefront.
 * Falls back to the central catalog name when the affiliate hasn't set one.
 */
export function resolveBrandName(
  centralName: string,
  override: string | null | undefined,
): string {
  const trimmed = (override ?? "").trim();
  return trimmed.length > 0 ? trimmed : centralName;
}

/** Affiliate markup configuration. All values are basis points or null. */
export interface AffiliateMarkup {
  /** Affiliate-wide default markup over affiliate cost (bps). */
  globalMarkupBps: number;
  /** Optional per-category overrides keyed by category key (e.g. "base"). */
  categoryMarkupBps?: Record<string, number | null | undefined>;
  /** Optional per-door-style overrides keyed by styleId. */
  styleMarkupBps?: Record<number, number | null | undefined>;
}

function isUsableBps(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/**
 * Pick the effective markup bps for a given category + style using the
 * style > category > global precedence. Returns the affiliate global default
 * when no more-specific override is set.
 */
export function resolveMarkupBps(
  markup: AffiliateMarkup,
  opts: { categoryKey?: string | null; styleId?: number | null },
): number {
  const { categoryKey, styleId } = opts;
  if (styleId != null && markup.styleMarkupBps) {
    const s = markup.styleMarkupBps[styleId];
    if (isUsableBps(s)) return s;
  }
  if (categoryKey && markup.categoryMarkupBps) {
    const c = markup.categoryMarkupBps[categoryKey];
    if (isUsableBps(c)) return c;
  }
  return isUsableBps(markup.globalMarkupBps) ? markup.globalMarkupBps : 0;
}

export interface AffiliateRetailResult {
  /** The affiliate's cost for the item (cents). */
  affiliateCostCents: number;
  /** The markup applied (bps). */
  markupBps: number;
  /** The marked-up customer retail price (cents). */
  retailCents: number;
  /** retailCents - affiliateCostCents (the affiliate's gross profit, cents). */
  profitCents: number;
}

/**
 * Compute the affiliate's customer-facing retail price for one item from their
 * affiliate cost + the resolved markup.
 */
export function resolveAffiliateRetail(
  affiliateCostCents: number,
  markup: AffiliateMarkup,
  opts: { categoryKey?: string | null; styleId?: number | null } = {},
): AffiliateRetailResult {
  const cost = roundCents(Math.max(0, affiliateCostCents));
  const markupBps = resolveMarkupBps(markup, opts);
  const retailCents = cost + applyBps(cost, markupBps);
  return {
    affiliateCostCents: cost,
    markupBps,
    retailCents,
    profitCents: retailCents - cost,
  };
}

/**
 * The only customer-facing price calculation for an affiliate storefront.
 *
 * Start from the confidential supplier cost, derive the platform's protected
 * affiliate cost with the current fee ladder, then apply that affiliate's own
 * saved markup.  The supplier cost and intermediate affiliate cost remain
 * server-only; callers return only `retailCents` to a shopper.
 *
 * This deliberately does not accept the CabinetDealz homeowner/list price as
 * an input.  An affiliate's public sale price must never inherit another
 * storefront's price or fall below its protected affiliate cost.
 */
export function resolveAffiliateStorefrontSale(
  sourceCostCents: number,
  platformSettings: PlatformPricingSettings,
  markup: AffiliateMarkup,
  opts: { categoryKey?: string | null; styleId?: number | null } = {},
): AffiliateRetailResult {
  const affiliateCostCents = priceLadder(
    Math.max(0, roundCents(sourceCostCents)),
    platformSettings,
  ).affiliateCents;
  return resolveAffiliateRetail(affiliateCostCents, markup, opts);
}
