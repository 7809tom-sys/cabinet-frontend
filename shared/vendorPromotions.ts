/** Vendor promotions stack on the normal sell price. One promotion applies per item. */

export const VENDOR_DISCOUNT_TYPES = ["percent", "fixed_amount", "fixed_price"] as const;
export type VendorDiscountType = (typeof VENDOR_DISCOUNT_TYPES)[number];

export type VendorPromotionRule = {
  id: number;
  distributorId: number;
  name: string;
  skuIds: number[] | null;
  styleId: number | null;
  category: string | null;
  discountType: VendorDiscountType;
  discountValue: number;
  isActive?: boolean;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
};

export type PromotionItem = {
  distributorId: number;
  skuId?: number | null;
  styleId?: number | null;
  category?: string | null;
};

export type PricedCandidate = PromotionItem & {
  basePrice: number;
};

export type PromotedPrice = {
  unitPrice: number;
  originalPrice: number;
  promo: VendorPromotionRule | null;
};

const MONEY_TOLERANCE = 0.02;

export function parseSkuIds(value: unknown): number[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const ids = Array.from(new Set(value.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0)));
  return ids.length > 0 ? ids : null;
}

export function toPromotionRule(row: {
  id: number;
  distributorId: number;
  name: string;
  skuIds: unknown;
  styleId: number | null;
  category: string | null;
  discountType: string;
  discountValue: string | number;
  isActive?: boolean;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
}): VendorPromotionRule {
  const discountType = VENDOR_DISCOUNT_TYPES.includes(row.discountType as VendorDiscountType)
    ? row.discountType as VendorDiscountType
    : "percent";
  return {
    id: row.id,
    distributorId: row.distributorId,
    name: row.name,
    skuIds: parseSkuIds(row.skuIds),
    styleId: row.styleId,
    category: row.category?.trim() || null,
    discountType,
    discountValue: Number(row.discountValue),
    isActive: row.isActive,
    startsAt: row.startsAt ?? null,
    endsAt: row.endsAt ?? null,
  };
}

export function vendorDiscountError(discountType: VendorDiscountType, discountValue: number): string | null {
  if (!Number.isFinite(discountValue)) return "Enter a valid discount.";
  if (discountType === "percent") {
    if (discountValue <= 0 || discountValue > 100) return "Percent off must be greater than 0 and at most 100.";
    return null;
  }
  if (discountValue <= 0) return "The discount amount must be greater than 0.";
  if (discountValue > 1_000_000) return "The discount amount is too large.";
  return null;
}

export function vendorPromotionWindowError(startsAt?: Date | string | null, endsAt?: Date | string | null): string | null {
  if (!startsAt || !endsAt) return null;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "Enter a valid start and end date.";
  if (end <= start) return "The end date must be after the start date.";
  return null;
}

function asTime(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function promotionIsCurrent(promo: VendorPromotionRule, now = new Date()): boolean {
  if (promo.isActive === false) return false;
  const time = now.getTime();
  const start = asTime(promo.startsAt);
  const end = asTime(promo.endsAt);
  if (start != null && start > time) return false;
  if (end != null && end < time) return false;
  return true;
}

function matchesScope(promo: VendorPromotionRule, item: PromotionItem): boolean {
  if (promo.distributorId !== item.distributorId) return false;
  if (promo.skuIds && (item.skuId == null || !promo.skuIds.includes(item.skuId))) return false;
  if (promo.styleId != null && promo.styleId !== item.styleId) return false;
  if (promo.category && promo.category !== item.category) return false;
  return true;
}

/** More specific scopes win. Equal scope keeps the lower resulting price. */
export function promotionSpecificity(promo: VendorPromotionRule): number {
  let score = 0;
  if (promo.skuIds?.length) score += 4;
  if (promo.styleId != null) score += 2;
  if (promo.category) score += 1;
  return score;
}

export function applyVendorDiscount(basePrice: number, promo: VendorPromotionRule): number {
  if (!Number.isFinite(basePrice) || basePrice < 0) return basePrice;
  const value = Number(promo.discountValue);
  if (!Number.isFinite(value) || value <= 0) return roundMoney(basePrice);
  if (promo.discountType === "percent") {
    const percent = Math.min(100, value);
    return roundMoney(Math.max(0, basePrice * (1 - percent / 100)));
  }
  if (promo.discountType === "fixed_amount") {
    return roundMoney(Math.max(0, basePrice - value));
  }
  // Legacy fixed_price replaces the sell price. New promotions use percent or fixed_amount.
  return roundMoney(Math.max(0, value));
}

export function selectVendorPromotion(
  promos: readonly VendorPromotionRule[],
  item: PromotionItem,
  now = new Date(),
): VendorPromotionRule | null {
  const matches = promos.filter((promo) => promotionIsCurrent(promo, now) && matchesScope(promo, item));
  if (matches.length === 0) return null;
  return matches.sort((left, right) => {
    const specificity = promotionSpecificity(right) - promotionSpecificity(left);
    if (specificity !== 0) return specificity;
    const price = applyVendorDiscount(100, left) - applyVendorDiscount(100, right);
    if (price !== 0) return price;
    return left.id - right.id;
  })[0] ?? null;
}

export function choosePromotedPrice(
  candidates: readonly PricedCandidate[],
  promos: readonly VendorPromotionRule[],
  now = new Date(),
): PromotedPrice | null {
  let best: PromotedPrice | null = null;
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.basePrice) || candidate.basePrice < 0) continue;
    const promo = selectVendorPromotion(promos, candidate, now);
    const originalPrice = roundMoney(candidate.basePrice);
    const unitPrice = promo ? applyVendorDiscount(originalPrice, promo) : originalPrice;
    const choice: PromotedPrice = { unitPrice, originalPrice, promo };
    if (!best || choice.unitPrice < best.unitPrice || (choice.unitPrice === best.unitPrice && choice.originalPrice < best.originalPrice)) {
      best = choice;
    }
  }
  return best;
}

/**
 * Keep a hand-entered quote when it is neither the normal price nor the promoted price.
 * A submitted normal price is replaced by the promoted price so cart and checkout match.
 */
export function reconcilePromotionPrice(submitted: number | null | undefined, originalPrice: number, promotedPrice: number): number {
  if (submitted == null || !Number.isFinite(submitted)) return promotedPrice;
  if (Math.abs(submitted - originalPrice) < MONEY_TOLERANCE) return promotedPrice;
  if (Math.abs(submitted - promotedPrice) < MONEY_TOLERANCE) return promotedPrice;
  return roundMoney(submitted);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
