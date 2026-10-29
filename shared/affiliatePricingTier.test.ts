import { describe, expect, it } from "vitest";
import {
  ATTACH_AFFILIATE_MARKUP_SHARE_BPS,
  ATTACH_PLATFORM_MARKUP_SHARE_BPS,
  affiliateTierSummary,
  isAttachProductCategory,
  resolveAffiliateTierCost,
  unassignedAffiliateTier,
  validateAffiliateTierDraft,
} from "./affiliatePricingTier";

describe("resolveAffiliateTierCost", () => {
  it("keeps the platform affiliate markup when no tier is assigned", () => {
    const cost = resolveAffiliateTierCost({
      yourCostCents: 10_000,
      listPriceCents: 40_000,
      platformAffiliateMarkupBps: 500,
      tier: null,
    });
    expect(cost).toEqual({ affiliateCostCents: 10_500, source: "platform_default" });
  });

  it("multiplies Cabinetdealz cost by the assigned tier", () => {
    const cost = resolveAffiliateTierCost({
      yourCostCents: 10_000,
      listPriceCents: 40_000,
      platformAffiliateMarkupBps: 500,
      tier: { basis: "cost_multiplier", basisPoints: 12_500 },
    });
    expect(cost).toEqual({ affiliateCostCents: 12_500, source: "tier_cost_multiplier" });
  });

  it("prices a list-discount tier from list, not from the platform markup", () => {
    const cost = resolveAffiliateTierCost({
      yourCostCents: 10_000,
      listPriceCents: 20_000,
      platformAffiliateMarkupBps: 500,
      tier: { basis: "list_discount", basisPoints: 1_000 },
    });
    expect(cost).toEqual({ affiliateCostCents: 18_000, source: "tier_list_discount" });
  });

  it("falls back to the platform markup when a list-discount tier has no list", () => {
    const cost = resolveAffiliateTierCost({
      yourCostCents: 10_000,
      listPriceCents: null,
      platformAffiliateMarkupBps: 500,
      tier: { basis: "list_discount", basisPoints: 1_000 },
    });
    expect(cost.source).toBe("platform_default");
    expect(cost.affiliateCostCents).toBe(10_500);
  });

  it("splits attach-product markup 40/60 and ignores the cabinet tier", () => {
    expect(ATTACH_PLATFORM_MARKUP_SHARE_BPS).toBe(4000);
    expect(ATTACH_AFFILIATE_MARKUP_SHARE_BPS).toBe(6000);
    const cost = resolveAffiliateTierCost({
      yourCostCents: 10_000,
      listPriceCents: 20_000,
      referenceRetailCents: 20_000,
      productClass: "attach",
      platformAffiliateMarkupBps: 500,
      tier: { basis: "cost_multiplier", basisPoints: 5_000 },
    });
    // $100 cost, $200 reference. Cabinetdealz keeps 40% of the $100 spread.
    expect(cost).toEqual({ affiliateCostCents: 14_000, source: "attach_split" });
  });

  it("treats flooring and appliances as attach products", () => {
    expect(isAttachProductCategory("Flooring")).toBe(true);
    expect(isAttachProductCategory("Appliances")).toBe(true);
    expect(isAttachProductCategory("Base")).toBe(false);
    expect(isAttachProductCategory("Sinks & Faucets")).toBe(false);
  });
});

describe("affiliate tier drafts", () => {
  it("rejects a tier that would zero every price", () => {
    const zero = validateAffiliateTierDraft({
      tierName: "Broken",
      basis: "list_discount",
      basisPoints: 10_000,
      volumeThresholdCents: null,
      examplePlaceholder: false,
      notes: null,
      active: true,
      sortOrder: 0,
    });
    expect(zero.ok).toBe(false);
  });

  it("labels example placeholders without treating them as a live discount", () => {
    expect(affiliateTierSummary({
      basis: "cost_multiplier",
      basisPoints: 10_000,
      volumeThresholdCents: null,
      examplePlaceholder: true,
    })).toBe("×1.00 of Cabinetdealz cost · example placeholder");
    expect(unassignedAffiliateTier().assigned).toBe(false);
  });
});
