import { describe, expect, it } from "vitest";
import { checkoutUnitPriceForLine, isCabinetFreightLine } from "./orderLinePricing";

describe("checkout surface pricing", () => {
  it("keeps the authoritative selected countertop slab price through checkout", () => {
    const line = {
      matched: true,
      cabinetId: null,
      masterCode: "PEL-404",
      cartProductKind: "surface",
      cartPriceLocked: true,
      cartUnitPrice: 1200,
    };
    expect(checkoutUnitPriceForLine(line, null)).toBe(1200);
    expect(checkoutUnitPriceForLine(line, null)! * 2).toBe(2400);
  });

  it("keeps a presentation-only or unpriced countertop out of the priced total", () => {
    expect(checkoutUnitPriceForLine({
      matched: false,
      cabinetId: null,
      masterCode: "COUNTERTOP-QUOTE",
      cartProductKind: "surface",
      cartPriceLocked: false,
      cartUnitPrice: null,
    }, null)).toBeNull();
  });

  it("never sends a selected countertop slab through cabinet freight palletization", () => {
    expect(isCabinetFreightLine({
      matched: true,
      cabinetId: null,
      masterCode: "PEL-404",
      cartProductKind: "surface",
      cartPriceLocked: true,
      cartUnitPrice: 1200,
    })).toBe(false);
  });

  it("preserves existing live and locked cabinet pricing behavior", () => {
    expect(checkoutUnitPriceForLine({
      matched: true,
      cabinetId: 42,
      masterCode: "B24",
      cartPriceLocked: false,
      cartUnitPrice: 300,
    }, 325)).toBe(325);
    expect(checkoutUnitPriceForLine({
      matched: true,
      cabinetId: 42,
      masterCode: "B24",
      cartPriceLocked: true,
      cartUnitPrice: 300,
    }, 325)).toBe(300);
  });
});
