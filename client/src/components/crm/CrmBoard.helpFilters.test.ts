import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CrmBoard.tsx", import.meta.url), "utf8");

describe("CRM help filters", () => {
  it("offers separate accessible Design Help and Shipping Cost Help filters", () => {
    expect(source).toContain('aria-label="Filter deals by help type"');
    expect(source).toContain('value="design"');
    expect(source).toContain("Needs Design Help");
    expect(source).toContain('value="shipping"');
    expect(source).toContain("Needs Shipping Cost Help");
  });

  it("filters the CRM board before its stage counts and columns are calculated", () => {
    expect(source).toContain("filterDealsByHelpType(deals, helpFilter)");
    expect(source).toContain("for (const d of filteredDeals)");
  });
});
