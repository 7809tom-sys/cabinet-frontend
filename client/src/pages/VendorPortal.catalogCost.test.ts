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
    const list = source.indexOf('<TableHead className="text-right">List</TableHead>');
    // There is another Cost column earlier in the file (the Pelican table), so
    // look for the one in the cabinet table, after List.
    const cost = source.indexOf('<TableHead className="text-right">Cost</TableHead>', list);
    const wholesale = source.indexOf('<TableHead className="text-right">Wholesale</TableHead>', list);
    expect(list).toBeGreaterThan(-1);
    expect(cost).toBeGreaterThan(list);
    expect(wholesale).toBeGreaterThan(cost);
    // Nothing but whitespace between List and Cost: they are adjacent.
    const between = source.slice(list + '<TableHead className="text-right">List</TableHead>'.length, cost);
    expect(between.trim()).toBe("");
  });

  it("renders the Cost cell beside the List cell", () => {
    expect(headerIndex).toBeGreaterThan(-1);
    expect(source.indexOf("item.listPrice")).toBeLessThan(headerIndex);
    expect(source.indexOf('field: "wholesalePrice"')).toBeGreaterThan(headerIndex);
  });

  it("resolves cost from the shared module rather than computing inline", () => {
    expect(source).toContain("resolveVendorCost(item.vendorWholesale, item.listPrice, lineCostFactor)");
    expect(source).toContain("formatVendorCostCents(cost)");
    expect(source).toContain("vendorCostKindLabel(cost.kind)");
  });

  it("labels a computed figure 'calculated' so it is never mistaken for a real cost", () => {
    expect(source).toContain("vendorCostKindLabel");
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
