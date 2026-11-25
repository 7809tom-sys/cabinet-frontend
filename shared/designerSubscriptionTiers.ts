// Designer subscription tiers. Requested by Tom by voice on Nov 25, 2026,
// 9:05 AM CT. Two monthly plans:
//
//   designer_website  $11.99/month  Designer + your own custom website, and the
//                                   purchasing club is included.
//   designer_only     $15.99/month  Designer only. No website, no purchasing
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
  interval: "month";
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
    amountCents: 1199,
    interval: "month",
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
    amountCents: 1599,
    interval: "month",
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

/** "$11.99". Always two decimals, since both prices have cents. */
export function formatTierAmount(amountCents: number): string {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return "$0.00";
  return `$${(amountCents / 100).toFixed(2)}`;
}

/** "$11.99/month". */
export function formatTierPrice(tier: DesignerSubscriptionTier): string {
  const option = DESIGNER_SUBSCRIPTION_TIERS[tier];
  return `${formatTierAmount(option.amountCents)}/${option.interval}`;
}
