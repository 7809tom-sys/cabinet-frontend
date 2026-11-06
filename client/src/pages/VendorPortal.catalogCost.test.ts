import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./VendorPortal.tsx", import.meta.url), "utf8");

/**
 * The admin/vendor catalog table shows List and Cost side by side. Cost is the
 * SKU's stored vendorWholesale when one exists, and otherwise list × this line's
 * landed-cost factor, labelled "calculated". A row with neither shows "—".
 */
describe("vendor catalog List and Cost columns", () => {
  const headerIndex = source.indexOf('data-testid="cabinet-catalog-cost"');

  it("puts Cost immediately after List in the header row", () => {
    const list = source.indexOf("VENDOR_CATALOG_WIDTHS.list} text-right`}>List</TableHead>");
    const cost = source.indexOf("VENDOR_CATALOG_WIDTHS.cost} text-right`}>Cost</TableHead>");
    const wholesale = source.indexOf("VENDOR_CATALOG_WIDTHS.wholesale} text-right`}>Wholesale</TableHead>");
    expect(list).toBeGreaterThan(-1);
    expect(cost).toBeGreaterThan(list);
    expect(wholesale).toBeGreaterThan(cost);
    // The slice starts inside the List tag, so it may close it; what matters is
    // that no other header opens between the two.
    expect(source.slice(list, cost).split("<TableHead").length - 1).toBeLessThanOrEqual(1);
  });

  it("renders the Cost cell beside the List cell", () => {
    expect(headerIndex).toBeGreaterThan(-1);
    expect(source.indexOf("item.listPrice")).toBeLessThan(headerIndex);
    expect(source.indexOf('field: "wholesalePrice"')).toBeGreaterThan(headerIndex);
  });

  it("resolves cost from the shared module rather than computing inline", () => {
    expect(source).toContain("resolveVendorCost(item.vendorWholesale, item.listPrice, lineCostFactor)");
    expect(source).toContain("formatVendorCostCents(cost)");
  });

  it("still distinguishes a computed figure from a real one", () => {
    // The "calculated" wording lives in the tooltip note so the 72px column does
    // not overflow; the marker and the italic style carry it visually.
    expect(source).toContain("cost.note");
    expect(source).toContain('cost.kind === "calculated"');
  });

  it("derives the factor from this supply line's multipliers only", () => {
    expect(source).toContain("vendorCostFactor(");
    expect(source).toContain("baseMultiplier");
    expect(source).toContain("freightMultiplier");
  });

  it("has no inline fallback that would copy the list price into Cost", () => {
    expect(source).not.toContain("item.vendorWholesale ?? item.listPrice");
    expect(source).not.toContain("formatVendorCost(item.vendorWholesale ?? item.listPrice)");
  });
});
