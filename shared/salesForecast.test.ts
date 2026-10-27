import { describe, expect, it } from "vitest";
import { PLACEHOLDER_CLOSE_BRACKETS } from "./closeRateBrackets";
import {
  aggregateForecast,
  designUpdatedOnOrAfter,
  filterForecastMaterials,
  forecastProductEditTarget,
  MISSING_CATEGORY_FILTER,
  monthsBefore,
  projectForecastForScopes,
  savedRangeForPreset,
  sumForecastMaterials,
  validateVendorForecastPercent,
  vendorMaySetForecastRate,
  type ForecastDesignMeta,
  type ForecastLine,
} from "./salesForecast";
import { distributorScope, PELICAN_SCOPE } from "./vendorFulfillment";

const NOW = new Date("2026-04-01T00:00:00Z");

function design(partial: Partial<ForecastDesignMeta> & Pick<ForecastDesignMeta, "id">): ForecastDesignMeta {
  return {
    name: `Design ${partial.id}`,
    updatedAt: "2026-03-20T00:00:00Z",
    customerName: "Private Customer",
    styleName: "Shaker",
    color: "White",
    seriesName: "Series A",
    customerType: "homeowner",
    status: "saved",
    ordered: false,
    crmStage: null,
    ...partial,
  };
}

function line(partial: Partial<ForecastLine> & Pick<ForecastLine, "designId" | "scope" | "sku">): ForecastLine {
  return {
    description: partial.sku,
    supplierName: partial.scope === PELICAN_SCOPE ? "Pelican" : "Cabinet Co",
    category: "cabinet",
    color: "White",
    styleName: "Shaker",
    seriesName: "Series A",
    quantity: 1,
    estimated: false,
    listPrice: 100,
    vendorWholesale: 80,
    ...partial,
  };
}

describe("sales forecast weighting and isolation", () => {
  const cabinet = distributorScope(11);
  const other = distributorScope(22);

  it("drops ordered and lost and leaves weighted blank until the vendor enters a percent", () => {
    const result = aggregateForecast({
      now: NOW,
      homeownerMarkupBps: 20000,
      brackets: PLACEHOLDER_CLOSE_BRACKETS,
      designs: [
        design({ id: 1, updatedAt: "2026-03-20T00:00:00Z" }),
        design({ id: 2, ordered: true, status: "ordered" }),
        design({ id: 3, crmStage: "lost", status: "lost" }),
        design({ id: 4, crmStage: "won", status: "won", updatedAt: "2025-01-01T00:00:00Z" }),
      ],
      lines: [
        line({ designId: 1, scope: cabinet, sku: "B24", quantity: 10 }),
        line({ designId: 2, scope: cabinet, sku: "B24", quantity: 99 }),
        line({ designId: 3, scope: cabinet, sku: "B24", quantity: 99 }),
        line({ designId: 4, scope: cabinet, sku: "B24", quantity: 4 }),
      ],
    });
    expect(result.excluded.ordered).toBe(1);
    expect(result.excluded.lost).toBe(1);
    const material = result.materials.find((row) => row.sku === "B24");
    expect(material?.quantity).toBe(14);
    // Company close-rate brackets are not applied. Weighted stays blank until a vendor percent is entered.
    expect(material?.weightedQuantity).toBeNull();
    expect(material?.vendorRatePercent).toBeNull();
    expect(material?.vendorCost).toBe(14 * 80);
    expect(material?.retailValue).toBe(14 * 160);
  });

  it("weights quantity and vendor cost by the vendor-entered percent only", () => {
    const aged = aggregateForecast({
      now: NOW,
      homeownerMarkupBps: 20000,
      brackets: PLACEHOLDER_CLOSE_BRACKETS,
      vendorRates: [{ scope: cabinet, percent: 75 }],
      designs: [design({ id: 1, updatedAt: "2025-01-01T00:00:00Z" })],
      lines: [line({ designId: 1, scope: cabinet, sku: "B24", quantity: 10, vendorWholesale: 80 })],
    });
    const fresh = aggregateForecast({
      now: NOW,
      homeownerMarkupBps: 20000,
      brackets: [{ minDays: 0, maxDays: null, closePercent: 10 }],
      vendorRates: [{ scope: cabinet, percent: 75 }],
      designs: [design({ id: 1, updatedAt: "2026-03-31T00:00:00Z" })],
      lines: [line({ designId: 1, scope: cabinet, sku: "B24", quantity: 10, vendorWholesale: 80 })],
    });
    expect(aged.materials[0]?.weightedQuantity).toBe(7.5);
    expect(fresh.materials[0]?.weightedQuantity).toBe(7.5);
    expect(aged.materials[0]?.weightedVendorCost).toBe(600);
    expect(aged.materials[0]?.vendorRatePercent).toBe(75);
  });

  it("does not fall back to retail when vendor cost is missing", () => {
    const result = aggregateForecast({
      now: NOW,
      homeownerMarkupBps: 20000,
      brackets: PLACEHOLDER_CLOSE_BRACKETS,
      vendorRates: [{ scope: cabinet, percent: 50 }],
      designs: [design({ id: 1 })],
      lines: [line({ designId: 1, scope: cabinet, sku: "B24", quantity: 2, vendorWholesale: null, listPrice: 500 })],
    });
    expect(result.materials[0]?.vendorCost).toBeNull();
    expect(result.materials[0]?.weightedVendorCost).toBeNull();
    expect(result.materials[0]?.retailValue).toBe(1000);
  });

  it("keeps missing style and color in the unspecified bucket", () => {
    const result = aggregateForecast({
      now: NOW,
      homeownerMarkupBps: 10000,
      brackets: PLACEHOLDER_CLOSE_BRACKETS,
      designs: [design({ id: 1, styleName: "", color: "" })],
      lines: [line({ designId: 1, scope: cabinet, sku: "B12", color: "", styleName: "" })],
    });
    expect(result.materials[0]).toMatchObject({ color: "unspecified", styleName: "unspecified" });
  });

  it("shows a cabinet vendor only its lines and hides the customer", () => {
    const result = aggregateForecast({
      now: NOW,
      homeownerMarkupBps: 10000,
      brackets: PLACEHOLDER_CLOSE_BRACKETS,
      designs: [design({ id: 1 })],
      lines: [
        line({ designId: 1, scope: cabinet, sku: "B24" }),
        line({ designId: 1, scope: PELICAN_SCOPE, sku: "PEL-9", category: "countertop" }),
        line({ designId: 1, scope: null, sku: "MYSTERY" }),
      ],
    });
    const vendor = projectForecastForScopes(result, [cabinet]);
    expect(vendor.materials.map((row) => row.sku)).toEqual(["B24"]);
    expect(vendor.unassigned).toEqual([]);
    expect(vendor.designs[0]?.customerName).toBeNull();
    expect(result.unassigned.map((row) => row.sku)).toEqual(["MYSTERY"]);
    expect(result.designs[0]?.customerName).toBe("Private Customer");
  });

  it("does not let the other cabinet vendor see the first vendor or the countertop vendor", () => {
    const result = aggregateForecast({
      now: NOW,
      homeownerMarkupBps: 10000,
      brackets: PLACEHOLDER_CLOSE_BRACKETS,
      filters: { supplierScopes: [other] },
      designs: [design({ id: 1 })],
      lines: [
        line({ designId: 1, scope: cabinet, sku: "B24" }),
        line({ designId: 1, scope: PELICAN_SCOPE, sku: "PEL-9" }),
      ],
    });
    expect(result.matched).toBe(0);
    expect(result.materials).toEqual([]);
  });

  it("uses calendar cutoffs for the last 2 and last 3 months", () => {
    const now = new Date("2026-04-15T00:00:00.000Z");
    expect(monthsBefore(now, 2).toISOString()).toBe("2026-02-15T00:00:00.000Z");
    expect(monthsBefore(now, 3).toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(monthsBefore(new Date("2026-03-31T00:00:00.000Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");

    const two = savedRangeForPreset("2m", now);
    const three = savedRangeForPreset("3m", now);
    const justInsideTwo = "2026-02-15T00:00:00.000Z";
    const betweenTwoAndThree = "2026-01-20T00:00:00.000Z";
    const olderThanThree = "2026-01-14T23:59:59.000Z";
    expect(designUpdatedOnOrAfter(justInsideTwo, new Date(two.savedFrom!))).toBe(true);
    expect(designUpdatedOnOrAfter(betweenTwoAndThree, new Date(two.savedFrom!))).toBe(false);
    expect(designUpdatedOnOrAfter(betweenTwoAndThree, new Date(three.savedFrom!))).toBe(true);
    expect(designUpdatedOnOrAfter(olderThanThree, new Date(three.savedFrom!))).toBe(false);

    const designs = [
      design({ id: 1, updatedAt: justInsideTwo, styleName: "Shaker" }),
      design({ id: 2, updatedAt: betweenTwoAndThree, styleName: "Shaker" }),
      design({ id: 3, updatedAt: olderThanThree, styleName: "Slab" }),
    ];
    const lines = designs.map((item) => line({ designId: item.id, scope: cabinet, sku: `SKU-${item.id}`, quantity: 1 }));
    const lastTwo = aggregateForecast({
      now,
      homeownerMarkupBps: 10000,
      brackets: PLACEHOLDER_CLOSE_BRACKETS,
      filters: { savedFrom: two.savedFrom, savedTo: two.savedTo },
      designs,
      lines,
    });
    const lastThree = aggregateForecast({
      now,
      homeownerMarkupBps: 10000,
      brackets: PLACEHOLDER_CLOSE_BRACKETS,
      filters: { savedFrom: three.savedFrom, savedTo: three.savedTo },
      designs,
      lines,
    });
    expect(lastTwo.materials.map((row) => row.sku)).toEqual(["SKU-1"]);
    expect(lastThree.materials.map((row) => row.sku)).toEqual(["SKU-1", "SKU-2"]);
    expect(savedRangeForPreset("all", now)).toEqual({ savedFrom: null, savedTo: null });
  });

  it("filters by door style and by the categories present on the lines", () => {
    const result = aggregateForecast({
      now: NOW,
      homeownerMarkupBps: 10000,
      brackets: PLACEHOLDER_CLOSE_BRACKETS,
      vendorRates: [{ scope: PELICAN_SCOPE, percent: 50 }],
      filters: { doorStyles: ["Shaker"], categories: ["Flooring"] },
      designs: [
        design({ id: 1, styleName: "Shaker" }),
        design({ id: 2, styleName: "Slab" }),
      ],
      lines: [
        line({ designId: 1, scope: PELICAN_SCOPE, sku: "PEL-1", category: "Flooring", quantity: 4, vendorWholesale: 10, supplierName: "Pelican" }),
        line({ designId: 1, scope: PELICAN_SCOPE, sku: "PEL-2", category: "Faucets", quantity: 9, vendorWholesale: 10, supplierName: "Pelican" }),
        line({ designId: 2, scope: PELICAN_SCOPE, sku: "PEL-3", category: "Flooring", quantity: 8, vendorWholesale: 10, supplierName: "Pelican" }),
      ],
    });
    expect(result.facets.categories).toEqual(["Faucets", "Flooring"]);
    expect(result.facets.doorStyles).toEqual(["Shaker", "Slab"]);
    expect(result.materials.map((row) => row.sku)).toEqual(["PEL-1"]);
    expect(result.materials[0]?.quantity).toBe(4);
    expect(result.materials[0]?.weightedQuantity).toBe(2);
    expect(sumForecastMaterials(result.materials).vendorCost).toBe(40);
    expect(sumForecastMaterials(result.materials).weightedVendorCost).toBe(20);
  });

  it("reports a missing product category instead of inventing one", () => {
    const result = aggregateForecast({
      now: NOW,
      homeownerMarkupBps: 10000,
      brackets: PLACEHOLDER_CLOSE_BRACKETS,
      designs: [design({ id: 1 })],
      lines: [line({ designId: 1, scope: cabinet, sku: "B24", category: "", categoryMissing: true })],
    });
    expect(result.materials[0]?.category).toBe("");
    expect(result.materials[0]?.categoryMissing).toBe(true);
    expect(result.facets.categories).toEqual([]);
    expect(result.facets.missingCategory).toBe(true);
    const onlyMissing = aggregateForecast({
      now: NOW,
      homeownerMarkupBps: 10000,
      brackets: PLACEHOLDER_CLOSE_BRACKETS,
      filters: { categories: [MISSING_CATEGORY_FILTER] },
      designs: [design({ id: 1 })],
      lines: [
        line({ designId: 1, scope: cabinet, sku: "B24", category: "", categoryMissing: true, quantity: 2 }),
        line({ designId: 1, scope: cabinet, sku: "PEL-9", category: "Flooring", quantity: 5 }),
      ],
    });
    expect(onlyMissing.materials.map((row) => row.sku)).toEqual(["B24"]);
  });

  it("searches sku, description, and supplier and applies a quantity range to the visible totals", () => {
    const result = aggregateForecast({
      now: NOW,
      homeownerMarkupBps: 10000,
      brackets: PLACEHOLDER_CLOSE_BRACKETS,
      filters: { query: "oak" },
      designs: [design({ id: 1 })],
      lines: [
        line({ designId: 1, scope: cabinet, sku: "B24", description: "Oak base", quantity: 2, vendorWholesale: 10 }),
        line({ designId: 1, scope: cabinet, sku: "W30", description: "Maple wall", quantity: 8, vendorWholesale: 10 }),
      ],
    });
    expect(result.materials.map((row) => row.sku)).toEqual(["B24"]);
    const ranged = filterForecastMaterials(
      [
        { ...result.materials[0]!, quantity: 2 },
        { ...result.materials[0]!, sku: "W30", quantity: 8 },
      ],
      { qtyMin: 3, qtyMax: 10 },
    );
    expect(ranged.map((row) => row.sku)).toEqual(["W30"]);
    expect(sumForecastMaterials(ranged).quantity).toBe(8);
  });

  it("rejects a forecast percent outside 0 to 100 and links a row to its catalog product", () => {
    expect(validateVendorForecastPercent(-1)).toMatch(/0 and 100/);
    expect(validateVendorForecastPercent(101)).toMatch(/0 and 100/);
    expect(validateVendorForecastPercent(null)).toBeNull();
    expect(validateVendorForecastPercent(75)).toBeNull();
    expect(vendorMaySetForecastRate({ role: "distributor", scope: cabinet, allowedScopes: [cabinet] })).toBeNull();
    expect(vendorMaySetForecastRate({ role: "distributor", scope: other, allowedScopes: [cabinet] })).toMatch(/not linked/);
    expect(vendorMaySetForecastRate({ role: "admin", scope: cabinet, allowedScopes: [cabinet] })).toMatch(/Only the vendor/);
    expect(vendorMaySetForecastRate({ role: "sales_rep", scope: cabinet, allowedScopes: [cabinet] })).toMatch(/Only the vendor/);
    expect(forecastProductEditTarget({ catalogProductKind: "pelican", catalogProductId: 9, sku: "PEL-9" })).toEqual({ section: "catalog", edit: 9 });
    expect(forecastProductEditTarget({ catalogProductKind: "cabinet_sku", catalogProductId: 4, sku: "B24" })).toEqual({ section: "catalog", sku: "B24" });
    expect(forecastProductEditTarget({ catalogProductKind: null, catalogProductId: null, sku: "TK-8" })).toBeNull();
  });
});
