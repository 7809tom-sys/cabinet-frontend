import { describe, expect, it } from "vitest";
import { resolveAffiliateStorefrontSale } from "./affiliateBranding";
import { DEFAULT_PRICING_SETTINGS } from "./pricing";
import {
  CONTRACTOR_FLOOR_MULTIPLIER_BPS,
  HARD_FLOOR_MULTIPLIER_BPS,
  checkContractorMarkupSave,
  checkRetailMarkupSave,
  clampContractorPriceCents,
  contractorFloorMultiplierBps,
  contractorStoreCostFloorCents,
  costFloorCents,
  minContractorMarkupPercent,
  normalizePriceFloors,
  storeCostBasisBps,
} from "./priceFloors";

// Live examples (diag-tom-shop-scm-price.md, Nov 16, 2026):
// SCM 2DB12: list 1414.00, yourCost 347.99. TWP B12: list 721.00, yourCost 177.44.
// Mirror of cabinet-backend shared/priceFloors.test.ts (sell-time contractor
// pricing lives in the backend's shared/margins.ts; this repo's margins.ts is an
// older copy the client does not import).
const PLATFORM = { ...DEFAULT_PRICING_SETTINGS, affiliateMarkupBps: 500 };

describe("constants and floor math", () => {
  it("uses cost × 1.15 and cost × 1.38, rounded up to the cent", () => {
    expect(HARD_FLOOR_MULTIPLIER_BPS).toBe(11500);
    expect(CONTRACTOR_FLOOR_MULTIPLIER_BPS).toBe(13800);
    expect(costFloorCents(34799, 11500)).toBe(40019);
    expect(costFloorCents(34799, 13800)).toBe(48023);
    expect(costFloorCents(17744, 11500)).toBe(20406);
    expect(costFloorCents(null, 11500)).toBeNull();
    expect(costFloorCents(0, 11500)).toBeNull();
  });

  it("reads pricing_settings floors with safe fallbacks and never below 1.15", () => {
    expect(normalizePriceFloors(null)).toEqual({ hardFloorBps: 11500, contractorFloorBps: 13800 });
    expect(normalizePriceFloors({ minMarginOverCostBps: 11500, contractorRecommendedBps: 13800 })).toEqual({ hardFloorBps: 11500, contractorFloorBps: 13800 });
    expect(normalizePriceFloors({ minMarginOverCostBps: 10000 })).toEqual({ hardFloorBps: 11500, contractorFloorBps: 13800 });
    expect(normalizePriceFloors({ minMarginOverCostBps: "12000", contractorRecommendedBps: "11000" })).toEqual({ hardFloorBps: 12000, contractorFloorBps: 12000 });
  });
});

describe("rule 1 + 4: affiliate retail never below cost × 1.15", () => {
  it("lifts a 0% store markup to the hard floor (SCM 2DB12, TWP B12)", () => {
    const zero = { globalMarkupBps: 0 };
    // Before: cost × 1.05 = $365.39 / $186.31. After: cost × 1.15.
    expect(resolveAffiliateStorefrontSale(34799, PLATFORM, zero).retailCents).toBe(40019);
    expect(resolveAffiliateStorefrontSale(17744, PLATFORM, zero).retailCents).toBe(20406);
    const sale = resolveAffiliateStorefrontSale(34799, PLATFORM, zero);
    expect(sale.affiliateCostCents).toBe(36539);
    expect(sale.profitCents).toBe(40019 - 36539);
  });

  it("leaves normal markups alone (55% → cost × 1.6275, SCM $566.35)", () => {
    expect(resolveAffiliateStorefrontSale(34799, PLATFORM, { globalMarkupBps: 5500 }).retailCents).toBe(56635);
  });

  it("clamps a 0% list_discount tier only when list is under the floor; a cost tier ×1.00 is lifted", () => {
    const listTier = { basis: "list_discount" as const, basisPoints: 0 };
    // Tom Cabinets Shop today: 0% off list + 55% = list × 1.55, far above the floor (unchanged).
    expect(resolveAffiliateStorefrontSale(34799, PLATFORM, { globalMarkupBps: 5500 }, { listPriceCents: 141400, tier: listTier }).retailCents).toBe(219170);
    // A list below cost × 1.15 at 0% markup is lifted.
    expect(resolveAffiliateStorefrontSale(34799, PLATFORM, { globalMarkupBps: 0 }, { listPriceCents: 35000, tier: listTier }).retailCents).toBe(40019);
    const costTier = { basis: "cost_multiplier" as const, basisPoints: 10000 };
    expect(resolveAffiliateStorefrontSale(34799, PLATFORM, { globalMarkupBps: 0 }, { tier: costTier }).retailCents).toBe(40019);
  });

  it("honors a higher floor read from pricing_settings", () => {
    const floors = normalizePriceFloors({ minMarginOverCostBps: 12000 });
    expect(resolveAffiliateStorefrontSale(10000, PLATFORM, { globalMarkupBps: 0 }, { floors }).retailCents).toBe(12000);
  });

  it("rejects retail saves under 1.15 server-side, including style/category overrides", () => {
    const basis = storeCostBasisBps(null, 500);
    expect(basis).toBe(10500);
    expect(checkRetailMarkupSave({ markupBps: 0, basisBps: basis })).toMatchObject({ ok: false });
    expect(checkRetailMarkupSave({ markupBps: 952, basisBps: basis })).toMatchObject({ ok: false });
    expect(checkRetailMarkupSave({ markupBps: 953, basisBps: basis })).toEqual({ ok: true });
    expect(checkRetailMarkupSave({ markupBps: 4000, basisBps: basis })).toEqual({ ok: true });
    // Unknown per-SKU basis (list_discount tier) and null (fall back to default) pass; sell time clamps.
    expect(storeCostBasisBps({ basis: "list_discount", basisPoints: 0 }, 500)).toBeNull();
    expect(checkRetailMarkupSave({ markupBps: 0, basisBps: null })).toEqual({ ok: true });
    expect(checkRetailMarkupSave({ markupBps: null, basisBps: basis })).toEqual({ ok: true });
    const rejected = checkRetailMarkupSave({ markupBps: 0, basisBps: basis });
    expect(rejected.ok ? "" : rejected.message).toContain("below the minimum of cost × 1.15");
  });
});


describe("rule 2: contractor price never below cost × 1.38 without an admin override", () => {
  it("rejects affiliate saves under 1.38, including 'use site default' when the site tier is under it", () => {
    const basis = storeCostBasisBps(null, 500);
    expect(checkContractorMarkupSave({ markupBps: 2000, basisBps: basis, siteContractorMarkupBps: 12900, isAdmin: false })).toMatchObject({ ok: false });
    expect(checkContractorMarkupSave({ markupBps: 3142, basisBps: basis, siteContractorMarkupBps: 12900, isAdmin: false })).toMatchObject({ ok: false });
    expect(checkContractorMarkupSave({ markupBps: 3143, basisBps: basis, siteContractorMarkupBps: 12900, isAdmin: false })).toEqual({ ok: true });
    expect(minContractorMarkupPercent(basis)).toBe(31.43);
    // Site default is floored at 1.38 at sell time, so clearing never lands under it.
    expect(checkContractorMarkupSave({ markupBps: null, basisBps: basis, siteContractorMarkupBps: 12900, isAdmin: false })).toEqual({ ok: true });
    // A raised hard floor above the site tier still lets the clamp hold.
    expect(checkContractorMarkupSave({ markupBps: null, basisBps: basis, siteContractorMarkupBps: 10000, isAdmin: false, floors: { hardFloorBps: 11500, contractorFloorBps: 13800 } })).toEqual({ ok: true });
  });

  it("admin needs an override to save under 1.38 and can never save under 1.15", () => {
    const basis = storeCostBasisBps(null, 500);
    const noOverride = checkContractorMarkupSave({ markupBps: 2000, basisBps: basis, siteContractorMarkupBps: 12900, isAdmin: true });
    expect(noOverride.ok ? "" : noOverride.message).toContain("Set an admin override");
    expect(checkContractorMarkupSave({ markupBps: 1429, basisBps: basis, siteContractorMarkupBps: 12900, isAdmin: true, adminOverrideBps: 12000 })).toEqual({ ok: true });
    const underHard = checkContractorMarkupSave({ markupBps: 0, basisBps: basis, siteContractorMarkupBps: 12900, isAdmin: true, adminOverrideBps: 11500 });
    expect(underHard.ok ? "" : underHard.message).toContain("No override can go below that");
    // An affiliate is held to the store's override when one exists.
    expect(checkContractorMarkupSave({ markupBps: 1429, basisBps: basis, siteContractorMarkupBps: 12900, isAdmin: false, adminOverrideBps: 12000 })).toEqual({ ok: true });
    expect(minContractorMarkupPercent(basis, 12000)).toBe(14.29);
  });
});

describe("rule 3: a contractor never pays less than what the store pays (not the shelf price)", () => {
  it("compares against the store's affiliate cost in one function", () => {
    expect(contractorStoreCostFloorCents(36539)).toBe(36539);
    expect(contractorStoreCostFloorCents(null)).toBeNull();
    expect(clampContractorPriceCents({ priceCents: 30000, yourCostCents: 20000, storeCostCents: 35000, adminOverrideBps: 11500 })).toBe(35000);
  });
});
