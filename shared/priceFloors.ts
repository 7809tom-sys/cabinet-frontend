// ─────────────────────────────────────────────────────────────────────────────
// Price floors (Tom, Nov 16, 2026, voice 11:54 and 11:55 AM CT).
//
// Every floor is a multiple of Cabinet Dealz cost (yourCost: the line's landed
// cost, e.g. USCD list × 0.23 × 1.07). A floor is never computed from list.
//
//   1. Hard floor: no sell price (homeowner, affiliate retail, contractor, any
//      payment method) goes below yourCost × 1.15. Admin included.
//   2. Contractor floor: yourCost × 1.38 is the recommended trade price and the
//      floor. Going lower needs an explicit admin override (Tom's admin page),
//      and even an override never goes below the 1.15 hard floor.
//   3. A contractor never pays less than what the store itself pays Cabinet
//      Dealz for that store/line (the store's affiliate cost). Confirmed by Tom
//      at 11:55 AM CT. It is NOT the store's shelf price.
//
// All money here is integer cents; multipliers are basis points on cost
// (10000 = ×1.00, 11500 = ×1.15, 13800 = ×1.38).
// ─────────────────────────────────────────────────────────────────────────────

/** Hard floor for every sell price: yourCost × 1.15. */
export const HARD_FLOOR_MULTIPLIER_BPS = 11500;
/** Recommended / default contractor price and contractor floor: yourCost × 1.38. */
export const CONTRACTOR_FLOOR_MULTIPLIER_BPS = 13800;

const NEUTRAL = 10000;

/**
 * Floors in effect. Read from pricing_settings.minMarginOverCostBps and
 * pricing_settings.contractorRecommendedBps when those columns exist; the
 * constants above are the fallback. normalizePriceFloors guarantees the hard
 * floor is never under 1.15 and the contractor floor never under the hard floor.
 */
export interface PriceFloorSettings {
  hardFloorBps: number;
  contractorFloorBps: number;
}

export const DEFAULT_PRICE_FLOORS: PriceFloorSettings = {
  hardFloorBps: HARD_FLOOR_MULTIPLIER_BPS,
  contractorFloorBps: CONTRACTOR_FLOOR_MULTIPLIER_BPS,
};

function finiteInt(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
}

export function normalizePriceFloors(raw?: {
  minMarginOverCostBps?: number | string | null;
  contractorRecommendedBps?: number | string | null;
} | null): PriceFloorSettings {
  const hard = Math.max(HARD_FLOOR_MULTIPLIER_BPS, finiteInt(raw?.minMarginOverCostBps) ?? HARD_FLOOR_MULTIPLIER_BPS);
  const contractor = Math.max(hard, finiteInt(raw?.contractorRecommendedBps) ?? CONTRACTOR_FLOOR_MULTIPLIER_BPS);
  return { hardFloorBps: hard, contractorFloorBps: contractor };
}

function floorsOrDefault(floors?: PriceFloorSettings | null): PriceFloorSettings {
  return floors ? normalizePriceFloors({ minMarginOverCostBps: floors.hardFloorBps, contractorRecommendedBps: floors.contractorFloorBps }) : DEFAULT_PRICE_FLOORS;
}

function positiveCents(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const cents = Math.round(value);
  return cents > 0 ? cents : null;
}

/** yourCost × multiplier, rounded up to the cent so the floor is never undercut by rounding. */
export function costFloorCents(yourCostCents: number | null | undefined, multiplierBps: number): number | null {
  const cost = positiveCents(yourCostCents);
  if (cost == null) return null;
  return Math.ceil((cost * multiplierBps) / NEUTRAL - 1e-9);
}

/** Hard 1.15 floor in cents, or null when cost is unknown (no floor is invented). */
export function hardFloorCents(yourCostCents: number | null | undefined, floors?: PriceFloorSettings | null): number | null {
  return costFloorCents(yourCostCents, floorsOrDefault(floors).hardFloorBps);
}

/** Lift a price to the 1.15 hard floor. Unknown cost leaves the price unchanged. */
export function clampToHardFloorCents(
  priceCents: number,
  yourCostCents: number | null | undefined,
  floors?: PriceFloorSettings | null,
): number {
  const floor = hardFloorCents(yourCostCents, floors);
  return floor != null && priceCents < floor ? floor : priceCents;
}

/** True when an admin override value is usable: from the hard floor (1.15) up to the contractor floor (1.38). */
export function isValidContractorOverrideBps(value: number | null | undefined, floors?: PriceFloorSettings | null): value is number {
  const f = floorsOrDefault(floors);
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= f.hardFloorBps
    && value <= f.contractorFloorBps;
}

/**
 * Contractor floor multiplier on yourCost: 1.38 by default. An admin override
 * lowers it, but never below the 1.15 hard floor. An override at or above 1.38
 * means "no override".
 */
export function contractorFloorMultiplierBps(adminOverrideBps?: number | null, floors?: PriceFloorSettings | null): number {
  const f = floorsOrDefault(floors);
  if (adminOverrideBps == null || !Number.isFinite(adminOverrideBps)) return f.contractorFloorBps;
  const rounded = Math.round(adminOverrideBps);
  if (rounded >= f.contractorFloorBps) return f.contractorFloorBps;
  return Math.max(f.hardFloorBps, rounded);
}

/**
 * Rule 3 (Tom, 11:55 AM CT): a contractor never pays less than what the store
 * itself pays for that store/line — the store's affiliate cost — not its shelf
 * price. Kept as its own function so the comparison is in one place.
 */
export function contractorStoreCostFloorCents(storeCostCents: number | null | undefined): number | null {
  return positiveCents(storeCostCents);
}

export interface ContractorFloorInput {
  /** The computed contractor price before floors (cents). */
  priceCents: number;
  /** Cabinet Dealz cost for the SKU (cents). Null = unknown: only the store-cost floor applies. */
  yourCostCents: number | null | undefined;
  /** What the contractor's store pays for this SKU (cents). Null for site-level contractors. */
  storeCostCents?: number | null;
  /** Admin-only override multiplier on yourCost (bps, 11500..13800). Null = 1.38. */
  adminOverrideBps?: number | null;
  /** Floors from pricing_settings; defaults to 1.15 / 1.38. */
  floors?: PriceFloorSettings | null;
}

/** Contractor price after every floor: max(price, store cost, yourCost × max(1.15, override ?? 1.38)). */
export function clampContractorPriceCents(input: ContractorFloorInput): number {
  let price = Math.max(0, Math.round(input.priceCents));
  const storeFloor = contractorStoreCostFloorCents(input.storeCostCents);
  if (storeFloor != null && price < storeFloor) price = storeFloor;
  const tradeFloor = costFloorCents(input.yourCostCents, contractorFloorMultiplierBps(input.adminOverrideBps, input.floors));
  if (tradeFloor != null && price < tradeFloor) price = tradeFloor;
  return clampToHardFloorCents(price, input.yourCostCents, input.floors);
}

/**
 * Lowest markup over a cost basis that still reaches `floorBps` on yourCost,
 * where the basis is yourCost × basisMultiplierBps (e.g. the store's 1.05 cost).
 * Returned in markup bps (100 = 1%), rounded up. 0 when the basis already meets the floor.
 */
export function minMarkupBpsForFloor(basisMultiplierBps: number, floorBps: number): number {
  if (!Number.isFinite(basisMultiplierBps) || basisMultiplierBps <= 0) return 0;
  const needed = (floorBps / basisMultiplierBps) * NEUTRAL - NEUTRAL;
  return needed <= 0 ? 0 : Math.ceil(needed - 1e-9);
}

/** Effective multiplier on yourCost of a markup over a cost basis: basis × (1 + markup). */
export function effectiveMultiplierBps(basisMultiplierBps: number, markupBps: number): number {
  return (basisMultiplierBps * (NEUTRAL + markupBps)) / NEUTRAL;
}

/** Plain message for an affiliate save rejected by a floor. */
export function floorRejectionMessage(kind: "retail" | "contractor", effectiveBps: number, floorBps: number): string {
  const fmt = (bps: number) => (bps / NEUTRAL).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (kind === "retail") {
    return `That markup would price items at Cabinet Dealz cost × ${fmt(effectiveBps)}, below the minimum of cost × ${fmt(floorBps)}. Choose a higher markup.`;
  }
  return `That contractor price would be Cabinet Dealz cost × ${fmt(effectiveBps)}, below the minimum of cost × ${fmt(floorBps)}. Contractor pricing below cost × 1.38 needs an override from Cabinet Dealz.`;
}

// ─── Write-time checks (server-side rejection of below-floor saves) ──────────

/**
 * What a store pays per unit of Cabinet Dealz cost, as a multiplier (bps):
 * a cost_multiplier tier's basis points, else 1 + the platform affiliate markup
 * (500 → 10500 = cost × 1.05). A list_discount tier depends on each SKU's list,
 * so it returns null: those stores are covered by the sell-time clamp only.
 */
export function storeCostBasisBps(
  tier: { basis: "cost_multiplier" | "list_discount"; basisPoints: number } | null | undefined,
  platformAffiliateMarkupBps: number,
): number | null {
  if (tier) {
    const bps = Math.round(tier.basisPoints);
    if (tier.basis === "cost_multiplier" && bps >= 1 && bps <= 200_000) return bps;
    if (tier.basis === "list_discount" && bps >= 0 && bps < NEUTRAL) return null;
  }
  const platform = Number.isFinite(platformAffiliateMarkupBps) ? Math.max(0, Math.min(200_000, Math.round(platformAffiliateMarkupBps))) : 0;
  return NEUTRAL + platform;
}

export type FloorCheck = { ok: true } | { ok: false; message: string };

/**
 * Rule 4: an affiliate retail markup (default, category, or style) may not
 * price below cost × 1.15. Applies to admin saves too. Null markup (fall back
 * to the store default) and unknown basis (list_discount tier) pass here; the
 * sell-time clamp still applies.
 */
export function checkRetailMarkupSave(input: {
  markupBps: number | null | undefined;
  basisBps: number | null;
  floors?: PriceFloorSettings | null;
}): FloorCheck {
  if (input.markupBps == null || input.basisBps == null) return { ok: true };
  const floor = floorsOrDefault(input.floors).hardFloorBps;
  const effective = effectiveMultiplierBps(input.basisBps, input.markupBps);
  if (effective + 1e-9 < floor) return { ok: false, message: floorRejectionMessage("retail", effective, floor) };
  return { ok: true };
}

/**
 * Rule 2 at save time for affiliate_contractor_markups.
 * - markupBps set: basis × (1 + markup) must reach the store's contractor
 *   floor (1.38, or the admin override). Admin is held to the same floor unless
 *   an override exists (or is set in the same save), and never below 1.15.
 * - markupBps null ("use site default"): the store falls back to the site
 *   contractor multiplier, which is itself floored at 1.38 at sell time, so the
 *   check uses that floored value.
 */
export function checkContractorMarkupSave(input: {
  markupBps: number | null;
  basisBps: number | null;
  siteContractorMarkupBps: number;
  isAdmin: boolean;
  adminOverrideBps?: number | null;
  floors?: PriceFloorSettings | null;
}): FloorCheck {
  const f = floorsOrDefault(input.floors);
  const floor = contractorFloorMultiplierBps(input.adminOverrideBps, f);
  let effective: number | null;
  if (input.markupBps == null) {
    effective = Math.max(Math.round(Number(input.siteContractorMarkupBps) || 0), f.contractorFloorBps);
  } else if (input.basisBps == null) {
    return { ok: true };
  } else {
    effective = effectiveMultiplierBps(input.basisBps, input.markupBps);
  }
  if (effective + 1e-9 >= floor) return { ok: true };
  if (!input.isAdmin) return { ok: false, message: floorRejectionMessage("contractor", effective, floor) };
  if (effective + 1e-9 < f.hardFloorBps) {
    return { ok: false, message: `${floorRejectionMessage("contractor", effective, f.hardFloorBps)} No override can go below that.` };
  }
  return { ok: false, message: `${floorRejectionMessage("contractor", effective, floor)} Set an admin override for this store first.` };
}

/** Lowest contractor markup percent a store can save, for the UI hint. Null when the basis varies by SKU. */
export function minContractorMarkupPercent(basisBps: number | null, adminOverrideBps?: number | null, floors?: PriceFloorSettings | null): number | null {
  if (basisBps == null) return null;
  return minMarkupBpsForFloor(basisBps, contractorFloorMultiplierBps(adminOverrideBps, floors)) / 100;
}
