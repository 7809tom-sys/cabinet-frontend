import { describe, expect, it } from "vitest";
import {
  formatVendorCostCents,
  resolveVendorCost,
  summarizeVendorCosts,
  vendorCostFactor,
  vendorCostReport,
  vendorsWithoutFactor,
  vendorCostKindLabel,
} from "./vendorCost";

describe("the landed-cost factor", () => {
  it("is base × (1 + freight), as the Multipliers tab states", () => {
    expect(vendorCostFactor(0.63, 0.05)).toBeCloseTo(0.6615, 6);
    expect(vendorCostFactor(0.59, 0)).toBeCloseTo(0.59, 6);
    expect(vendorCostFactor(0.6, null)).toBeCloseTo(0.6, 6);
  });

  it("reproduces CD-20261022-OLOUT's Ashford numbers", () => {
    // The order: distributor cost $284.39, list price $449.34.
    // cost / list = 284.39 / 449.34 = 0.632906, so Ashford's landed factor is
    // 0.6329 (cost is 63.29% of list; the sell side is the inverse, 1/0.6329 =
    // 1.58). 449.34 × 0.6329 = 284.3873 → $284.39, which is the real cost.
    const factor = vendorCostFactor(0.6329, 0);
    expect(factor).toBeCloseTo(0.6329, 6);
    const result = resolveVendorCost(null, 449.34, factor);
    expect(result.kind).toBe("calculated");
    expect(result.cents).toBe(28439);
  });

  it("rebuilds the cost through base and freight", () => {
    // base 0.6329 with a 0 freight rate is the Ashford line as configured.
    expect(vendorCostFactor(0.6329, 0)).toBeCloseTo(0.6329, 6);
    // A 5% tariff on the same base costs 0.664545 of list.
    const withTariff = vendorCostFactor(0.6329, 0.05)!;
    expect(withTariff).toBeCloseTo(0.664545, 5);
    expect(resolveVendorCost(null, 449.34, withTariff).cents).toBe(29861);
  });

  it("refuses a factor outside the sane range", () => {
    expect(vendorCostFactor(0, 0)).toBeNull();
    expect(vendorCostFactor(null, 0.05)).toBeNull();
    expect(vendorCostFactor(1.5, 0)).toBeNull();
    expect(vendorCostFactor(0.005, 0)).toBeNull();
  });

  it("rejects the inverse (sell-side) factor as out of range", () => {
    // 1.58 is cost-to-sell, not cost-of-list. Feeding it in would produce a cost
    // above the list price, so the bounds reject it instead.
    expect(vendorCostFactor(1.58, 0)).toBeNull();
  });
});

describe("resolving one row's cost", () => {
  it("prefers the stored cost and labels it 'on file'", () => {
    const result = resolveVendorCost(284.39, 449.34, 0.63);
    expect(result).toMatchObject({ kind: "on_file", cents: 28439 });
    expect(vendorCostKindLabel(result.kind)).toBe("on file");
    expect(formatVendorCostCents(result)).toBe("$284.39");
  });

  it("calculates from the list price when no cost is stored", () => {
    const result = resolveVendorCost(null, 449.34, 0.63);
    expect(result.kind).toBe("calculated");
    expect(result.cents).toBe(28308);
    expect(vendorCostKindLabel(result.kind)).toBe("calculated");
    expect(result.note).toContain("$449.34");
    expect(result.note).toContain("0.63");
  });

  it("shows an em dash when there is no cost and no factor", () => {
    const result = resolveVendorCost(null, 449.34, null);
    expect(result).toMatchObject({ kind: "missing", cents: null });
    expect(formatVendorCostCents(result)).toBe("—");
    expect(result.note).toContain("no cost factor");
  });

  it("never copies the list price as the cost", () => {
    const noCost = resolveVendorCost(null, 449.34, null);
    expect(noCost.cents).not.toBe(44934);
    // Even a stored zero is not a cost.
    expect(resolveVendorCost(0, 449.34, null).kind).toBe("missing");
  });

  it("shows an em dash when there is no list price to calculate from", () => {
    expect(resolveVendorCost(null, null, 0.63)).toMatchObject({ kind: "missing", cents: null });
    expect(resolveVendorCost(null, 0, 0.63).kind).toBe("missing");
  });

  it("accepts string amounts with currency formatting", () => {
    expect(resolveVendorCost("$284.39", "449.34", 0.63)).toMatchObject({ kind: "on_file", cents: 28439 });
    expect(resolveVendorCost(null, "1,449.34", 0.5).cents).toBe(72467);
  });
});

describe("vendor coverage summary", () => {
  it("counts each kind and the coverage percent", () => {
    const summary = summarizeVendorCosts([
      resolveVendorCost(100, 200, 0.5),
      resolveVendorCost(null, 200, 0.5),
      resolveVendorCost(null, 200, null),
      resolveVendorCost(null, 200, null),
    ]);
    expect(summary).toEqual({ onFile: 1, calculated: 1, missing: 2, coveragePercent: 50 });
  });

  it("is zero for no rows", () => {
    expect(summarizeVendorCosts([]).coveragePercent).toBe(0);
  });
});

describe("per-vendor report", () => {
  it("states the factor and its source for a vendor that has one", () => {
    const report = vendorCostReport({
      vendorId: 210001,
      vendorName: "Ashford",
      baseMultiplier: 0.6329,
      freightMultiplier: 0,
      rows: [
        { vendorWholesale: 284.39, listPrice: 449.34 },
        { vendorWholesale: null, listPrice: 449.34 },
        { vendorWholesale: null, listPrice: null },
      ],
    });
    expect(report.factor).toBeCloseTo(0.6329, 6);
    expect(report.factorSource).toBe("Distributor Multipliers base multiplier");
    expect(report).toMatchObject({ rows: 3, onFile: 1, calculated: 1, missing: 1 });
  });

  it("mentions freight when the vendor has a freight rate", () => {
    const report = vendorCostReport({ vendorId: 1, vendorName: "X", baseMultiplier: 0.6, freightMultiplier: 0.05, rows: [] });
    expect(report.factorSource).toContain("freight rate");
  });

  it("reports a vendor with no factor as unset and lists every unpriced row as missing", () => {
    const report = vendorCostReport({
      vendorId: 2,
      vendorName: "Clark and Son",
      baseMultiplier: null,
      freightMultiplier: null,
      rows: [{ vendorWholesale: null, listPrice: 100 }, { vendorWholesale: 50, listPrice: 100 }],
    });
    expect(report.factor).toBeNull();
    expect(report.factorSource).toBe("no cost factor set on Distributor Multipliers");
    expect(report).toMatchObject({ onFile: 1, calculated: 0, missing: 1, coveragePercent: 50 });
  });

  it("lists exactly the vendors that still cannot price a row", () => {
    const withFactor = vendorCostReport({ vendorId: 1, vendorName: "Ashford", baseMultiplier: 0.6329, rows: [{ vendorWholesale: null, listPrice: 100 }] });
    const noFactor = vendorCostReport({ vendorId: 2, vendorName: "Clark and Son", rows: [{ vendorWholesale: null, listPrice: 100 }] });
    const fullyStored = vendorCostReport({ vendorId: 3, vendorName: "Preston", rows: [{ vendorWholesale: 50, listPrice: 100 }] });
    expect(vendorsWithoutFactor([withFactor, noFactor, fullyStored]).map((report) => report.vendorName)).toEqual(["Clark and Son"]);
  });
});
