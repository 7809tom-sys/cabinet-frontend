// Shared margin math used by both the server price resolver and the admin
// preview, so the displayed numbers always match what the catalog charges.
//
// All markups are basis points where 10000 = no change (×1.0), 11500 = +15%.

export type PricingTier = "homeowner" | "contractor" | "wholesale";

export interface TierMarkupBps {
  homeownerMarkupBps: number;
  contractorMarkupBps: number;
  wholesaleMarkupBps: number;
}

export const NEUTRAL_BPS = 10000;

/** Clamp a basis-points value to a sane range (0%..+1000%). */
export function clampBps(bps: number): number {
  if (!Number.isFinite(bps)) return NEUTRAL_BPS;
  return Math.min(110000, Math.max(0, Math.round(bps)));
}

/** Convert basis points to a human percent delta string, e.g. 11500 -> "+15%". */
export function bpsToPercentLabel(bps: number): string {
  const pct = (bps - NEUTRAL_BPS) / 100;
  const rounded = Math.round(pct * 100) / 100;
  if (rounded === 0) return "0%";
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

/** Pick the markup bps for a given tier from a settings object. */
export function markupBpsForTier(s: TierMarkupBps, tier: PricingTier): number {
  switch (tier) {
    case "homeowner":
      return s.homeownerMarkupBps;
    case "contractor":
      return s.contractorMarkupBps;
    case "wholesale":
      return s.wholesaleMarkupBps;
    default:
      return NEUTRAL_BPS;
  }
}

/**
 * Apply a tier markup to a base price (number or decimal string). Returns a
 * 2-dp number, or null when the input price is null/NaN.
 */
export function applyTierMarkup(
  basePrice: string | number | null | undefined,
  s: TierMarkupBps,
  tier: PricingTier,
): number | null {
  if (basePrice === null || basePrice === undefined) return null;
  const n = Number(basePrice);
  if (Number.isNaN(n)) return null;
  const bps = clampBps(markupBpsForTier(s, tier));
  return Math.round(n * (bps / NEUTRAL_BPS) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for the customer-facing SELL price.
//
// The sell price for a tier is ALWAYS computed from our COST base times the
// per-tier markup multiplier — never from a pre-stored, already-marked-up price
// column (doing that double-applies the markup). The global default markup does
// NOT participate here: it is only guidance for new supply lines, so it can
// never compound onto a live price.
//
//   sell(tier) = costBase × (tierMarkupBps / 10000)
//
// Cost base precedence (first non-null wins). Our TRUE cost is `yourCost`,
// which equals the distributor's listPrice × their costMultiplier (the single
// cost lever on the admin Multiplier tab). Fallbacks only apply when a SKU is
// missing yourCost, so a row still resolves a base:
//   yourCost → wholesalePrice → adjustedListPrice → listPrice
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The one site-wide retail multiplier. 10000 basis points = ×1.0.
 * This reuses pricing_settings.homeownerMarkupBps. It is not a new constant.
 * Per-vendor distributors.markupPercent and per-category pelican markupBps
 * stay on top of this key when a row carries them.
 */
export const SITE_RETAIL_MULTIPLIER_KEY = "pricing_settings.homeownerMarkupBps" as const;

export interface CostBaseRow {
  yourCost?: number | string | null;
  wholesalePrice?: number | string | null;
  adjustedListPrice?: number | string | null;
  listPrice?: number | string | null;
  /** A supplier can explicitly designate its verified list as customer retail. */
  retailPriceBasis?: "cost_plus_tier" | "source_list" | null;
  /**
   * Vendor-entered wholesale. Distinct from wholesalePrice, which is a stored
   * cost-base fallback and a tier column. When set, homeowner retail is
   * wholesale × the site-wide key at read time.
   */
  vendorWholesale?: number | string | null;
  /** distributors.markupPercent, e.g. 0.15 = +15% on top of the site-wide key. */
  vendorMarkupPercent?: number | string | null;
  /** pelican_category_markups.markupBps, applied on top of the site-wide key. */
  categoryMarkupBps?: number | null;
}

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolve our COST base for a SKU — the number the per-tier markup multiplies.
 * Returns null when no usable cost column exists.
 */
export function resolveCostBase(row: CostBaseRow): number | null {
  return (
    toNum(row.yourCost) ??
    toNum(row.wholesalePrice) ??
    toNum(row.adjustedListPrice) ??
    toNum(row.listPrice)
  );
}

/**
 * Retail = vendor wholesale × the site-wide homeowner multiplier, then any
 * existing per-vendor or per-category uplift. Computed at read time.
 * Returns a 2-dp number, or null when wholesale is missing.
 */
export function retailFromWholesale(
  wholesale: string | number | null | undefined,
  homeownerMarkupBps: number,
  overrides?: { vendorMarkupPercent?: number | string | null; categoryMarkupBps?: number | null },
): number | null {
  const base = toNum(wholesale);
  if (base === null || base < 0) return null;
  const bps = clampBps(homeownerMarkupBps);
  const vendor = toNum(overrides?.vendorMarkupPercent) ?? 0;
  const category = overrides?.categoryMarkupBps;
  const categoryFactor = 1 + (category != null && Number.isFinite(category) ? category : 0) / NEUTRAL_BPS;
  return Math.round(base * (bps / NEUTRAL_BPS) * (1 + vendor) * categoryFactor * 100) / 100;
}

/**
 * Compute the customer-facing sell price for a tier from the cost base and the
 * per-tier markup. Returns a 2-dp number, or null when no cost base exists.
 * The global default markup is intentionally ignored.
 *
 * Homeowner retail uses vendor wholesale × pricing_settings.homeownerMarkupBps
 * when that wholesale has been entered. Contractor and wholesale tiers stay on
 * the existing cost ladder. Rows without vendor wholesale are unchanged.
 */
export function sellPriceForTier(
  row: CostBaseRow,
  s: TierMarkupBps,
  tier: PricingTier,
): number | null {
  // Some suppliers publish a verified customer-facing list and explicitly do
  // not use CabinetDealz tier markup (for example the staged AltaEuro line).
  // Keep that printed value exact. Cost-plus-tier suppliers such as USCD still
  // follow the normal landed-cost × tier multiplier path below.
  if (row.retailPriceBasis === "source_list") {
    return toNum(row.listPrice);
  }
  const vendorWholesale = toNum(row.vendorWholesale);
  if (tier === "homeowner" && vendorWholesale != null && vendorWholesale > 0) {
    return retailFromWholesale(vendorWholesale, s.homeownerMarkupBps, {
      vendorMarkupPercent: row.vendorMarkupPercent,
      categoryMarkupBps: row.categoryMarkupBps,
    });
  }
  const base = resolveCostBase(row);
  if (base === null) return null;
  const bps = clampBps(markupBpsForTier(s, tier));
  return Math.round(base * (bps / NEUTRAL_BPS) * 100) / 100;
}
