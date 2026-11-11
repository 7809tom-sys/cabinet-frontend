import { describe, expect, it } from "vitest";
import {
  SALES_REP_COMMISSION_DEFAULTS,
  defaultCommissionSettings,
  normalizeCommissionSettings,
  residualLines,
  resolveMaterialSubtotal,
  repFeeCheckoutAvailable,
  selectableSalesReps,
  snapshotRates,
} from "./salesRepCommission";

describe("sales rep commission settings", () => {
  it("seeds $400 flat and 0.5% of material sales", () => {
    expect(SALES_REP_COMMISSION_DEFAULTS.flatFeeUsd).toBe(400);
    expect(SALES_REP_COMMISSION_DEFAULTS.residualRate).toBe(0.005);
    expect(SALES_REP_COMMISSION_DEFAULTS.residualBase).toBe("confirmed_material_subtotal");
    const settings = defaultCommissionSettings();
    expect(settings.repFeeUsd).toBeNull();
    expect(repFeeCheckoutAvailable(settings)).toBe(false);
  });

  it("snapshots the rate onto the commission so a later edit does not rewrite it", () => {
    const original = snapshotRates(defaultCommissionSettings(), "2026-11-11T15:00:00.000Z");
    const edited = normalizeCommissionSettings({ flatFeeUsd: 50, residualRate: 0.1, residualBase: "confirmed_material_subtotal" });
    expect(edited.ok).toBe(true);
    expect(original.flatFeeCents).toBe(40000);
    expect(original.residualRateBps).toBe(50);
    if (edited.ok) {
      const later = snapshotRates(edited.settings, "2026-12-01T00:00:00.000Z");
      expect(later.flatFeeCents).toBe(5000);
      expect(later.residualRateBps).toBe(1000);
      expect(original.flatFeeCents).toBe(40000);
    }
  });

  it("pays 0.5% of the material subtotal and leaves freight, tax, and fees out", () => {
    const snapshot = snapshotRates(defaultCommissionSettings(), "2026-11-11T15:00:00.000Z");
    const result = residualLines([
      {
        id: 1,
        status: "confirmed",
        totalAmount: 18000,
        lineItems: [
          { description: "Base cabinet", linePrice: 10000 },
          { description: "Wall cabinet", linePrice: 2000 },
          { description: "LTL Freight Shipping", linePrice: 500 },
          { description: "Sales tax", linePrice: 800 },
          { productKind: "tech_fee", linePrice: 100 },
        ],
      },
      { id: 2, status: "submitted", lineItems: [{ linePrice: 9000 }] },
    ], snapshot);
    expect(result.lines).toEqual([
      expect.objectContaining({
        orderKey: "residual:order:1",
        materialSubtotalCents: 1_200_000,
        amountCents: 6000,
        residualRateBps: 50,
      }),
    ]);
    expect(result.flagged).toEqual([]);
  });

  it("uses a stored material subtotal and does not guess from the order total", () => {
    const stored = resolveMaterialSubtotal({
      id: 4,
      status: "confirmed",
      materialSubtotalCents: 250000,
      totalAmount: 9000,
    });
    expect(stored).toEqual({ ok: true, materialSubtotalCents: 250000, source: "stored" });

    const missing = resolveMaterialSubtotal({
      id: 5,
      status: "confirmed",
      totalAmount: 9000,
      lineItems: [],
    });
    expect(missing).toEqual({ ok: false, reason: "material_subtotal_missing" });

    const incomplete = resolveMaterialSubtotal({
      id: 6,
      status: "confirmed",
      totalAmount: 4000,
      lineItems: [{ description: "Cabinet", linePrice: null, unitPrice: null }],
    });
    expect(incomplete).toEqual({ ok: false, reason: "material_subtotal_missing" });

    const snapshot = snapshotRates(defaultCommissionSettings(), "2026-11-11T15:00:00.000Z");
    const result = residualLines([
      { id: 5, status: "confirmed", totalAmount: 9000 },
      { id: 4, status: "confirmed", materialSubtotalCents: 200000, totalAmount: 9000 },
    ], snapshot);
    expect(result.flagged.map((row) => row.orderKey)).toEqual(["residual:order:5"]);
    expect(result.lines.map((row) => row.amountCents)).toEqual([1000]);
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
