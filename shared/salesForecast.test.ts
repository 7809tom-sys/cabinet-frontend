import { describe, expect, it } from "vitest";
import { PLACEHOLDER_CLOSE_BRACKETS } from "./closeRateBrackets";
import { aggregateForecast, projectForecastForScopes, type ForecastDesignMeta, type ForecastLine } from "./salesForecast";
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

  it("weights by age, forces won to 100%, and drops ordered and lost", () => {
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
    // Design 1 is 12 days old → 70%. Design 4 is won → 100% of 4.
    expect(material?.weightedQuantity).toBe(10 * 0.7 + 4);
    expect(material?.retailValue).toBe(14 * 160);
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
});
