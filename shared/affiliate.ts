// Shared, DB-free helpers for the affiliate program. Kept pure so they can be
// unit-tested and reused on both client and server.

// Normalize a referral code to a canonical uppercase token (letters/digits only).
export function normalizeReferralCode(raw: string): string {
  return (raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 32);
}

// Turn a store name into a URL-safe slug (lowercase, hyphenated).
export function slugify(raw: string): string {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

// Derive a default referral code from a store name when one isn't supplied.
export function deriveReferralCode(storeName: string): string {
  const code = normalizeReferralCode(storeName);
  return code || "STORE";
}

// Compute commission on a confirmed order total. rate is a fraction (0.05 = 5%).
// Returns a value rounded to cents; non-finite/negative inputs yield 0.
export function computeCommission(orderTotal: number, rate: number): number {
  if (!Number.isFinite(orderTotal) || !Number.isFinite(rate)) return 0;
  if (orderTotal <= 0 || rate <= 0) return 0;
  return Math.round(orderTotal * rate * 100) / 100;
}

// Sum commission across a set of confirmed referred orders.
export function sumCommission(
  orders: { totalAmount: number | null; status: string }[],
  rate: number
): { referredCount: number; confirmedCount: number; gross: number; commission: number } {
  let confirmedCount = 0;
  let gross = 0;
  for (const o of orders) {
    if (o.status === "confirmed") {
      confirmedCount += 1;
      gross += Number(o.totalAmount ?? 0) || 0;
    }
  }
  return {
    referredCount: orders.length,
    confirmedCount,
    gross: Math.round(gross * 100) / 100,
    commission: computeCommission(gross, rate),
  };
}


// ─── Affiliate membership offer ───────────────────────────────────────────────
// Single source of truth for both paid affiliate membership prices. An affiliate
// gets: access to the kitchen design software, their own (white-labeled)
// website/storefront, and membership in the buying group (trade pricing).
// Surface this constant anywhere the offer or price is shown so copy and
// pricing never drift. Dollar amounts live here; cent amounts and the
// three-month rule are derived in shared/affiliateMembershipPlans.ts.
export const AFFILIATE_MEMBERSHIP = {
  priceUsd: 1195,
  billingPeriod: "year" as const,
  monthlyPriceUsd: 169,
  monthlyBillingPeriod: "month" as const,
  monthlyMinimumMonths: 3,
  // Cheaper up-front commitment first, then the annual plan.
  planIds: ["monthly", "annual"] as const,
  benefits: [
    {
      title: "Kitchen Design Software",
      desc: "Full access to the 2D kitchen designer — lay out rooms, drop cabinets, and price jobs instantly.",
    },
    {
      title: "Your Own Website",
      desc: "A white-labeled storefront with your branding, featured door styles, and your referral link.",
    },
    {
      title: "Buying-Group Access",
      desc: "Join the purchasing group and order at trade pricing across our supply network.",
    },
  ],
} as const;

// Format the membership price for display, e.g. "$1,195".
export function formatMembershipPrice(
  amount: number = AFFILIATE_MEMBERSHIP.priceUsd,
): string {
  if (!Number.isFinite(amount)) return "$0";
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

// Full price label including the billing period, e.g. "$1,195/year".
export function membershipPriceLabel(): string {
  return `${formatMembershipPrice()}/${AFFILIATE_MEMBERSHIP.billingPeriod}`;
}

// "$169/month".
export function monthlyMembershipPriceLabel(): string {
  return `${formatMembershipPrice(AFFILIATE_MEMBERSHIP.monthlyPriceUsd)}/${AFFILIATE_MEMBERSHIP.monthlyBillingPeriod}`;
}

// Both options, for any sentence that used to mention only the annual price.
export function membershipOptionsLabel(): string {
  return `${monthlyMembershipPriceLabel()} (${AFFILIATE_MEMBERSHIP.monthlyMinimumMonths}-month minimum) or ${membershipPriceLabel()}`;
}
