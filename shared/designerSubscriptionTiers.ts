// Designer subscription tiers. Requested by Tom by voice on Nov 25, 2026,
// 9:05 AM CT; corrected to yearly prices at 9:53 AM CT. Two annual plans:
//
//   designer_website  $1,199/year   Designer + your own custom website, and the
//                                   purchasing club is included.
//   designer_only     $1,599/year   Designer only. No website, no purchasing
//                                   club. Priced higher on purpose: the website
//                                   plan is the one we want people to pick.
//
// These are separate from the affiliate membership ($169/month or $1,195/year
// in shared/affiliate.ts), which is unchanged. This file is the single source
// of truth for both tier prices; the pricing page and the Stripe Checkout
// line item both read from here, so copy and charge never drift.
// No database, no Stripe client, no clock.

export const DESIGNER_SUBSCRIPTION_TIER_IDS = ["designer_website", "designer_only"] as const;
export type DesignerSubscriptionTier = (typeof DESIGNER_SUBSCRIPTION_TIER_IDS)[number];

export interface DesignerSubscriptionTierOption {
  id: DesignerSubscriptionTier;
  name: string;
  amountCents: number;
  interval: "year";
  /** Short line under the price. */
  tagline: string;
  /** What the plan includes, in display order. */
  includes: readonly string[];
  /** What the plan does not include, shown greyed out. */
  excludes: readonly string[];
  includesWebsite: boolean;
  includesPurchasingClub: boolean;
  /** The plan the pricing page highlights. */
  recommended: boolean;
}

export const DESIGNER_SUBSCRIPTION_TIERS: Record<DesignerSubscriptionTier, DesignerSubscriptionTierOption> = {
  designer_website: {
    id: "designer_website",
    name: "Designer + Website",
    amountCents: 119900,
    interval: "year",
    tagline: "The kitchen designer plus your own custom website, with the purchasing club included.",
    includes: ["Kitchen designer", "Your own custom website", "Purchasing club"],
    excludes: [],
    includesWebsite: true,
    includesPurchasingClub: true,
    recommended: true,
  },
  designer_only: {
    id: "designer_only",
    name: "Designer only",
    amountCents: 159900,
    interval: "year",
    tagline: "The kitchen designer on its own. No website and no purchasing club.",
    includes: ["Kitchen designer"],
    excludes: ["Custom website", "Purchasing club"],
    includesWebsite: false,
    includesPurchasingClub: false,
    recommended: false,
  },
};

export function isDesignerSubscriptionTier(value: unknown): value is DesignerSubscriptionTier {
  return typeof value === "string" && (DESIGNER_SUBSCRIPTION_TIER_IDS as readonly string[]).includes(value);
}

export function designerSubscriptionTier(value: unknown): DesignerSubscriptionTierOption | null {
  return isDesignerSubscriptionTier(value) ? DESIGNER_SUBSCRIPTION_TIERS[value] : null;
}

/** Tiers in the order the pricing page shows them: website plan first. */
export function designerSubscriptionTierChoices(): DesignerSubscriptionTierOption[] {
  return DESIGNER_SUBSCRIPTION_TIER_IDS.map((id) => DESIGNER_SUBSCRIPTION_TIERS[id]);
}

/** "$1,199". Whole dollars drop the cents; any cents show two decimals. */
export function formatTierAmount(amountCents: number): string {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return "$0";
  const whole = amountCents % 100 === 0;
  return `$${(amountCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
}

/** "$1,199/year". */
export function formatTierPrice(tier: DesignerSubscriptionTier): string {
  const option = DESIGNER_SUBSCRIPTION_TIERS[tier];
  return `${formatTierAmount(option.amountCents)}/${option.interval}`;
}
