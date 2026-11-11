import { describe, expect, it } from "vitest";
import { sumCommission } from "./affiliate";
import {
  SALES_REP_COMMISSION_DEFAULTS,
  confirmedOrderGross,
  defaultCommissionSettings,
  normalizeCommissionSettings,
  residualLines,
  repFeeCheckoutAvailable,
  selectableSalesReps,
  snapshotRates,
} from "./salesRepCommission";

const orders = [
  { id: 1, totalAmount: 10000, status: "confirmed" },
  { id: 2, totalAmount: 500, status: "submitted" },
  { id: 3, totalAmount: 2000, status: "confirmed" },
];

describe("sales rep commission settings", () => {
  it("seeds $400 flat and 0.5% on confirmed order sales", () => {
    expect(SALES_REP_COMMISSION_DEFAULTS.flatFeeUsd).toBe(400);
    expect(SALES_REP_COMMISSION_DEFAULTS.residualRate).toBe(0.005);
    expect(SALES_REP_COMMISSION_DEFAULTS.residualBase).toBe("confirmed_order_gross");
    const settings = defaultCommissionSettings();
    expect(settings.repFeeUsd).toBeNull();
    expect(repFeeCheckoutAvailable(settings)).toBe(false);
  });

  it("uses the same confirmed gross as sumCommission", () => {
    expect(confirmedOrderGross(orders)).toBe(sumCommission(orders, 0.1).gross);
    expect(confirmedOrderGross(orders)).toBe(12000);
  });

  it("snapshots the rate onto the commission so a later edit does not rewrite it", () => {
    const original = snapshotRates(defaultCommissionSettings(), "2026-11-11T15:00:00.000Z");
    const edited = normalizeCommissionSettings({ flatFeeUsd: 50, residualRate: 0.1, residualBase: "confirmed_order_gross" });
    expect(edited.ok).toBe(true);
    const lines = residualLines(orders, original);
    expect(original.flatFeeCents).toBe(40000);
    expect(original.residualRateBps).toBe(50);
    expect(lines.map((line) => line.orderKey)).toEqual(["residual:order:1", "residual:order:3"]);
    expect(lines.map((line) => line.amountCents)).toEqual([5000, 1000]);
    expect(lines.every((line) => line.residualRateBps === 50)).toBe(true);
    if (edited.ok) {
      const later = snapshotRates(edited.settings, "2026-12-01T00:00:00.000Z");
      expect(later.flatFeeCents).toBe(5000);
      expect(later.residualRateBps).toBe(1000);
      expect(original.flatFeeCents).toBe(40000);
    }
  });

  it("only counts approved reps as selectable", () => {
    const reps = [
      { id: 1, status: "approved" as const },
      { id: 2, status: "pending" as const },
      { id: 3, status: "rejected" as const },
    ];
    expect(selectableSalesReps(reps).map((rep) => rep.id)).toEqual([1]);
  });
});
