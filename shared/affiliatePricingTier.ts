// Affiliate buy-cost tiers. These are separate from the customer sell tiers in
// pricingTier.ts (homeowner | contractor | wholesale).
//
// resolvePricingFor(user) chooses the sell column. An approved contractor
// (role "contractor") gets the contractor trade column from that function.
// This module does not replace that decision and must not write a buy-cost
// tier into users.pricingTier.
//
// resolveAffiliateTierCost is only what an affiliate pays Cabinetdealz.
// The affiliate's own markup still sits on top for their customers. On an
// affiliate storefront that customer price is the price every viewer pays,
// including an approved contractor. Volume thresholds are assignment guidance
// only. They never change a price by themselves.

export const ATTACH_PLATFORM_MARKUP_SHARE_BPS = 4000;
export const ATTACH_AFFILIATE_MARKUP_SHARE_BPS = 6000;

export type AffiliateTierBasis = "cost_multiplier" | "list_discount";

export interface AffiliatePricingTierRule {
  basis: AffiliateTierBasis;
  /** cost_multiplier: 10000 = ×1.00 of Cabinetdealz cost.
      list_discount: basis points taken off list. 0 = pay the full list. */
  basisPoints: number;
}

export type AffiliateProductClass = "cabinet" | "attach";

export type AffiliateCostSource =
  | "tier_cost_multiplier"
  | "tier_list_discount"
  | "attach_split"
  | "platform_default"
  | "unavailable";

export interface AffiliateCostInput {
  yourCostCents: number | null;
  listPriceCents?: number | null;
  /** Platform or list price used as the attach-product markup reference. */
  referenceRetailCents?: number | null;
  productClass?: AffiliateProductClass;
  tier?: AffiliatePricingTierRule | null;
  /** Used when no active tier applies. Same basis points as pricing_settings.affiliateMarkupBps. */
  platformAffiliateMarkupBps: number;
}

export interface AffiliateCostResult {
  affiliateCostCents: number | null;
  source: AffiliateCostSource;
}

export interface AffiliateTierDraft {
  tierName: string;
  basis: AffiliateTierBasis;
  basisPoints: number;
  volumeThresholdCents: number | null;
  examplePlaceholder: boolean;
  notes: string | null;
  active: boolean;
  sortOrder: number;
}

const MAX_MULTIPLIER_BPS = 200_000;
const MAX_VOLUME_CENTS = 2_000_000_000;

function positiveCents(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const cents = Math.round(value);
  return cents > 0 ? cents : null;
}

function wholeBps(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

/** Flooring and appliances share markup 40% Cabinetdealz / 60% affiliate. */
export function isAttachProductCategory(category: string | null | undefined): boolean {
  const name = (category ?? "").trim().toLowerCase();
  return name.includes("flooring") || name.includes("appliance");
}

export function classifyAffiliateProduct(category: string | null | undefined): AffiliateProductClass {
  return isAttachProductCategory(category) ? "attach" : "cabinet";
}

/**
 * The affiliate's Cabinetdealz cost for one item.
 * Cabinets use the assigned tier, or the platform affiliate markup when no
 * active tier is assigned. Flooring and appliances ignore the cabinet tier
 * and use the 40/60 markup split against the reference retail price.
 */
export function resolveAffiliateTierCost(input: AffiliateCostInput): AffiliateCostResult {
  const yourCost = positiveCents(input.yourCostCents);
  const list = positiveCents(input.listPriceCents);
  const productClass = input.productClass ?? "cabinet";

  if (productClass === "attach") {
    if (yourCost == null) return { affiliateCostCents: null, source: "unavailable" };
    const reference = positiveCents(input.referenceRetailCents) ?? list;
    if (reference == null || reference <= yourCost) {
      return { affiliateCostCents: yourCost, source: "attach_split" };
    }
    const spread = reference - yourCost;
    const platformShare = Math.round((spread * ATTACH_PLATFORM_MARKUP_SHARE_BPS) / 10000);
    return { affiliateCostCents: yourCost + platformShare, source: "attach_split" };
  }

  const tier = input.tier;
  const tierBps = tier ? wholeBps(tier.basisPoints) : null;
  if (tier && tierBps != null) {
    if (tier.basis === "cost_multiplier" && tierBps >= 1 && tierBps <= MAX_MULTIPLIER_BPS) {
      if (yourCost == null) return { affiliateCostCents: null, source: "unavailable" };
      return {
        affiliateCostCents: Math.round((yourCost * tierBps) / 10000),
        source: "tier_cost_multiplier",
      };
    }
    if (tier.basis === "list_discount" && tierBps >= 0 && tierBps < 10000) {
      if (list != null) {
        const payBps = 10000 - tierBps;
        return {
          affiliateCostCents: Math.round((list * payBps) / 10000),
          source: "tier_list_discount",
        };
      }
    }
  }

  if (yourCost == null) return { affiliateCostCents: null, source: "unavailable" };
  const platformBps = wholeBps(input.platformAffiliateMarkupBps) ?? 0;
  const safeBps = Math.min(MAX_MULTIPLIER_BPS, Math.max(0, platformBps));
  return {
    affiliateCostCents: yourCost + Math.round((yourCost * safeBps) / 10000),
    source: "platform_default",
  };
}

export function validateAffiliateTierDraft(
  draft: AffiliateTierDraft,
): { ok: true; draft: AffiliateTierDraft } | { ok: false; message: string } {
  const tierName = draft.tierName.trim();
  if (!tierName || tierName.length > 128) {
    return { ok: false, message: "Enter a tier name up to 128 characters." };
  }
  if (draft.basis !== "cost_multiplier" && draft.basis !== "list_discount") {
    return { ok: false, message: "Choose a cost multiplier or a discount off list." };
  }
  const basisPoints = wholeBps(draft.basisPoints);
  if (basisPoints == null) return { ok: false, message: "Enter a numeric tier value." };
  if (draft.basis === "cost_multiplier" && (basisPoints < 1 || basisPoints > MAX_MULTIPLIER_BPS)) {
    return { ok: false, message: "Cost multiplier must be between 0.01 and 20.00." };
  }
  if (draft.basis === "list_discount" && (basisPoints < 0 || basisPoints >= 10000)) {
    return { ok: false, message: "Discount off list must be from 0% up to, but not including, 100%." };
  }
  const volume = draft.volumeThresholdCents;
  if (volume != null && (!Number.isFinite(volume) || volume < 0 || Math.round(volume) > MAX_VOLUME_CENTS)) {
    return { ok: false, message: "Volume threshold must be empty or a positive dollar amount." };
  }
  const notes = draft.notes?.trim() || null;
  if (notes && notes.length > 2000) return { ok: false, message: "Notes must be 2000 characters or less." };
  return {
    ok: true,
    draft: {
      tierName,
      basis: draft.basis,
      basisPoints,
      volumeThresholdCents: volume == null ? null : Math.round(volume),
      examplePlaceholder: Boolean(draft.examplePlaceholder),
      notes,
      active: draft.active !== false,
      sortOrder: Number.isFinite(draft.sortOrder) ? Math.round(draft.sortOrder) : 0,
    },
  };
}

export function affiliateTierCodeFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "tier";
}

export function formatAffiliateTierPrice(basis: AffiliateTierBasis, basisPoints: number): string {
  if (basis === "cost_multiplier") {
    return `×${(basisPoints / 10000).toFixed(2)} of Cabinetdealz cost`;
  }
  return `${(basisPoints / 100).toFixed(2)}% off list`;
}

export function formatVolumeThreshold(cents: number | null | undefined): string | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function affiliateTierSummary(tier: {
  basis: AffiliateTierBasis;
  basisPoints: number;
  volumeThresholdCents?: number | null;
  examplePlaceholder?: boolean;
  active?: boolean;
}): string {
  const price = formatAffiliateTierPrice(tier.basis, tier.basisPoints);
  const volume = formatVolumeThreshold(tier.volumeThresholdCents);
  const parts = [price];
  if (volume) parts.push(`volume ${volume}`);
  if (tier.active === false) parts.push("inactive");
  if (tier.examplePlaceholder) parts.push("example placeholder");
  return parts.join(" · ");
}

export interface AffiliateTierDashboard {
  assigned: boolean;
  inactive: boolean;
  tierName: string | null;
  summary: string;
  examplePlaceholder: boolean;
  volumeLabel: string | null;
}

export function unassignedAffiliateTier(): AffiliateTierDashboard {
  return {
    assigned: false,
    inactive: false,
    tierName: null,
    summary: "No pricing tier assigned. Cabinet cost uses the platform affiliate markup until an administrator assigns a tier.",
    examplePlaceholder: false,
    volumeLabel: null,
  };
}
