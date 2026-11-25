import { describe, expect, it } from "vitest";
import { filterDistributorProspects, isDistributorProspect } from "./crmDistributorFilter";

describe("isDistributorProspect", () => {
  it("matches both distributor prospect company tags, any case", () => {
    expect(isDistributorProspect({ company: "Distributor prospect" })).toBe(true);
    expect(isDistributorProspect({ company: "Distributor prospect - needs new site" })).toBe(true);
    expect(isDistributorProspect({ company: "  distributor PROSPECT " })).toBe(true);
  });

  it("matches the master list marker in notes", () => {
    expect(isDistributorProspect({ company: "Acme", notes: "Customer list import: distributor_master_list_2026-11-24\nRank 3" })).toBe(true);
  });

  it("leaves regular sales contacts out", () => {
    expect(isDistributorProspect({ company: "Smith Remodeling", notes: "Wants a quote" })).toBe(false);
    expect(isDistributorProspect({ company: null, notes: null })).toBe(false);
    expect(isDistributorProspect({ company: "Prospect distributor" })).toBe(false);
  });
});

describe("filterDistributorProspects", () => {
  it("keeps only distributor prospects in order", () => {
    const deals = [
      { id: 1, company: "Distributor prospect", notes: null },
      { id: 2, company: "Homeowner", notes: null },
      { id: 3, company: null, notes: "distributor_master_list_2026-11-24" },
    ];
    expect(filterDistributorProspects(deals).map((d) => d.id)).toEqual([1, 3]);
  });
});
