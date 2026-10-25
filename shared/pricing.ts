// ─── Cabinet Dealz tiered pricing + fee engine ──────────────────────────────
// Pure, deterministic money math for the platform's price ladder and order fee
// stack. No I/O, no dates — fully unit-testable. All money is whole CENTS to
// avoid float drift; all percentages are stored as BASIS POINTS (bps) so 5% =
// 500 bps and 0.5% is representable.
//
// Price ladder (per cabinet line, derived from internal base cost):
//   base cost (internal)
//     → Wholesale  = base × (1 + wholesaleMarkupBps)
//     → Affiliate  = base × (1 + affiliateMarkupBps)
//     → Suggested Retail = base × (1 + retailMarkupBps)
//   Every tier marks up off the SAME base cost (independent margins) — no
//   markup-on-markup chaining. Each percentage is measured against cost.
//
// Affiliate fee stack (on the affiliate's cost only):
//   • Damage fee  — damageFeeBps of the affiliate cabinet cost
//   • Tech fee    — techFeeBps of the affiliate cabinet cost, CAPPED at techFeeCapCents
//   • Card fee    — cardFeeBps of the affiliate cabinet cost, CARD payments only
// These internal affiliate fees never increase a homeowner's retail checkout or
// freight. Direct contractor/wholesale/homeowner orders have no affiliate fees.
//
// Defaults encode the owner's spec: affiliate 5%, damage 1%, tech 10% cap $100,
// card 4%.

export const BPS_DIVISOR = 10000;

/** Round to the nearest whole cent (half-up on .5). */
export function roundCents(n: number): number {
  return Math.round(n);
}

/** Apply a basis-points markup to a cents amount, returning whole cents. */
export function applyBps(amountCents: number, bps: number): number {
  return roundCents((amountCents * bps) / BPS_DIVISOR);
}

// ─── Platform pricing settings ───────────────────────────────────────────────
// One row in the DB drives the whole ladder + fee stack. Defaults below are the
// owner's stated spec and are also used when the row is missing.
export interface PlatformPricingSettings {
  /** Internal base cost → wholesale markup. */
  wholesaleMarkupBps: number;
  /** Base cost → affiliate markup (off cost). */
  affiliateMarkupBps: number;
  /** Base cost → suggested retail markup (off cost; customer-facing fallback). */
  retailMarkupBps: number;
  /** Damage coverage fee on the affiliate's cabinet cost. */
  damageFeeBps: number;
  /** Technology fee on the affiliate's cabinet cost. */
  techFeeBps: number;
  /** Hard cap on the tech fee, in cents. */
  techFeeCapCents: number;
  /** Card processing fee on the affiliate's cabinet cost — card payments only. */
  cardFeeBps: number;
}

export const DEFAULT_PRICING_SETTINGS: PlatformPricingSettings = {
  wholesaleMarkupBps: 1500, // 15% (illustrative; admin-editable)
  affiliateMarkupBps: 500, //  5%
  retailMarkupBps: 2500, // 25% (illustrative; admin-editable)
  damageFeeBps: 100, //  1%
  techFeeBps: 1000, // 10%
  techFeeCapCents: 10000, // $100.00
  cardFeeBps: 400, //  4%
};

/**
 * Clamp/normalize a partial settings object (e.g. a DB row with nullable cols)
 * into a complete settings object, falling back to defaults for any missing or
 * invalid (negative / non-finite) field.
 */
export function normalizePricingSettings(
  partial: Partial<Record<keyof PlatformPricingSettings, number | null | undefined>> | null | undefined,
): PlatformPricingSettings {
  const pick = (v: number | null | undefined, dflt: number): number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : dflt;
  const p = partial ?? {};
  return {
    wholesaleMarkupBps: pick(p.wholesaleMarkupBps, DEFAULT_PRICING_SETTINGS.wholesaleMarkupBps),
    affiliateMarkupBps: pick(p.affiliateMarkupBps, DEFAULT_PRICING_SETTINGS.affiliateMarkupBps),
    retailMarkupBps: pick(p.retailMarkupBps, DEFAULT_PRICING_SETTINGS.retailMarkupBps),
    damageFeeBps: pick(p.damageFeeBps, DEFAULT_PRICING_SETTINGS.damageFeeBps),
    techFeeBps: pick(p.techFeeBps, DEFAULT_PRICING_SETTINGS.techFeeBps),
    techFeeCapCents: pick(p.techFeeCapCents, DEFAULT_PRICING_SETTINGS.techFeeCapCents),
    cardFeeBps: pick(p.cardFeeBps, DEFAULT_PRICING_SETTINGS.cardFeeBps),
  };
}

// ─── Price ladder ────────────────────────────────────────────────────────────
export interface PriceLadder {
  /** Internal base cost (what the platform pays). */
  baseCostCents: number;
  /** base × (1 + wholesale%). */
  wholesaleCents: number;
  /** base × (1 + affiliate%) — what an affiliate pays. */
  affiliateCents: number;
  /** base × (1 + retail%) — customer-facing suggested retail. */
  suggestedRetailCents: number;
}

/**
 * Derive the full price ladder for a single cabinet line from its internal base
 * cost. Every tier marks up off the SAME base cost (independent margins) — there
 * is no markup-on-markup chaining, so each percentage is measured against cost.
 */
export function priceLadder(
  baseCostCents: number,
  settings: PlatformPricingSettings = DEFAULT_PRICING_SETTINGS,
): PriceLadder {
  const base = Math.max(0, roundCents(baseCostCents));
  const wholesale = base + applyBps(base, settings.wholesaleMarkupBps);
  const affiliate = base + applyBps(base, settings.affiliateMarkupBps);
  const suggestedRetail = base + applyBps(base, settings.retailMarkupBps);
  return {
    baseCostCents: base,
    wholesaleCents: wholesale,
    affiliateCents: affiliate,
    suggestedRetailCents: suggestedRetail,
  };
}

// ─── Order fee stack ─────────────────────────────────────────────────────────
export type PaymentMethod = "card" | "ach";

export interface FeeStackInput {
  /** Customer-facing cabinet merchandise subtotal in cents. */
  cabinetSubtotalCents: number;
  /** Customer freight in cents. It is never an affiliate-fee base. */
  freightCents?: number;
  /** "card" adds the card fee; "ach" (bank transfer) waives it. */
  paymentMethod: PaymentMethod;
  /** Only matters for an affiliate ACH invoice: an approved transfer waives the card fee. */
  achApproved?: boolean;
  /**
   * True only for an affiliate's internal cost invoice. Customer retail checkouts
   * never become affiliate fee bases merely because the order was referred.
   */
  isAffiliateOrder?: boolean;
  /** The affiliate's actual cabinet cost in cents. Required to assess any fee. */
  affiliateCostCents?: number;
}

export interface FeeStack {
  cabinetSubtotalCents: number;
  freightCents: number;
  /** Customer merchandise + freight; does not include affiliate-only fees. */
  customerTotalCents: number;
  /** Actual affiliate cabinet cost supplied for the affiliate invoice. */
  affiliateCostCents: number;
  /** 1% of affiliate cost; zero for a customer/direct order. */
  damageFeeCents: number;
  /** 10% of affiliate cost, capped at $100; zero for a customer/direct order. */
  techFeeCents: number;
  /** True when the cap clipped the tech fee. */
  techFeeCapped: boolean;
  /** Customer retail checkout: merchandise + freight, before tax. */
  preCardTotalCents: number;
  /** 4% of affiliate cost, or 0 for approved affiliate ACH/direct customer orders. */
  cardFeeCents: number;
  /** The affiliate's cabinet cost plus affiliate-only fees; excludes freight. */
  affiliateTotalCostCents: number;
  /** Final customer checkout amount before tax: merchandise + freight only. */
  totalCents: number;
}

/**
 * Compute the customer checkout and a separate affiliate-cost fee stack. Fee
 * percentages apply only to an explicit affiliate cost; they never use retail
 * merchandise, freight, tax, or a derived/guessed supplier cost.
 */
export function computeFeeStack(
  input: FeeStackInput,
  settings: PlatformPricingSettings = DEFAULT_PRICING_SETTINGS,
): FeeStack {
  const cabinetSubtotalCents = Math.max(0, roundCents(input.cabinetSubtotalCents));
  const freightCents = Math.max(0, roundCents(input.freightCents ?? 0));
  const isAffiliateCostInvoice = Boolean(input.isAffiliateOrder && input.affiliateCostCents != null);
  const affiliateCostCents = isAffiliateCostInvoice
    ? Math.max(0, roundCents(input.affiliateCostCents ?? 0))
    : 0;

  // Each extra fee is based only on the affiliate's actual cabinet cost.
  const damageFeeCents = isAffiliateCostInvoice ? applyBps(affiliateCostCents, settings.damageFeeBps) : 0;

  const techFeeRaw = isAffiliateCostInvoice
    ? applyBps(affiliateCostCents, settings.techFeeBps)
    : 0;
  const techFeeCapped = Boolean(isAffiliateCostInvoice && settings.techFeeCapCents > 0 && techFeeRaw > settings.techFeeCapCents);
  const techFeeCents = techFeeCapped ? settings.techFeeCapCents : techFeeRaw;

  const customerTotalCents = cabinetSubtotalCents + freightCents;

  // Card fee — only for an affiliate cost invoice. Freight and other fees never compound it.
  const achWaives = input.paymentMethod === "ach" && (input.achApproved ?? false);
  const cardFeeCents = !isAffiliateCostInvoice || achWaives ? 0 : applyBps(affiliateCostCents, settings.cardFeeBps);
  const affiliateTotalCostCents = affiliateCostCents + damageFeeCents + techFeeCents + cardFeeCents;

  return {
    cabinetSubtotalCents,
    freightCents,
    customerTotalCents,
    affiliateCostCents,
    damageFeeCents,
    techFeeCents,
    techFeeCapped,
    preCardTotalCents: customerTotalCents,
    cardFeeCents,
    affiliateTotalCostCents,
    totalCents: customerTotalCents,
  };
}

/** Human label for a payment method. */
export function paymentMethodLabel(m: PaymentMethod): string {
  return m === "ach" ? "Bank transfer (ACH)" : "Credit / debit card";
}

/** Format whole cents as a $ string, e.g. 12345 → "$123.45". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(roundCents(cents));
  return `${sign}$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
