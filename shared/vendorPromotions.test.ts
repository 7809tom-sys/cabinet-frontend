import { describe, expect, it } from "vitest";
import {
  applyVendorDiscount,
  choosePromotedPrice,
  reconcilePromotionPrice,
  selectVendorPromotion,
  vendorDiscountError,
  type VendorPromotionRule,
} from "./vendorPromotions";

const catalog: VendorPromotionRule = {
  id: 1,
  distributorId: 4,
  name: "Extra 5% off",
  skuIds: null,
  styleId: null,
  category: null,
  discountType: "percent",
  discountValue: 5,
};

const shaker: VendorPromotionRule = {
  ...catalog,
  id: 2,
  name: "Shaker $25 off",
  styleId: 8,
  discountType: "fixed_amount",
  discountValue: 25,
};

const sku: VendorPromotionRule = {
  ...catalog,
  id: 3,
  name: "One cabinet",
  skuIds: [77],
  discountType: "percent",
  discountValue: 10,
};

const otherVendor: VendorPromotionRule = { ...catalog, id: 9, distributorId: 5, name: "Other line" };

describe("vendor promotion discounts", () => {
  it("rejects percent values outside 0 to 100 and empty amounts", () => {
    expect(vendorDiscountError("percent", 0)).toMatch(/at most 100/);
    expect(vendorDiscountError("percent", 100)).toBeNull();
    expect(vendorDiscountError("percent", 100.01)).toMatch(/at most 100/);
    expect(vendorDiscountError("fixed_amount", 5)).toBeNull();
    expect(vendorDiscountError("fixed_amount", 0)).toMatch(/greater than 0/);
  });

  it("stacks one additional discount on the normal price and prefers the most specific scope", () => {
    expect(applyVendorDiscount(200, catalog)).toBe(190);
    expect(applyVendorDiscount(200, shaker)).toBe(175);
    expect(applyVendorDiscount(20, shaker)).toBe(0);
    const item = { distributorId: 4, skuId: 77, styleId: 8, category: "Base" };
    expect(selectVendorPromotion([catalog, shaker, sku, otherVendor], item)?.id).toBe(3);
    expect(selectVendorPromotion([catalog, otherVendor], { distributorId: 4, styleId: 8, category: "Wall" })?.id).toBe(1);
    expect(selectVendorPromotion([otherVendor], item)).toBeNull();
  });

  it("applies only the owning vendor's promotion when choosing a sell price", () => {
    const own = choosePromotedPrice([
      { distributorId: 4, skuId: 77, styleId: 8, category: "Base", basePrice: 200 },
    ], [sku, otherVendor]);
    expect(own).toMatchObject({ unitPrice: 180, originalPrice: 200, promo: expect.objectContaining({ id: 3 }) });

    const foreign = choosePromotedPrice([
      { distributorId: 4, skuId: 77, styleId: 8, category: "Base", basePrice: 200 },
    ], [otherVendor]);
    expect(foreign).toMatchObject({ unitPrice: 200, originalPrice: 200, promo: null });
  });

  it("replaces a normal submitted price with the promoted price and leaves a manual quote alone", () => {
    expect(reconcilePromotionPrice(200, 200, 190)).toBe(190);
    expect(reconcilePromotionPrice(190, 200, 190)).toBe(190);
    expect(reconcilePromotionPrice(150, 200, 190)).toBe(150);
    expect(reconcilePromotionPrice(null, 200, 190)).toBe(190);
  });
});
