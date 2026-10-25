// ─────────────────────────────────────────────────────────────────────────────
// Pricing-tier resolution
// A logged-in user is assigned ONE pricing tier (homeowner | contractor |
// wholesale) by the owner after they're seen on the site. That tier decides
// which of the three SKU price columns the user actually sees and checks out at.
//
// Anonymous / not-yet-approved visitors default to the homeowner tier (the
// highest of the three — i.e. retail), so trade pricing is never exposed until
// the owner explicitly approves the account.
// ─────────────────────────────────────────────────────────────────────────────

export type PricingTier = "homeowner" | "contractor" | "wholesale";

export const PRICING_TIERS: readonly PricingTier[] = [
  "homeowner",
  "contractor",
  "wholesale",
] as const;

export const DEFAULT_PRICING_TIER: PricingTier = "homeowner";

/** Human-readable label for a tier. */
export function tierLabel(tier: PricingTier): string {
  switch (tier) {
    case "wholesale":
      return "Wholesale";
    case "contractor":
      return "Contractor";
    case "homeowner":
    default:
      return "Homeowner";
  }
}

/** Normalize any input into a valid tier, falling back to the default. */
export function normalizeTier(value: unknown): PricingTier {
  if (typeof value === "string") {
    const v = value.toLowerCase();
    if (v === "homeowner" || v === "contractor" || v === "wholesale") return v;
  }
  return DEFAULT_PRICING_TIER;
}

export interface TierPrices {
  wholesalePrice?: number | string | null;
  contractorPrice?: number | string | null;
  homeownerPrice?: number | string | null;
  // Fallbacks used when a tier-specific column is missing.
  adjustedListPrice?: number | string | null;
  listPrice?: number | string | null;
  // The owner's TRUE acquisition cost (what CabinetDealz pays the supplier).
  // This is NOT a sell tier — it is only used for the owner-only margin view.
  yourCost?: number | string | null;
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolve the single effective price for a user's tier from a SKU's price set.
 *
 * Resolution rules:
 *  - wholesale  → wholesalePrice, else contractorPrice, else homeowner/adjusted/list
 *  - contractor → contractorPrice, else wholesalePrice, else homeowner/adjusted/list
 *  - homeowner  → homeownerPrice, else adjustedListPrice, else listPrice
 *
 * A homeowner view never falls back to contractor or wholesale values. Those
 * are restricted business tiers, not a customer-price source.
 *
 * Returns null when no usable price exists.
 */
export function resolveTierPrice(
  tier: PricingTier,
  prices: TierPrices,
): number | null {
  const wholesale = num(prices.wholesalePrice);
  const contractor = num(prices.contractorPrice);
  const homeowner = num(prices.homeownerPrice);
  const adjusted = num(prices.adjustedListPrice);
  const list = num(prices.listPrice);

  switch (tier) {
    case "wholesale":
      return wholesale ?? contractor ?? homeowner ?? adjusted ?? list;
    case "contractor":
      return contractor ?? wholesale ?? homeowner ?? adjusted ?? list;
    case "homeowner":
    default:
      return homeowner ?? adjusted ?? list;
  }
}

/**
 * Resolve the storefront pricing tier for the current viewer. Anonymous
 * visitors (and users without an explicit tier) see the retail HOMEOWNER price;
 * a logged-in pro sees the tier the owner assigned to their account.
 */
export function resolveStorefrontTier(
  user: { pricingTier?: unknown } | null | undefined,
): PricingTier {
  if (!user) return DEFAULT_PRICING_TIER;
  return normalizeTier(user.pricingTier);
}

/**
 * The struck-through "Compare at" reference price for the homeowner sale
 * display: the prior list price (adjustedListPrice/listPrice), shown only when
 * it is strictly higher than the live homeowner price. Null when there is no
 * genuine markdown to show, or for non-homeowner tiers.
 */
export function compareAtPrice(
  tier: PricingTier,
  prices: TierPrices,
): number | null {
  if (tier !== "homeowner") return null;
  const live = resolveTierPrice("homeowner", prices);
  const compare = num(prices.adjustedListPrice) ?? num(prices.listPrice);
  if (live === null || compare === null) return null;
  return compare > live ? compare : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// OWNER-ONLY cost intelligence
// When the platform owner/admin is logged in, the price card shows what they
// pay (the wholesale/platform "My Cost") next to what the viewer's tier sells
// at ("Your Cost" / list), plus the gross margin between them. This is NEVER
// exposed to affiliates or customers — gate the UI on role === "admin".
// ─────────────────────────────────────────────────────────────────────────────

export interface OwnerCostBreakdown {
  /** The owner's base/platform cost (lowest tier = wholesale). Null if unknown. */
  myCost: number | null;
  /** The price the current viewer tier sells at. Null if unknown. */
  sellPrice: number | null;
  /** sellPrice - myCost (gross profit in dollars). Null if either is unknown. */
  marginDollars: number | null;
  /** marginDollars / sellPrice as a percentage (0-100). Null if not computable. */
  marginPct: number | null;
}

/**
 * Compute the owner's cost-vs-sell breakdown for a SKU at the viewer's tier.
 * `myCost` is the wholesale (platform) price — the cheapest the owner pays.
 * `sellPrice` is the price the supplied `sellTier` is quoted at.
 */
export function ownerCostBreakdown(
  prices: TierPrices,
  sellTier: PricingTier,
): OwnerCostBreakdown {
  // Owner's cost is the TRUE acquisition cost (`yourCost`) — what CabinetDealz
  // actually pays the supplier. Only when that is missing do we fall back to the
  // wholesale price as an approximation. (Previously this always used wholesale,
  // which overstated cost and understated margin.)
  const myCost = num(prices.yourCost) ?? resolveTierPrice("wholesale", prices);
  const sellPrice = resolveTierPrice(sellTier, prices);
  let marginDollars: number | null = null;
  let marginPct: number | null = null;
  if (myCost != null && sellPrice != null) {
    marginDollars = Math.round((sellPrice - myCost) * 100) / 100;
    if (sellPrice > 0) {
      marginPct = Math.round((marginDollars / sellPrice) * 1000) / 10;
    }
  }
  return { myCost, sellPrice, marginDollars, marginPct };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER-SIDE price-column gating
// Never ship a price column the viewer isn't entitled to. The wholesale/base
// cost must NOT travel to customers or affiliates — only to the owner/admin and
// (for their own tier) approved pros.
//
//   admin/owner → every column (needs My Cost for margin tools)
//   wholesale   → wholesale + contractor + homeowner + list refs
//   contractor  → contractor + homeowner + list refs (no wholesale/base)
//   homeowner   → homeowner + list refs ONLY (no trade columns at all)
//
// Fields not entitled are set to null so existing resolvers degrade gracefully.
// ─────────────────────────────────────────────────────────────────────────────

export interface FullPriceRow {
  listPrice?: number | string | null;
  adjustedListPrice?: number | string | null;
  wholesalePrice?: number | string | null;
  contractorPrice?: number | string | null;
  homeownerPrice?: number | string | null;
}

/**
 * Redact the price columns a viewer is not entitled to see. `isAdmin` overrides
 * everything (owner sees all). Otherwise gate strictly by the viewer's tier so
 * the wholesale/base cost never leaves the server for customers/affiliates.
 */
export function visiblePricesForViewer<T extends FullPriceRow>(
  row: T,
  viewerTier: PricingTier,
  isAdmin: boolean,
): T {
  if (isAdmin) return { ...row };
  const out: T = { ...row };
  // List/adjusted-list references are public (used as MSRP/compare-at).
  switch (viewerTier) {
    case "wholesale":
      // sees all trade columns
      break;
    case "contractor":
      out.wholesalePrice = null;
      break;
    case "homeowner":
    default:
      out.wholesalePrice = null;
      out.contractorPrice = null;
      break;
  }
  return out;
}
