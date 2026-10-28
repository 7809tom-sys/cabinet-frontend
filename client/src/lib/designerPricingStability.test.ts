import { describe, expect, it } from "vitest";
import { countertopToastVisible, stablePricePairKey, COUNTERTOP_TOAST_TIMEOUT_MS } from "./designerPricingStability";

describe("designer pricing stability", () => {
  it("keeps the same pricing key when only the array identity changes", () => {
    const first = [
      { cabinetId: 4, styleId: 9, masterCode: "B24" },
      { cabinetId: 11, styleId: 9, masterCode: "BEP2535" },
    ];
    const second = [...first].reverse();
    expect(stablePricePairKey(second, 3)).toBe(stablePricePairKey(first, 3));
    expect(stablePricePairKey(first, 4)).not.toBe(stablePricePairKey(first, 3));
  });

  it("clears the countertop toast on success, on error, and after a timeout", () => {
    expect(COUNTERTOP_TOAST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(countertopToastVisible({ pending: true, failed: false, timedOut: false })).toBe(true);
    expect(countertopToastVisible({ pending: false, failed: false, timedOut: false })).toBe(false);
    expect(countertopToastVisible({ pending: true, failed: true, timedOut: false })).toBe(false);
    expect(countertopToastVisible({ pending: true, failed: false, timedOut: true })).toBe(false);
  });
});
